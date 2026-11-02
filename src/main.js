const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const store = require('./state-store');

const WIN_W = 220;
const WIN_H = 220;

const WALK_MIN_INTERVAL = 8000;
const WALK_MAX_INTERVAL = 15000;
const WALK_MIN_DIST = 40;
const WALK_MAX_DIST = 120;
const WALK_FRAME_MS = 16;
const WALK_SPEED_PX_PER_SEC = 90;

let win = null;
let dragState = null;
let walkTimer = null;
let walkAnimTimer = null;
let walk = null;

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clampToWorkArea(x, y, w, h) {
  const cx = Math.round(x + w / 2);
  const cy = Math.round(y + h / 2);
  const display = screen.getDisplayNearestPoint({ x: cx, y: cy });
  const wa = display.workArea;
  const maxX = Math.max(wa.x, wa.x + wa.width - w);
  const maxY = Math.max(wa.y, wa.y + wa.height - h);
  return {
    x: Math.min(Math.max(Math.round(x), wa.x), maxX),
    y: Math.min(Math.max(Math.round(y), wa.y), maxY)
  };
}

function createWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  const saved = store.getState();

  const fallback = clampToWorkArea(
    wa.x + wa.width - WIN_W - 40,
    wa.y + wa.height - WIN_H - 40,
    WIN_W, WIN_H
  );

  const startPos =
    Number.isFinite(saved.x) && Number.isFinite(saved.y)
      ? clampToWorkArea(saved.x, saved.y, WIN_W, WIN_H)
      : fallback;

  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x: startPos.x,
    y: startPos.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.setIgnoreMouseEvents(false);

  win.webContents.on('did-finish-load', () => {
    scheduleNextWalk();
  });

  win.on('close', () => {
    clearAllTimers();
    try {
      const [x, y] = win.getPosition();
      store.setPosition(x, y);
    } catch (err) {
      console.error('[main] save position on close failed:', err);
    }
    store.flush();
  });

  win.on('closed', () => {
    clearAllTimers();
    win = null;
  });
}

function scheduleNextWalk() {
  if (!win || win.isDestroyed()) return;
  cancelNextWalk();
  const delay = rand(WALK_MIN_INTERVAL, WALK_MAX_INTERVAL);
  walkTimer = setTimeout(() => {
    walkTimer = null;
    startWalk();
  }, delay);
}

function cancelNextWalk() {
  if (walkTimer) {
    clearTimeout(walkTimer);
    walkTimer = null;
  }
}

function startWalk() {
  if (!win || win.isDestroyed() || walk) return;

  const [cx, cy] = win.getPosition();
  const [w, h] = win.getSize();
  const display = screen.getDisplayNearestPoint({ x: cx + w / 2, y: cy + h / 2 });
  const wa = display.workArea;

  let dir = Math.random() < 0.5 ? -1 : 1;
  const dist = rand(WALK_MIN_DIST, WALK_MAX_DIST);
  let targetX = cx + dir * dist;

  if (targetX < wa.x) {
    dir = 1;
    targetX = cx + dist;
  } else if (targetX + w > wa.x + wa.width) {
    dir = -1;
    targetX = cx - dist;
  }

  const clamped = clampToWorkArea(targetX, cy, w, h);
  walk = { fromX: cx, fromY: cy, toX: clamped.x, toY: clamped.y, dir };

  store.setDir(dir);
  if (win.webContents && !win.webContents.isDestroyed()) {
    win.webContents.send('pet:walk-start', { dir });
  }

  const totalDist = Math.abs(walk.toX - walk.fromX);
  const duration = Math.max(300, (totalDist / WALK_SPEED_PX_PER_SEC) * 1000);
  const startTime = Date.now();

  if (walkAnimTimer) clearInterval(walkAnimTimer);
  walkAnimTimer = setInterval(() => {
    if (!win || win.isDestroyed() || !walk) {
      finishWalk();
      return;
    }
    const t = Math.min(1, (Date.now() - startTime) / duration);
    const nx = Math.round(walk.fromX + (walk.toX - walk.fromX) * t);
    win.setPosition(nx, walk.toY);
    if (t >= 1) {
      finishWalk();
      saveCurrentPosition();
      scheduleNextWalk();
    }
  }, WALK_FRAME_MS);
}

function finishWalk() {
  if (walkAnimTimer) {
    clearInterval(walkAnimTimer);
    walkAnimTimer = null;
  }
  const wasWalking = !!walk;
  walk = null;
  if (wasWalking && win && !win.isDestroyed() &&
      win.webContents && !win.webContents.isDestroyed()) {
    win.webContents.send('pet:walk-end', {});
  }
}

function saveCurrentPosition() {
  if (!win || win.isDestroyed()) return;
  try {
    const [x, y] = win.getPosition();
    store.setPosition(x, y);
  } catch (err) {
    console.error('[main] save position failed:', err);
  }
}

function clearAllTimers() {
  if (walkTimer) { clearTimeout(walkTimer); walkTimer = null; }
  if (walkAnimTimer) { clearInterval(walkAnimTimer); walkAnimTimer = null; }
  walk = null;
  dragState = null;
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  app.whenReady().then(() => {
    store.init();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    clearAllTimers();
    store.flush();
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    clearAllTimers();
    if (win && !win.isDestroyed()) saveCurrentPosition();
    store.flush();
  });

  ipcMain.on('pet:set-ignore-mouse', (_e, ignore) => {
    if (!win || win.isDestroyed()) return;
    win.setIgnoreMouseEvents(!!ignore, { forward: true });
  });

  ipcMain.handle('pet:get-state', () => {
    const s = store.getState();
    return { dir: s.dir === -1 ? -1 : 1 };
  });

  ipcMain.handle('pet:click', () => store.incrementClicks());

  ipcMain.on('pet:drag-start', (_e, payload) => {
    if (!win || win.isDestroyed()) return;
    cancelNextWalk();
    finishWalk();
    const [x, y] = win.getPosition();
    dragState = {
      startCursor: { x: payload.screenX, y: payload.screenY },
      startPos: { x, y }
    };
  });

  ipcMain.on('pet:drag-move', (_e, payload) => {
    if (!win || win.isDestroyed() || !dragState) return;
    const dx = payload.screenX - dragState.startCursor.x;
    const dy = payload.screenY - dragState.startCursor.y;
    const [w, h] = win.getSize();
    const next = clampToWorkArea(dragState.startPos.x + dx, dragState.startPos.y + dy, w, h);
    win.setPosition(next.x, next.y);
  });

  ipcMain.on('pet:drag-end', () => {
    dragState = null;
    saveCurrentPosition();
    if (win && !win.isDestroyed()) scheduleNextWalk();
  });

  ipcMain.on('pet:quit', () => {
    app.quit();
  });
}