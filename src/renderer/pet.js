(function () {
  const pet = document.getElementById('pet');
  const bubble = document.getElementById('bubble');

  const LINES = [
    '你好呀～',
    '今天也要加油哦！',
    '摸摸我嘛～',
    '我想吃小鱼干。',
    '你在忙什么呀？',
    '嘿嘿，被你发现啦。',
    '好想出去玩～',
    '要不要休息一下？',
    '我在这儿陪着你～',
    '工作辛苦啦！'
  ];

  function applyDir(dir) {
    pet.classList.toggle('face-left', dir === -1);
    pet.classList.toggle('face-right', dir !== -1);
  }

  let ignoring = null;

  function setIgnore(next) {
    if (next === ignoring) return;
    ignoring = next;
    if (window.petAPI) window.petAPI.setIgnoreMouse(next);
  }

  function isOnPet(x, y) {
    const r = pet.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  let bubbleTimer = null;

  function say(text) {
    bubble.textContent = text;
    bubble.classList.add('show');
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => {
      bubble.classList.remove('show');
      bubbleTimer = null;
    }, 3000);
  }

  let talkTimer = null;

  function randMs(min, max) {
    return Math.random() * (max - min) + min;
  }

  function scheduleTalk() {
    if (talkTimer) clearTimeout(talkTimer);
    talkTimer = setTimeout(() => {
      talkTimer = null;
      const line = LINES[Math.floor(Math.random() * LINES.length)];
      say(line);
      scheduleTalk();
    }, randMs(20000, 40000));
  }

  let happyTimer = null;

  function triggerHappy() {
    pet.classList.add('happy');
    if (happyTimer) clearTimeout(happyTimer);
    happyTimer = setTimeout(() => {
      pet.classList.remove('happy');
      happyTimer = null;
    }, 1000);
  }

  const DRAG_THRESHOLD = 5;
  let pressed = false;
  let dragging = false;
  let startX = 0;
  let startY = 0;

  pet.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    pressed = true;
    dragging = false;
    startX = e.screenX;
    startY = e.screenY;
    setIgnore(false);
  });

  window.addEventListener('mousemove', (e) => {
    if (!pressed) return;
    const dx = e.screenX - startX;
    const dy = e.screenY - startY;
    if (!dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      dragging = true;
      if (window.petAPI) window.petAPI.dragStart(startX, startY);
    }
    if (dragging && window.petAPI) {
      window.petAPI.dragMove(e.screenX, e.screenY);
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (!pressed || e.button !== 0) return;
    pressed = false;
    if (dragging) {
      dragging = false;
      if (window.petAPI) window.petAPI.dragEnd();
      setIgnore(!isOnPet(e.clientX, e.clientY));
    } else {
      handleClick();
    }
  });

  window.addEventListener('blur', () => {
    if (!pressed) return;
    pressed = false;
    if (dragging) {
      dragging = false;
      if (window.petAPI) window.petAPI.dragEnd();
    }
  });

  async function handleClick() {
    triggerHappy();
    if (!window.petAPI) return;
    try {
      const count = await window.petAPI.click();
      say(`第 ${count} 次被摸到～`);
    } catch (err) {
      console.error('[pet] click report failed:', err);
      say('被摸到了～');
    }
  }

  let unsubWalkStart = null;
  let unsubWalkEnd = null;

  if (window.petAPI && window.petAPI.onWalkStart) {
    unsubWalkStart = window.petAPI.onWalkStart(({ dir }) => {
      pet.classList.remove('walking-left', 'walking-right');
      pet.classList.add(dir === 1 ? 'walking-right' : 'walking-left');
      applyDir(dir);
    });
  }
  if (window.petAPI && window.petAPI.onWalkEnd) {
    unsubWalkEnd = window.petAPI.onWalkEnd(() => {
      pet.classList.remove('walking-left', 'walking-right');
    });
  }

  window.addEventListener('mousemove', (e) => {
    if (pressed || dragging) return;
    setIgnore(!isOnPet(e.clientX, e.clientY));
  });

  window.addEventListener('mouseleave', () => {
    if (pressed || dragging) return;
    setIgnore(true);
  });

  async function bootstrap() {
    setIgnore(false);
    if (window.petAPI && window.petAPI.getState) {
      try {
        const state = await window.petAPI.getState();
        applyDir(state && state.dir === -1 ? -1 : 1);
      } catch (err) {
        console.error('[pet] load state failed:', err);
        applyDir(1);
      }
    } else {
      applyDir(1);
    }
    scheduleTalk();
  }

  window.addEventListener('beforeunload', () => {
    if (talkTimer) { clearTimeout(talkTimer); talkTimer = null; }
    if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null; }
    if (happyTimer) { clearTimeout(happyTimer); happyTimer = null; }
    if (typeof unsubWalkStart === 'function') { unsubWalkStart(); unsubWalkStart = null; }
    if (typeof unsubWalkEnd === 'function') { unsubWalkEnd(); unsubWalkEnd = null; }
  });

  bootstrap();
})();