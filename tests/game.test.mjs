import { Face, SAT, Sprite, Framebuffer } from '../js/engine.js';
import { ResourceFork } from '../js/resources.js';
import fs from 'node:fs';
import {
  G, sat, setAssets, initResources, MakeMathTbl, LoadSounds, InitAllSprite,
  startGame, moveItStep,
} from '../js/game.js';

const blank = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });

const rsrcBytes = new Uint8Array(fs.readFileSync('public/assets/MozPong.rsrc'));
const fork = new ResourceFork(rsrcBytes.buffer);

const assets = {
  japanese: false,
  fork,
  getPictureSync: (id) => blank(id === 129 ? 512 : 64, id === 129 ? 400 : 64),
  getFacePPSync: () => new Face(32, 32),
  getFaceCicnSync: () => new Face(16, 16),
};

const audio = {
  playSound() {}, soundOn() {}, soundOff() {}, stopAll() {}, events() {},
  done: () => true, startMusic() {}, stopMusic() {}, init() {}, resume() {},
};

setAssets(assets, audio);
G.pref = {
  version: 60, sound: 1, music: 0,
  depthAlert: 1, ignoreOthers: 0,
  highscores: [50000, 40000, 30000, 20000, 10000], names: ['', '', '', '', ''],
  stages: [1, 1, 1, 1, 1], maxStage: 1,
};
G.input = {
  mouseX: 256, mouseY: 300, mouseDown: false,
  setMouse(x, y) { this.mouseX = x; this.mouseY = y; },
};
G.mouseV = 0; G.mouseH = 0;
sat.fb = new Framebuffer(512, 400);
sat.background = assets.getPictureSync(129);

initResources(fork);
MakeMathTbl();
LoadSounds();
InitAllSprite();
startGame(1);
console.log('egps0', G.egps[0]?.length, Array.from(G.egps[0]||[]).filter(x=>x).length, 'eggCount', G.eggCount);
console.log('after startGame score', G.score, 'butaStarted', G.butaStarted, 'state', G.gameState);

console.log('sprites after start:', countSprites());
let eggs=[]; for(let s=sat.head;s;s=s.next) if(s.subtype===10) eggs.push([s.h,s.v,s.tA0]); console.log('egg count',eggs.length,'sample',eggs.slice(0,5), 'row>=6',eggs.filter(e=>e[1]>=186).slice(0,10));
for (let i = 0; i < 600; i++) {
  G.input.mouseX = 256 + Math.round(100 * Math.sin(i / 20));
  G.input.mouseDown = (i % 40) === 0;
  moveItStep();
  if (i < 5) console.log('  frame', i, 'moz.state', G.moz?.state, 'moz.h2', G.moz?.h2, 'mouseDown', G.input.mouseDown, 'gameState', G.gameState, 'score', G.score);
  if (i % 100 === 0) {
    console.log(i, 'state', G.gameState, 'sprites', countSprites(), 'score', G.score,
      'buta', G.butaCount, 'eggs', G.eggCount);
  }
}
console.log('done; state', G.gameState, 'sprites', countSprites(), 'score', G.score);

function countSprites() {
  let n = 0;
  for (let s = sat.head; s; s = s.next) n++;
  return n;
}
