// MozPong game logic, ported from the PPC disassembly.
//
// Each function below corresponds to the named function at the same offset in
// analysis/ppc/mozpong_ppc.s.  Sprite offsets are documented in engine.js; the
// global names follow the g_XXXX labels used in the disassembly.

import {
  SAT, Sprite, Face, makeRect, setRect, copyRect, offsetRect, sectRect,
  rectsOverlap, s16, u16, idiv, imod, SATRand, rand, clock,
} from './engine.js';

// ---------------------------------------------------------------------------
// Global state.  The original keeps these in one 3.3 KB data section; the
// names below are the g_XXXX offsets from the disassembly.
// ---------------------------------------------------------------------------
export const G = {
  // preferences (g_1DE8 points at a 0x640 byte record)
  pref: null,

  nextExtra: 100000, // g_1DEC (next extra-butasan threshold)
  extraLamps: 0,     // g_1DF0
  butaStarted: 0,    // g_1DF2 (short)
  langBase: 100,     // g_1DF4 (0 = Japanese, 100 = English)
  diff3: 0,          // g_1DF6
  diff2: 0,          // g_1DF8
  diff4: 0,          // g_1DFA
  diffMaxSpeed: 0,   // g_1DFC
  diffSpeed: 0,      // g_1DFE
  scoreAtStart: 0,   // g_1E00? (actually extra lamp bits / piyo)
  piyoPoints: 10,    // g_1E04 (current chick point value)
  gameState: 0,      // g_1E08 (short)
  g1E0A: 0,          // g_1E0A (short)
  g1E0C: 0,          // g_1E0C (short)
  butaCount: 3,      // g_1E0E (short)
  eggCount: 0,       // g_1E10 (short)
  kingOnField: 0,    // g_1E12 (short)
  score: 0,          // g_1E14 (actual score)
  lastScore: -1,     // g_1230 (last drawn score)
  g1E18: 0,          // g_1E18
  g1E1C: 0,          // g_1E1C
  stage: 1,          // g_1E20
  mouseH: 0,         // g_1F5C.lo: horizontal mouse position
  mouseV: 0,         // g_1F5C.hi: vertical mouse position
  paused: 0,         // g_1F50 (byte)
  g1F54: 0,
  g1E24: null,       // menu handles (not used by the canvas UI)
  g1E28: null,
  g1E2C: null,
  g2E08: null,       // SAT global record, represented by the SAT object

  // Scratch game globals at low data offsets
  g08EC: 0,
  g08F0: 0,
  g1EA0: 0,          // g_1EA0 (DekaMoz on field)
  g0928: null,
  g092C: 0,
  g092E: 0,
  g0930: null,
  g0934: null,
  g093C: null,
  g0940: null,
  g0944: null,
  g0948: null,
  g1170: null,

  // handles from InitAllResource
  dfTy: [],          // g_2854: 32 handles to DfTy resources
  egps: [],          // g_28D4: 32 handles to EgPS resources
  egpsGameOver: null,// g_20034: EgPS 228
  titlePict: null,   // g_2964: PICT 12500
  titlePict2: null,  // g_2960: PICT 12501
  aboutPict: null,   // g_295C: PICT 140
  highScorePict: null, // g_2958: PICT 12502
  titleWindow: null, // g_2D08

  // faces
  mozFaces: [],      // g_1ECC [32]
  mozExtraFaces: [], // g_1EA4 [10]
  butaFaces: [],     // g_1F88 [16]
  butaRingFaces: [], // g_1F70 [6]
  butaRingFace: null,// g_0928
  eggFaces: [],      // g_2000 [11]
  piyoFaces: [],     // g_1F6D8? actually g_1FF8? [2]
  fireFaces: [],     // g_1FE8 [4]
  fireFaces2: [],    // g_1FE0 [2]
  kaizyuFaces: [],   // g_1F768 [16]
  kaizyuGhostFaces: [], // g_1F728 [16]
  kaizyuExtraFace: null,// g_0930 [1]
  kaizyuGrabFaces: [], // g_1F720 [2]
  kaizyuHitFaces: [],  // g_1F718 [2]
  kaizyuFallFaces: [], // g_1F710 [2]
  guideFace: null,   // g_0934
  scoreFaces: [],    // g_1F7CC [10]
  pointsFaces: [],   // g_1F814 [30] (cicn 1000..1029)
  multiplierFaces: [], // g_1F804 [4] (cicn 2000..2003)
  slotFaces: [],     // g_1F964 [5] (6010..6014)
  spinnerFaces: [],  // g_1F940 [9] (6000..6008)
  spinnerSmallFaces: [], // g_1F938 [2] (3052..3053)
  spinnerExtraFace: null, // g_0944 (7000)
  coinsFace: null,   // g_093C (3011)
  blindFaces: [],    // g_1F890 [3] (5000..5002)
  mozKanbanFaces: [],// g_1F8AC [4] (3060..3063)
  mekakusiFace: null,// g_0940 (130)
  selbtnFaces: [],   // g_1F98C [12] (8000..8011)
  selbtnCursorFace: null, // g_0948 (cicn 128)
  seggFaces: [],     // g_1F9E4 [3] (cicn 3000..3002)
  kingFaces: [],     // g_1FA20 [5] (10000..10004)
  kingExtraFaces: [],// g_1FA0C [5] (10010..10014)
  kingExtraFaces2: [],// g_1F9F8 [5] (10020..10024)

  // sprite pointers
  moz: null,         // g_1F4C
  kaizyu: null,      // g_202C
  dekaMoz: null,     // g_1FC8 (hand cursor sprite)
  butaLeftSprites: [], // g_1FCC [5]
  blindSprite: null, // g_21B0
  scoreBoard: null,  // g_20CC
  scoreBoardOn: 0,   // g_20C8 (byte)
  segBoard: null,    // g_22DC
  mozKanban: null,
  mozKanbanSprites: [],
  coinsSprites: [],
  king: null,        // g_2310? etc
  kingFoot: null,
  g2310: 0,          // g_2310 (King piyo budget)
  g2312: 0,          // g_2312 (King egg type counter)
  g2314: 0,          // g_2314 (King egg budget)
  g2316: 0,          // g_2316 (King spawn cooldown)
  kingRhand: null,
  kingLhand: null,
  kingPiyo2: [],
  kingEggs: [],
  spinnerState: {},
  roulettePiyos: [],
  piyoSlotCount: 0,  // g_1E02
  rouletteResult: 0,  // g_1DF0
  extraLampCount: 0,  // g_21DC (lit extra lamps)
  queuedSpins: 0,     // g_1E00 (roulette spins waiting)
  pointsSprites: [],
  scoreSprites: [],
  segSprites: [],
  blindSprites: [],
  coinsSprites: [],

  // stage select state
  selStart: 1,       // g_229A
  selSecret: 0,      // g_229C
  selSelected: 0,    // g_229E
  handCursor: null,  // g_22A0
  selResult: 0,      // g_22A4
  selButtonState: 0, // g_22A8
  selButtons: [],    // g_22AC
  stageStart: 1,     // ? used by initStageStart

  // resource handles / non-sprite state
  soundHandles: {},
  highScoreNames: [], // g_2354 (5 x 256 Pascal strings)
  highScoreScores: [],
  highScoreStages: [],
  highScoreExtraName: '',
  hiscoreBuffer: '',  // used while entering a name

  // misc
  gameOverTimer: 0,   // g_1E1C / g_1E18
  gameOverCounter: 0,
  pauseLogoDrawn: false,
  lastHighScore: 0,
};

// Sound handles: the original stores Mac handles, we store snd resource ids.
G.sounds = {
  hitEgg: 0, hitButa: 0, getPiyo: 0, hitKaizyu: 0, shootButa: 0,
  timeCount: 0, kaizyuCatch: 0, boingKaizyu: 0, bombSound: 0,
  rainbowEgg: 0, enterKaizyu: 0, enterKanban: 0, hypButaBound: 0,
  hitEgg2: 0, hitEgg3: 0, getCoins: 0, spin: 0, special: 0,
  slowButa: 0, litExtra: 0, gameOver: 0, boing: 0, dekamoz: 0,
  hypButa: 0, kingHit: 0, oh: 0, yahoo: 0, newHero: 0,
};

export let sat = new SAT();
export let assets = null;
export let audio = null;

export function setAssets(a, au) {
  assets = a;
  audio = au;
}

// ---------------------------------------------------------------------------
// Toolbox helpers used by the translated functions.
// ---------------------------------------------------------------------------
function SetRect(r, l, t, rr, b) { return setRect(r, l, t, rr, b); }
function OffsetRect(r, dx, dy) { return offsetRect(r, dx, dy); }
function SectRect(a, b, out) { return sectRect(a, b, out); }
function SATRectsOverlap(a, b) { return rectsOverlap(a, b); }

function Button() {
  if (!G.input) return false;
  if (G.input.mouseDown) return true;
  return G.input.consumeTap ? G.input.consumeTap() : false;
}

function SATGetFacePP(c, m, b) { return assets.getFacePPSync(c, m, b); }
function SATGetFace(id) { return assets.getFaceCicnSync(id); }
function GetPicture(id) { return assets.getPictureSync(id); }

function SATNewSprite(kind, h, v, setup) {
  return sat.newSprite(kind, h, v, setup);
}

function SATSoundPlay(snd, prio = 0, canWait = false) {
  if (audio) audio.playSound(snd, prio, canWait);
}
function SATSoundPlay2(snd, prio = 0, canWait = false, extra = 0) {
  if (audio) audio.playSound(snd, prio, canWait, extra);
}
function SATSoundOn() { if (audio) audio.soundOn(); }
function SATSoundOff() { if (audio) audio.soundOff(); }
function SATSoundShutup() { if (audio) audio.stopAll(); }
function SATSoundEvents() { if (audio) audio.events(); }
function SATSoundDone() { return audio ? audio.done() : true; }
function CSS_StartMusic(n) { if (audio) audio.startMusic(n); }
function CSS_StopMusic(n) { if (audio) audio.stopMusic(n); }
function CSS_LoadMusic(n) { return 0; }
function CSS_OpenChannel(n) { return 0; }
function CSS_Init() { return 0; }
function CSS_Init2() { return 0; }
function CSS_Shutdown() {}
function CSS_LoadSong(n) { return 0; }
function CSS_DisposeSong(n) {}
function CSS_PlaySong(...a) {}

// ---------------------------------------------------------------------------
// Resource loading.
// ---------------------------------------------------------------------------

function addFaceGroup(target, firstColor, firstMask, firstBW, count, startIndex = 0) {
  for (let i = 0; i < count; i++) {
    target[startIndex + i] = SATGetFacePP(firstColor + i, firstMask + i, firstBW + i);
  }
}

export function InitMozmoz() {
  G.mozFaces.length = 32;
  addFaceGroup(G.mozFaces, 2000, 2100, 2200, 16, 0);
  addFaceGroup(G.mozFaces, 2050, 2150, 2250, 16, 16);
  G.mozExtraFaces.length = 10;
  addFaceGroup(G.mozExtraFaces, 2016, 2116, 2216, 5, 0);
  addFaceGroup(G.mozExtraFaces, 2066, 2166, 2266, 5, 5);
}

export function InitButa() {
  G.butaFaces.length = 16;
  addFaceGroup(G.butaFaces, 1000, 1100, 1200, 16);
  G.butaRingFace = SATGetFacePP(3030, 3130, 3230);
  G.g0928 = G.butaRingFace;
  G.butaRingFaces.length = 6;
  addFaceGroup(G.butaRingFaces, 1050, 1150, 1250, 6);
}

export function InitEgg() {
  G.eggFaces.length = 11;
  addFaceGroup(G.eggFaces, 3000, 3100, 3200, 11);
}

export function initPiyo() {
  G.piyoFaces.length = 2;
  addFaceGroup(G.piyoFaces, 3050, 3150, 3250, 2);
  G.piyoPoints = 10;
}

export function initFireworks() {
  G.fireFaces.length = 4;
  addFaceGroup(G.fireFaces, 3020, 3120, 3220, 4);
  G.fireFaces2.length = 2;
  addFaceGroup(G.fireFaces2, 3024, 3124, 3224, 2);
}

export function InitKaizyu() {
  G.kaizyuFaces.length = 16;
  addFaceGroup(G.kaizyuFaces, 4000, 4100, 4200, 16);
  G.kaizyuGhostFaces.length = 16;
  addFaceGroup(G.kaizyuGhostFaces, 4020, 4120, 4220, 16);
  G.kaizyuExtraFace = SATGetFacePP(4050, 4150, 4250);
  G.kaizyuGrabFaces.length = 2;
  addFaceGroup(G.kaizyuGrabFaces, 4051, 4151, 4251, 2);
  G.kaizyuHitFaces.length = 2;
  addFaceGroup(G.kaizyuHitFaces, 4053, 4153, 4253, 2);
  G.kaizyuFallFaces.length = 2;
  addFaceGroup(G.kaizyuFallFaces, 4055, 4155, 4255, 2);
}

export function initMGuide() {
  G.guideFace = SATGetFacePP(11000, 11100, 11200);
}

export function initScores() {
  G.scoreFaces.length = 10;
  addFaceGroup(G.scoreFaces, 12000, 12100, 12200, 10);
}

export function initPoints() {
  G.pointsFaces.length = 30;
  for (let i = 0; i < 30; i++) G.pointsFaces[i] = SATGetFace(1000 + i);
  G.multiplierFaces.length = 4;
  for (let i = 0; i < 4; i++) G.multiplierFaces[i] = SATGetFace(2000 + i);
}

export function InitCoins() {
  G.coinsFace = SATGetFacePP(3011, 3111, 3211);
}

export function initBlind() {
  G.blindFaces.length = 3;
  addFaceGroup(G.blindFaces, 5000, 5100, 5200, 3);
}

export function initMozKanban() {
  G.mozKanbanFaces.length = 4;
  addFaceGroup(G.mozKanbanFaces, 3060, 3160, 3260, 4);
}

export function initMekakusi() {
  G.mekakusiFace = SATGetFacePP(130, 230, 330);
}

export function initSpinners() {
  G.slotFaces.length = 5;
  addFaceGroup(G.slotFaces, 6010, 6110, 6210, 5);
  G.spinnerFaces.length = 9;
  addFaceGroup(G.spinnerFaces, 6000, 6100, 6200, 9);
  G.spinnerSmallFaces.length = 2;
  addFaceGroup(G.spinnerSmallFaces, 3052, 3152, 3252, 2);
  G.spinnerExtraFace = SATGetFacePP(7000, 7100, 7200);
}


export function initSegg() {
  G.seggFaces.length = 3;
  for (let i = 0; i < 3; i++) G.seggFaces[i] = SATGetFace(3000 + i);
}

export function InitKing() {
  G.kingFaces.length = 5;
  addFaceGroup(G.kingFaces, 10000, 10100, 10200, 5);
  G.kingExtraFaces.length = 5;
  addFaceGroup(G.kingExtraFaces, 10010, 10110, 10210, 5);
  G.kingExtraFaces2.length = 5;
  addFaceGroup(G.kingExtraFaces2, 10020, 10120, 10220, 5);
}

export function LoadSounds() {
  const names = [
    ['hitEgg', 'HitEgg'], ['hitButa', 'HitButa'], ['getPiyo', 'GetPiyo'],
    ['hitKaizyu', 'HitKaizyu'], ['shootButa', 'ShootButa'], ['timeCount', 'TimeCount'],
    ['kaizyuCatch', 'KaizyuCatch'], ['boingKaizyu', 'BoingKaizyu'], ['bombSound', 'BombSound'],
    ['rainbowEgg', 'RainbowEgg'], ['enterKaizyu', 'EnterKaizyu'], ['enterKanban', 'EnterKanban'],
    ['hypButaBound', 'HypButaBound'], ['hitEgg2', 'HitEgg2'], ['hitEgg3', 'HitEgg3'],
    ['getCoins', 'GetCoins'], ['spin', 'Spin'], ['special', 'Special'],
    ['slowButa', 'SlowButa'], ['litExtra', 'LitExtra'], ['gameOver', 'GAMEOVER'],
    ['boing', 'Boing'], ['dekamoz', 'Dekamoz'], ['hypButa', 'HypButa'],
    ['kingHit', 'KingHit'], ['oh', 'Oh'], ['yahoo', 'Yahoo'], ['newHero', 'NewHero'],
  ];
  for (const [key, name] of names) {
    G.sounds[key] = assets.fork.idByName('snd ', name) ?? 0;
  }
}

// ---------------------------------------------------------------------------
// Difficulty and level setup.
// ---------------------------------------------------------------------------
export function SetUpDifficulty(stage) {
  let s = stage - 1;
  if (s < 0) s = 0;
  if (s > 0x1f) s = 0x1f;
  const data = G.dfTy[s];
  if (!data) return;
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  G.diffSpeed = dv.getInt16(0);
  G.diffMaxSpeed = dv.getInt16(2);
  G.diff2 = dv.getInt16(4);
  G.diff3 = dv.getInt16(6);
  G.diff4 = dv.getInt16(8);
}

export function SetupGloval() {
  G.g1E0A = 0;
  G.g1E04 = 10;
  G.g1E0C = 0;
  G.g1E12 = 0;
}

export function makeEggField(level) {
  const data = level === 32 ? G.egpsGameOver : G.egps[level];
  if (!data) return;
  const count = G.eggCount;
  for (let row = 0; row < 12; row++) {
    const yBase = row * 0x1f;
    for (let col = 0; col < 32; col++) {
      const v = data[col + row * 32];
      let sp = null;
      const x = col * 13 + 3;
      switch (v) {
        case 1: sp = SATNewSprite(10, x, yBase, SetupWhiteEgg); G.eggCount++; break;
        case 2: sp = SATNewSprite(10, x, yBase, SetupYellowEgg); G.eggCount++; break;
        case 3: sp = SATNewSprite(10, x, yBase, SetupGreenEgg); G.eggCount++; break;
        case 4: sp = SATNewSprite(10, x, yBase, SetupBlueEgg); G.eggCount++; break;
        case 5: sp = SATNewSprite(10, x, yBase, SetupRedEgg); G.eggCount++; break;
        case 6: sp = SATNewSprite(10, x, yBase, SetupRbEgg); break;
        case 7: sp = SATNewSprite(10, x, yBase, SetupSteelEgg); break;
        case 16: sp = SATNewSprite(10, x, yBase, SetupBomb); break;
        case 32:
          sp = SATNewSprite(10, col * 13 - 2, yBase + 13, SetupKing);
          G.g1E12 = 1;
          break;
      }
      if (sp) sp.tA0 = ((8 - row) << 1) + 0x28;
    }
  }
}

export function SetUpLevel(stage) {
  SetUpDifficulty(stage);
  // Keep the persistent HUD, discard every sprite from the previous level.
  for (let sp = sat.head; sp;) {
    const next = sp.next;
    if (!sp.hud) sat.unlink(sp);
    sp = next;
  }
  G.eggCount = 0;
  let level = stage - 1;
  if (level > 0x1f) level = 0x1f;
  makeEggField(level);
  makeBlindSprite();
  G.moz = SATNewSprite(2, 0x178, 0x148, SetupMoz);
  G.kaizyu = SATNewSprite(-4, 0x178, 0x13e, SetupKaizyu);
  SetupGloval();
  G.gameState = 0;
  G.g1E18 = G.diff2;
  updateScoreBoard();
  updateButaLeft();
  updateSeggBoard(stage);
  sat.redraw();
}

// ---------------------------------------------------------------------------
// MozMoz.
// ---------------------------------------------------------------------------
export function SetupMoz(sp) {
  sp.anim = 0;
  sp.face = G.mozFaces[0];
  sp.handle = HandleMozMoz;
  sp.hit = hitMozMoz;
  sp.subtype = 2;
  sp.state = 0;
  SetRect(sp.local, 0x10, 4, 0x31, 0x28);
  G.g08EC = 0;
  G.g08F0 = 0;
  sp.baseV = sp.v;
  sp.h2 = sp.h;
  sp.layer = 7;
}

export function SetupDekaMoz(sp) {
  sp.face = null;
  sp.handle = HandleDekaMoz;
  sp.hit = hitDekaMoz;
  sp.subtype = 8;
  SetRect(sp.local, 0x10, 2, 0x40, 0x3c);
}

export function HandleDekaMoz(sp) {
  if (G.g1EA0 === 0) sp.handle = null;
  if (s16(G.gameState) === 0x14) {
    G.g1EA0 = 0;
    sp.handle = null;
    return;
  }
  sp.v = G.moz.v;
  sp.h = G.moz.h;
  sp.state -= 1;
  if (sp.state < 1) G.g1EA0 = 0;
}

export function hitDekaMoz(sp, other) {
  if (other.subtype === -3 && other.state === 2) G.g08F0 = 8;
  if (other.subtype === -7) G.g08F0 = 8;
  if (other.subtype === -2) SATSoundPlay(G.sounds.getPiyo, 1, false);
}

export function makeDekaMoz() {
  SATSoundPlay(G.sounds.dekamoz, 9, true);
  if (G.g1EA0 === 0) {
    const sp = SATNewSprite(8, 0x178, 0x180, SetupDekaMoz);
    sp.state = 0x5dc;
    G.g1EA0 = 1;
  } else {
    for (let sp = sat.head; sp; sp = sp.next) {
      if (sp.subtype === 8) sp.state += 0x5dc;
    }
  }
}

// ---------------------------------------------------------------------------
// Buta setup callbacks.
// ---------------------------------------------------------------------------
export function SetupButa(sp) {
  sp.face = G.butaFaces[0];
  SetRect(sp.local, 5, 5, 0x12, 0x12);
  sp.handle = HandleButa;
  sp.hit = hitButa;
  sp.angle = 0x10e;
  sp.angle2 = 0x10e;
  sp.speed = s16(G.diffSpeed);
  sp.x = s16(sp.h) << 12;
  sp.y = s16(sp.v) << 12;
  sp.oldX = sp.x;
  sp.oldY = sp.y;
  sp.subtype = -3;
  sp.state = 0;
  sp.dir = -1;
  sp.t96 = 0;
  sp.t98 = 0;
  sp.layer = 7;
  sp.count2 = 0;
  sp.count = 0;
  sp.anim = 0;
  sp.tA0 = 0;
  sp.sub = null;
  // The original writes to absolute address 0x1a here (a Mac OS low-memory
  // global); it is not a sprite field.
}

export function SetupButaLeft(sp) {
  sp.hud = true;
  sp.face = null;
  SetRect(sp.local, 0, 0, 0, 0);
  sp.handle = HandleButaLeft;
  sp.subtype = 0;
  sp.layer = 0;
}

export function SetupButaRing(sp) {
  sp.face = null;
  SetRect(sp.local, 0, 0, 0, 0);
  sp.handle = HandleButaRing;
  sp.subtype = 0;
  sp.anim = 0;
  sp.layer = 0;
  sp.sub = null;
}

export function HandleButaLeft(sp) {
  // Intentionally empty.
}

export function HandleButaRing(sp) {
  sp.anim = (sp.anim + 1) % 6;
  sp.face = G.butaRingFaces[sp.anim];
  if (sp.h > 0x178) sp.face = null;
}

// ---------------------------------------------------------------------------
// Egg setup callbacks.  The intact face is kept at +0x8e; the generic
// HandleEgg installs it at +0x16 when the drop-in timer expires.
// ---------------------------------------------------------------------------
function setupEggCommon(sp, subtype, face, state = 1, layer = 1) {
  sp.face = null;
  sp.intactFace = face;
  sp.handle = HandleEgg;
  sp.hit = hitEgg;
  sp.subtype = subtype;
  sp.layer = layer;
  sp.state = state;
  sp.count = 0;
  sp.count2 = 0;
  sp.sub = null;
}

export function SetupWhiteEgg(sp) {
  SetRect(sp.local, 3, 1, 0x1c, 0x1e);
  setupEggCommon(sp, 10, G.eggFaces[0], 1);
}

export function SetupYellowEgg(sp) {
  SetRect(sp.local, 3, 1, 0x1c, 0x1e);
  setupEggCommon(sp, 11, G.eggFaces[1], 1);
}

export function SetupGreenEgg(sp) {
  SetRect(sp.local, 3, 1, 0x1c, 0x1e);
  setupEggCommon(sp, 12, G.eggFaces[2], 1);
}

export function SetupBlueEgg(sp) {
  SetRect(sp.local, 3, 1, 0x1c, 0x1e);
  setupEggCommon(sp, 13, G.eggFaces[3], 2);
}

export function SetupRedEgg(sp) {
  SetRect(sp.local, 3, 1, 0x1c, 0x1e);
  setupEggCommon(sp, 14, G.eggFaces[4], 3);
}

export function SetupRbEgg(sp) {
  SetRect(sp.local, 3, 1, 0x1c, 0x1e);
  setupEggCommon(sp, 15, G.eggFaces[5], 1);
}

export function SetupSteelEgg(sp) {
  SetRect(sp.local, 3, 0, 0x1c, 0x20);
  setupEggCommon(sp, 16, G.eggFaces[6], 1);
  sp.dir = 0;
}

export function SetupBomb(sp) {
  SetRect(sp.local, 4, 1, 0x1b, 0x1e);
  setupEggCommon(sp, 17, G.eggFaces[10], 1);
}

export function SetupPiyo(sp) {
  sp.face = G.piyoFaces[0];
  SetRect(sp.local, 4, 2, 0x1c, 0x1c);
  sp.handle = HandlePiyo;
  sp.hit = hitPiyo;
  sp.subtype = -2;
  sp.anim = 0;
  sp.speed = 0;
  sp.layer = (imod(s16(sp.h) - 3, 0x1a) === 0) ? 4 : 5;
  sp.sub = null;
}

export function SetupBombGhost1(sp) {
  sp.face = null;
  sp.handle = HandleBombGhost1;
  sp.hit = hitBombGhost;
  sp.subtype = -6;
  sp.state = 0x10;
  SetRect(sp.local, 0, 0, 0, 0);
}

export function SetupBombGhost2(sp) {
  sp.face = null;
  sp.handle = HandleBombGhost2;
  sp.hit = hitBombGhost;
  sp.subtype = -6;
  SetRect(sp.local, 0, 0, 0x58, 0x50);
}

export function SetupBombGhost3(sp) {
  sp.face = null;
  sp.handle = HandleBombGhost2;
  sp.hit = hitBombGhost;
  sp.subtype = -6;
  SetRect(sp.local, 0, 0, 0x28, 0x60);
}

export function SetupFire(sp) {
  sp.face = null;
  SetRect(sp.local, 0, 0, 0, 0);
  sp.handle = HandleFire;
  sp.subtype = 0;
  sp.layer = 9;
  sp.speed = 0x20;
  sp.anim = 0;
  sp.state = 0;
  sp.tA0 = 0;
  sp.x = s16(sp.h) << 12;
  sp.y = s16(sp.v) << 12;
  sp.count = 0;
}

export function SetupFire2(sp) {
  sp.face = null;
  SetRect(sp.local, 0, 0, 0, 0);
  sp.handle = HandleFire2;
  sp.subtype = 0;
  sp.layer = 9;
  sp.anim = 0;
  sp.state = 0;
  sp.tA0 = 0;
  sp.x = s16(sp.h) << 12;
  sp.y = s16(sp.v) << 12;
  sp.count = 0;
}

// ---------------------------------------------------------------------------
// Eggs.
// ---------------------------------------------------------------------------
export function HandleEgg(sp) {
  if (!sp.handle) return;
  const state = s16(G.gameState);
  if (state <= 0x14) {
    switch (state) {
      case 2:
        if (sp.subtype >= 18) sp.handle = null;
        else if (sp.subtype >= 15) sp.count = 0x28;
        else sp.handle = null;
        break;
      case 9:
      case 10:
        sp.handle = null;
        break;
      case 11:
        sp.tA0 = 1;
        break;
      case 20:
        sp.handle = null;
        return;
      default:
        break;
    }
  }
  if (sp.count2 > 0) sp.count2--;
  if (sp.count > 0) {
    sp.count--;
    if (sp.count === 0) {
      sp.handle = null;
      return;
    }
  }
  if (sp.tA0 !== -1) {
    if (sp.tA0 >= 0) sp.tA0--;
    if (sp.tA0 === 0) sp.face = sp.intactFace;
  }
}

export function HandleFire(sp) {
  const state = s16(G.gameState);
  if (state === 2 || state === 9) { sp.handle = null; return; }
  sp.tA0++;
  if (sp.tA0 > 3) {
    sp.anim = (sp.anim + 1) % 2;
    sp.face = G.fireFaces[sp.anim + sp.dir] ?? null;
    calcFirePos(sp);
    if (sp.h > 0x168) { sp.face = null; sp.handle = null; }
    if (sp.tA0 > 12) sp.handle = null;
  }
}

export function HandleFire2(sp) {
  const state = s16(G.gameState);
  if (state === 2 || state === 9) { sp.handle = null; return; }
  sp.tA0++;
  sp.anim = (sp.anim + 1) % 2;
  sp.face = G.fireFaces2[sp.anim] ?? null;
  calcFirePos(sp);
  if (sp.h > 0x168) { sp.face = null; sp.handle = null; }
  if (sp.tA0 > 10) sp.handle = null;
}

export function calcFirePos(sp) {
  sp.x = (sp.x + sp.speed * G.cosTable[sp.angle]) | 0;
  sp.y = (sp.y + sp.speed * G.sinTable[sp.angle]) | 0;
  sp.h = s16(sp.x >> 12);
  sp.v = s16(sp.y >> 12);
}

export function HandlePiyo(sp) {
  const state = s16(G.gameState);
  if (state < 0x15) {
    if (state === 2 || state === 9 || state === 10 || state === 11 || state === 20) {
      sp.handle = null;
      return;
    }
  }
  sp.anim = (sp.anim + 1) % 2;
  sp.speed++;
  sp.face = G.piyoFaces[sp.anim] ?? null;
  const accel = sp.speed * sp.speed * 0x5dc + sp.speed * -10000;
  sp.v = s16((sp.y + accel) >> 12);
  if (sp.v > 400) {
    sp.handle = null;
    G.piyoPoints = 10;
    G.g1E12--;
    if (G.g1E12 === 0 && G.eggCount === 0) {
      G.gameState = 1;
      SATSoundPlay(G.sounds.newHero, 10, true);
    }
  }
}

export function HandleBombGhost1(sp) {
  const state = s16(G.gameState);
  if (state === 2 || state === 9) { sp.handle = null; return; }
  sp.state--;
  if (sp.state < 1) {
    sp.handle = null;
    SATNewSprite(-6, sp.h, sp.v, SetupBombGhost2);
  }
}

export function HandleBombGhost2(sp) {
  sp.handle = null;
}

export function hitBombGhost() {}

function spawnPiyoAt(sp) {
  const piyo = SATNewSprite(-2, sp.h, sp.v, SetupPiyo);
  piyo.y = s16(sp.v) << 12;
  G.g1E12++;
  G.eggCount--;
  return piyo;
}

export function hitEgg(sp, other) {
  if (!sp.handle) return;
  if (!(other.subtype === -3 || other.subtype === -6)) return;
  let score = 0;
  const sub = sp.subtype;
  switch (sub) {
    case 10: { // white
      sp.state--;
      if (sp.state === 0) {
        sp.handle = null;
        if (sp.sub) sp.sub.handle = null;
        spawnPiyoAt(sp);
        score = 10;
      }
      break;
    }
    case 11:
    case 12: { // yellow, green
      sp.state--;
      sp.count2 = 2;
      if (sp.state === 0) {
        sp.handle = null;
        if (sp.sub) sp.sub.handle = null;
        spawnPiyoAt(sp);
        score = 10;
      }
      break;
    }
    case 13: { // blue
      if (sp.count2 <= 0) {
        sp.count2 = 4;
        sp.state--;
        if (sp.state === 0) {
          sp.handle = null;
          if (sp.sub) sp.sub.handle = null;
          spawnPiyoAt(sp);
          score = 10;
        } else {
          sp.face = G.eggFaces[7];
        }
      }
      break;
    }
    case 14: { // red
      if (sp.count2 <= 0) {
        sp.count2 = 4;
        sp.state--;
        if (sp.state === 0) {
          sp.handle = null;
          if (sp.sub) sp.sub.handle = null;
          spawnPiyoAt(sp);
          score = 10;
        } else if (sp.state === 2) {
          sp.face = G.eggFaces[8];
        } else {
          sp.face = G.eggFaces[9];
        }
      }
      break;
    }
    case 15: { // rainbow
      sp.state--;
      if (sp.state === 0) {
        sp.handle = null;
        score = 10;
        makeFireworks(sp.v, sp.h);
        const buta = SATNewSprite(-3, sp.h + 4, sp.v - 4, SetupButa);
        if (other.subtype === -3) {
          buta.angle = other.angle;
        } else {
          buta.angle = sp.h < 0xc0 ? 0xf0 : 0x12c;
        }
        buta.state = 2;
        G.butaStarted++;
      }
      break;
    }
    case 16: { // steel egg (never breaks)
      break;
    }
    case 17: { // bomb
      if (!sp.handle) break;
      makeFireworks(sp.v, sp.h);
      sp.state--;
      sp.handle = null;
      score = 10;
      SATNewSprite(0, sp.h - 0x1c, sp.v - 0x10, SetupBombGhost1);
      break;
    }
    default:
      break;
  }

  // Sound and score block.  It runs even when the egg is destroyed.
  if (other.tA0 < 2) {
    if (sub >= 10 && sub <= 12) SATSoundPlay(G.sounds.hitEgg, 1, false);
    else if (sub === 13 || sub === 14) SATSoundPlay(G.sounds.hitEgg2, 1, false);
    else if (sub === 15) SATSoundPlay(G.sounds.rainbowEgg, 8, false);
    else if (sub === 17) SATSoundPlay(G.sounds.bombSound, 8, false);
    else if (sub === 16) SATSoundPlay(G.sounds.hitEgg3, 1, false);
  }
  const mult = G.butaStarted === 0 ? 1 : G.butaStarted;
  G.score += score * mult;
}

export function hitPiyo(piyo, other) {
  if (!piyo.handle) return;
  if (!((other.subtype === 2 && G.g1EA0 === 0) || other.subtype === 8)) return;
  piyo.handle = null;
  addPiyo();
  const extra = G.butaStarted < 2 ? 0 : G.butaStarted - 1;
  makePointsSprite(G.piyoPoints, s16(piyo.v), s16(piyo.h), G.piyoPoints === 100 ? 1 : 0, extra);
  const mult = G.butaStarted === 0 ? 1 : G.butaStarted;
  G.score += G.piyoPoints * mult;
  G.piyoPoints += 10;
  if (G.piyoPoints > 100) G.piyoPoints = 100;
  G.g1E12--;
  if (G.g1E12 === 0 && G.eggCount === 0) {
    G.gameState = 1;
    SATSoundPlay(G.sounds.newHero, 10, true);
  }
}

// ---------------------------------------------------------------------------
// Egg-field extras.
// ---------------------------------------------------------------------------
export function makeFireworks(v, h = v) {
  for (let i = 0; i < 0x12; i++) {
    const sp = SATNewSprite(0, h + 0xc, v + 0xc, SetupFire);
    sp.dir = (i - (i >> 1) * 2) * 2;
    sp.angle = i * 0x14;
  }
}

export function makeFireworks2(v, h = v) {
  for (let i = 0; i < 9; i++) {
    const sp = SATNewSprite(0, h + 0xc, v + 0xc, SetupFire2);
    sp.speed = 9;
    sp.angle = i * 0x28;
  }
  for (let i = 0; i < 9; i++) {
    const sp = SATNewSprite(0, h + 0xc, v + 0xc, SetupFire2);
    sp.speed = 0xe;
    sp.angle = i * 0x28 + 0x14;
    sp.anim = 1;
  }
}

export function makeFireworks3(v, h = v) {
  for (let i = 0; i < 9; i++) {
    const sp = SATNewSprite(0, h + 0xc, v + 0xc, SetupFire);
    sp.dir = (i - (i >> 1) * 2) * 2;
    sp.angle = i * 0x28;
  }
}

// ---------------------------------------------------------------------------
// Piyo roulette (addPiyo / clearPiyo).
// ---------------------------------------------------------------------------
export function addPiyo() {
  G.piyoSlotCount++;
  const sp = G.roulettePiyos[G.piyoSlotCount - 1];
  if (sp) sp.state = 10;
  if (G.piyoSlotCount > 11) {
    G.piyoSlotCount = 0;
    for (let i = 0; i < 12; i++) {
      if (G.roulettePiyos[i]) G.roulettePiyos[i].state = 8;
    }
    if (G.rouletteResult < 1) {
      SATRand(8);
      SATRand(0xc);
      SATRand(0x14);
      G.rouletteResult = SATRand(0xc) + 0x40;
    } else {
      G.queuedSpins++;
    }
  }
}

export function clearPiyo() {
  for (let i = 0; i < 12; i++) {
    if (G.roulettePiyos[i]) G.roulettePiyos[i].state = 0;
  }
}

// ---------------------------------------------------------------------------
// Points sprites.
// ---------------------------------------------------------------------------
export function makePointsSprite(points, v, h, mode, extra) {
  const sprites = [];
  for (let i = 0; i < 4; i++) {
    const sp = SATNewSprite(0, h + (4 - i) * 8 - 0x14, v, SetupPoints);
    sprites.push(sp);
    G.pointsSprites[i] = sp;
    sp.state = mode;
    sp.anim = i - idiv(i, 3) * 3;
  }
  let n = points;
  for (let i = 0; i < 4; i++) {
    const sp = sprites[i];
    if (n === 0) {
      sp.face = null;
    } else {
      sp.count = n - idiv(n, 10) * 10;
      sp.face = mode === 2 ? G.pointsFaces[sp.count + 0x14] : G.pointsFaces[sp.count];
    }
    n = idiv(n, 10);
  }
  if (points === 0) sprites[0].face = G.pointsFaces[0];
  if (extra > 0) {
    const sp = SATNewSprite(0, h + 0x18, v, SetupMulti);
    sp.face = G.multiplierFaces[extra - 1] ?? null;
  }
}

export function SetupPoints(sp) {
  sp.face = null;
  SetRect(sp.local, 0, 0, 0, 0);
  sp.handle = HandlePoints;
  sp.subtype = 0;
  sp.layer = 9;
  sp.anim = 0;
  sp.speed = 0;
  sp.state = 0;
  sp.count = 0;
}

export function SetupMulti(sp) {
  sp.face = null;
  SetRect(sp.local, 0, 0, 0, 0);
  sp.handle = HandleMulti;
  sp.subtype = 0;
  sp.layer = 9;
  sp.anim = 0;
  sp.speed = 0;
  sp.state = 0;
  sp.count = 0;
}

export function SetupScores(sp) {
  sp.hud = true;
  sp.face = null;
  sp.handle = HandleScores;
  sp.subtype = 0;
  sp.layer = 0;
  SetRect(sp.local, 0, 0, 0, 0);
}

export function HandleScores() {}

export function HandlePoints(sp) {
  if (s16(G.gameState) === 9) {
    sp.handle = null;
    return;
  }
  sp.speed++;
  sp.v -= 3;
  if (sp.speed > 10) sp.handle = null;
  sp.anim = (sp.anim + 1) % 3;
  const state = sp.state;
  if (state === 2) {
    sp.v += 3;
  } else if (state > 0 && state < 2 && sp.face) {
    sp.face = G.pointsFaces[sp.count + sp.anim * 10];
  }
}

export function HandleMulti(sp) {
  if (s16(G.gameState) === 9) {
    sp.handle = null;
    return;
  }
  sp.speed++;
  sp.v -= 3;
  if (sp.speed > 10) sp.handle = null;
}

// ---------------------------------------------------------------------------
// MozMoz (the player).
// ---------------------------------------------------------------------------
function mozFace(anim, deka) {
  return G.mozFaces[idiv(anim, 2) + deka * 16 + 8] ?? null;
}
function mozResetFace(anim, deka) {
  return G.mozFaces[idiv(anim, 2) + deka * 16] ?? null;
}
function mozIdleFace(anim, deka) {
  return G.mozExtraFaces[idiv(anim, 4) + deka * 5] ?? null;
}
function mozShootFace(deka, which) {
  return G.mozExtraFaces[deka * 5 + which] ?? null;
}

export function HandleMozMoz(sp) {
  if (s16(G.gameState) === 1 && sp.state !== 4) {
    sp.state = 4;
    return;
  }
  if (s16(G.gameState) === 0x14) {
    sp.handle = null;
    return;
  }
  const sVar12 = G.g1EA0 === 1 ? -0x12 : -0xb;
  const sVar11 = G.g1EA0 === 1 ? -0x11 : 0;
  if (s16(G.gameState) > 8) {
    sp.face = G.mozExtraFaces[1] ?? null;
    if (G.g1EA0 === 1) {
      G.g1EA0 = 0;
      sp.h -= sVar12;
      sp.h += -0xb;
      sp.v -= sVar11;
    }
    return;
  }
  const mouseV = G.mouseV;
  const mouseH = G.mouseH;
  const state = sp.state;
  if (state !== 3) {
    if (state < 3) {
      if (state === 1) {
        G.g1E18 = s16(G.diff2);
        const pointV = sp.v - 0x18;
        const pointH = sp.h + 0xc;
        if (sp.count > 0) sp.count--;
        sp.anim = (sp.anim + 1) & 0xf;
        sp.face = mozIdleFace(sp.anim, G.g1EA0);
        if (sp.count === 0x3c) {
          makePointsSprite(2, pointV, pointH, 2, 0);
          SATSoundPlay(G.sounds.timeCount, 1, false);
        } else if (sp.count < 0x3c) {
          if (sp.count === 0x1e) {
            makePointsSprite(1, pointV, pointH, 2, 0);
            SATSoundPlay(G.sounds.timeCount, 1, false);
          } else if (sp.count < 0x1e && sp.count === 0) {
            SATSoundPlay(G.sounds.shootButa, 1, false);
            sp.state = 3;
            if (G.currentButa) G.currentButa.state = 2;
          }
        } else if (sp.count === 0x5a) {
          makePointsSprite(3, pointV, pointH, 2, 0);
          SATSoundPlay(G.sounds.timeCount, 1, false);
        }
        if (Button()) {
          SATSoundPlay(G.sounds.shootButa, 1, false);
          sp.state = 3;
          if (G.currentButa) G.currentButa.state = 2;
        }
        // LAB_10000ecc
        sp.v = sp.baseV;
        sp.h = sp.h2 + sVar12;
        sp.v += sVar11;
        return;
      }
      if (state > 0) {
        sp.anim = (sp.anim + 1) & 0xf;
        sp.face = mozFace(sp.anim, G.g1EA0);
        sp.h2 -= 4;
        if (sp.h2 <= 0xa5) {
          sp.h2 = 0xa5;
          sp.face = mozIdleFace(sp.anim, G.g1EA0);
          sp.state = 1;
          if (G.currentButa) G.currentButa.state = 1;
        }
        // LAB_10000ecc
        sp.v = sp.baseV;
        sp.h = sp.h2 + sVar12;
        sp.v += sVar11;
        return;
      }
      if (state >= 0) {
        sp.state = 2;
        sp.count = 0xa5;
        G.g1EA0 = 0;
        const buta = SATNewSprite(-3, sp.h2 + 10, sp.baseV - 0x28, SetupButa);
        G.currentButa = buta;
        G.butaStarted = 1;
        // LAB_10000ecc
        sp.v = sp.baseV;
        sp.h = sp.h2 + sVar12;
        sp.v += sVar11;
        return;
      }
    } else {
      if (state === 5) {
        if (G.kaizyu && G.kaizyu.state === 5) {
          G.g08F0--;
          if (G.g08F0 !== 0) {
            sp.face = null;
            sp.h = G.kaizyu.h + 0x10;
            return;
          }
          sp.state = 3;
          sp.face = mozShootFace(G.g1EA0, 0);
          G.kaizyu.state = 0;
          G.kaizyu.count = 0x14;
        } else {
          G.g08F0 = 0;
          sp.state = 3;
          sp.face = mozShootFace(G.g1EA0, 0);
        }
        // LAB_10000ecc
        sp.v = sp.baseV;
        sp.h = sp.h2 + sVar12;
        sp.v += sVar11;
        return;
      }
      if (state < 5) {
        G.g1E18 = s16(G.diff2);
        sp.anim = (sp.anim + 1) & 0xf;
        sp.face = mozResetFace(sp.anim, G.g1EA0);
        sp.h2 += 4;
        if (sp.h2 >= 0x178) {
          if (s16(G.gameState) === 1) {
            sp.handle = null;
          } else {
            G.g1E0A = 0;
            sp.h2 = 0x178;
            sp.face = mozIdleFace(sp.anim, G.g1EA0);
            sp.state = 0;
            sp.count = 0xa5;
            G.g08F0 = 0;
            if (G.currentButa) G.currentButa.handle = null;
            updateButaLeft();
            updateSeggBoard(G.stage);
          }
        }
        // LAB_10000ecc
        sp.v = sp.baseV;
        sp.h = sp.h2 + sVar12;
        sp.v += sVar11;
        return;
      }
    }
  }

  // State 3 (normal control), and the fall-through for unrecognised states.
  sp.face = mozFace(sp.anim, G.g1EA0);
  if (G.g08F0 > 0) {
    if (G.g08F0 < 3) sp.face = mozShootFace(G.g1EA0, 1);
    else sp.face = mozShootFace(G.g1EA0, 4);
    G.g08F0--;
    sp.v = sp.baseV;
    sp.h = sp.h2 + sVar12;
    sp.v += sVar11;
    return;
  }

  let delta = G.mouseH - sp.h2;
  delta = idiv(delta, 4);
  if (delta > 0x20) delta = 0x20;
  if (delta < -0x20) delta = -0x20;
  if (delta < 1 && delta > -1) delta = 0;
  sp.h2 += delta;
  if (sp.h2 > 0x14b) {
    sp.h2 = 0x14b;
    delta = 0;
  }
  if (sp.h2 < 0) {
    sp.h2 = 0;
    delta = 0;
  }
  let moveDir = 0;
  if (delta > 0) moveDir = 0;
  if (delta < 0) {
    moveDir = 0x10;
    if (sp.anim < 0x10) sp.anim += 0x10;
  }
  sp.anim++;
  if (delta > 0xf) sp.anim++;
  if (delta < -0xf) sp.anim++;
  if (delta === 0) {
    if (sp.anim > 0xf) sp.anim = 0;
    sp.face = mozIdleFace(sp.anim, G.g1EA0);
  } else {
    if (moveDir + 0x10 <= sp.anim) sp.anim = moveDir;
    sp.face = mozResetFace(sp.anim, G.g1EA0);
    G.g08EC = 0;
  }
  sp.v = sp.baseV;
  sp.h = sp.h2 + sVar12;
  sp.v += sVar11;
}

export function hitMozMoz(sp, other) {
  if (other.subtype === -3 && other.state === 2 && G.g1EA0 === 0) G.g08F0 = 8;
  if (other.subtype === -7) G.g08F0 = 8;
  if (other.subtype === -2) SATSoundPlay(G.sounds.getPiyo, 1, false);
  if (other.subtype === -4 && other.state === 0 && sp.state === 3) {
    G.g08EC++;
    if (G.g08EC > 4) {
      G.g08EC = -0x28;
      G.g08F0 = 0x1e;
      sp.state = 5;
      sp.h = G.kaizyu.h + 0x10;
      SATSoundPlay(G.sounds.kaizyuCatch, 9, true);
    }
  }
}

// ---------------------------------------------------------------------------
// Bouncing movement.
// ---------------------------------------------------------------------------
export function calcPos(sp, range) {
  const mag = sp.speed >> 5;
  // C remainder: a - (a/b)*b with truncating division.
  sp.angle = sp.angle - idiv(sp.angle, 360) * 360;
  let x = sp.x + mag * G.cosTable[sp.angle];
  let y = sp.y + mag * G.sinTable[sp.angle];
  let left = s16(x >> 12);
  let top = s16(y >> 12);
  let bounceH = false;
  let bounceV = false;

  if (left < -4) {
    left = -4;
    x = -0x4000;
    sp.t9a = s16(sp.t9a + 1);
    if (sp.angle >= 0x5a && sp.angle <= 0x10e) {
      if (sp.angle < 0xb9) {
        if (sp.angle >= 0xb4) sp.angle = SATRand(3) + 0xb8;
      }
      if (sp.angle >= 0xb4) {
        // fall through to the bounce flag below
      } else if (sp.angle >= 0xaf) {
        sp.angle = 0xaf - SATRand(3);
      }
      bounceH = true;
    }
  }
  if (left > 0x164) {
    left = 0x164;
    x = 0x164000;
    sp.t9a = s16(sp.t9a + 1);
    if (sp.angle <= 0x5a || sp.angle >= 0x10e) {
      if (sp.angle < 5) sp.angle = SATRand(3) + 4;
      if (sp.angle > 0x163) sp.angle = 0x163 - SATRand(3);
      bounceH = true;
    }
  }
  if (top < -6) {
    top = -6;
    y = -0x6000;
    sp.t9a = s16(sp.t9a + 1);
    if (sp.t9a > 0x50) {
      if (sp.angle < 0xb4) {
        if (sp.angle < 0x10e) sp.angle += SATRand(3);
        else sp.angle -= SATRand(3);
      } else {
        if (sp.angle >= 0x10e) sp.angle -= SATRand(3);
        else sp.angle += SATRand(3);
      }
      if (sp.angle <= 0xb7) sp.angle += SATRand(3);
      if (sp.angle >= 0x165) sp.angle -= SATRand(3);
      sp.angle = sp.angle - idiv(sp.angle, 360) * 360;
    }
    if (sp.angle >= 0xb4 && sp.angle <= 0x168) bounceV = true;
  }

  const ret = top <= 0x15c;
  if (bounceH) {
    if (sp.angle > 0xb4) {
      sp.angle = 0x168 - (sp.angle - 0xb4);
    } else {
      sp.angle = 0xb4 - sp.angle;
    }
    x = sp.x + mag * G.cosTable[sp.angle];
    left = s16(x >> 12);
  }
  if (bounceV) {
    sp.angle = 0x168 - sp.angle;
    y = sp.y + mag * G.sinTable[sp.angle];
    top = s16(y >> 12);
  }
  sp.x = x;
  sp.y = y;
  sp.h = left;
  sp.v = top;
  return ret;
}

export function calcWave(sp, pointV, pointH, lo, hi, speed, factor) {
  sp.angle += sp.dir * factor;
  if (sp.angle > hi) {
    sp.angle = hi;
    sp.dir = -1;
  }
  if (sp.angle < lo) {
    sp.angle = lo;
    sp.dir = 1;
  }
  const x = (pointH << 12) + speed * G.cosTable[sp.angle];
  const y = (pointV << 12) + speed * G.sinTable[sp.angle];
  sp.x = x;
  sp.y = y;
  sp.h = s16(x >> 12);
  sp.v = s16(y >> 12);
}

export function HandleButa(sp) {
  const game = s16(G.gameState);
  if (game <= 0x14) {
    if (game === 1) {
      makeFireworks2(sp.v, sp.h);
      sp.handle = null;
      if (sp.sub && sp.sub.handle && sp.tA0 > 0) sp.sub.handle = null;
      sp.tA0 = 0;
      return;
    }
    if (game === 9 || game === 11 || game === 20) {
      sp.handle = null;
      if (sp.sub && sp.sub.handle && sp.tA0 > 0) sp.sub.handle = null;
      sp.tA0 = 0;
      return;
    }
  }
  if (sp.tA0 === 1) {
    sp.sub = SATNewSprite(0, sp.h, sp.v, SetupButaRing);
    sp.tA0++;
  }
  if (sp.tA0 > 600) {
    sp.tA0 = 0;
    if (sp.sub && sp.sub.handle) sp.sub.handle = null;
  }
  sp.t96 = 0;
  sp.t98 = 0;
  sp.oldX = sp.x;
  sp.oldY = sp.y;
  if (sp.count2 > 0) sp.count2--;
  if (s16(G.diffMaxSpeed) < sp.speed) sp.speed = s16(G.diffMaxSpeed);
  sp.anim = (sp.anim + 1) & 0xf;
  sp.face = G.butaFaces[sp.anim] ?? null;

  switch (sp.state) {
    case 0:
      sp.h -= 4;
      sp.x = sp.h << 12;
      break;
    case 1:
      calcWave(sp, G.moz.v, G.moz.h + 0x14, 0xdc, 0x140, 0xa0, 4);
      break;
    case 2: {
      const before = sp.state;
      const ret = calcPos(sp, 0x10);
      if (!ret) {
        sp.state = 3;
        sp.v = 0x164;
        sp.y = sp.v << 12;
        if (G.butaStarted === 1) {
          SATSoundPlay(G.sounds.oh, 10, true);
        } else {
          let found = false;
          for (let other = sat.head; other; other = other.next) {
            if (other.subtype === -3 && other.state === 2) found = true;
          }
          if (!found) SATSoundPlay(G.sounds.oh, 10, true);
        }
      }
      break;
    }
    case 3: {
      sp.h = s16((sp.x + sp.count * (sp.speed >> 5) * G.cosTable[sp.angle]) >> 12);
      sp.v = s16((sp.y + sp.count * sp.count * 2000 + sp.count * -50000) >> 12);
      sp.count++;
      if (sp.v > 400 && sp.handle) {
        sp.state = 4;
        G.butaStarted--;
        if (G.butaStarted === 0) {
          if (G.moz) G.moz.state = 4;
          if (G.kaizyu && G.kaizyu.state !== 4 && G.kaizyu.state !== 9 && G.kaizyu.state !== 10) G.kaizyu.state = 4;
          G.piyoPoints = 10;
          G.g1E0A = 0;
          G.butaCount--;
          if (G.butaCount === 0) G.gameState = 9;
        }
      }
      if (sp.h > 0x178) sp.face = null;
      break;
    }
    case 4:
      sp.handle = null;
      if (sp.sub && sp.sub.handle && sp.tA0 > 0) sp.sub.handle = null;
      sp.tA0 = 0;
      break;
    default:
      if (!calcPos(sp, 0x10)) {
        sp.state = 3;
        sp.v = 0x164;
        sp.y = sp.v << 12;
        if (G.butaStarted === 1) {
          SATSoundPlay(G.sounds.oh, 10, true);
        } else {
          let found = false;
          for (let other = sat.head; other; other = other.next) {
            if (other.subtype === -3 && other.state === 2) found = true;
          }
          if (!found) SATSoundPlay(G.sounds.oh, 10, true);
        }
      }
      break;
  }
  sp.angle2 = sp.angle;
  if (sp.tA0 > 1) {
    sp.tA0++;
    if (sp.sub) {
      sp.sub.v = sp.v;
      sp.sub.h = sp.h;
    }
  }
}

export function hitButa(buta, other) {
  if (buta.state !== 2) return;
  const sub = other.subtype;

  const finish = () => {
    // 0x47ec: keep the ring sprite glued to the Butasan while it is active.
    if (buta.tA0 > 1 && buta.sub) {
      buta.sub.v = buta.v;
      buta.sub.h = buta.h;
    }
  };

  switch (sub) {
    case 1: {
      // 0x3cdc
      if (buta.count2 > 0) break;
      const diff = (buta.h + 0xc) - (other.h + 0x24);
      buta.angle = idiv(diff * 3 + 0x10e, 10) * 10;
      if (buta.angle > 0x14a) buta.angle = 0x14a;
      if (buta.angle < 0xd2) buta.angle = 0xd2;
      if (buta.angle === 0x10e) buta.angle += 0xa;
      buta.speed += 0xe;
      buta.count2 = 0;
      buta.t9a = 0;
      break;
    }
    case 2: {
      // 0x3758
      if (G.g1EA0 === 1) break;
      if (buta.count2 > 0) break;
      if (buta.state !== 2) break;
      if (!other.face) break;
      SATSoundPlay2(G.sounds.hitButa, 1, false, 1);
      const diff = (buta.h + 0xc) - (other.h + 0x20);
      buta.angle = idiv(diff * 4 + 0x10e, 5) * 5;
      if (buta.angle > 0x14a) buta.angle = 0x14a;
      if (buta.angle < 0xd2) buta.angle = 0xd2;
      if (buta.angle === 0x10e) buta.angle += 5;
      buta.speed += 4;
      buta.count2 = 3;
      buta.t9a = 0;
      break;
    }
    case 7: {
      // 0x3844 (MozKanban)
      if (buta.state !== 2) break;
      if (!other.face) break;
      if (buta.count2 > 0) break;
      SATSoundPlay(G.sounds.boing, 1, false);
      const diff = (buta.h + 0xc) - (other.h + 0x14);
      buta.angle = idiv(diff * 3 + 0x10e, 10) * 10;
      if (buta.angle > 0x15e) buta.angle = 0x163;
      if (buta.angle < 0xbe) buta.angle = 0xc3;
      if (buta.angle === 0x10e) buta.angle += 0xa;
      buta.speed += 4;
      buta.count2 = 4;
      buta.t9a = 0;
      break;
    }
    case 8: {
      // 0x3688 (DekaMoz)
      if (buta.state !== 2) break;
      if (buta.count2 > 0) break;
      SATSoundPlay2(G.sounds.hitButa, 1, false, 1);
      const diff = (buta.h + 0xc) - (other.h + 0x28);
      buta.angle = idiv(diff * 4 + 0x10e, 10) * 10;
      if (buta.angle > 0x14a) buta.angle = 0x14a;
      if (buta.angle < 0xd2) buta.angle = 0xd2;
      if (buta.angle === 0x10e) buta.angle += 0xa;
      buta.speed += 4;
      buta.count2 = 4;
      buta.t9a = 0;
      break;
    }
    case 10: case 11: case 12:
      hitButaEgg(buta, other, sub);
      break;
    case 13: case 14:
      // The original jump table sends blue/red to 0x3d90, then the subtype
      // switch at 0x3e4c runs recalcButa and adds two more speed units
      // (0x40cc..0x40e0).  The subtype must be carried through.
      hitButaEgg(buta, other, sub);
      break;
    case 15:
      hitButaEgg(buta, other, 15);
      break;
    case 16:
      hitButaEgg(buta, other, 16);
      break;
    case 17:
      hitButaEgg(buta, other, 17);
      break;
    case 18: {
      // 0x3ba0 (right hand)
      if (buta.state !== 2) break;
      if (!other.face) break;
      if (buta.count2 > 0) break;
      buta.angle = 0x13b + SATRand(9) * 0xa;
      buta.angle = imod(buta.angle, 0x168);
      buta.speed += 0x30;
      buta.count2 = 0;
      buta.t9a = 0;
      break;
    }
    case 19: {
      // 0x3b34 (left hand)
      if (buta.state !== 2) break;
      if (!other.face) break;
      if (buta.count2 > 0) break;
      buta.angle = 0x87 + SATRand(9) * 0xa;
      buta.speed += 0x30;
      buta.count2 = 0;
      buta.t9a = 0;
      break;
    }
    case 20: {
      // 0x3c24 (foot)
      const diff = (buta.h + 0xc) - (other.h + 0x64);
      let a = buta.angle;
      if (a < 0x5a && diff < 0) a = 0xb4 - a;
      if (a > 0x10e && diff < 0) a = 0x10e - (a - 0x10e);
      if (a >= 0x5a && a < 0xb4 && diff >= 0) a = 0xb4 - a;
      if (a >= 0xb4 && a <= 0x10e && diff >= 0) a = 0x168 - (0xb4 - a);
      buta.angle = a;
      buta.speed += 0xe;
      buta.count2 = 0;
      buta.t9a = 0;
      break;
    }
    case 21: {
      // 0x391c (King of Eggs)
      if (buta.state !== 2) break;
      if (!other.face) break;
      if (buta.count2 > 0) break;
      const dh = (buta.h + 0xc) - (other.h + 0x64);
      const dv = (buta.v + 0xc) - (other.v + 0x4b);
      let a = buta.angle;
      if (buta.v + 0xc >= other.v + 0x22) {
        // lower part of the king
        if (a < 0x5a && dh < 0) a = 0xb4 - a;
        if (a > 0x10e && dh < 0) a = 0x10e - (a - 0x10e);
        if (a >= 0x5a && a < 0xb4 && dh >= 0) a = 0xb4 - a;
        if (a >= 0xb4 && a <= 0x10e && dh >= 0) a = 0x168 - a;
      } else if (buta.h + 0xc >= other.h + 0x4a) {
        if (buta.h + 0xc <= other.h + 0x7a) {
          if (a < 0xb4) a = 0x168 - a;
          else a = 0x168 - (a - 0xb4);
        } else {
          if (a >= 0x5a && a < 0xb4) a = 0xb4 - a;
          if (a >= 0xb4 && a < 0x10e) a = 0x168 - (a - 0xb4);
        }
      } else {
        if (a < 0x5a) a = 0xb4 - a;
        if (a > 0x10e) a = 0x10e - (a - 0x10e);
      }
      buta.angle = a;
      buta.speed += 0x20;
      buta.count2 = 0;
      buta.t9a = 0;
      break;
    }
    default:
      // Cases 0, 3, 4, 5, 6 and 9 are no-ops in the jump table.
      break;
  }
  finish();
}

// 0x3d90/0x3dc0/0x3de4: the shared egg-contact path.  `entry` selects the
// original jump-table target: 10..14 = 0x3d90, 15 = 0x3de4, 16 = 0x3dc0,
// 17 = 0x3de4.  The subtype switch after 0x3e4c distinguishes blue/red
// (recalcButa) from white/yellow/green/rainbow (no recalc).
function hitButaEgg(buta, other, entry) {
  const commonEgg = entry >= 10 && entry <= 14;
  if (commonEgg) {
    buta.t98 = s16(buta.t98 + 1);
    if (buta.t98 === 1) {
      buta.savedV = s16(other.v);
      buta.h2 = s16(other.h);
      buta.angle2 = buta.angle;
    }
    buta.t9a = 0;
  }
  if (commonEgg || entry === 16) {
    if (buta.tA0 >= 2) SATSoundPlay(G.sounds.hypButaBound, 3, false);
  }
  if (buta.tA0 >= 2) {
    const ghost = SATNewSprite(-6, s16(buta.h - 0xa), s16(buta.v - 0x28), SetupBombGhost3);
    ghost.tA0 = 2;
    makeFireworks3(s16(buta.v - 0x28), s16(buta.h - 0xa));
  }
  buta.speed += 2;

  if (entry === 16) {
    buta.t96 = s16(buta.t96 + 1);
    if (buta.t96 === 1) {
      buta.angle2 = buta.angle;
      buta.otherV = s16(other.v);
      buta.otherH = s16(other.h);
    }
    recalcButa(buta, other);
    buta.speed += 4;
    buta.t9a = s16(buta.t9a + 1);
    if (buta.t9a > 0x26) {
      buta.angle += SATRand(2);
      buta.angle = imod(buta.angle, 0x168);
    }
    if (buta.t9a > 0x28) {
      buta.angle += SATRand(2);
      buta.angle = imod(buta.angle, 0x168);
      if (buta.angle < 5) buta.angle += 3;
      if (buta.angle > 0x163) buta.angle -= 3;
    }
    if (buta.t9a > 0x38) {
      buta.angle += SATRand(5);
      buta.angle += 0x166;
      buta.angle = imod(buta.angle, 0x168);
      if (buta.angle < 6) buta.angle += 3;
      if (buta.angle > 0x162) buta.angle -= 3;
    }
    if (buta.t9a > 0x50) {
      buta.angle += SATRand(8);
      buta.angle += 0x164;
      buta.angle = imod(buta.angle, 0x168);
      if (buta.angle < 7) buta.angle += 3;
      if (buta.angle > 0x161) buta.angle -= 3;
    }
    if (buta.t9a > 0x3e8) {
      buta.t9a = 0;
      buta.h = s16(SATRand(0x20) + 0xbc);
      buta.v = 8;
      buta.count2 = 0x46;
      buta.x = s16(buta.h) << 12;
      buta.y = s16(buta.v) << 12;
    }
  } else if (entry === 13 || entry === 14) {
    recalcButa(buta, other);
    buta.speed += 2;
  } else if (entry === 17) {
    buta.speed += 3;
    buta.t9a = 0;
  }

  hitButaEggPush(buta, other);
}

// 0x4104..0x47e8: keep the bounced Butasan outside the egg.  The original
// compares the centres and nudges the 16-bit h/v position by one pixel only
// while the ball is actually overlapping the egg's local rect.
function hitButaEggPush(buta, other) {
  if (!other.face) return;
  buta.count2 = 0;
  const dh = (buta.h + 0xc) - (other.h + 0x10);
  const dv = (buta.v + 0xc) - (other.v + 0x10);
  const dh2 = dh * dh;
  const dv2 = dv * dv - 4;

  if (other.subtype === 0x10 && buta.t96 !== 1) {
    buta.angle = buta.angle2;
    if (buta.t96 !== 2) {
      buta.angle = imod(buta.angle + 0xb4, 0x168);
      buta.count2 = 1;
      return;
    }
    if (buta.otherH === s16(other.h)) {
      const a = buta.angle;
      if (a > 0xb4) {
        if (dh > 0 && a < 0x10e) {
          buta.angle = 0x10e - (a - 0x10e);
          if (dh < 0x12) { buta.h = s16(buta.h + 1); buta.x = s16(buta.h) << 12; }
          return;
        }
        if (dh > 0) return;
        if (a < 0x10e) return;
        buta.angle = 0x10e - (a - 0x10e);
        if (dh <= -0x12) return;
        buta.h = s16(buta.h - 1); buta.x = s16(buta.h) << 12;
        return;
      }
      if (dh > 0 && a > 0x5a) {
        buta.angle = 0xb4 - a;
        if (dh < 0x12) { buta.h = s16(buta.h + 1); buta.x = s16(buta.h) << 12; }
        return;
      }
      if (dh > 0) return;
      if (a > 0x5a) return;
      buta.angle = 0xb4 - a;
      if (dh <= -0x12) return;
      buta.h = s16(buta.h - 1); buta.x = s16(buta.h) << 12;
      return;
    }
    // 0x42b8 compares 0x86 (otherV), which is populated by the steel-egg
    // entry at 0x43d4.  Using savedV (0x8a) here made steel-egg bounces read
    // a stale value and could reflect the Butasan horizontally when it should
    // have bounced vertically.
    if (buta.otherV === s16(other.v)) {
      const a = buta.angle;
      if (a > 0xb4) {
        if (dv > 0) {
          buta.angle = 0x168 - a;
          if (dv < 0x12) { buta.v = s16(buta.v + 1); buta.y = s16(buta.v) << 12; }
          return;
        }
        return;
      }
      if (dv > 0) return;
      buta.angle = 0x168 - a;
      if (dv <= -0x12) return;
      buta.v = s16(buta.v - 1); buta.y = s16(buta.v) << 12;
      return;
    }
    buta.angle = imod(buta.angle + 0xb4, 0x168);
    return;
  }

  if (buta.t98 > 1) {
    buta.angle = buta.angle2;
    if (buta.t98 !== 2) {
      buta.angle = imod(buta.angle + 0xb4, 0x168);
      return;
    }
    if (buta.h2 === s16(other.h)) {
      const a = buta.angle;
      if (a > 0xb4) {
        if (dh > 0 && a < 0x10e) {
          buta.angle = 0x10e - (a - 0x10e);
          if (dh < 0x12) { buta.h = s16(buta.h + 1); buta.x = s16(buta.h) << 12; }
          return;
        }
        if (dh > 0) return;
        if (a < 0x10e) return;
        buta.angle = 0x10e - (a - 0x10e);
        if (dh <= -0x12) return;
        buta.h = s16(buta.h - 1); buta.x = s16(buta.h) << 12;
        return;
      }
      if (dh > 0 && a > 0x5a) {
        buta.angle = 0xb4 - a;
        if (dh < 0x12) { buta.h = s16(buta.h + 1); buta.x = s16(buta.h) << 12; }
        return;
      }
      if (dh > 0) return;
      if (a > 0x5a) return;
      buta.angle = 0xb4 - a;
      if (dh <= -0x12) return;
      buta.h = s16(buta.h - 1); buta.x = s16(buta.h) << 12;
      return;
    }
    if (buta.savedV === s16(other.v)) {
      const a = buta.angle;
      if (a > 0xb4) {
        if (dv > 0) {
          buta.angle = 0x168 - a;
          if (dv < 0x12) { buta.v = s16(buta.v + 1); buta.y = s16(buta.v) << 12; }
          return;
        }
        return;
      }
      if (dv > 0) return;
      buta.angle = 0x168 - a;
      if (dv <= -0x12) return;
      buta.v = s16(buta.v - 1); buta.y = s16(buta.v) << 12;
      return;
    }
    buta.angle = imod(buta.angle + 0xb4, 0x168);
    return;
  }

  if (dh2 > dv2) {
    const a = buta.angle;
    if (a > 0xb4) {
      if (a < 0x10e && dh > 0) {
        buta.angle = 0x10e - (a - 0x10e);
        if (dh < 0x12 && other.subtype === 0x10) {
          buta.h = s16(buta.h + 1); buta.x = s16(buta.h) << 12;
        }
        return;
      }
      if (a < 0x10e) return;
      if (dh > 0) return;
      buta.angle = 0x10e - (a - 0x10e);
      if (dh <= -0x12) return;
      if (other.subtype !== 0x10) return;
      buta.h = s16(buta.h - 1); buta.x = s16(buta.h) << 12;
      return;
    }
    if (a < 0x5a && dh < 0) {
      buta.angle = 0xb4 - a;
      if (dh > -0x12 && other.subtype === 0x10) {
        buta.h = s16(buta.h - 1); buta.x = s16(buta.h) << 12;
      }
      return;
    }
    if (a < 0x5a) return;
    if (dh < 0) return;
    buta.angle = 0xb4 - a;
    if (dh >= 0x12) return;
    if (other.subtype !== 0x10) return;
    buta.h = s16(buta.h + 1); buta.x = s16(buta.h) << 12;
    return;
  }

  const a = buta.angle;
  if (a < 0xb4 && dv < 0) {
    buta.angle = 0x168 - a;
    if (dv > -0x12) { buta.v = s16(buta.v - 1); buta.y = s16(buta.v) << 12; }
    return;
  }
  if (a < 0xb4) return;
  if (dv < 0) return;
  buta.angle = 0x168 - a;
  if (dv >= 0x12) return;
  buta.v = s16(buta.v + 1); buta.y = s16(buta.v) << 12;
}

export function recalcButa(buta, other) {
  const origSpeed = buta.speed;
  const origAngle = buta.angle;
  buta.angle = buta.angle2;

  const target = makeRect();
  copyRect(target, other.local);
  offsetRect(target, s16(other.h), s16(other.v));

  const base = origSpeed >> 4;
  let factor = 7;
  let covered = false;
  const pos = makeRect();
  const scratch = makeRect();
  while (!covered) {
    factor++;
    buta.speed = s16(factor) * s16(base);
    buta.x = buta.oldX;
    buta.y = buta.oldY;
    calcPos(buta);
    copyRect(pos, buta.local);
    offsetRect(pos, s16(buta.h), s16(buta.v));
    covered = sectRect(pos, target, scratch);
    if (factor === 0x10) {
      covered = true;
      buta.speed = s16(origSpeed);
    }
  }
  if (factor === 8) buta.speed = s16(origSpeed);
  buta.x = buta.oldX;
  buta.y = buta.oldY;
  calcPos(buta);
  buta.speed = s16(origSpeed);
  buta.angle = origAngle;
  return factor;
}

export function makeButaLeft(v, h) {
  G.butaLeftSprites.length = 5;
  for (let i = 0; i < 5; i++) {
    G.butaLeftSprites[i] = SATNewSprite(0, h - i * 0x18, v, SetupButaLeft);
  }
}

export function updateButaLeft() {
  for (let i = 0; i < 5; i++) {
    if (G.butaLeftSprites[i]) G.butaLeftSprites[i].face = null;
  }
  for (let i = 0; i < s16(G.butaCount) - 1; i++) {
    if (G.butaLeftSprites[i]) G.butaLeftSprites[i].face = G.g0928;
  }
}

// ---------------------------------------------------------------------------
// Score and stage boards.
// ---------------------------------------------------------------------------
export function makeScoreBoard(v, h) {
  G.scoreSprites.length = 8;
  for (let i = 0; i < 8; i++) {
    G.scoreSprites[i] = SATNewSprite(0, h + (8 - i) * 0xc, v, SetupScores);
  }
}

export function updateScoreBoard() {
  if (G.score !== G.lastScore) {
    let n = G.score;
    for (let i = 0; i < 8; i++) {
      const sp = G.scoreSprites[i];
      if (!sp) continue;
      if (n === 0) sp.face = null;
      else sp.face = G.scoreFaces[n % 10] ?? null;
      n = idiv(n, 10);
    }
    if (G.score === 0 && G.scoreSprites[0]) G.scoreSprites[0].face = G.scoreFaces[0];
    if (G.nextExtra <= G.score) {
      G.butaCount++;
      updateButaLeft();
      SATSoundPlay(G.sounds.special, 10, true);
      G.nextExtra += 100000;
    }
    if (G.pref.highscores && G.pref.highscores[4] < G.score && G.scoreBoardOn === 1) {
      SATSoundPlay(G.sounds.newHero, 10, true);
      G.scoreBoardOn = 0;
    }
    G.lastScore = G.score;
  }
}

export function makeSeggBoard(v, h) {
  G.segSprites.length = 10;
  for (let i = 0; i < 10; i++) {
    G.segSprites[i] = SATNewSprite(0, h - i * 8, v, SetupSegg);
  }
}

export function updateSeggBoard(stage) {
  let p = stage | 0;
  if (p > 99) p = 99;
  const rem5 = p - idiv(p, 5) * 5;
  const five = idiv(p, 5);
  const over4 = (p - idiv(p, 10) * 10) > 4;
  const tens = idiv(p, 10);
  for (let i = 0; i < rem5; i++) {
    if (G.segSprites[i]) G.segSprites[i].face = G.seggFaces[0];
  }
  for (let i = rem5; i < rem5 + (over4 ? 1 : 0); i++) {
    if (G.segSprites[i]) G.segSprites[i].face = G.seggFaces[1];
  }
  for (let i = rem5 + (over4 ? 1 : 0); i < rem5 + (over4 ? 1 : 0) + tens; i++) {
    if (G.segSprites[i]) G.segSprites[i].face = G.seggFaces[2];
  }
  for (let i = rem5 + (over4 ? 1 : 0) + tens; i < 10; i++) {
    if (G.segSprites[i]) G.segSprites[i].face = null;
  }
  // Keep the unused variables from the original to make the intent clear.
  void five;
}

export function SetupSegg(sp) {
  sp.hud = true;
  sp.face = null;
  sp.handle = HandleSegg;
  sp.subtype = 0;
  sp.layer = 0;
  SetRect(sp.local, 0, 0, 0, 0);
}

export function HandleSegg() {}

// ---------------------------------------------------------------------------
// Blind overlay.
// ---------------------------------------------------------------------------
export function makeBlindSprite() {
  G.blindSprites.length = 0x13;
  G.g21AC = 1;
  for (let i = 0; i < 0x13; i++) {
    const sp = SATNewSprite(0, 0, i << 4, SetupBlind);
    sp.state = (0x13 - i) * 2 + 0x2f;
    sp.dir = i - idiv(i, 2) * 2;
    sp.extra66 = i === 0x12 ? 1 : 0;
    G.blindSprites[i] = sp;
  }
}

export function SetupBlind(sp) {
  sp.face = null;
  SetRect(sp.local, 0, 0, 0, 0);
  sp.handle = HandleBlind;
  sp.subtype = 0;
  sp.layer = 8;
}

export function HandleBlind(sp) {
  if (s16(G.gameState) === 1 || s16(G.gameState) === 9 || s16(G.gameState) === 10) {
    sp.handle = null;
    return;
  }
  sp.state += s16(G.g21AC);
  if (sp.state === 0x53) sp.face = null;
  if (sp.state === 0x55) sp.face = G.blindFaces[2] ?? null;
  if (sp.state === 0x57 && sp.extra66 !== 1) {
    sp.face = G.blindFaces[sp.dir === 0 ? 1 : 0] ?? null;
  }
  if (sp.state === 0x59 && sp.extra66 !== 1) {
    sp.face = G.blindFaces[0] ?? null;
  }
  if (sp.extra66 === 1 && sp.state === 0x5d) {
    G.g21AC = -1;
    sp.state -= 2;
  }
  if (sp.state < 1) sp.handle = null;
}

export function makeMekakusi() {
  SATNewSprite(0, 0x178, 0x108, SetupMekakusi);
}

export function SetupMekakusi(sp) {
  sp.hud = true;
  sp.face = G.mekakusiFace;
  sp.handle = HandleMekakusi;
  sp.subtype = 0;
  sp.layer = 9;
  SetRect(sp.local, 0, 0, 0, 0);
}

export function HandleMekakusi() {}

// ---------------------------------------------------------------------------
// Coins.
// ---------------------------------------------------------------------------
export function SetupCoins(sp) {
  sp.face = G.coinsFace;
  sp.handle = HandleCoins;
  sp.hit = hitCoins;
  sp.subtype = -5;
  sp.speed = 0;
  sp.y = s16(sp.v) << 12;
  sp.layer = 4;
  SetRect(sp.local, 2, 2, 0xe, 0xe);
}

export function HandleCoins(sp) {
  if (s16(G.gameState) === 9 || s16(G.gameState) === 10) {
    G.g1E0A = 0;
    sp.handle = null;
  } else {
    sp.v += 8;
    if (sp.v > 400) sp.handle = null;
  }
}

export function hitCoins(sp, other) {
  if (!sp.handle) return;
  if (other.subtype !== 2 && other.subtype !== 8) return;
  SATSoundPlay(G.sounds.getCoins, 1, false);
  sp.handle = null;
  const r = SATRand(0x10);
  let value, mode;
  if (r < 4) {
    if (r === 0) { value = 1; mode = 0; }
    else { value = 10; mode = 0; }
  } else if (r < 7) {
    value = 1000; mode = 1;
  } else {
    value = 100; mode = 0;
  }
  const mult = G.butaStarted === 0 ? 1 : G.butaStarted;
  G.score += mult * value;
  const extra = G.butaStarted < 2 ? 0 : G.butaStarted - 1;
  makePointsSprite(value, s16(sp.v), s16(sp.h), mode, extra);
}

export function createCoins() {
  G.g1E0A--;
  if (SATRand(0x10) > 0xc) {
    const x = SATRand(0x14);
    SATNewSprite(-5, x * 0x10 + 0x10, -0x10, SetupCoins);
  }
}

// ---------------------------------------------------------------------------
// Kaizyu spawn timer.
// ---------------------------------------------------------------------------
export function createMonster() {
  if (G.g1E18 === 0) {
    if (G.kaizyu && G.kaizyu.state === 10) {
      if (s16(G.gameState) === 0) {
        SATSoundPlay(G.sounds.enterKaizyu, 9, true);
        G.kaizyu.state = 1;
        G.kaizyu.h = 0x178;
        G.kaizyu.count = 0x32;
      } else {
        G.g1E18 = s16(G.diff3);
      }
    }
  } else {
    G.g1E18--;
  }
}

// ---------------------------------------------------------------------------
// Spinner / roulette.
// ---------------------------------------------------------------------------
export const SPIN_REWARDS = [6, 2, 7, 1, 8, 2, 3, 1, 4, 0, 5, 1];
export const SPIN_X = [0x1af, 0x1c8, 0x1da, 0x1e1, 0x1da, 0x1c9, 0x1af, 0x195, 0x184, 0x17e, 0x186, 0x197];
export const SPIN_Y = [0x62, 0x68, 0x79, 0x92, 0xad, 0xbf, 0xc5, 0xbf, 0xad, 0x92, 0x7b, 0x68];

export function makeSpinItem() {
  G.spinnerIndex = 0;
  G.extraLampCount = 0;
  G.spinnerSlots = [];
  for (let i = 0; i < 12; i++) {
    const sp = SATNewSprite(0, SPIN_X[i], SPIN_Y[i], SetupSpinitem);
    sp.anim = SPIN_REWARDS[i];
    G.spinnerSlots.push(sp);
  }
  G.roulettePiyos = [];
  for (let i = 0; i < 12; i++) {
    const sp = SATNewSprite(0, 0x17d + i * 10, 0xe0, SetupSmallpiyo);
    G.roulettePiyos.push(sp);
  }
  G.extraSprites = [];
  for (let i = 0; i < 5; i++) {
    const sp = SATNewSprite(0, 0x19c, 0xaa, SetupExtra);
    sp.anim = i;
    G.extraSprites.push(sp);
  }
  G.spinnerIndex = 0;
  G.spinnerBigPiyo = SATNewSprite(0, 0x194, 0x76, SetupBigpiyo);
}

export function SetupSpinitem(sp) {
  sp.hud = true;
  sp.face = null;
  SetRect(sp.local, 0, 0, 0, 0);
  sp.handle = HandleSpinitem;
  sp.subtype = 0;
  sp.layer = 0;
  sp.anim = 0;
  sp.speed = 0;
  sp.state = 0;
  sp.tA0 = 0;
}

export function HandleSpinitem(sp) {
  sp.face = sp.state > 0 ? (G.spinnerFaces[sp.anim] ?? null) : null;
}

export function SetupSmallpiyo(sp) {
  sp.hud = true;
  sp.face = null;
  SetRect(sp.local, 0, 0, 0, 0);
  sp.handle = HandleSmallpiyo;
  sp.subtype = 0;
  sp.layer = 0;
  sp.anim = 0;
  sp.speed = 0;
  sp.state = 0;
}

export function HandleSmallpiyo(sp) {
  const st = sp.state;
  if (st === 9) {
    sp.face = G.spinnerSmallFaces[1] ?? null;
  } else if (st === 10) {
    sp.state--;
    sp.face = G.spinnerSmallFaces[0] ?? null;
  } else if (st === 1) {
    sp.state--;
    sp.face = G.spinnerSmallFaces[0] ?? null;
  } else if (st === 0) {
    sp.face = null;
  } else {
    sp.state--;
    sp.face = G.spinnerSmallFaces[1] ?? null;
  }
}

export function SetupExtra(sp) {
  sp.hud = true;
  sp.face = null;
  SetRect(sp.local, 0, 0, 0, 0);
  sp.handle = HandleExtra;
  sp.subtype = 0;
  sp.layer = 0;
  sp.anim = 0;
  sp.speed = 0;
  sp.state = 0;
}

export function HandleExtra(sp) {
  const st = sp.state;
  const face = G.slotFaces[sp.anim] ?? null;
  if (st === 0x14) {
    sp.face = face;
  } else if (st === 0) {
    sp.face = null;
  } else {
    sp.state--;
    sp.face = (sp.state % 2) === 0 ? face : null;
  }
}

export function SetupBigpiyo(sp) {
  sp.hud = true;
  sp.face = null;
  sp.handle = HandleBigpiyo;
  sp.subtype = 0;
  sp.layer = 0;
  sp.anim = 0;
  sp.speed = 0;
  sp.state = 0;
  SetRect(sp.local, 0, 0, 0, 0);
}

export function HandleBigpiyo(sp) {
  sp.face = sp.state > 0 ? (G.spinnerExtraFace ?? null) : null;
}

export function updateSpinner() {
  const slot0 = G.spinnerSlots?.[0];
  if (slot0 && slot0.tA0 > 0) {
    slot0.tA0 = s16(slot0.tA0 - 1);
    if (slot0.tA0 === 0) {
      SATRand(7);
      SATRand(0x15);
      G.rouletteResult = s16(SATRand(0xc) + 0x40);
      G.queuedSpins = s16(G.queuedSpins - 1);
    }
    return;
  }
  if (G.rouletteResult === 0) return;
  if (s16(G.gameState) >= 9) {
    G.rouletteResult = 0;
    return;
  }
  G.rouletteResult = s16(G.rouletteResult - 1);
  G.spinnerIndex = s16((G.spinnerIndex + 1) % 12);
  const half = idiv(s16(G.spinnerIndex), 2);
  if (G.spinnerBigPiyo) G.spinnerBigPiyo.state = half - idiv(half, 2) * 2;
  for (let i = 0; i < 12; i++) {
    if (G.spinnerSlots[i]) G.spinnerSlots[i].state = 0;
  }
  if (G.spinnerSlots[G.spinnerIndex]) G.spinnerSlots[G.spinnerIndex].state = 1;
  if (G.rouletteResult !== 0) {
    if (G.spinnerBigPiyo && G.spinnerBigPiyo.state === 0) {
      SATSoundPlay(G.sounds.spin, 1, false);
    }
    return;
  }
  if (!G.moz || G.moz.state !== 3) {
    G.rouletteResult = 0xc;
    return;
  }
  if (G.spinnerBigPiyo) G.spinnerBigPiyo.state = 0;
  const reward = G.spinnerSlots[G.spinnerIndex]?.anim ?? 0;
  switch (reward) {
    // The original jump table at 0x1254 maps face 0 (10K) to 0x2710,
    // face 1 (1K) to 0x3e8 and face 2 (5K) to 0x1388.  The cases had been
    // rotated, so the 10K slot awarded 1,000 points.
    case 0:
      G.score += 10000;
      SATSoundPlay(G.sounds.getCoins, 8, true);
      break;
    case 1:
      G.score += 1000;
      SATSoundPlay(G.sounds.getCoins, 8, true);
      break;
    case 2:
      G.score += 5000;
      SATSoundPlay(G.sounds.getCoins, 8, true);
      break;
    case 3:
      G.g1E0A = 0x96;
      break;
    case 4:
      SATSoundPlay(G.sounds.hypButa, 8, true);
      makeButaRing();
      break;
    case 5:
      makeDekaMoz();
      break;
    case 6:
      addExtra();
      break;
    case 7:
      makeMozKanban();
      break;
    case 8:
      slowButa();
      break;
    default:
      break;
  }
  if (G.queuedSpins > 0 && slot0) slot0.tA0 = 10;
}

export function makeButaRing() {
  for (let sp = sat.head; sp; sp = sp.next) {
    if (sp.subtype === -3) sp.tA0 = sp.tA0 === 0 ? 1 : 2;
  }
}

export function slowButa() {
  for (let sp = sat.head; sp; sp = sp.next) {
    if (sp.subtype === -3) sp.speed = s16(G.diffSpeed);
  }
  SATSoundPlay(G.sounds.slowButa, 10, false);
}

export function addExtra() {
  G.extraLampCount++;
  for (let i = 0; i < 5; i++) {
    const sp = G.extraSprites?.[i];
    if (!sp) continue;
    if (i < G.extraLampCount - 1) sp.state = 0x14;
    else if (i === G.extraLampCount - 1) sp.state = 0x1a;
    else sp.state = 0;
  }
  if (G.extraLampCount < 5) {
    SATSoundPlay(G.sounds.litExtra, 9, true);
  } else {
    G.extraLampCount = 0;
    G.butaCount++;
    updateButaLeft();
    G.score += 10000;
    SATSoundPlay(G.sounds.litExtra, 10, true);
    for (let i = 0; i < 5; i++) {
      const sp = G.extraSprites?.[i];
      if (sp) sp.state = (i % 2 === 0) ? 0x13 : 0x12;
    }
  }
}

// ---------------------------------------------------------------------------
// Tables and resource initialisation.
// ---------------------------------------------------------------------------
export function MakeMathTbl() {
  G.sinTable = new Int32Array(360);
  G.cosTable = new Int32Array(360);
  const PI = 3.14159265358979323846; // the double stored at g_0920
  for (let i = 0; i < 360; i++) {
    const rad = (i / 180) * PI;
    G.sinTable[i] = Math.trunc(1000 * Math.sin(rad));
    G.cosTable[i] = Math.trunc(1000 * Math.cos(rad));
  }
}

export function initResources(fork) {
  G.dfTy = [];
  G.egps = [];
  for (let i = 0; i < 32; i++) {
    G.dfTy[i] = fork.get('DfTy', 128 + i);
    G.egps[i] = fork.get('EgPS', 128 + i);
  }
  G.egpsGameOver = fork.get('EgPS', 228);
  G.rankLabels = fork.getStringList(130, assets.japanese);
  G.aboutPict = null;
  G.titlePict = null;
  G.titlePict2 = null;
  G.highScorePict = null;
  G.highScoreLabel = fork.getStringList(129, assets.japanese);
}

export function InitAllSprite() {
  InitKing();
  InitButa();
  InitEgg();
  InitKaizyu();
  InitMozmoz();
  initPiyo();
  initMGuide();
  initScores();
  initPoints();
  InitCoins();
  initBlind();
  initFireworks();
  initMozKanban();
  initMekakusi();
  initSpinners();
  initSegg();
}

export function makeMozKanban() {
  SATSoundPlay(G.sounds.enterKanban, 9, true);
  G.mozKanbanSprites = [];
  for (let i = 0; i < 12; i++) {
    const sp = SATNewSprite(7, i * 0x1e, 0x156, SetupMozKanban);
    G.mozKanbanSprites.push(sp);
    if (i === 0) G.mozKanban = sp;
  }
}

export function SetupMozKanban(sp) {
  sp.face = null;
  SetRect(sp.local, 8, 6, 0x20, 0x26);
  sp.handle = HandleMozKanban;
  sp.hit = hitMozKanban;
  sp.subtype = 7;
  sp.layer = 0;
  sp.state = 0;
  sp.count = SATRand(0x10) + 10;
}

export function makeMozKanbanFace(index) {
  return G.mozKanbanFaces[index] ?? null;
}

export function HandleMozKanban(sp) {
  const gs = s16(G.gameState);
  if (gs === 2) { sp.handle = null; return; }
  if (gs === 0x14) { sp.handle = null; return; }
  if (gs === 1) sp.state = 2;
  switch (sp.state) {
    case 0:
      if (sp.count > 0) sp.count--;
      if (sp.count >= 8) return;
      sp.face = G.mozKanbanFaces[idiv(sp.count, 2)] ?? null;
      if (sp.count === 0) sp.state = 1;
      return;
    case 1:
      return;
    case 2:
      sp.count++;
      if (sp.count >= 8) { sp.handle = null; return; }
      sp.face = G.mozKanbanFaces[idiv(sp.count, 2)] ?? null;
      return;
    default:
      return;
  }
}

export function hitMozKanban(sp, other) {
  if (other.subtype === -3 && other.state === 2) {
    sp.state = 2;
    sp.count = 0;
  }
}

export function makeButaRingSimple() { makeButaRing(); }

// ---------------------------------------------------------------------------
// Game start / level flow.
// ---------------------------------------------------------------------------
export function startGame(stage = 1) {
  G.stage = stage | 0;
  G.score = 0;
  G.gameState = 0;
  G.butaCount = 3;
  G.piyoSlotCount = 0;
  G.extraLampCount = 0;
  G.rouletteResult = 0;
  G.nextExtra = 100000;
  G.g1E0A = 0;
  G.g1EA0 = 0;
  G.butaStarted = 0;
  G.currentButa = null;
  G.g08EC = 0;
  G.g08F0 = 0;
  sat.head = sat.tail = null;
  SetUpElement();
  clearPiyo();
  G.scoreBoardOn = 1;
  SetUpLevel(G.stage);
  if (G.pref.sound) SATSoundOn(); else SATSoundOff();
  if (G.pref.music === 1) CSS_StartMusic(0);
}

export function checkGameOver() {
  if (G.gameState === 0xb) {
    G.g1E1C++;
    if (G.g1E1C > 0x2d) G.gameState = 0x14;
  } else if (G.gameState < 0xb) {
    if (G.gameState === 9) {
      CSS_StopMusic(0);
      while (!SATSoundDone()) SATSoundEvents();
      SATSoundPlay(G.sounds.gameOver, 10, false);
      G.gameState = 10;
      G.g1E1C = 0;
    } else if (G.gameState > 8) {
      G.g1E1C++;
      if (G.g1E1C === 2) {
        G.gameState = 0xb;
        makeEggField(32);
      }
    }
  } else if (G.gameState === 0x14) {
    G.paused = 0;
  }
}

export function moveItStep() {
  G.mouseV = G.input.mouseY;
  G.mouseH = G.input.mouseX;
  if (G.g1E0A > 0) createCoins();
  createMonster();
  updateScoreBoard();
  updateSpinner();
  if (G.gameState > 3) checkGameOver();
  sat.run();
  sat.layerSort(1, 9);
  if (G.gameState === 1 && (!G.moz || G.moz.handle === null) &&
      (!G.kaizyu || G.kaizyu.handle === null)) {
    G.gameState = 2;
    SATSoundShutup();
    sat.run(false, false);
    G.stage++;
    if (G.stage > G.pref.maxStage) G.pref.maxStage = Math.min(32, G.stage);
    if (G.onSavePref) G.onSavePref();
    SetUpLevel(G.stage);
    if (G.pref.music === 1) CSS_StartMusic(0);
  }
}

// ---------------------------------------------------------------------------
// Guide / hand cursor.
// ---------------------------------------------------------------------------
export function SetupGuide(sp) {
  sp.hud = true;
  sp.face = G.guideFace;
  sp.handle = HandleGuide;
  sp.subtype = 0;
  SetRect(sp.local, 0, 0, 0, 0);
}

export function HandleGuide(sp) {
  // The red bar is the original character guide, not the browser pointer.
  // The +8 offset puts its centre under MozMoz's visible centre, and the
  // original clamp keeps the bar inside the track at both ends.
  let h = Math.trunc(G.mouseH);
  if (h < 0) h = 0;
  if (h > 0x14b) h = 0x14b;
  sp.h = s16(h + 8);
}

// ---------------------------------------------------------------------------
// Kaizyu (Josephine).
// ---------------------------------------------------------------------------
export function SetupKaizyu(sp) {
  sp.face = G.kaizyuExtraFace;
  SetRect(sp.local, 0x17, 6, 0x36, 0x3f);
  sp.handle = HandleKaizyu;
  sp.hit = hitKaizyu;
  sp.subtype = -4;
  sp.anim = 0;
  sp.state = 10;
  sp.count = 0;
  sp.layer = 6;
  G.g092C = sp.v;
  G.g092E = sp.h;
  SATNewSprite(1, G.g092E, G.g092C, SetupKaizyuGhost);
}

export function HandleKaizyu(sp) {
  const game = s16(G.gameState);
  if (game === 1 && sp.state !== 4 && sp.state !== 9) { sp.state = 4; return; }
  else if (game === 0x14) { sp.handle = null; return; }
  else {
    if (game >= 9) {
      if (sp.state !== 9) { sp.face = G.kaizyuExtraFace; return; }
      sp.handle = null;
      sp.face = null;
    }
    switch (sp.state) {
      case 0:
        sp.face = G.kaizyuExtraFace;
        sp.count--;
        if (sp.count < 0) {
          sp.state = sp.h < 0xbc ? 2 : 1;
          sp.count = SATRand(100) + 0x32;
        }
        if (game === 1) sp.state = 4;
        break;
      case 1:
        sp.anim = (sp.anim + 1) & 0xf;
        sp.face = G.kaizyuGhostFaces[sp.anim] ?? null;
        sp.h -= 2;
        if (sp.h < 0) sp.state = 2;
        sp.count--;
        if (sp.count < 0) {
          sp.state = 0;
          sp.count = SATRand(100) + 0x32;
          sp.anim = 0;
        }
        if (game === 1) sp.state = 4;
        break;
      case 2:
        sp.anim = (sp.anim + 1) & 0xf;
        sp.face = G.kaizyuFaces[sp.anim] ?? null;
        sp.h += 2;
        if (sp.h + 0x40 > 0x178) sp.state = 1;
        sp.count--;
        if (sp.count < 0) {
          sp.state = 0;
          sp.count = SATRand(100) + 0x32;
          sp.anim = 0;
        }
        if (game === 1) sp.state = 4;
        break;
      case 3:
        sp.anim = (sp.anim + 1) & 1;
        sp.face = G.kaizyuGrabFaces[sp.anim] ?? null;
        sp.count--;
        if (sp.count < 0) { sp.state = 0; sp.count = 0x14; }
        break;
      case 4:
        sp.anim = (sp.anim + 1) & 0xf;
        sp.face = G.kaizyuFaces[sp.anim] ?? null;
        sp.h += 4;
        if (sp.h > 0x178) {
          if (game === 1) sp.handle = null;
          else {
            sp.h = 0x178;
            sp.v = 0x13e;
            sp.state = 10;
            sp.face = null;
          }
        }
        break;
      case 5:
        sp.anim = (sp.anim + 1) & 3;
        sp.face = G.kaizyuFallFaces[sp.anim >> 1] ?? null;
        break;
      case 9: {
        const cos = G.cosTable[sp.angle] ?? 0;
        sp.h = s16((sp.x + sp.count * sp.speed * cos) >> 12);
        sp.v = s16((sp.y + sp.count * sp.count * 0x7d0 - sp.count * 0xc350) >> 12);
        sp.count++;
        if (sp.v > 400) {
          sp.h = 0x178;
          sp.v = 0x13e;
          sp.state = 10;
          sp.face = null;
        }
        if (sp.h > 0x178) sp.face = null;
        break;
      }
      case 10:
        sp.face = null;
        break;
      default:
        break;
    }
    G.g092C = sp.v;
    G.g092E = sp.h;
  }
}

export function hitKaizyu(sp, other) {
  if (other.subtype === 2 && sp.state === 3) {
    SATSoundPlay(G.sounds.boingKaizyu, 9, true);
    const mult = G.butaStarted === 0 ? 1 : G.butaStarted;
    G.score += mult * 100;
    sp.state = 9;
    sp.count = 0;
    sp.x = sp.h << 12;
    sp.y = sp.v << 12;
    sp.speed = 0x20;
    if (sp.h < 0xbd) { sp.angle = 300; sp.face = G.kaizyuHitFaces[0]; }
    else { sp.angle = 0xf0; sp.face = G.kaizyuHitFaces[1]; }
    G.g1E18 = s16(G.diff3);
  }
  if (other.subtype === 8 && sp.state !== 9 && sp.state !== 10 && sp.state !== 4) {
    SATSoundPlay(G.sounds.boingKaizyu, 9, true);
    const mult = G.butaStarted === 0 ? 1 : G.butaStarted;
    G.score += mult * 100;
    sp.state = 9;
    sp.count = 0;
    sp.x = sp.h << 12;
    sp.y = sp.v << 12;
    sp.speed = 0x20;
    if (sp.h < 0xbd) { sp.angle = 300; sp.face = G.kaizyuHitFaces[0]; }
    else { sp.angle = 0xf0; sp.face = G.kaizyuHitFaces[1]; }
    G.g1E18 = s16(G.diff3);
  }
  if (other.subtype === 2 && (sp.state === 1 || sp.state === 2)) {
    sp.state = 0;
    sp.count = SATRand(0x32) + 0x14;
    sp.anim = 0;
  }
  if (other.subtype === 2 && other.state === 5 && sp.state === 0) {
    sp.state = 5;
  }
}

export function SetupKaizyuGhost(sp) {
  sp.face = null;
  SetRect(sp.local, 0x17, 6, 0x36, 0x3f);
  sp.handle = HandleKaizyuGhost;
  sp.hit = hitKaizyuGhost;
  sp.subtype = 1;
  sp.state = 0;
}

export function HandleKaizyuGhost(sp) {
  if (s16(G.gameState) === 2) {
    sp.handle = null;
    return;
  }
  if (s16(G.gameState) === 9) {
    sp.handle = null;
    return;
  }
  sp.v = G.g092C;
  sp.h = G.g092E;
}

export function hitKaizyuGhost(sp, other) {
  const k = G.kaizyu;
  if (!k) return;
  const st = k.state;
  if (!((st >= 0 && st <= 3) || st === 5)) return;
  if (other.subtype === -3 && other.state === 2) {
    k.state = 3;
    k.count = s16(G.diff4);
    SATSoundPlay2(G.sounds.hitKaizyu, 8, false, 1);
  }
  if (other.subtype === -7) {
    k.state = 3;
    k.count = s16(G.diff4);
    SATSoundPlay2(G.sounds.hitKaizyu, 8, false, 1);
  }
}

// ---------------------------------------------------------------------------
// King of Eggs (stage 32).  Ported from 0x0d350..0x0ee30.
// ---------------------------------------------------------------------------
export function SetupKing(sp) {
  sp.face = null;
  SetRect(sp.local, 0x3a, 0x12, 0x8a, 0x78);
  sp.handle = HandleKing;
  sp.hit = hitKing;
  sp.subtype = 0x15;
  sp.anim = 0;
  sp.state = 0;
  sp.count = 0x20;
  sp.tA0 = 0;
  sp.t98 = 0x19;
  sp.layer = 3;
  sp.count2 = 0;
  sp.sub = null;
  G.kingRhand = SATNewSprite(0x12, sp.h + 0x80, sp.v + 0x46, SetupRhand);
  G.kingLhand = SATNewSprite(0x13, sp.h, sp.v + 0x46, SetupLhand);
  G.kingFoot = SATNewSprite(0x14, sp.h, sp.v + 0x78, SetupFoot);
  G.g2316 = 0;
  G.g2314 = 0;
  G.g2312 = 0xbf;
  G.g2310 = 0x20;
}

export function HandleKing(sp) {
  const gs = s16(G.gameState);
  if (gs === 9) sp.handle = null;
  if (gs === 10) sp.handle = null;
  if (sp.count > 0) {
    sp.count--;
    return;
  }
  if (sp.tA0 > 0) sp.tA0 = s16(sp.tA0 - 1);
  if (G.moz && G.moz.state === 3) createEgg();

  const a = sp.anim;
  if (a > 0x65) {
    sp.anim = a - 1;
    return;
  }
  switch (a) {
    case 0:
      sp.face = G.kingFaces[0] ?? null;
      if (SATRand(0x40) === 0) sp.anim = 6;
      break;
    case 4:
      sp.face = G.kingFaces[0] ?? null;
      sp.anim--;
      break;
    case 6:
      sp.face = G.kingFaces[1] ?? null;
      sp.anim--;
      break;
    case 8:
      sp.face = G.kingFaces[2] ?? null;
      sp.anim--;
      break;
    case 13:
      sp.face = G.kingFaces[3] ?? null;
      sp.anim--;
      break;
    case 14:
      sp.face = G.kingFaces[1] ?? null;
      sp.anim--;
      break;
    case 15:
      sp.face = G.kingFaces[4] ?? null;
      createPiyo(s16(sp.v + 0x4b), s16(sp.h + 0x46));
      break;
    case 16:
      sp.face = G.kingFaces[4] ?? null;
      sp.anim--;
      SATSoundPlay(G.sounds.bombSound, 9, true);
      for (let o = sat.head; o; o = o.next) {
        if (o.subtype === 0x12 || o.subtype === 0x13 || o.subtype === 0x14) o.handle = null;
      }
      break;
    case 24:
      sp.face = G.kingFaces[0] ?? null;
      sp.anim--;
      break;
    case 32:
      sp.face = G.kingFaces[3] ?? null;
      sp.anim--;
      makeFireworks2(s16(sp.v + 0x6e), s16(sp.h + 0x50));
      SATSoundPlay(G.sounds.bombSound, 9, true);
      break;
    case 40:
      sp.face = G.kingFaces[0] ?? null;
      sp.anim--;
      break;
    case 48:
      sp.face = G.kingFaces[3] ?? null;
      sp.anim--;
      makeFireworks2(s16(sp.v + 0x40), s16(sp.h + 0x6e));
      SATSoundPlay(G.sounds.bombSound, 9, true);
      sp.face = G.kingFaces[0] ?? null;
      sp.anim--;
      break;
    case 56:
      sp.face = G.kingFaces[3] ?? null;
      sp.anim--;
      makeFireworks2(s16(sp.v + 0x1e), s16(sp.h + 0x1e));
      SATSoundPlay(G.sounds.bombSound, 9, true);
      break;
    case 64:
      sp.face = G.kingFaces[3] ?? null;
      sp.anim--;
      makeFireworks2(s16(sp.v + 0x1e), s16(sp.h + 0x1e));
      SATSoundPlay(G.sounds.bombSound, 9, true);
      break;
    case 72:
      sp.face = G.kingFaces[0] ?? null;
      sp.anim--;
      break;
    case 80:
      sp.face = G.kingFaces[3] ?? null;
      sp.anim--;
      makeFireworks2(s16(sp.v + 0x4b), s16(sp.h + 0x50));
      SATSoundPlay(G.sounds.bombSound, 9, true);
      sp.face = G.kingFaces[3] ?? null;
      sp.anim--;
      makeFireworks2(s16(sp.v + 0x28), s16(sp.h + 0x32));
      SATSoundPlay(G.sounds.bombSound, 9, true);
      break;
    case 88:
      sp.face = G.kingFaces[3] ?? null;
      sp.anim--;
      makeFireworks2(s16(sp.v + 0x28), s16(sp.h + 0x32));
      SATSoundPlay(G.sounds.bombSound, 9, true);
      break;
    case 96:
      sp.face = G.kingFaces[3] ?? null;
      sp.anim--;
      for (let o = sat.head; o; o = o.next) {
        if (o.subtype === -3) {
          makeFireworks2(o.v, o.h);
          o.handle = null;
          if (o.sub) o.sub.handle = null;
        }
      }
      break;
    case 101:
      sp.handle = null;
      break;
    default:
      sp.anim--;
      break;
  }
}

export function SetupFoot(sp) {
  sp.face = null;
  SetRect(sp.local, 0x2a, 0, 0x9a, 0x26);
  sp.handle = HandleFoot;
  sp.hit = hitFoot;
  sp.subtype = 0x14;
  sp.anim = 0;
  sp.state = 0;
  sp.count = 0x20;
  sp.tA0 = 0;
  sp.sub = null;
  sp.layer = 2;
}

export function SetupRhand(sp) {
  sp.face = null;
  SetRect(sp.local, 1, 7, 0x2e, 0x38);
  sp.handle = HandleRhand;
  sp.hit = hitRhand;
  sp.subtype = 0x12;
  sp.anim = 0;
  sp.state = 0;
  sp.count = 0x20;
  sp.tA0 = 0;
  sp.sub = null;
  sp.layer = 2;
}

export function SetupLhand(sp) {
  sp.face = null;
  SetRect(sp.local, 0x12, 10, 0x2e, 0x38);
  sp.handle = HandleLhand;
  sp.hit = hitLhand;
  sp.subtype = 0x13;
  sp.anim = 0;
  sp.state = 0;
  sp.count = 0x20;
  sp.tA0 = 0;
  sp.sub = null;
  sp.layer = 2;
}

export function HandleFoot(sp) {
  const gs = s16(G.gameState);
  if (gs === 1) sp.handle = null;
  if (gs === 9) sp.handle = null;
  if (gs === 10) sp.handle = null;
  if (sp.tA0 > 0) sp.tA0 = s16(sp.tA0 - 1);
}

function handleHand(sp, faces) {
  const gs = s16(G.gameState);
  if (gs === 1) sp.handle = null;
  if (gs === 9) sp.handle = null;
  if (gs === 10) sp.handle = null;
  if (sp.count > 0) {
    sp.count--;
    return;
  }
  if (sp.tA0 > 0) sp.tA0 = s16(sp.tA0 - 1);
  const a = sp.anim;
  if (a <= 8) {
    switch (a) {
      case 0: sp.face = faces[0] ?? null; return;
      case 1: sp.face = faces[1] ?? null; sp.anim--; return;
      case 2: sp.face = faces[2] ?? null; sp.anim--; return;
      case 3: sp.face = faces[3] ?? null; sp.anim--; return;
      case 7: sp.face = faces[4] ?? null; sp.anim--; return;
      case 8: sp.face = faces[2] ?? null; sp.anim--; return;
      default: sp.anim--; return;
    }
  }
  sp.anim--;
}

export function HandleRhand(sp) {
  handleHand(sp, G.kingExtraFaces);
}

export function HandleLhand(sp) {
  handleHand(sp, G.kingExtraFaces2);
}

export function SetupFallEgg(sp) {
  sp.face = null;
  SetRect(sp.local, 3, 1, 0x1c, 0x1e);
  sp.handle = HandleFallEgg;
  sp.hit = hitEgg;
  sp.layer = 1;
  sp.count2 = 0;
  sp.state = 1;
  sp.count = 0;
  sp.sub = SATNewSprite(-7, sp.h, sp.v, SetupEggGhost);
}

export function SetupEggGhost(sp) {
  sp.face = null;
  SetRect(sp.local, 3, 1, 0x1c, 0x1e);
  sp.handle = HandleEggGhost;
  sp.subtype = -7;
  sp.hit = hitEggGhost;
  sp.layer = 4;
  sp.count = 0;
  sp.sub = null;
}

export function SetupBoundEgg(sp) {
  sp.face = null;
  SetRect(sp.local, 0, 0, 0, 0);
  sp.handle = HandleBoundEgg;
  sp.layer = 8;
  sp.count2 = 0;
  sp.state = 1;
  sp.count = 0;
  const r = SATRand(2);
  sp.speed = (r * 2 - 1) * 0x1388;
  if (sp.h > 0x154) sp.speed = -0x1388;
  sp.x = s16(sp.h) << 12;
  sp.y = s16(sp.v) << 12;
  sp.sub = null;
}

export function SetupPiyo2(sp) {
  sp.face = G.piyoFaces[0] ?? null;
  SetRect(sp.local, 4, 2, 0x1c, 0x1c);
  sp.handle = HandlePiyo2;
  sp.hit = hitPiyo2;
  sp.subtype = -2;
  sp.anim = 0;
  sp.speed = (SATRand(0x18) - 0xc) * 0x7d0;
  sp.count = 0;
  sp.layer = 4;
  sp.x = s16(sp.h) << 12;
  sp.y = s16(sp.v) << 12;
  G.g1E12 = s16(G.g1E12 + 1);
  sp.sub = null;
}

export function HandlePiyo2(sp) {
  const gs = s16(G.gameState);
  if (gs === 2 || gs === 9 || gs === 11 || gs === 20) {
    sp.handle = null;
    return;
  }
  sp.anim = (sp.anim + 1) & 1;
  sp.face = G.piyoFaces[sp.anim] ?? null;
  sp.count++;
  sp.h = s16((sp.x + sp.speed * sp.count) >> 12);
  sp.v = s16((sp.y + sp.count * sp.count * 0x9c4 - sp.count * 0x3cb0) >> 12);
  if (sp.v > 0x180) {
    sp.handle = null;
    G.g1E12 = s16(G.g1E12 - 1);
  }
}

export function HandleEggGhost(sp) {
  const gs = s16(G.gameState);
  if (gs === 1) sp.handle = null;
  if (gs === 9) sp.handle = null;
  if (gs === 10) sp.handle = null;
}

export function HandleBoundEgg(sp) {
  const gs = s16(G.gameState);
  if (gs === 1) sp.handle = null;
  if (gs === 9) sp.handle = null;
  if (gs === 10) sp.handle = null;
  sp.count++;
  sp.h = s16((sp.x + sp.speed * sp.count) >> 12);
  sp.v = s16((sp.y + sp.count * sp.count * 0x9c4 - sp.count * 0x3cb0) >> 12);
  if (sp.v > 0x180) sp.handle = null;
}

export function HandleFallEgg(sp) {
  const gs = s16(G.gameState);
  if (gs === 1) sp.handle = null;
  if (gs === 9) sp.handle = null;
  if (gs === 10) sp.handle = null;
  sp.count2 = 0;
  if (!sp.face) sp.face = G.eggFaces[sp.anim] ?? null;
  if (!sp.sub || !sp.sub.handle) {
    sp.handle = null;
    const egg = SATNewSprite(0, sp.h, sp.v, SetupBoundEgg);
    egg.face = sp.face;
  } else if (sp.v > 0x180) {
    sp.handle = null;
    sp.sub.handle = null;
  } else {
    sp.v = s16(sp.v + 7);
    sp.sub.v = sp.v;
    sp.sub.h = sp.h;
  }
}

export function hitKing(sp, other) {
  if (sp.t98 > 0 && other.subtype === -3) {
    if (sp.tA0 === 0) {
      sp.tA0 = 8;
      SATSoundPlay(G.sounds.kingHit, 9, true);
      makeFireworks2(other.v, other.h);
      sp.t98 = s16(sp.t98 - 1);
      G.score += 0x64;
      if (sp.t98 > 0) {
        G.g2314 = s16(G.g2314 + 8);
      } else {
        sp.anim = 0x64;
        G.g2314 = 0;
        G.g2312 = 0;
      }
    }
    if (sp.anim === 0) sp.anim = 0xe;
  }
}

export function hitFoot(sp, other) {
  if (other.subtype === -3 && sp.tA0 === 0) {
    sp.tA0 = 8;
    SATSoundPlay(G.sounds.boing, 2, false);
  }
}

export function hitRhand(sp, other) {
  if (other.subtype === -3) {
    if (sp.tA0 === 0) {
      sp.tA0 = 8;
      SATSoundPlay(G.sounds.boing, 2, false);
    }
    if (sp.anim === 0) sp.anim = 8;
  }
}

export function hitLhand(sp, other) {
  if (other.subtype === -3) {
    if (sp.tA0 === 0) {
      sp.tA0 = 8;
      SATSoundPlay(G.sounds.boing, 2, false);
    }
    if (sp.anim === 0) sp.anim = 8;
  }
}

export function hitPiyo2(sp, other) {
  if (other.subtype === 2) {
    makePointsSprite(0x3e8, sp.v, sp.h, 1, 0);
    G.score += 0x3e8;
    sp.handle = null;
  }
}

export function hitEggGhost(sp, other) {
  if (other.subtype === 2) {
    sp.handle = null;
    G.score += 5;
    SATSoundPlay(G.sounds.hitButa, 2, false);
  } else if (other.subtype === 1) {
    sp.handle = null;
    SATSoundPlay(G.sounds.hitKaizyu, 2, false);
  }
}

export function createPiyo(v, h) {
  if (G.g2316 > 0) {
    G.g2316 = s16(G.g2316 - 1);
    return null;
  }
  G.g2316 = 8;
  let sp = null;
  if (G.g2310 > 0) {
    sp = SATNewSprite(-2, s16(h + SATRand(0x10)), v, SetupPiyo2);
    G.g1E12 = s16(G.g1E12 + 1);
  }
  G.g2310 = s16(G.g2310 - 1);
  if (G.g2310 === -0xa) {
    G.g1E12 = 0;
    G.eggCount = 0;
    G.gameState = 1;
    for (let o = sat.head; o; o = o.next) {
      if (o.subtype === 0x15) o.anim = 0xc8;
    }
  }
  return sp;
}

export function createEgg() {
  if (G.g2314 === 0) return null;
  if (G.g2316 > 0) {
    G.g2316 = s16(G.g2316 - 1);
    return null;
  }
  const phase = idiv(s16(G.g2312), 0x20);
  let h = SATRand(5) * 0x1a * 2 + 3;
  if (h > 0x68) h += 0x82;
  let sp = null;
  switch (phase) {
    case 0:
      sp = SATNewSprite(0x10, h, -0x20, SetupFallEgg);
      sp.subtype = 0x10; sp.anim = 6; break;
    case 1:
      sp = SATNewSprite(0x0e, h, -0x20, SetupFallEgg);
      sp.subtype = 0x0e; sp.anim = 4; sp.state = 3; break;
    case 2:
      sp = SATNewSprite(0x0d, h, -0x20, SetupFallEgg);
      sp.subtype = 0x0d; sp.anim = 3; sp.state = 2; break;
    case 3:
      sp = SATNewSprite(0x0c, h, -0x20, SetupFallEgg);
      sp.subtype = 0x0c; sp.anim = 2; sp.state = 1; break;
    case 4:
      sp = SATNewSprite(0x0b, h, -0x20, SetupFallEgg);
      sp.subtype = 0x0b; sp.anim = 1; sp.state = 1; break;
    case 5:
      sp = SATNewSprite(0x0a, h, -0x20, SetupFallEgg);
      sp.subtype = 0x0a; sp.anim = 0; sp.state = 1; break;
    default:
      break;
  }
  G.g2316 = 0x10;
  G.g2312 = s16(G.g2312 - 1);
  G.g2314 = s16(G.g2314 - 1);
  return sp;
}

// 0x06d58: create the persistent HUD elements.  The original uses the SAT
// screen size for the guide sprite and fixed positions for the boards.
export function SetUpElement() {
  SATNewSprite(0, sat.fb.width, sat.fb.height - 0xc, SetupGuide);
  makeMekakusi();
  makeSpinItem();
  G.nextExtra = 0x186a0;
  makeScoreBoard(0x16, 0x188);
  G.lastScore = -1;
  updateScoreBoard();
  makeButaLeft(0x43, 0x1e0);
  updateButaLeft();
  makeSeggBoard(0xf4, 0x1e0);
  updateSeggBoard(1);
}


// ---------------------------------------------------------------------------
// Save / resume support.
//
// The original stores its complete mutable state in a 3.3 KB data section and
// keeps sprites in a linked SAT list.  We snapshot the same information into a
// JSON-friendly structure: primitive globals, sprite records (with function and
// face references encoded by name/id), and the Toolbox RNG seed.
// ---------------------------------------------------------------------------
const SAVE_SKIP_KEYS = new Set([
  'pref', 'input', 'audio', 'sat', 'onSavePref',
  'dfTy', 'egps', 'egpsGameOver', 'titlePict', 'titlePict2',
  'aboutPict', 'highScorePict', 'titleWindow', 'rankLabels',
  'highScoreLabel', 'sounds', 'soundHandles', 'g2E08', 'g1E24',
  'g1E28', 'g1E2C', 'sinTable', 'cosTable',
]);

const SPRITE_FUNCS = {
  HandleBigpiyo, HandleBlind, HandleBombGhost1, HandleBombGhost2,
  HandleBoundEgg, HandleButa, HandleButaLeft, HandleButaRing,
  HandleCoins, HandleDekaMoz, HandleEgg, HandleEggGhost, HandleExtra,
  HandleFallEgg, HandleFire, HandleFire2, HandleFoot, HandleGuide,
  HandleKaizyu, HandleKaizyuGhost, HandleKing, HandleLhand,
  HandleMekakusi, HandleMozKanban, HandleMozMoz, HandleMulti,
  HandlePiyo, HandlePiyo2, HandlePoints, HandleRhand, HandleScores,
  HandleSegg, HandleSmallpiyo, HandleSpinitem,
  hitBombGhost, hitButa, hitCoins, hitDekaMoz, hitEgg, hitEggGhost,
  hitFoot, hitKaizyu, hitKaizyuGhost, hitKing, hitLhand,
  hitMozKanban, hitMozMoz, hitPiyo, hitPiyo2, hitRhand,
};

// The production bundle minifies function names, so save a stable registry
// key on each handler at module load instead of relying on Function#name.
for (const [name, fn] of Object.entries(SPRITE_FUNCS)) {
  if (typeof fn === 'function') fn.__mozpongSaveId = name;
}

function faceKey(face) {
  if (!face) return null;
  if (face.resourceId != null) return `p${face.resourceId}`;
  if (face.id != null) return `c${face.id}`;
  return null;
}

function faceFromKey(key, faceMap) {
  if (!key) return null;
  const face = faceMap.get(key);
  if (face) return face;
  const id = Number(key.slice(1));
  if (key[0] === 'p') return assets?.getFacePPSync(id) ?? null;
  if (key[0] === 'c') return assets?.getFaceCicnSync(id) ?? null;
  return null;
}

function isFaceArray(value) {
  return Array.isArray(value) &&
    value.some(v => v instanceof Face) &&
    value.every(v => v == null || v instanceof Face);
}

function buildFaceMap() {
  const map = new Map();
  const add = (value) => {
    if (value instanceof Face) {
      const key = faceKey(value);
      if (key && !map.has(key)) map.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) add(item);
    }
  };
  for (const value of Object.values(G)) add(value);
  if (assets?.facesPP) for (const face of assets.facesPP.values()) add(face);
  if (assets?.facesCicn) for (const face of assets.facesCicn.values()) add(face);
  return map;
}

function serializeValue(value, spriteIndex) {
  if (value === null || value === undefined) return value;
  const type = typeof value;
  if (type === 'function' || type === 'symbol') return undefined;
  if (type !== 'object') return value;
  if (value instanceof Sprite) {
    const index = spriteIndex.get(value);
    return index === undefined ? null : { $sprite: index };
  }
  if (value instanceof Face) return { $face: faceKey(value) };
  if (Array.isArray(value)) return value.map(v => serializeValue(v, spriteIndex));
  if (value instanceof Int32Array || value instanceof Uint8Array ||
      value instanceof Uint16Array || value instanceof Int16Array) {
    return { $typed: value.constructor.name, data: Array.from(value) };
  }
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    const serialized = serializeValue(item, spriteIndex);
    if (serialized !== undefined) out[key] = serialized;
  }
  return out;
}

function serializeSprite(sp, spriteIndex) {
  const out = {};
  for (const [key, value] of Object.entries(sp)) {
    if (key === 'next' || key === 'prev' || key === 'handle' ||
        key === 'hit' || key === 'cachedFace') continue;
    if (key === 'face' || key === 'intactFace') {
      out[key] = faceKey(value);
      continue;
    }
    const serialized = serializeValue(value, spriteIndex);
    if (serialized !== undefined) out[key] = serialized;
  }
  out.handle = sp.handle ? (sp.handle.__mozpongSaveId ?? sp.handle.name ?? null) : null;
  out.hit = sp.hit ? (sp.hit.__mozpongSaveId ?? sp.hit.name ?? null) : null;
  return out;
}

function deserializeValue(value, sprites, faceMap) {
  if (Array.isArray(value)) {
    return value.map(v => deserializeValue(v, sprites, faceMap));
  }
  if (value && typeof value === 'object') {
    if (typeof value.$sprite === 'number') return sprites[value.$sprite] ?? null;
    if (typeof value.$face === 'string' || value.$face === null) {
      return faceFromKey(value.$face, faceMap);
    }
    if (typeof value.$typed === 'string' && Array.isArray(value.data)) {
      const ctor = globalThis[value.$typed];
      return typeof ctor === 'function' ? new ctor(value.data) : value.data;
    }
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = deserializeValue(item, sprites, faceMap);
    }
    return out;
  }
  return value;
}

export function snapshotGame() {
  const sprites = [];
  const spriteIndex = new Map();
  for (let sp = sat.head; sp; sp = sp.next) {
    spriteIndex.set(sp, sprites.length);
    sprites.push(serializeSprite(sp, spriteIndex));
  }
  const globals = {};
  for (const [key, value] of Object.entries(G)) {
    if (SAVE_SKIP_KEYS.has(key)) continue;
    if (value instanceof Face || isFaceArray(value)) continue;
    const serialized = serializeValue(value, spriteIndex);
    if (serialized !== undefined) globals[key] = serialized;
  }
  return {
    version: 1,
    savedAt: Date.now(),
    globals,
    sprites,
    rand: rand.seed,
    ticks: clock.ticks,
  };
}

export function restoreGame(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.sprites)) return false;
  const faceMap = buildFaceMap();
  const sprites = [];
  for (const info of data.sprites) {
    const sp = new Sprite(info.kind ?? 0, info.h ?? 0, info.v ?? 0);
    for (const [key, value] of Object.entries(info)) {
      if (key === 'handle' || key === 'hit' || key === 'face' ||
          key === 'intactFace' || key === 'cachedFace' ||
          key === 'sub' || key === 'next' || key === 'prev') continue;
      const item = deserializeValue(value, sprites, faceMap);
      if (key === 'local' || key === 'screen' || key === 'destRect' ||
          key === 'prevDrawn') {
        if (item && typeof item === 'object') {
          setRect(sp[key], item.left ?? 0, item.top ?? 0,
            item.right ?? 0, item.bottom ?? 0);
        }
      } else {
        sp[key] = item;
      }
    }
    sp.handle = info.handle ? (SPRITE_FUNCS[info.handle] ?? null) : null;
    sp.hit = info.hit ? (SPRITE_FUNCS[info.hit] ?? null) : null;
    sp.face = faceFromKey(info.face, faceMap);
    sp.intactFace = faceFromKey(info.intactFace, faceMap);
    sp.cachedFace = sp.face;
    sp.next = null;
    sp.prev = null;
    sprites.push(sp);
  }
  for (let i = 0; i < sprites.length; i++) {
    const ref = data.sprites[i].sub;
    sprites[i].sub = ref && typeof ref.$sprite === 'number'
      ? (sprites[ref.$sprite] ?? null) : null;
  }
  sat.head = sat.tail = null;
  for (const sp of sprites) sat.append(sp);
  for (const [key, value] of Object.entries(data.globals ?? {})) {
    if (SAVE_SKIP_KEYS.has(key)) continue;
    G[key] = deserializeValue(value, sprites, faceMap);
  }
  rand.setSeed(data.rand ?? 1);
  clock.ticks = data.ticks ?? 0;
  for (const sp of sprites) {
    sp.screen.left = sp.local.left + sp.h;
    sp.screen.top = sp.local.top + sp.v;
    sp.screen.right = sp.local.right + sp.h;
    sp.screen.bottom = sp.local.bottom + sp.v;
    sp.cachedPos = (sp.v << 16) | (sp.h & 0xffff);
  }
  return true;
}
