/* =====================================================
   MIZO — SUBMIT.JS
   Sign submission panel: camera, 60-frame recorder,
   thermal toggle, in-memory queue, JSON export.

   Depends on: config.js, thermal.js, model.js, ui.js
   ===================================================== */

let submitHolistic = null;
let submitLastResults = null;
let thermalSubmit = false;

function toggleSubmitThermal() {
  thermalSubmit = !thermalSubmit;
  console.log('[Thermal Submit]', thermalSubmit);

  const btn = document.getElementById('thermalSubmitBtn');
  if (btn) {
    btn.textContent = thermalSubmit ? 'THERMAL: ON' : 'THERMAL: OFF';
    btn.dataset.active = String(thermalSubmit);
  }
}

async function initSubmitHolistic() {
  if (!window.Holistic) return;

  submitHolistic = new Holistic({
    locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`,
  });

  submitHolistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  submitHolistic.onResults(r => {
    submitLastResults = r;
  });

  // 🔥 CRITICAL FIX
  await submitHolistic.initialize();
}

async function processSubmitFrame(video) {
  if (!submitHolistic) return;

  await submitHolistic.send({ image: video });
}

function getSubmitResults() {
  return submitLastResults;
}

async function submitLoop(video, canvas) {
  if (video.readyState >= 2) {
    await processSubmitFrame(video);

    applyThermal(video, canvas, thermalSubmit);

    const results = getSubmitResults();

    if (results) {
      drawSkeleton(canvas, results);
    }
  }

  requestAnimationFrame(() => submitLoop(video, canvas));
}
}
