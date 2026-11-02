const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULT_STATE = { x: null, y: null, dir: 1, clickCount: 0 };
const SAVE_DEBOUNCE_MS = 400;

let statePath = null;
let state = { ...DEFAULT_STATE };
let saveTimer = null;

function init() {
  try {
    statePath = path.join(app.getPath('userData'), 'pet-state.json');
  } catch (err) {
    console.error('[store] resolve userData failed:', err);
    statePath = null;
    return;
  }
  load();
}

function load() {
  if (!statePath) return;
  if (!fs.existsSync(statePath)) return;

  let parsed = null;
  try {
    const raw = fs.readFileSync(statePath, 'utf-8');
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error('[store] load failed, file may be corrupted:', err);
    try {
      const bad = statePath + '.bad';
      if (fs.existsSync(bad)) fs.unlinkSync(bad);
      fs.renameSync(statePath, bad);
    } catch (e) {
      console.error('[store] move bad file failed:', e);
    }
    state = { ...DEFAULT_STATE };
    return;
  }

  if (!parsed || typeof parsed !== 'object') {
    state = { ...DEFAULT_STATE };
    return;
  }

  state = {
    x: Number.isFinite(parsed.x) ? parsed.x : null,
    y: Number.isFinite(parsed.y) ? parsed.y : null,
    dir: parsed.dir === -1 ? -1 : 1,
    clickCount:
      Number.isFinite(parsed.clickCount) && parsed.clickCount >= 0
        ? Math.floor(parsed.clickCount)
        : 0
  };
}

function getState() {
  return { ...state };
}

function setPosition(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  state.x = Math.round(x);
  state.y = Math.round(y);
  scheduleSave();
}

function setDir(dir) {
  state.dir = dir === -1 ? -1 : 1;
  scheduleSave();
}

function incrementClicks() {
  state.clickCount += 1;
  scheduleSave();
  return state.clickCount;
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flush();
  }, SAVE_DEBOUNCE_MS);
}

function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!statePath) return;
  try {
    const tmp = statePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tmp, statePath);
  } catch (err) {
    console.error('[store] save failed:', err);
  }
}

module.exports = { init, getState, setPosition, setDir, incrementClicks, flush };