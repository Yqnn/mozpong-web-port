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
    this.touchId = null;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchBaseX = 0;
    this.touchBaseY = 0;
    this.view = {
      canvasW: 512,
      canvasH: 400,
      sourceW: 512,
      sourceH: 400,
      offsetY: 0,
      playH: 400,
    };
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
      this.touchId = null;
    });

    const isUiTarget = (target) => target instanceof Element &&
      target.closest('.side-panel, button, input, textarea, select, #overlay, #loading');

    const updateFromClient = (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      const v = this.view;
      const cx = ((clientX - r.left) / r.width) * v.canvasW;
      const cy = ((clientY - r.top) / r.height) * v.canvasH;
      this.mouseX = Math.round(cx * v.sourceW / v.canvasW) - MOUSE_X_CORRECTION;
      this.mouseY = Math.round((cy - v.offsetY) * v.sourceH / v.playH);
      this.clamp();
    };

    // Touch drags are tracked on the whole window, not just the canvas, so a
    // finger that slides off the playfield still moves MozMoz.
    window.addEventListener('touchstart', (e) => {
      if (this.touchId !== null || isUiTarget(e.target)) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      this.touchId = touch.identifier;
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.touchBaseX = this.mouseX;
      this.touchBaseY = this.mouseY;
      // A tap/drag on the playfield fires; a drag from elsewhere on the screen
      // only steers MozMoz.  Do not jump the cursor to the finger on touchstart.
      this.mouseDown = e.target instanceof Element && !!e.target.closest('#screen-wrap');
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (this.touchId === null) return;
      for (const touch of e.changedTouches) {
        if (touch.identifier !== this.touchId) continue;
        const r = canvas.getBoundingClientRect();
        const v = this.view;
        const dx = (touch.clientX - this.touchStartX) * v.canvasW / r.width;
        const dy = (touch.clientY - this.touchStartY) * v.canvasH / r.height;
        this.mouseX = Math.round(this.touchBaseX + dx * v.sourceW / v.canvasW);
        this.mouseY = Math.round(this.touchBaseY + dy * v.sourceH / v.playH);
        this.clamp();
        e.preventDefault();
        break;
      }
    }, { passive: false });

    const endTouch = (e) => {
      if (this.touchId === null) return;
      for (const touch of e.changedTouches) {
        if (touch.identifier !== this.touchId) continue;
        this.touchId = null;
        this.mouseDown = false;
        break;
      }
    };
    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      updateFromClient(e.clientX, e.clientY);
    });
  }

  clamp() {
    // Clamp to the canvas rather than wrapping to the opposite edge.
    if (this.mouseX < 0) this.mouseX = 0;
    if (this.mouseX > 511) this.mouseX = 511;
    if (this.mouseY < 0) this.mouseY = 0;
    if (this.mouseY > 399) this.mouseY = 399;
  }

  setView(view) {
    this.view = { ...this.view, ...view };
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
