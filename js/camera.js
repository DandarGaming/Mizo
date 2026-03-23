S
Copy

/* =====================================================
   MIZO — CAMERA.JS
   Main demo camera: getUserMedia, per-frame render loop,
   thermal + skeleton overlay, and live model inference
   via feedFrame() from model.js.
 
   Depends on: config.js, thermal.js, model.js, holistic.js, ui.js
   ===================================================== */
 
// ── Camera state ──────────────────────────────────────
let cameraStream  = null;
let cameraOn      = false;
let cameraAnimId  = null;
 
// ─────────────────────────────────────────────────────
// Camera controls
// ─────────────────────────────────────────────────────
 
/** Open the main demo camera and start the render loop. */
async function startCamera() {
  if (cameraOn) return;
 
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
    });
 
    const video = document.getElementById('mainVideo');
    video.srcObject     = cameraStream;
    video.style.display = 'block';
 
    const idle = document.getElementById('camIdle');
    if (idle) idle.style.display = 'none';
 
    cameraOn = true;
    clearFrameBuffer();   // reset rolling inference buffer (model.js)
 
    document.getElementById('camStatus').textContent = 'LIVE';
    document.getElementById('startCamBtn').disabled  = true;
    document.getElementById('stopCamBtn').disabled   = false;
 
    renderLoop();
    console.log('[Mizo] Main camera started.');
  } catch (err) {
    document.getElementById('camStatus').textContent = 'ACCESS DENIED';
    console.error('[Mizo] Camera access denied:', err);
  }
}
 
/** Stop the main demo camera and clear the render loop. */
function stopCamera() {
  cameraOn = false;
 
  if (cameraAnimId) { cancelAnimationFrame(cameraAnimId); cameraAnimId = null; }
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
 
  const video = document.getElementById('mainVideo');
  if (video) { video.srcObject = null; video.style.display = 'none'; }
 
  const idle = document.getElementById('camIdle');
  if (idle) idle.style.display = 'flex';
 
  document.getElementById('camStatus').textContent = 'STANDBY';
  document.getElementById('startCamBtn').disabled  = false;
  document.getElementById('stopCamBtn').disabled   = true;
 
  // Clear prediction HUD
  updatePredictionUI({ label: '···', confidence: 0, scores: [], classIdx: -1 });
  clearFrameBuffer();
 
  console.log('[Mizo] Main camera stopped.');
}
 
// ─────────────────────────────────────────────────────
// Per-frame render loop
// ─────────────────────────────────────────────────────
 
/**
 * The main per-frame loop. For every frame it:
 *  1. Sends the video frame to MediaPipe Holistic (if ready)
 *  2. Applies the thermal colour-map + Bayer dither (thermal.js)
 *  3. Draws the MediaPipe skeleton overlay (thermal.js)
 *  4. Updates the holistic status badge in the HUD
 *  5. Extracts & scales keypoints, then feeds them to feedFrame() (model.js)
 *     which runs inference every PRED_EVERY frames and calls updatePredictionUI()
 */
async function renderLoop() {
  if (!cameraOn) return;
 
  const video  = document.getElementById('mainVideo');
  const canvas = document.getElementById('mainCanvas');
 
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
 
    // ── 1. MediaPipe Holistic ────────────────────────
    if (holistic && holisticReady) {
      await holistic.send({ image: video });
    }
 
    // ── 2. Thermal render ────────────────────────────
    applyThermal(video, canvas);
 
    // ── 3. Skeleton overlay ──────────────────────────
    if (lastResults) {
      const ctx = canvas.getContext('2d');
      drawSkeleton(ctx, lastResults, canvas.width, canvas.height);
    }
 
    // ── 4. Update holistic status badge ──────────────
    const hasLeft  = !!(lastResults && lastResults.leftHandLandmarks);
    const hasRight = !!(lastResults && lastResults.rightHandLandmarks);
    const hasPose  = !!(lastResults && lastResults.poseLandmarks);
    const parts    = [
      hasPose  ? 'POSE' : '',
      hasLeft  ? 'LH'   : '',
      hasRight ? 'RH'   : '',
    ].filter(Boolean);
 
    const holisticBadge = document.getElementById('holisticStatus');
    if (holisticBadge) {
      holisticBadge.textContent = 'HOLISTIC: ' + (parts.length ? parts.join('+') : 'SCANNING');
    }
 
    // ── 5. Keypoint extraction + model inference ─────
    // extractKeypoints and scalerTransform live in model.js.
    // feedFrame() maintains the 60-frame rolling buffer and calls
    // runPrediction() + updatePredictionUI() every PRED_EVERY frames.
    const kp       = extractKeypoints(lastResults || {});
    const kpScaled = scalerTransform(kp);
    await feedFrame(kpScaled);
  }
 
  cameraAnimId = requestAnimationFrame(renderLoop);
}
