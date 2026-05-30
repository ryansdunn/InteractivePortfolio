/* =============================================================================
 * components/MobileControls.js
 * -----------------------------------------------------------------------------
 * Virtual joystick (left) + action button (right) for touch devices.
 * Only activates when a touch-capable device is detected, so the desktop
 * experience is completely unchanged.
 *
 * Exposes:
 *   .active     — true when touch controls are live
 *   .joystick   — { x, y } normalised direction (-1..1); (0,0) when idle
 *   .onAction   — callback set by TiledWorldScene once the scene is ready;
 *                 called on every button tap (context-aware: dialogue → talk → attack)
 * ========================================================================== */

class MobileControls {
  constructor() {
    this.active = false;
    this.joystick = { x: 0, y: 0 };
    this.onAction = null;
    this._touchId = null;
    this._baseX = 0;
    this._baseY = 0;
    this._joyThumb = null;
    this._baseR = 44;
  }

  init() {
    if (!('ontouchstart' in window) && !(navigator.maxTouchPoints > 0)) return;
    this.active = true;
    this._build();
  }

  _build() {
    const el = document.createElement('div');
    el.id = 'mobile-controls';
    el.innerHTML = `
      <div id="joy-zone">
        <div id="joy-base"><div id="joy-thumb"></div></div>
      </div>
      <button id="action-btn" aria-label="Action">⚔</button>`;
    document.body.appendChild(el);

    this._joyThumb = el.querySelector('#joy-thumb');
    const joyBase = el.querySelector('#joy-base');
    const joyZone = el.querySelector('#joy-zone');
    const btn = el.querySelector('#action-btn');

    joyZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this._touchId !== null) return;
      const t = e.changedTouches[0];
      this._touchId = t.identifier;
      const r = joyBase.getBoundingClientRect();
      this._baseX = r.left + r.width / 2;
      this._baseY = r.top + r.height / 2;
      this._updateJoy(t.clientX, t.clientY);
    }, { passive: false });

    joyZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this._touchId) this._updateJoy(t.clientX, t.clientY);
      }
    }, { passive: false });

    const endJoy = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this._touchId) {
          this._touchId = null;
          this.joystick = { x: 0, y: 0 };
          this._joyThumb.style.transform = 'translate(-50%, -50%)';
        }
      }
    };
    joyZone.addEventListener('touchend', endJoy, { passive: false });
    joyZone.addEventListener('touchcancel', endJoy, { passive: false });

    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.onAction) this.onAction();
    }, { passive: false });
  }

  _updateJoy(cx, cy) {
    const dx = cx - this._baseX, dy = cy - this._baseY;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, this._baseR);
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * clamped, ny = Math.sin(angle) * clamped;
    this._joyThumb.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
    const mag = clamped / this._baseR;
    this.joystick = { x: Math.cos(angle) * mag, y: Math.sin(angle) * mag };
  }
}
