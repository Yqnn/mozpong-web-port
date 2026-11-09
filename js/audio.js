// Web Audio layer for the original snd resources.
export class AudioEngine {
  constructor(manifest) {
    this.manifest = manifest;
    this.ctx = null;
    this.buffers = new Map();
    this.effectsEnabled = true;
    this.musicEnabled = true;
    this.musicSource = null;
    this.musicBuffer = null;
    this.volume = 0.7;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  async load(id) {
    id = +id;
    if (this.buffers.has(id)) return this.buffers.get(id);
    const url = this.manifest.snd[String(id)];
    if (!url) return null;
    const data = await fetch(url).then(r => r.arrayBuffer());
    const buf = await this.ctx.decodeAudioData(data);
    this.buffers.set(id, buf);
    return buf;
  }

  async preload(ids) {
    this.init();
    await Promise.all(ids.map(id => this.load(id)));
  }

  async playSound(id, prio = 0, canWait = false, extra = 0) {
    if (!this.effectsEnabled || !id) return;
    this.init();
    this.resume();
    const buf = await this.load(id);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.9;
    src.connect(g).connect(this.master);
    src.start();
  }

  async startMusic(n = 0) {
    if (!this.musicEnabled) return;
    this.init();
    this.resume();
    if (!this.musicBuffer) this.musicBuffer = await this.load(10000);
    if (!this.musicBuffer) return;
    this.stopMusic(0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.musicBuffer;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = 0.45;
    src.connect(g).connect(this.master);
    src.start();
    this.musicSource = src;
  }

  stopMusic(n = 0) {
    if (this.musicSource) {
      try { this.musicSource.stop(); } catch { /* already stopped */ }
      this.musicSource.disconnect();
      this.musicSource = null;
    }
  }

  soundOn() { this.effectsEnabled = true; }
  soundOff() { this.effectsEnabled = false; }
  events() {}
  done() { return true; }
  stopAll() { this.stopMusic(0); }
}
