import { Face } from '../js/engine.js';
import { G, setAssets, MakeMathTbl, updateSpinner } from '../js/game.js';

const blank = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
const assets = {
  japanese: false,
  fork: null,
  getPictureSync: () => blank(64, 64),
  getFacePPSync: () => new Face(32, 32),
  getFaceCicnSync: () => new Face(16, 16),
};
const audio = {
  playSound() {}, soundOn() {}, soundOff() {}, stopAll() {}, events() {},
  done: () => true, startMusic() {}, stopMusic() {},
};
setAssets(assets, audio);
MakeMathTbl();

function spin(reward, score = 0) {
  G.score = score;
  G.gameState = 0;
  G.rouletteResult = 1;
  G.spinnerIndex = 8; // increments to 9
  G.queuedSpins = 0;
  G.moz = { state: 3 };
  G.spinnerSlots = Array.from({ length: 12 }, () => ({ tA0: 0, state: 0, anim: 1 }));
  G.spinnerSlots[9].anim = reward;
  G.spinnerBigPiyo = { state: 1 };
  updateSpinner();
  return G.score;
}

const cases = [[0, 10000], [1, 1000], [2, 5000]];
for (const [reward, expected] of cases) {
  const start = 4520;
  const score = spin(reward, start);
  if (score !== start + expected) {
    console.error(`roulette reward ${reward}: ${score}, expected ${start + expected}`);
    process.exit(1);
  }
  console.log(`roulette reward ${reward}: +${score - start}`);
}
