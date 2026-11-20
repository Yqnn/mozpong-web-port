import { Face, Sprite } from '../js/engine.js';
import { G, setAssets, MakeMathTbl, hitButa } from '../js/game.js';

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

function makeButa() {
  const sp = new Sprite(-3, 100, 100);
  sp.subtype = -3;
  sp.state = 2;
  sp.count2 = 0;
  sp.t96 = 0;
  sp.t98 = 0;
  sp.tA0 = 0;
  sp.t9a = 0;
  sp.speed = 100;
  sp.angle = 0x96;
  sp.angle2 = 0x96;
  sp.h = 100;
  sp.v = 100;
  sp.x = sp.h << 12;
  sp.y = sp.v << 12;
  sp.oldX = sp.x;
  sp.oldY = sp.y;
  sp.local = { left: 0, top: 0, right: 0x1e, bottom: 0x1e };
  sp.face = {};
  sp.handle = () => {};
  sp.sub = null;
  return sp;
}

const buta = makeButa();
const egg = new Sprite(10, 100, 100);
egg.subtype = 0x10; // unbreakable steel egg
egg.face = {};
egg.h = 100;
egg.v = 100;
egg.local = { left: 0, top: 0, right: 0x1e, bottom: 0x1e };

// First contact records the steel-egg reference position.
hitButa(buta, egg);

// A later contact at the same vertical position, but not the same horizontal
// position, must use the saved vertical position (0x86) and reflect vertically.
// Using savedV (0x8a) here produced the horizontal velocity inversion seen on
// rows of steel eggs.
buta.angle = 0x96;
buta.angle2 = 0x96;
buta.h = 100;
buta.v = 100;
buta.x = buta.h << 12;
buta.y = buta.v << 12;
buta.oldX = buta.x;
buta.oldY = buta.y;
buta.t96 = 1;
buta.t98 = 0;
buta.tA0 = 0;
buta.t9a = 0;
buta.count2 = 0;
buta.otherH = 50;
buta.otherV = 100;
hitButa(buta, egg);

const expected = 0x168 - 0x96;
if (buta.angle !== expected) {
  console.error(`steel-egg bounce angle ${buta.angle}, expected ${expected}`);
  process.exit(1);
}
console.log('steel-egg vertical bounce angle', buta.angle);

// ---------------------------------------------------------------------------
// Blue/red eggs use jump-table target 0x3d90 and then the subtype switch at
// 0x3e4c, which calls recalcButa and adds two more speed units at 0x40cc.
// White/yellow/green skip that branch.  This checks that the subtype is
// carried into hitButaEgg instead of collapsing every common egg to 10.
// ---------------------------------------------------------------------------
function resetButa() {
  buta.angle = 0x96;
  buta.angle2 = 0x96;
  buta.speed = 100;
  buta.h = 100;
  buta.v = 100;
  buta.x = buta.h << 12;
  buta.y = buta.v << 12;
  buta.oldX = buta.x;
  buta.oldY = buta.y;
  buta.t96 = 0;
  buta.t98 = 0;
  buta.tA0 = 0;
  buta.t9a = 0;
  buta.count2 = 0;
  buta.state = 2;
  buta.face = {};
  buta.sub = null;
}

function makeEgg(subtype, state) {
  const egg = new Sprite(10, 100, 100);
  egg.subtype = subtype;
  egg.state = state;
  egg.face = {};
  egg.handle = () => {};
  egg.h = 100;
  egg.v = 100;
  egg.local = { left: 0, top: 0, right: 0x1e, bottom: 0x1e };
  return egg;
}

resetButa();
hitButa(buta, makeEgg(10, 1));
if (buta.speed !== 102) {
  console.error(`white-egg contact speed ${buta.speed}, expected 102`);
  process.exit(1);
}

for (const subtype of [13, 14]) {
  resetButa();
  hitButa(buta, makeEgg(subtype, 2));
  if (buta.speed !== 104) {
    console.error(`egg subtype ${subtype} contact speed ${buta.speed}, expected 104`);
    process.exit(1);
  }
}

console.log('egg contact speeds: white 102, blue/red 104');
