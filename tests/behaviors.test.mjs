// Regression checks for behaviors that are easy to misread as bugs:
//   - the explosive Butasan's ghost really does overlap every egg subtype;
//   - blue/red eggs normally need several contacts, so one explosion only
//     removes one of their states;
//   - a Butasan cannot kill the green monster (Kaizyu) directly.  Hitting its
//     ghost only makes Kaizyu catchable by MozMoz.
//
// The assembly sources are hitEgg (0x05ee0), hitKaizyu (0x07624) and
// hitKaizyuGhost (0x07904).

import { Face } from '../js/engine.js';
import {
  G, sat, setAssets, hitEgg, hitKaizyu, hitKaizyuGhost, SetupBombGhost3,
} from '../js/game.js';

const blank = (w, h) => ({
  width: w,
  height: h,
  data: new Uint8ClampedArray(w * h * 4),
});
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

function clearSat() {
  sat.head = null;
  sat.tail = null;
}

function makeEgg(subtype, state) {
  return sat.newSprite(10, 100, 100, (sp) => {
    sp.face = {};
    sp.handle = () => {};
    sp.hit = hitEgg;
    sp.subtype = subtype;
    sp.state = state;
    sp.local = { left: 0, top: 0, right: 0x1c, bottom: 0x1e };
    sp.count2 = 0;
    sp.count = 0;
    sp.sub = null;
    sp.layer = 1;
  });
}

function makeGhost() {
  return sat.newSprite(-6, 100, 100, SetupBombGhost3);
}

// --- explosive area effect vs. rainbow, blue and red eggs -------------------
clearSat();
G.butaStarted = 0;
G.score = 0;
const blue = makeEgg(13, 2);
makeGhost();
sat.collide();
if (blue.state !== 1 || !blue.handle) {
  console.error(`explosive ghost vs blue egg: state ${blue.state}, handle ${!!blue.handle}`);
  process.exit(1);
}

clearSat();
const red = makeEgg(14, 3);
makeGhost();
sat.collide();
if (red.state !== 2 || !red.handle) {
  console.error(`explosive ghost vs red egg: state ${red.state}, handle ${!!red.handle}`);
  process.exit(1);
}

clearSat();
const rainbow = makeEgg(15, 1);
makeGhost();
sat.collide();
if (rainbow.handle !== null) {
  console.error('explosive ghost did not destroy the rainbow egg');
  process.exit(1);
}

// --- green monster ----------------------------------------------------------
const kaizyu = { state: 3, count: 0, h: 100, v: 100, face: null, anim: 0 };
const buta = { subtype: -3, state: 2 };

// A direct Butasan contact must not kill Kaizyu.
hitKaizyu(kaizyu, buta);
if (kaizyu.state !== 3) {
  console.error(`Butasan killed Kaizyu directly (state ${kaizyu.state})`);
  process.exit(1);
}

// Hitting the Kaizyu ghost with a moving Butasan makes Kaizyu catchable; it
// still has to be caught by MozMoz.
G.kaizyu = kaizyu;
G.diff4 = 0x32;
kaizyu.state = 0;
hitKaizyuGhost({}, buta);
if (kaizyu.state !== 3 || kaizyu.count !== 0x32) {
  console.error(`Kaizyu ghost contact state ${kaizyu.state}, count ${kaizyu.count}`);
  process.exit(1);
}

console.log('explosive area and green-monster behavior match the assembly');
