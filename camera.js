/* =====================================================
   MIZO — CAMERA.JS
   Main demo camera: getUserMedia, per-frame render loop,
   thermal + skeleton overlay, live model inference.

   Depends on: config.js, thermal.js, model.js, holistic.js, ui.js
   ===================================================== */

let cameraStream = null;
let cameraOn     = false;
let cameraAnimId = null;

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
    clearFrameBuffer();

    document.getElementById('camStatus').textContent       = 'LIVE';
    document.getElementById('startCamBtn').disabled        = true;
    document.getElementById('stopCamBtn').disabled         = false;
    document.getElementById('thermalMainBtn').disabled     = false;

    renderLoop();
    console.log('[Mizo] Main camera started.');
  } catch (err) {
    document.getElementById('camStatus').textContent = 'ACCESS DENIED';
    console.error('[Mizo] Camera error:', err);
  }
}

function stopCamera() {
  cameraOn = false;
  if (cameraAnimId) { cancelAnimationFrame(cameraAnimId); cameraAnimId = null; }
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }

  const video = document.getElementById('mainVideo');
  if (video) { video.srcObject = null; video.style.display = 'none'; }

  const idle = document.getElementById('camIdle');
  if (idle) idle.style.display = 'flex';

  document.getElementById('camStatus').textContent       = 'STANDBY';
  document.getElementById('startCamBtn').disabled        = false;
  document.getElementById('stopCamBtn').disabled         = true;
  document.getElementById('thermalMainBtn').disabled     = true;

  updatePredictionUI({ label: '···', confidence: 0, scores: [], classIdx: -1 });
  clearFrameBuffer();
}

async function renderLoop() {
  if (!cameraOn) return;

  const video  = document.getElementById('mainVideo');
  const canvas = document.getElementById('mainCanvas');

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;

    // 1. MediaPipe Holistic
    if (holistic && holisticReady) {
      await holistic.send({ image: video });
    }

    // 2. Render — thermal or plain, driven by toggle flag
    applyThermal(video, canvas, thermalMain);

    // 3. Skeleton overlay
    if (lastResults) {
      const ctx = canvas.getContext('2d');
      drawSkeleton(ctx, lastResults, canvas.width, canvas.height);
    }

    // 4. Holistic status badge
    const hasLeft  = !!(lastResults && lastResults.leftHandLandmarks);
    const hasRight = !!(lastResults && lastResults.rightHandLandmarks);
    const hasPose  = !!(lastResults && lastResults.poseLandmarks);
    const parts    = [hasPose ? 'POSE' : '', hasLeft ? 'LH' : '', hasRight ? 'RH' : ''].filter(Boolean);
    const badge    = document.getElementById('holisticStatus');
    if (badge) badge.textContent = 'HOLISTIC: ' + (parts.length ? parts.join('+') : 'SCANNING');

    // 5. Extract keypoints → feed rolling buffer → inference every PRED_EVERY frames
    const kp       = extractKeypoints(lastResults || {});
    const kpScaled = scalerTransform(kp);
    await feedFrame(kpScaled);
  }

  cameraAnimId = requestAnimationFrame(renderLoop);
}
