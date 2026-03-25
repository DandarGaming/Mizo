/* =====================================================
   MIZO — HOLISTIC.JS
   MediaPipe Holistic initialisation for the main demo.
   The submit panel uses its own separate instance
   (see submit.js) to avoid shared-state conflicts.

   Depends on: config.js
   ===================================================== */

// ── Module state ──────────────────────────────────────
var holisticReady = false;
var holistic      = null;   // MediaPipe Holistic instance (main camera)
var lastResults   = null;   // Most recent onResults payload

// ─────────────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────────────

/**
 * Initialise MediaPipe Holistic for the main demo camera.
 * Called once from main.js after loadMizo() resolves.
 * Requires window.Holistic loaded from the MediaPipe CDN.
 */
function initHolistic() {
  if (!window.Holistic) {
    console.warn('[Mizo] MediaPipe Holistic not available — skeleton disabled.');
    return;
  }

  holistic = new Holistic({
    locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`,
  });

  holistic.setOptions({
    modelComplexity:        1,
    smoothLandmarks:        true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence:  0.5,
  });

  holistic.onResults(results => {
    lastResults = results;
  });

  holisticReady = true;
  console.log('[Mizo] Holistic initialised.');
}
