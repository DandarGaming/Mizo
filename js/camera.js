/* =====================================================
   MIZO — CAMERA.JS
   Main demo camera: setup, run-loop, holistic + model
   inference, demo-stub mode, and camera controls.

   Depends on: config.js, thermal.js, model.js,
               holistic.js, ui.js
   ===================================================== */

// ── Inference buffers ─────────────────────────────────
let sequence    = [];   // rolling SEQ_LEN-frame keypoint buffer
let predictions = [];   // rolling STABILITY_N argmax buffer

// ── Camera state ──────────────────────────────────────
let cameraActive = false;
let stream       = null;
let animFrame    = null;

// ── FPS tracking ──────────────────────────────────────
let frameCount  = 0;
let lastFpsTime = Date.now();
let fps         = 0;

// ─────────────────────────────────────────────────────
// Demo stub (runs when no model / scaler is available)
// ─────────────────────────────────────────────────────
let demoIdx  = 0;
let demoTick = 0;

/**
 * Return a simulated prediction that cycles through ACTIONS
 * every ~45 frames so the UI remains active in demo mode.
 *
 * @returns {{ action: string, confidence: number, stable: boolean }}
 */
function demoPredict() {
  demoTick++;
  if (demoTick > 45) {
    demoTick = 0;
    demoIdx = (demoIdx + 1) % ACTIONS.length;
  }
  return {
    action:     ACTIONS[demoIdx],
    confidence: 0.78 + Math.random() * 0.2,
    stable:     true,
  };
}

// ─────────────────────────────────────────────────────
// Per-frame processor
// ─────────────────────────────────────────────────────

/**
 * Process one video frame:
 *  1. Send to MediaPipe Holistic (if available)
 *  2. Render thermal image + skeleton onto the overlay canvas
 *  3. Run model inference (or demo stub)
 *  4. Update HUD and sentence buffer
 *
 * @param {HTMLVideoElement}  video
 * @param {HTMLCanvasElement} overlayCanvas
 */
async function processHolisticFrame(video, overlayCanvas) {
  const w   = overlayCanvas.width;
  const h   = overlayCanvas.height;
  const ctx = overlayCanvas.getContext('2d');

  // 1. Run MediaPipe
  if (holisticReady && holistic) {
    await holistic.send({ image: video });
  }

  const results = lastResults;

  // 2. Thermal render + skeleton
  applyThermal(video, overlayCanvas);
  if (results) drawSkeleton(ctx, results, w, h);

  // Update hand-presence indicators
  document.getElementById('leftHandBar').style.width  =
    (results && results.leftHandLandmarks)  ? '100%' : '0%';
  document.getElementById('rightHandBar').style.width =
    (results && results.rightHandLandmarks) ? '100%' : '0%';

  // 3a. Demo mode (no model loaded)
  if (!mizoModel) {
    const d = demoPredict();
    updateHUD({ sign: d.action, confidence: d.confidence, stable: d.stable });
    return;
  }

  // 3b. Real inference
  if (!results) return;

  const kp       = extractKeypoints(results);
  const kpScaled = scalerTransform(kp);

  sequence.push(kpScaled);
  if (sequence.length > SEQ_LEN) sequence.shift();

  updateBufferBar(sequence.length);

  if (sequence.length < SEQ_LEN) return; // not enough frames yet

  const inputTensor = tf.tensor3d([sequence], [1, SEQ_LEN, 1662]);
  const predTensor  = mizoModel.predict(inputTensor);
  const probs       = await predTensor.data();
  inputTensor.dispose();
  predTensor.dispose();

  const argmax = probs.indexOf(Math.max(...probs));
  if (argmax < 0 || argmax >= ACTIONS.length) return;

  predictions.push(argmax);
  if (predictions.length > STABILITY_N) predictions.shift();

  const confidence = Math.min(1, Math.max(0, probs[argmax]));
  const stable     =
    predictions.length === STABILITY_N &&
    new Set(predictions).size === 1 &&
    confidence > THRESHOLD;

  // 4. Update sentence buffer on stable prediction
  if (stable) {
    const action = ACTIONS[argmax];
    if (sentence.length === 0 || sentence[sentence.length - 1] !== action) {
      sentence.push(action);
      if (sentence.length > 5) sentence.shift();
      addLogEntry(action, Math.round(confidence * 100));
      updateSentence();
    }
  }

  updateHUD({ sign: ACTIONS[argmax], confidence, stable });
}

// ─────────────────────────────────────────────────────
// Main animation loop
// ─────────────────────────────────────────────────────

async function runLoop() {
  if (!cameraActive) return;

  const video  = document.getElementById('videoElement');
  const canvas = document.getElementById('canvasOverlay');

  // FPS counter
  frameCount++;
  const now = Date.now();
  if (now - lastFpsTime >= 1000) {
    fps         = frameCount;
    frameCount  = 0;
    lastFpsTime = now;
  }

  const elapsed = Math.floor((now - lastFpsTime) / 1000);
  document.getElementById('frameCounter').textContent =
    'FRAME: ' + String(fps * elapsed + frameCount).padStart(4, '0');
  document.getElementById('fpsCounter').textContent =
    'FPS: ' + String(fps || '--').padStart(2, '0');

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    try {
      await processHolisticFrame(video, canvas);
    } catch (e) {
      console.error('[Mizo loop]', e);
    }
  }

  animFrame = requestAnimationFrame(runLoop);
}

// ─────────────────────────────────────────────────────
// Camera controls
// ─────────────────────────────────────────────────────

/** Request camera access and start the recognition loop. */
async function startCamera() {
  if (cameraActive) return;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
    });

    const video = document.getElementById('videoElement');
    video.srcObject   = stream;
    video.style.display = 'block';
    document.getElementById('cameraPlaceholder').style.display = 'none';

    cameraActive = true;
    sequence     = [];
    predictions  = [];

    const recDot = document.getElementById('recDot');
    recDot.style.background = 'var(--thermal-red)';
    recDot.style.boxShadow  = '0 0 8px var(--thermal-red)';

    setStatus('LIVE ● REC');
    document.getElementById('startBtn').textContent = '■ STOP CAMERA';
    document.getElementById('startBtn').classList.add('active');

    runLoop();
  } catch (e) {
    setStatus('ACCESS DENIED');
    console.error('[Mizo] Camera access denied:', e);
  }
}

/** Stop the recognition loop and release the camera. */
function stopCamera() {
  cameraActive = false;

  if (animFrame) cancelAnimationFrame(animFrame);
  if (stream)   { stream.getTracks().forEach(t => t.stop()); stream = null; }

  const video  = document.getElementById('videoElement');
  const canvas = document.getElementById('canvasOverlay');

  video.srcObject     = null;
  video.style.display = 'none';
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

  document.getElementById('cameraPlaceholder').style.display = 'flex';
  document.getElementById('recDot').style.background = '#C0C4D0';
  document.getElementById('recDot').style.boxShadow  = 'none';

  setStatus('STANDBY');
  document.getElementById('startBtn').textContent = '▶ INITIALISE CAMERA';
  document.getElementById('startBtn').classList.remove('active');

  // Reset HUD
  document.getElementById('detectedSign').textContent = '—';
  document.getElementById('confFill').style.width     = '0%';
  document.getElementById('confValue').textContent    = '0%';
  document.getElementById('bufferFill').style.width   = '0%';
  document.getElementById('bufferVal').textContent    = '0/' + SEQ_LEN;

  sequence    = [];
  predictions = [];
}

/** Toggle camera on/off — called by the sidebar button. */
function toggleCamera() {
  cameraActive ? stopCamera() : startCamera();
}
