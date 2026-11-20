import { Assets, loadPictureUrl } from './resources.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { SCREEN_W, SCREEN_H, Framebuffer, SAT } from './engine.js';
import {
  G, sat, setAssets, initResources, MakeMathTbl, LoadSounds, InitAllSprite,
  startGame, moveItStep, checkGameOver, updateScoreBoard, SetUpElement,
  snapshotGame, restoreGame,
} from './game.js';

const canvas = document.getElementById('game');
canvas.width = SCREEN_W;
canvas.height = SCREEN_H;
const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
const overlay = document.getElementById('overlay');

const input = new Input(canvas);
G.input = input;

let assets;
let audio;
let mode = 'title'; // title | game
let paused = false;
let gameOverHandled = false;
let lastTime = 0;
let accumulator = 0;
let saveAccumulator = 0;
const STEP = 1 / 30;
const SAVE_KEY = 'mozpong.save';

// Mobile presentation layout: the 376x400 playfield is scaled to 512x545 and
// the right-hand HUD is rearranged into a 512x180 top bar.
const MOBILE_LAYOUT = {
  topPad: 14,
  topH: 170,
  sourceW: 376,
  sourceH: 400,
  playX: 0,
  playY: 184,
  playH: 400,
  // HUD source panel is x=378..511. The score/Butasan panel (source y=0..95)
  // maps to x=198..332; the spinner panel (source y=95..270) maps to x=44..178.
  hudX: 378,
  spinnerY: 95,
  spinnerDx: 44,
  scoreDx: 198,
  spinnerDy: -4,
  scoreDy: 1,
};
const MOBILE_W = 376;
const MOBILE_H = 584; // 14 px top pad + 170 px HUD + 400 px playfield
let layoutMode = 'desktop';
let mobileFb = null;
let mobileBg = null;

const DEFAULT_PREF = {
  version: 60,
  sound: 1,
  music: 1,
  layout: 'desktop',
  depthAlert: 1,
  ignoreOthers: 0,
  highscores: [50000, 40000, 30000, 20000, 10000],
  names: ['MozMoz', 'MozMoz', 'MozMoz', 'MozMoz', 'MozMoz'],
  stages: [5, 5, 5, 5, 5],
  maxStage: 1,
  lastHighScoreName: 'MozMoz',
};

function loadPref() {
  let p = { ...DEFAULT_PREF };
  try {
    const raw = localStorage.getItem('mozpong.pref');
    if (raw) p = { ...p, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  if (p.layout !== 'mobile' && p.layout !== 'desktop') p.layout = 'desktop';
  // The original pref record stores the last name entered in the high-score
  // dialog at +0x53E and pre-fills the next dialog from it.  ResetPref seeds
  // it from the localized default ("MozMoz" in the English resources).
  if (typeof p.lastHighScoreName !== 'string') p.lastHighScoreName = 'MozMoz';
  G.pref = p;
  G.pref.nextExtra = 100000;
}

function savePref() {
  try { localStorage.setItem('mozpong.pref', JSON.stringify(G.pref)); } catch { /* ignore */ }
}

function saveGame() {
  if (!G.pref || !assets || mode !== 'game' || gameOverHandled) return;
  if (G.gameState === 0x14) {
    clearSavedGame();
    return;
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshotGame()));
  } catch { /* storage unavailable or full */ }
}

function loadSavedGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) {
      clearSavedGame();
      return null;
    }
    return data;
  } catch {
    clearSavedGame();
    return null;
  }
}

function clearSavedGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

const textCanvas = document.createElement('canvas');
const textCtx = textCanvas.getContext('2d', { willReadFrequently: true });

// Draw QuickDraw-style text at a baseline into the SAT framebuffer.  The
// original uses the Mac system font at 9/12 pt; the browser font is rendered
// offscreen and thresholded so it keeps the hard-edged look of the original.
function drawPixelText(fb, text, x, baseline, size, rgb, bold = true) {
  // The original does not select a font: DrawHighScore only calls TextFace(1)
  // and TextSize(9/12), so it uses the Mac system font (Charcoal/Geneva), a
  // bold sans-serif face.
  const font = `${bold ? 'bold ' : ''}${size}px "Charcoal", "Geneva", "Verdana", "DejaVu Sans", sans-serif`;
  textCtx.font = font;
  const m = textCtx.measureText(text);
  const ascent = Math.max(1, Math.ceil(m.actualBoundingBoxAscent || size * 0.8));
  const descent = Math.max(1, Math.ceil(m.actualBoundingBoxDescent || size * 0.2));
  const w = Math.max(1, Math.ceil(m.width) + 4);
  const h = ascent + descent + 2;
  textCanvas.width = w;
  textCanvas.height = h;
  textCtx.font = font;
  textCtx.textBaseline = 'alphabetic';
  textCtx.fillStyle = '#000';
  textCtx.clearRect(0, 0, w, h);
  textCtx.fillText(text, 2, ascent + 1);
  const data = textCtx.getImageData(0, 0, w, h).data;
  const top = baseline - ascent - 1;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const alpha = data[(yy * w + xx) * 4 + 3];
      if (alpha === 0) continue;
      const tx = x + xx;
      const ty = top + yy;
      if (tx < 0 || tx >= fb.width || ty < 0 || ty >= fb.height) continue;
      const di = (ty * fb.width + tx) * 4;
      const a = alpha / 255;
      fb.rgba[di] = Math.round(fb.rgba[di] * (1 - a) + rgb[0] * a);
      fb.rgba[di + 1] = Math.round(fb.rgba[di + 1] * (1 - a) + rgb[1] * a);
      fb.rgba[di + 2] = Math.round(fb.rgba[di + 2] * (1 - a) + rgb[2] * a);
      fb.rgba[di + 3] = 255;
    }
  }
}

function blitPictureMasked(fb, img, dx, dy) {
  // Only the white pixels connected to the outer edge are background.  White
  // highlights inside the logo letters must stay opaque.
  const w = img.width;
  const h = img.height;
  const bg = new Uint8Array(w * h);
  const isWhite = (i) => {
    const o = i * 4;
    return img.data[o + 3] !== 0 &&
      img.data[o] > 240 && img.data[o + 1] > 240 && img.data[o + 2] > 240;
  };
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = y * w + x;
    if (bg[i] || !isWhite(i)) return;
    bg[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i / w) | 0;
    push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (bg[i]) continue;
      const si = i * 4;
      if (img.data[si + 3] === 0) continue;
      const tx = dx + x;
      const ty = dy + y;
      if (tx < 0 || tx >= fb.width || ty < 0 || ty >= fb.height) continue;
      const di = (ty * fb.width + tx) * 4;
      fb.rgba[di] = img.data[si];
      fb.rgba[di + 1] = img.data[si + 1];
      fb.rgba[di + 2] = img.data[si + 2];
      fb.rgba[di + 3] = 255;
    }
  }
}

// 0x09b30 DrawHighScore: the welcome screen is the live game backdrop/HUD
// plus the MozPong logo and the high-score table, not an HTML dialog.
function drawWelcome() {
  const fb = sat.fb;
  sat.render();

  const logo = assets.getPictureSync(12502);
  if (logo) blitPictureMasked(fb, logo, 0x76, 0x5c);

  const black = [0, 0, 0];
  drawPixelText(fb, 'V1.0.5', 0x11a, 0x80, 9, black);
  drawPixelText(fb, 'RANK', 0x2c, 0x9c, 9, black);
  drawPixelText(fb, 'NAME', 0x80, 0x9c, 9, black);
  drawPixelText(fb, 'SCORE', 0xfa, 0x9c, 9, black);
  drawPixelText(fb, 'STAGE', 0x136, 0x9c, 9, black);
  fb.fillRect({ left: 0x25, top: 0x9f, right: 0x15e, bottom: 0xa1 }, 0, 0, 0);

  const ranks = ['1st', '2nd', '3rd', '4th', '5th'];
  const colors = [
    [250, 26, 32], [255, 253, 72], [30, 145, 29], [1, 70, 237], [49, 219, 219],
  ];
  const shadow = [86, 86, 86];
  for (let i = 0; i < 5; i++) {
    const by = 0xb0 + i * 0x14;
    const score = G.pref.highscores[i] ?? 0;
    const name = G.pref.names[i] ?? '';
    const stage = G.pref.stages[i] ?? 1;
    drawPixelText(fb, ranks[i], 0x2c, by + 1, 12, shadow);
    drawPixelText(fb, name, 0x59, by + 1, 12, shadow);
    drawPixelText(fb, String(score), 0xe5, by + 1, 12, shadow);
    drawPixelText(fb, String(stage), 0x13d, by + 1, 12, shadow);
    drawPixelText(fb, ranks[i], 0x2c, by, 12, colors[i]);
    drawPixelText(fb, name, 0x59, by, 12, colors[i]);
    drawPixelText(fb, String(score), 0xe5, by, 12, colors[i]);
    drawPixelText(fb, String(stage), 0x13d, by, 12, colors[i]);
  }
  present();
}

function blitScaledRegion(src, srcW, sx, sy, sw, sh, dst, dstW, dx, dy, dw, dh) {
  for (let y = 0; y < dh; y++) {
    const syy = sy + Math.floor(y * sh / dh);
    const srow = syy * srcW * 4;
    const drow = (dy + y) * dstW * 4;
    for (let x = 0; x < dw; x++) {
      const sxx = sx + Math.floor(x * sw / dw);
      const si = srow + sxx * 4;
      const di = drow + (dx + x) * 4;
      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = 255;
    }
  }
}

function presentMobile() {
  if (!mobileFb) {
    mobileFb = new Framebuffer(MOBILE_W, MOBILE_H);
  }
  const dst = mobileFb.rgba;
  for (let i = 0; i < dst.length; i += 4) {
    dst[i] = 242;
    dst[i + 1] = 225;
    dst[i + 2] = 225;
    dst[i + 3] = 255;
  }
  if (mobileBg && mobileBg.width === MOBILE_W) {
    // While the manually designed background is still 570 px tall, bottom-align
    // it so the reserved 14 px top pad stays empty. A 584 px replacement will
    // fill the whole canvas.
    const bgY = Math.max(0, MOBILE_H - mobileBg.height);
    const rows = Math.min(mobileBg.height, MOBILE_H - bgY);
    const srcStart = 0;
    const dstStart = bgY * MOBILE_W * 4;
    dst.set(mobileBg.data.subarray(srcStart, srcStart + rows * MOBILE_W * 4), dstStart);
  }
  const src = sat.fb.rgba;
  const srcW = SCREEN_W;
  const L = MOBILE_LAYOUT;
  blitScaledRegion(src, srcW, 0, 0, L.sourceW, L.sourceH,
    dst, MOBILE_W, L.playX, L.playY, L.sourceW, L.sourceH);

  // The static HUD background is provided by mobile-bg.png.  Draw only the
  // dynamic HUD sprites (digits, lives, roulette, extra lamps, stage meter).
  for (let sp = sat.head; sp; sp = sp.next) {
    if (!sp.hud || !sp.face || sp.h < L.hudX) continue;
    const isScore = sp.v < L.spinnerY;
    const dx = (isScore ? L.scoreDx : L.spinnerDx) + (sp.h - L.hudX);
    const dy = L.topPad + (isScore
      ? sp.v + L.scoreDy
      : sp.v - L.spinnerY + L.spinnerDy);
    mobileFb.blitFace(sp.face, dx, dy);
  }
  ctx.putImageData(new ImageData(dst, MOBILE_W, MOBILE_H), 0, 0);
}

function present() {
  if (layoutMode === 'mobile') {
    presentMobile();
    return;
  }
  const img = new ImageData(sat.fb.rgba, SCREEN_W, SCREEN_H);
  ctx.putImageData(img, 0, 0);
}

function redrawForLayout() {
  if (!assets) return;
  if (mode === 'title') {
    drawWelcome();
  } else if (mode === 'game') {
    sat.render();
    present();
    if (paused && !gameOverHandled) drawPause();
  }
}

function applyLayout(redraw = true) {
  layoutMode = G.pref.layout === 'mobile' ? 'mobile' : 'desktop';
  document.body.classList.toggle('mobile-layout', layoutMode === 'mobile');
  const mobile = layoutMode === 'mobile';
  canvas.width = mobile ? MOBILE_W : SCREEN_W;
  canvas.height = mobile ? MOBILE_H : SCREEN_H;
  input.setView(mobile ? {
    canvasW: MOBILE_W,
    canvasH: MOBILE_H,
    sourceW: MOBILE_LAYOUT.sourceW,
    sourceH: MOBILE_LAYOUT.sourceH,
    offsetY: MOBILE_LAYOUT.playY,
    playH: MOBILE_LAYOUT.playH,
    mobile: true,
  } : {
    canvasW: SCREEN_W,
    canvasH: SCREEN_H,
    sourceW: SCREEN_W,
    sourceH: SCREEN_H,
    offsetY: 0,
    playH: SCREEN_H,
    mobile: false,
  });
  mobileFb = null;
  updateMenuBar();
  if (redraw) redrawForLayout();
}

function setOverlay(html) {
  if (!html) {
    overlay.style.display = 'none';
    overlay.innerHTML = '';
    return;
  }
  overlay.style.display = 'flex';
  overlay.innerHTML = html;
}

function highScoreQualifies(score) {
  return score > (G.pref.highscores[4] ?? 0);
}

function registerHighScore(name, score, stage) {
  G.pref.lastHighScoreName = name;
  G.pref.highscores.push(score);
  G.pref.names.push(name);
  G.pref.stages.push(stage);
  const rows = G.pref.highscores.map((s, i) => ({
    s,
    n: G.pref.names[i] ?? '',
    st: G.pref.stages[i] ?? 1,
  }));
  rows.sort((a, b) => b.s - a.s);
  G.pref.highscores = rows.slice(0, 5).map(r => r.s);
  G.pref.names = rows.slice(0, 5).map(r => r.n);
  G.pref.stages = rows.slice(0, 5).map(r => r.st);
  savePref();
}

function promptHighScore() {
  const score = G.score;
  const stage = G.stage;
  const lastName = typeof G.pref.lastHighScoreName === 'string'
    ? G.pref.lastHighScoreName
    : 'MozMoz';
  setOverlay(`
    <div class="dialog">
      <h2>HIGH SCORE!</h2>
      <p>You reached stage ${stage} with ${score} points.</p>
      <label>Name <input id="hs-name" maxlength="20" autocomplete="off" data-1p-ignore></label>
      <button id="hs-ok">OK</button>
    </div>`);
  const nameInput = document.getElementById('hs-name');
  nameInput.value = lastName;
  nameInput.focus();
  nameInput.select();
  const commit = () => {
    // The original GetDialogItemText/CopyPString path preserves the entered
    // case and truncates to 20 characters; it never uppercases the name.
    const name = nameInput.value.slice(0, 20);
    registerHighScore(name, score, stage);
    toTitle();
  };
  document.getElementById('hs-ok').onclick = commit;
  nameInput.onkeydown = (e) => { if (e.key === 'Enter') commit(); };
}

function finishRun() {
  if (gameOverHandled) return;
  gameOverHandled = true;
  paused = true;
  clearSavedGame();
  updateMenuBar();
  if (G.stage > G.pref.maxStage) {
    G.pref.maxStage = Math.min(32, G.stage);
    savePref();
  }
  if (highScoreQualifies(G.score)) {
    promptHighScore();
  } else {
    toTitle();
  }
}

function toTitle() {
  mode = 'title';
  clearSavedGame();
  closeMobileMenu();
  audio.stopMusic(0);
  paused = false;
  gameOverHandled = false;
  setOverlay(null);
  G.gameState = 0x14;
  G.score = 0;
  G.stage = 1;
  G.butaCount = 0;
  G.extraLampCount = 0;
  G.piyoSlotCount = 0;
  G.rouletteResult = 0;
  G.nextExtra = 100000;
  sat.head = sat.tail = null;
  SetUpElement();
  G.lastScore = -1;
  updateScoreBoard();
  sat.run(false);
  updateMenuBar();
  drawWelcome();
}

function newGame(stage = 1) {
  closeMobileMenu();
  clearSavedGame();
  saveAccumulator = 0;
  setOverlay(null);
  audio.init();
  audio.resume();
  mode = 'game';
  paused = false;
  gameOverHandled = false;
  startGame(stage);
  if (layoutMode === 'mobile') {
    // Start with a zero relative drag at the position where the intro
    // animation leaves MozMoz (0xa5).  The title-screen pointer could
    // otherwise pull the character sideways as soon as control begins.
    input.resetForGame(0xa5, G.moz ? G.moz.baseV : 0x148);
  }
  updateMenuBar();
  saveGame();
}

function drawPause() {
  sat.render();
  const p = assets.getPictureSync(140);
  if (p) {
    // PICT 140 is a 1-bit "GAME PAUSED" mask.  DrawPicture in the original
    // uses the picture as black-on-transparent, not as an opaque white patch.
    const dst = sat.fb.rgba;
    const dw = sat.fb.width;
    for (let y = 0; y < p.height; y++) {
      for (let x = 0; x < p.width; x++) {
        const si = (y * p.width + x) * 4;
        // White is the PICT's background; the red lettering is the logo.
        if (p.data[si] > 240 && p.data[si + 1] > 240 && p.data[si + 2] > 240) continue;
        const tx = 0x30 + x;
        const ty = 0x80 + y;
        if (tx < 0 || tx >= dw || ty < 0 || ty >= sat.fb.height) continue;
        const di = (ty * dw + tx) * 4;
        dst[di] = p.data[si];
        dst[di + 1] = p.data[si + 1];
        dst[di + 2] = p.data[si + 2];
        dst[di + 3] = 255;
      }
    }
  }
  present();
}

function togglePause() {
  if (mode !== 'game' || gameOverHandled) return;
  paused = !paused;
  input.endFrame();
  if (paused) {
    saveGame();
    drawPause();
    audio.stopMusic(0);
  } else {
    audio.startMusic(0);
  }
  updateMenuBar();
}

// Abort ends the current run immediately, like the Abort action in the
// Tetris Max port.  It still goes through the normal game-over path, so a
// qualifying score gets the same high-score prompt as a natural game over.
function abortGame() {
  if (mode !== 'game' || gameOverHandled) return;
  paused = true;
  input.endFrame();
  audio.stopMusic(0);
  finishRun();
}

function updateMenuBar() {
  const canPause = mode === 'game' && !gameOverHandled;
  const pause = document.getElementById('menu-pause');
  const abort = document.getElementById('menu-abort');
  const mobilePause = document.getElementById('mobilePause');
  if (pause) {
    pause.disabled = !canPause;
    pause.textContent = paused ? 'Resume' : 'Pause';
  }
  if (abort) abort.disabled = !canPause;
  if (mobilePause) {
    const inGame = mode === 'game' && !gameOverHandled;
    mobilePause.disabled = false;
    mobilePause.textContent = inGame ? (paused ? 'Resume' : 'Pause') : 'New Game';
  }
  const sound = document.getElementById('menu-sound');
  const music = document.getElementById('menu-music');
  const layoutSelect = document.getElementById('layoutSelect');
  if (sound) sound.textContent = `Sound: ${G.pref.sound ? 'On' : 'Off'}`;
  if (music) music.textContent = `BGM: ${G.pref.music ? 'On' : 'Off'}`;
  if (layoutSelect) layoutSelect.value = layoutMode;

  const panel = document.getElementById('sidePanelWrapper');
  if (panel) {
    const running = mode === 'game' && !paused && !gameOverHandled;
    panel.classList.toggle('collapsed', running);
    if (running) {
      setTimeout(() => panel.classList.add('collapsed-interactive'), 300);
    } else {
      panel.classList.remove('collapsed-interactive');
    }
  }
}

function closeMobileMenu() {
  document.body.classList.remove('mobile-controls-expanded');
}

function toggleSound() {
  G.pref.sound = G.pref.sound ? 0 : 1;
  if (G.pref.sound) audio.soundOn(); else audio.soundOff();
  savePref();
  updateMenuBar();
}
function toggleMusic() {
  G.pref.music = G.pref.music ? 0 : 1;
  audio.musicEnabled = !!G.pref.music;
  if (G.pref.music) audio.startMusic(0); else audio.stopMusic(0);
  savePref();
  updateMenuBar();
}

function selectStage() {
  let max = Math.min(32, Math.max(1, G.pref.maxStage));
  if (G.pref.maxStage >= 32) max = 32;
  const value = prompt(`Start at stage (1-${max}):`, '1');
  if (value === null) return;
  const stage = Math.max(1, Math.min(max, parseInt(value, 10) || 1));
  newGame(stage);
}

function handleShortcuts() {
  const keys = input.takeKeys();
  for (const code of keys) {
    if (code === 'KeyN') newGame(1);
    else if (code === 'KeyS') toggleSound();
    else if (code === 'KeyM') toggleMusic();
    else if (code === 'KeyP') {
      if (mode === 'game') togglePause();
    } else if (code === 'KeyR') {
      if (mode === 'game' && paused) togglePause();
    } else if (code === 'Enter') {
      if (mode === 'title') newGame(1);
      else if (mode === 'game' && paused) togglePause();
    } else if (code === 'Escape') {
      if (mode === 'game') togglePause();
    }
  }
}

function gameStep() {
  if (mode !== 'game' || paused) return;
  moveItStep();
  input.endFrame();
  if (G.gameState === 0x14) {
    finishRun();
    return;
  }
  saveAccumulator += STEP;
  if (saveAccumulator >= 1) {
    saveAccumulator = 0;
    saveGame();
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  handleShortcuts();
  if (!lastTime) lastTime = now;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.25) dt = 0.25;
  if (mode === 'title') return;
  if (mode === 'game' && !paused) {
    accumulator += dt;
    while (accumulator >= STEP) {
      gameStep();
      accumulator -= STEP;
      if (mode !== 'game') break;
    }
    present();
    if (paused && !gameOverHandled) drawPause();
  }
}

async function boot() {
  loadPref();
  if (document.fonts) {
    try {
      await document.fonts.load('12px "Charcoal"');
      await document.fonts.load('bold 12px "Charcoal"');
    } catch { /* use fallback */ }
  }
  const loadFill = document.getElementById('load-fill');
  let lastProgress = -1;
  const setProgress = (f) => {
    const pct = Math.round(f * 100);
    if (pct === lastProgress) return;
    lastProgress = pct;
    if (loadFill) loadFill.style.width = `${pct}%`;
  };
  setProgress(0.02);
  assets = await new Assets().load();
  setProgress(0.05);
  await assets.preloadAll((done, total) => setProgress(0.05 + 0.9 * done / total));
  try {
    mobileBg = await loadPictureUrl('assets/mobile-bg.png');
  } catch (e) {
    console.warn('Could not load mobile background', e);
  }
  setProgress(0.96);
  audio = new AudioEngine(assets.manifest);
  audio.init();
  setAssets(assets, audio);
  initResources(assets.fork);
  MakeMathTbl();
  LoadSounds();
  InitAllSprite();
  G.butaCount = 0;
  SetUpElement();
  sat.run(false);
  G.audio = audio;
  G.sat = sat;
  audio.musicEnabled = !!G.pref.music;
  audio.effectsEnabled = !!G.pref.sound;
  G.onSavePref = savePref;
  window.__mozpong = {
    G, sat, assets, audio, input, newGame, toTitle, abortGame,
    snapshotGame, restoreGame, saveGame, clearSavedGame, applyLayout, getMode: () => mode,
  };
  sat.fb = new Framebuffer(SCREEN_W, SCREEN_H);
  sat.background = assets.getPictureSync(129);
  applyLayout(false);
  setProgress(1);
  document.getElementById('loading')?.remove();
  document.documentElement.classList.remove('booting');

  const saved = loadSavedGame();
  let restored = false;
  if (saved) {
    try {
      restored = restoreGame(saved);
    } catch (e) {
      console.error('Could not restore saved game', e);
    }
  }
  if (restored) {
    mode = 'game';
    paused = true;
    gameOverHandled = false;
    saveAccumulator = 0;
    if (Number.isFinite(G.mouseH) && Number.isFinite(G.mouseV)) {
      input.setMouse(G.mouseH, G.mouseV);
    }
    audio.stopMusic(0);
    updateMenuBar();
    drawPause();
  } else if (saved) {
    // The save was present but unusable; reset to a clean welcome screen.
    clearSavedGame();
    toTitle();
  } else {
    drawWelcome();
    updateMenuBar();
  }
  requestAnimationFrame(frame);
}

// Menu wiring.
document.getElementById('menu-new').onclick = () => newGame(1);
document.getElementById('menu-pause').onclick = () => { if (mode === 'game') togglePause(); };
document.getElementById('menu-abort').onclick = abortGame;
document.getElementById('menu-sound').onclick = toggleSound;
document.getElementById('menu-music').onclick = toggleMusic;
const layoutSelect = document.getElementById('layoutSelect');
if (layoutSelect) {
  layoutSelect.onchange = () => {
    G.pref.layout = layoutSelect.value === 'mobile' ? 'mobile' : 'desktop';
    savePref();
    applyLayout();
  };
}
document.getElementById('menu-stage').onclick = () => { selectStage(); closeMobileMenu(); };

const mobilePause = document.getElementById('mobilePause');
if (mobilePause) {
  mobilePause.onclick = () => {
    if (mode === 'game' && !gameOverHandled) togglePause();
    else newGame(1);
  };
}
const mobileMenu = document.getElementById('mobileMenu');
if (mobileMenu) {
  mobileMenu.onclick = () => {
    if (mode === 'game' && !paused && !gameOverHandled) togglePause();
    document.body.classList.toggle('mobile-controls-expanded');
  };
}
document.addEventListener('touchstart', (e) => {
  if (!(e.target instanceof Element)) return;
  if (e.target.closest('.side-panel') || e.target.closest('#mobileMenu')) return;
  closeMobileMenu();
}, { capture: true });
document.body.classList.add('enable-transition');

canvas.addEventListener('click', () => { audio.init(); audio.resume(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGame();
});
window.addEventListener('beforeunload', saveGame);

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('loading');
  if (el) el.textContent = 'Failed to load: ' + e.message;
});
