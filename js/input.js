// Mouse/keyboard input for the 512x400 game window.  The original hides the
// system cursor and uses the red guide bar as the pointer.  Because the port
// keeps the system cursor visible, the game coordinate is shifted left by the
// bar-centre offset so the visible crosshair sits on the bar/character.
// 23 px = 15 px bar half-width + the original 8 px guide offset.
const MOUSE_X_CORRECTION = 0x17;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouseX = 256;
    this.mouseY = 200;
    this.mouseDown = false;
    this.keys = [];
    this.keySet = new Set();

    window.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keySet.has(e.code)) this.keys.push(e.code);
      this.keySet.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keySet.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keySet.clear();
      this.mouseDown = false;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = Math.round(((e.clientX - r.left) / r.width) * 512) - MOUSE_X_CORRECTION;
      this.mouseY = Math.round(((e.clientY - r.top) / r.height) * 400);
      this.clamp();
    });
  }

  clamp() {
    // Clamp to the canvas rather than wrapping to the opposite edge.
    if (this.mouseX < 0) this.mouseX = 0;
    if (this.mouseX > 511) this.mouseX = 511;
    if (this.mouseY < 0) this.mouseY = 0;
    if (this.mouseY > 399) this.mouseY = 399;
  }

  setMouse(x, y) {
    this.mouseX = Math.round(x);
    this.mouseY = Math.round(y);
    this.clamp();
  }

  takeKeys() {
    const k = this.keys;
    this.keys = [];
    return k;
  }
}
