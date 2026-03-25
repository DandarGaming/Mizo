/* =====================================================
   MIZO — UI.JS
   HUD helpers: status badge, prediction display,
   toast notifications, clock, radar minimap.

   Depends on: config.js
   ===================================================== */

// ─────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────

/**
 * Update the main status badge text (e.g. "MODEL READY", "DEMO MODE").
 * @param {string} msg
 */
function setStatus(msg) {
  const el = document.getElementById('statusBadge');
  if (el) el.textContent = msg;
}

// ─────────────────────────────────────────────────────
// Prediction display
// ─────────────────────────────────────────────────────

/**
 * Push a new prediction result into the live HUD.
 * Hides the label and confidence when below CONFIDENCE_THRESHOLD,
 * showing "···" instead so low-confidence noise is suppressed.
 *
 * Expects these elements in index.html:
 *   #predLabel   — the sign name badge
 *   #predConf    — the confidence percentage
 *   #predBar     — optional progress-bar fill (width % of confidence)
 *   #predScores  — optional per-class score readout
 *
 * @param {{ label: string, confidence: number, scores: number[], classIdx: number }} pred
 */
function updatePredictionUI({ label, confidence, scores, classIdx }) {
  const labelEl  = document.getElementById('predLabel');
  const confEl   = document.getElementById('predConf');
  const barEl    = document.getElementById('predBar');
  const scoresEl = document.getElementById('predScores');

  const active = confidence >= CONFIDENCE_THRESHOLD;

  // ── Main label ────────────────────────────────────
  if (labelEl) {
    labelEl.textContent      = active ? label : '···';
    labelEl.dataset.active   = active ? 'true' : 'false';
    labelEl.dataset.classIdx = classIdx ?? '';
  }

  // ── Confidence percentage ─────────────────────────
  if (confEl) {
    confEl.textContent = active ? Math.round(confidence * 100) + '%' : '';
  }

  // ── Optional progress bar ─────────────────────────
  if (barEl) {
    barEl.style.width = Math.round(confidence * 100) + '%';
    barEl.dataset.active = active ? 'true' : 'false';
  }

  // ── Optional per-class score readout ──────────────
  if (scoresEl && scores) {
    scoresEl.innerHTML = '';
    scores.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'score-row' + (i === classIdx ? ' top' : '');

      const name = document.createElement('span');
      name.className   = 'score-label';
      name.textContent = ACTION_LABELS[i] ?? `CLASS_${i}`;

      const pct = document.createElement('span');
      pct.className   = 'score-pct';
      pct.textContent = Math.round(s * 100) + '%';

      const fill = document.createElement('div');
      fill.className = 'score-bar-fill';
      fill.style.width = Math.round(s * 100) + '%';

      row.appendChild(name);
      row.appendChild(fill);
      row.appendChild(pct);
      scoresEl.appendChild(row);
    });
  }
}

// ─────────────────────────────────────────────────────
// Toast notifications
// ─────────────────────────────────────────────────────

var _toastTimer = null;

/**
 * Show a brief HUD toast message.
 * Auto-dismisses after 2.5 seconds.
 * @param {string} msg
 */
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;

  el.textContent = msg;
  el.classList.add('visible');

  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('visible'), 2500);
}

// ─────────────────────────────────────────────────────
// Footer clock
// ─────────────────────────────────────────────────────

/** Update the footer clock to the current UTC time. */
function updateClock() {
  const el = document.getElementById('footerClock');
  if (!el) return;
  const now = new Date();
  const hh  = String(now.getUTCHours()).padStart(2, '0');
  const mm  = String(now.getUTCMinutes()).padStart(2, '0');
  const ss  = String(now.getUTCSeconds()).padStart(2, '0');
  el.textContent = `${hh}:${mm}:${ss} UTC`;
}

// ─────────────────────────────────────────────────────
// Radar minimap
// ─────────────────────────────────────────────────────

/** Draw a simple spinning radar sweep onto #radarCanvas. */
function drawRadar() {
  const canvas = document.getElementById('radarCanvas');
  if (!canvas) return;

  const ctx  = canvas.getContext('2d');
  const W    = canvas.width  = 80;
  const H    = canvas.height = 80;
  const cx   = W / 2, cy = H / 2, r = 36;
  let   angle = 0;

  function frame() {
    ctx.clearRect(0, 0, W, H);

    // Background circle
    ctx.strokeStyle = 'rgba(26,63,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

    // Cross-hairs
    ctx.beginPath();
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
    ctx.stroke();

    // Inner rings
    [r * 0.6, r * 0.3].forEach(ri => {
      ctx.beginPath(); ctx.arc(cx, cy, ri, 0, Math.PI * 2); ctx.stroke();
    });

    // Sweep
    const grad = ctx.createConicalGradient
      ? ctx.createConicalGradient(cx, cy, angle - Math.PI / 2)
      : null;

    if (grad) {
      grad.addColorStop(0,    'rgba(26,63,255,0.7)');
      grad.addColorStop(0.25, 'rgba(26,63,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    } else {
      // Fallback: simple sweep line
      ctx.strokeStyle = 'rgba(26,63,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
      ctx.stroke();
    }

    angle += 0.04;
    requestAnimationFrame(frame);
  }

  frame();
}
