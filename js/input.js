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
    this.tapPending = false;
    this.touchId = null;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchLastX = 0;
    this.touchLastY = 0;
    this.touchBaseX = 0;
    this.touchBaseY = 0;
    this.view = {
      canvasW: 512,
      canvasH: 400,
      sourceW: 512,
      sourceH: 400,
      offsetY: 0,
      playH: 400,
      mobile: false,
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
      this.tapPending = false;
      this.touchId = null;
    });

    const isUiTarget = (target) => target instanceof Element &&
      target.closest('.side-panel, .mobile-controls, button, input, textarea, select, #overlay, #loading');

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
      this.touchLastX = touch.clientX;
      this.touchLastY = touch.clientY;
      this.touchBaseX = this.mouseX;
      this.touchBaseY = this.mouseY;
      // A tap/drag on the playfield fires; a drag from elsewhere on the screen
      // only steers MozMoz.  In the mobile layout a touch anywhere outside the
      // UI fires, matching the original's mouse-button behavior.  Do not jump
      // the cursor to the finger on touchstart.
      this.mouseDown = this.view.mobile ||
        (e.target instanceof Element && !!e.target.closest('#screen-wrap'));
      this.tapPending = true;
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (this.touchId === null) return;
      for (const touch of e.changedTouches) {
        if (touch.identifier !== this.touchId) continue;
        const r = canvas.getBoundingClientRect();
        const v = this.view;
        const scale = 1.5;
        const dx = (touch.clientX - this.touchStartX) * v.canvasW / r.width * scale;
        const dy = (touch.clientY - this.touchStartY) * v.canvasH / r.height * scale;
        this.mouseX = Math.round(this.touchBaseX + dx * v.sourceW / v.canvasW);
        this.mouseY = Math.round(this.touchBaseY + dy * v.sourceH / v.playH);
        this.touchLastX = touch.clientX;
        this.touchLastY = touch.clientY;
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

    window.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || isUiTarget(e.target)) return;
      // In the mobile layout a click/tap anywhere outside the UI fires.  On
      // desktop only clicks on the playfield should fire.
      if (this.view.mobile || e.target === canvas) {
        this.mouseDown = true;
        this.tapPending = true;
      }
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

  // Rebase the relative touch drag without moving the current pointer.  Called
  // when a game starts so a finger that is already down cannot produce an
  // accumulated jump from the title screen into the first playable frame.
  resetForGame(x, y) {
    if (Number.isFinite(x)) this.mouseX = Math.round(x);
    if (Number.isFinite(y)) this.mouseY = Math.round(y);
    this.clamp();
    this.tapPending = false;
    if (this.touchId !== null) {
      this.touchStartX = this.touchLastX;
      this.touchStartY = this.touchLastY;
    }
    this.touchBaseX = this.mouseX;
    this.touchBaseY = this.mouseY;
  }

  // A short tap can be released between two 30 Hz logic steps.  Latch it for
  // the next Button() read and clear it at the end of the step if it was not
  // consumed, so a tap made while the Butasan is unavailable cannot fire later.
  consumeTap() {
    if (!this.tapPending) return false;
    this.tapPending = false;
    return true;
  }

  endFrame() {
    this.tapPending = false;
  }

  takeKeys() {
    const k = this.keys;
    this.keys = [];
    return k;
  }
}
