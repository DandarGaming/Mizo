/* =====================================================
   MIZO — HOLISTIC.JS
   MediaPipe Holistic initialisation for the main demo.
   The submit panel uses its own separate instance
   (see submit.js) to avoid shared-state conflicts.

   Depends on: config.js
   ===================================================== */
let holistic = null;
let holisticReady = false;
let lastResults = null;

async function initHolistic() {
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

  await holistic.initialize();

  holisticReady = true;
  console.log('[Mizo] Holistic initialised.');
}

async function processHolisticFrame(video) {
  if (!holisticReady || !holistic) return;

  await holistic.send({ image: video });
}

function getHolisticResults() {
  return lastResults;
}
