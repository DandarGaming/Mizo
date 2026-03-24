/* =====================================================
   MIZO — UI.JS
   All HUD update helpers, radar animation, clock,
   and toast notifications.

   Depends on: config.js (SEQ_LEN)
   ===================================================== */

// ── Sentence buffer (last 5 confirmed actions) ────────
let sentence = [];

// ── Toast timer ───────────────────────────────────────
let toastTimer = null;

// ─────────────────────────────────────────────────────
// Camera / status bar helpers
// ─────────────────────────────────────────────────────

/** Update the status text in the camera status bar. */
function setStatus(txt) {
  document.getElementById('camStatus').textContent = txt;
}

// ─────────────────────────────────────────────────────
// Sequence buffer bar
// ─────────────────────────────────────────────────────

/**
 * Update the sequence-buffer progress bar and label.
 * While buffering, the detection display shows "BUF".
 *
 * @param {number} n - current number of frames in the buffer
 */
function updateBufferBar(n) {
  const pct = Math.round((n / SEQ_LEN) * 100);
  document.getElementById('bufferFill').style.width = pct + '%';
  document.getElementById('bufferVal').textContent  = n + '/' + SEQ_LEN;

  if (n < SEQ_LEN) {
    document.getElementById('detectedSign').textContent = 'BUF';
  }
}

// ─────────────────────────────────────────────────────
// Sentence buffer display
// ─────────────────────────────────────────────────────

/** Re-render the sentence buffer display from the global `sentence` array. */
function updateSentence() {
  document.getElementById('sentenceDisplay').textContent =
    sentence.join('  ·  ') || '—';
}

// ─────────────────────────────────────────────────────
// Main HUD
// ─────────────────────────────────────────────────────

/**
 * Update the sign display, confidence bar, and stable indicator.
 *
 * @param {object} opts
 * @param {string}  opts.sign       - action label to display
 * @param {number}  opts.confidence - [0, 1] confidence value
 * @param {boolean} opts.stable     - whether the prediction is stable
 */
function updateHUD({ sign, confidence, stable }) {
  const confPct = Math.round((confidence || 0) * 100);

  // Only update the sign text once the buffer is full
  if (sequence.length >= SEQ_LEN) {
    document.getElementById('detectedSign').textContent = sign || '—';
  }

  document.getElementById('confFill').style.width  = confPct + '%';
  document.getElementById('confValue').textContent  = confPct + '%';

  const indicator = document.getElementById('stableIndicator');
  indicator.textContent = stable ? '● STABLE' : '○ READING';
  indicator.style.color  = stable ? 'var(--phosphor)' : '#C0C4D0';
}

// ─────────────────────────────────────────────────────
// Recognition log
// ─────────────────────────────────────────────────────

/**
 * Prepend a new entry to the recognition log.
 * Trims the log to a maximum of 8 entries.
 *
 * @param {string} sign  - action label
 * @param {number} conf  - confidence percentage (0–100)
 */
function addLogEntry(sign, conf) {
  const log   = document.getElementById('signLog');
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  const signSpan = document.createElement('span');
  signSpan.className   = 'sign';
  signSpan.textContent = sign;

  const confSpan = document.createElement('span');
  confSpan.className   = 'conf';
  confSpan.textContent = conf + '%';

  entry.appendChild(signSpan);
  entry.appendChild(confSpan);
  log.insertBefore(entry, log.firstChild);

  while (log.children.length > 8) log.removeChild(log.lastChild);
}

// ─────────────────────────────────────────────────────
// Radar widget
// ─────────────────────────────────────────────────────

/** Animate the radar minimap on the demo sidebar. */
function drawRadar() {
  const canvas = document.getElementById('radarCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2, r = w / 2 - 4;

  let angle = 0;
  let dots  = [];

  function tick() {
    // Fade previous frame
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, w, h);

    // Concentric rings
    ctx.strokeStyle = '#1A3FFF20';
    ctx.lineWidth = 0.5;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * i / 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crosshairs
    ctx.strokeStyle = '#1A3FFF15';
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();

    // Sweep cone
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(0, 0, r, 0);
    g.addColorStop(0, 'rgba(26,63,255,0.5)');
    g.addColorStop(1, 'rgba(26,63,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, -0.5, 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Random blips
    if (Math.random() > 0.96) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * r * 0.9;
      dots.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, age: 0 });
    }
    dots = dots.filter(dot => dot.age < 80);
    dots.forEach(dot => {
      ctx.fillStyle = `rgba(26,63,255,${(1 - dot.age / 80) * 0.8})`;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      dot.age++;
    });

    angle += 0.04;
    requestAnimationFrame(tick);
  }

  tick();
}

// ─────────────────────────────────────────────────────
// Clock
// ─────────────────────────────────────────────────────

/** Render the current UTC time into the footer clock element. */
function updateClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

// ─────────────────────────────────────────────────────
// Toast notifications
// ─────────────────────────────────────────────────────

/**
 * Adapter called by model.js and camera.js.
 * Maps the { label, confidence, classIdx } shape from the model
 * onto the { sign, confidence, stable } shape that updateHUD() expects.
 *
 * @param {object} opts
 * @param {string}  opts.label      - predicted sign label
 * @param {number}  opts.confidence - [0, 1] confidence value
 * @param {number}  opts.classIdx   - predicted class index (-1 = none)
 */
function updatePredictionUI({ label, confidence, classIdx }) {
  const stable = classIdx >= 0 && (confidence || 0) >= CONFIDENCE_THRESHOLD;
  updateHUD({ sign: label || '···', confidence: confidence || 0, stable });
}

/**
 * Display a brief toast notification at the bottom of the screen.
 *
 * @param {string} msg - message text (will be prefixed with "// ")
 */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = '// ' + msg;
  t.classList.add('show');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}
