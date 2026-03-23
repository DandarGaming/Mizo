/* =====================================================
   MIZO — MODEL.JS
   TF.js model loading, StandardScaler transform,
   keypoint extraction, and real-time inference.
   ===================================================== */

// ── Module state ──────────────────────────────────────
let mizoModel  = null;
let scalerMean = null;
let scalerStd  = null;

// ── Rolling inference buffer ──────────────────────────
// Holds the last SEQUENCE_LEN scaled keypoint frames for live prediction
const SEQUENCE_LEN = 60;
let frameBuffer    = [];          // circular buffer of scaled kp arrays
let lastPrediction = null;        // { label, confidence, scores }
let predCooldown   = 0;           // skip frames between predictions (perf)
const PRED_EVERY   = 6;           // run inference every N frames (~10 Hz at 60fps)

/**
 * Load the TF.js model and its associated StandardScaler.
 * Falls back to demo-stub mode if either file is missing.
 */
async function loadMizo() {
  setStatus('LOADING MODEL…');
  try {
    mizoModel = await tf.loadLayersModel(MODEL_PATH);

    const scalerRes = await fetch(SCALER_PATH);
    if (!scalerRes.ok) throw new Error('Scaler fetch failed: ' + scalerRes.status);
    const scalerData = await scalerRes.json();

    const valid =
      Array.isArray(scalerData.mean) && Array.isArray(scalerData.std) &&
      scalerData.mean.length === 1662 && scalerData.std.length === 1662 &&
      scalerData.mean.every(Number.isFinite) && scalerData.std.every(Number.isFinite);
    if (!valid) throw new Error('Scaler data malformed or wrong shape (expected 1662 values)');

    scalerMean = scalerData.mean;
    scalerStd  = scalerData.std;
    setStatus('MODEL READY');
    console.log('[Mizo] Model loaded. Input shape:', mizoModel.inputs[0].shape);
  } catch (e) {
    setStatus('MODEL NOT FOUND — DEMO MODE');
    console.warn('[Mizo] Could not load model/scaler. Running demo stub.', e);
  }
}

/**
 * Push one scaled keypoint frame into the rolling buffer,
 * then run inference if the buffer is full and the cooldown has elapsed.
 * Call this every frame from the camera render loop.
 *
 * @param {number[]} scaledKp - 1662-element scaled keypoint vector
 */
async function feedFrame(scaledKp) {
  frameBuffer.push(scaledKp);
  if (frameBuffer.length > SEQUENCE_LEN) frameBuffer.shift(); // keep last 60

  if (!mizoModel || frameBuffer.length < SEQUENCE_LEN) return;

  predCooldown++;
  if (predCooldown < PRED_EVERY) return;
  predCooldown = 0;

  lastPrediction = await runPrediction(frameBuffer);
  if (lastPrediction) updatePredictionUI(lastPrediction);
}

/**
 * Run a single forward pass through the LSTM model.
 * Input tensor shape: [1, 60, 1662]
 *
 * @param {number[][]} sequence - array of exactly 60 keypoint vectors (each 1662-d)
 * @returns {{ label: string, confidence: number, scores: number[] } | null}
 */
async function runPrediction(sequence) {
  if (!mizoModel || sequence.length < SEQUENCE_LEN) return null;

  return tf.tidy(() => {
    const input  = tf.tensor3d([sequence.slice(-SEQUENCE_LEN)], [1, SEQUENCE_LEN, 1662]);
    const output = mizoModel.predict(input);           // [1, 4]
    const scores = Array.from(output.dataSync());      // synchronous inside tidy

    const maxIdx     = scores.indexOf(Math.max(...scores));
    const confidence = scores[maxIdx];
    const label      = ACTION_LABELS[maxIdx] ?? `CLASS_${maxIdx}`;

    return { label, confidence, scores, classIdx: maxIdx };
  });
}

/**
 * Run inference on a completed 60-frame captured sequence
 * (called from submit.js after finishRecording).
 *
 * @param {number[][]} keypoints - capturedSeq.keypoints
 * @returns {Promise<{ label, confidence, scores }>}
 */
async function predictCaptured(keypoints) {
  return runPrediction(keypoints);
}

/**
 * Extract a flat 1662-element keypoint vector from MediaPipe Holistic results.
 * pose(132) + face(1404) + lh(63) + rh(63) = 1662
 */
function extractKeypoints(results) {
  const pose = results.poseLandmarks
    ? results.poseLandmarks.flatMap(l => [l.x, l.y, l.z, l.visibility])
    : new Array(132).fill(0);
  const face = results.faceLandmarks
    ? results.faceLandmarks.flatMap(l => [l.x, l.y, l.z])
    : new Array(1404).fill(0);
  const lh = results.leftHandLandmarks
    ? results.leftHandLandmarks.flatMap(l => [l.x, l.y, l.z])
    : new Array(63).fill(0);
  const rh = results.rightHandLandmarks
    ? results.rightHandLandmarks.flatMap(l => [l.x, l.y, l.z])
    : new Array(63).fill(0);
  return [...pose, ...face, ...lh, ...rh];
}

/** Apply sklearn StandardScaler: (x - mean) / std */
function scalerTransform(kp) {
  if (!scalerMean || !scalerStd) return kp;
  return kp.map((v, i) => (v - scalerMean[i]) / (scalerStd[i] + 1e-8));
}

/** Reset the rolling frame buffer (e.g. on camera restart). */
function clearFrameBuffer() {
  frameBuffer    = [];
  lastPrediction = null;
  predCooldown   = 0;
}
