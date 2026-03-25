/* =====================================================
   MIZO — MODEL.JS
   TF.js model loading, StandardScaler transform,
   keypoint extraction, rolling frame buffer,
   and real-time + post-capture inference.

   Mirrors the pipeline from mizo__3_.ipynb exactly:
     pose(132) + face(1404) + lh(63) + rh(63) = 1662 features

   Architecture (from model.json):
     Input  [batch, 60, 1662]
     LSTM   64 units, return_sequences=true
     LayerNorm + Dropout(0.4)
     LSTM   64 units, return_sequences=false
     LayerNorm + Dropout(0.4)
     Dense  32, relu
     LayerNorm + Dropout(0.4)
     Dense  4,  softmax   ← ACTION_LABELS[0..3]

   Depends on: config.js, ui.js
   ===================================================== */

// ── Module state ──────────────────────────────────────
var mizoModel  = null;   // loaded tf.LayersModel
var scalerMean = null;   // number[] length 1662
var scalerStd  = null;   // number[] length 1662

// ── Rolling inference buffer ──────────────────────────
var frameBuffer    = [];   // last SEQUENCE_LEN scaled kp frames
var lastPrediction = null; // { label, confidence, scores, classIdx }
var predCooldown   = 0;    // frame counter for throttling inference

// ─────────────────────────────────────────────────────
// Model loading
// ─────────────────────────────────────────────────────

/**
 * Load the TF.js LayersModel and its associated StandardScaler JSON.
 * Falls back to demo-stub mode silently if either asset is missing.
 * Called once from main.js via:  loadMizo().then(() => initHolistic())
 */
async function loadMizo() {
  setStatus('LOADING MODEL…');
  try {
    // ── 1. Load TF.js model ──────────────────────────
    mizoModel = await tf.loadLayersModel(MODEL_PATH);
    console.log('[Mizo] Model loaded. Input shape:', mizoModel.inputs[0].shape);

    // ── 2. Load StandardScaler ───────────────────────
    const scalerRes = await fetch(SCALER_PATH);
    if (!scalerRes.ok) throw new Error('Scaler fetch failed: ' + scalerRes.status);
    const scalerData = await scalerRes.json();

    // Validate: must be two arrays of exactly 1662 finite numbers
    const valid =
      Array.isArray(scalerData.mean) &&
      Array.isArray(scalerData.std)  &&
      scalerData.mean.length === 1662 &&
      scalerData.std.length  === 1662 &&
      scalerData.mean.every(Number.isFinite) &&
      scalerData.std.every(Number.isFinite);

    if (!valid) {
      throw new Error('Scaler data malformed or wrong shape (expected 1662 values)');
    }

    scalerMean = scalerData.mean;
    scalerStd  = scalerData.std;

    // ── 3. Warm-up pass (avoids first-inference lag) ─
    // Runs a zero tensor through the model to compile GPU kernels.
    tf.tidy(() => {
      const warmup = tf.zeros([1, SEQUENCE_LEN, 1662]);
      mizoModel.predict(warmup);
    });

    setStatus('MODEL READY');
    console.log('[Mizo] Scaler loaded. Warm-up complete.');
  } catch (e) {
    setStatus('MODEL NOT FOUND — DEMO MODE');
    console.warn('[Mizo] Could not load model/scaler. Running demo stub.', e);
    mizoModel  = null;
    scalerMean = null;
    scalerStd  = null;
  }
}

// ─────────────────────────────────────────────────────
// Keypoint extraction
// ─────────────────────────────────────────────────────

/**
 * Extract a flat 1662-element keypoint vector from a MediaPipe
 * Holistic results object.  Mirrors extract_keypoints() in the notebook.
 *
 * Layout:
 *   pose : 33 landmarks × 4 (x, y, z, visibility) = 132
 *   face : 468 landmarks × 3 (x, y, z)            = 1404
 *   lh   : 21 landmarks  × 3                       = 63
 *   rh   : 21 landmarks  × 3                       = 63
 *                                            total  = 1662
 *
 * @param {object} results - MediaPipe Holistic results object
 * @returns {number[]} Flat array of exactly 1662 numbers
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

  return [...pose, ...face, ...lh, ...rh]; // always 1662
}

// ─────────────────────────────────────────────────────
// StandardScaler
// ─────────────────────────────────────────────────────

/**
 * Apply sklearn StandardScaler transform: z = (x - mean) / std
 * Returns the raw keypoints unchanged when the scaler is not loaded
 * (demo-stub mode) so the rest of the pipeline still runs.
 *
 * @param {number[]} kp - raw 1662-element keypoint vector
 * @returns {number[]} z-scored vector (or raw kp in demo mode)
 */
function scalerTransform(kp) {
  if (!scalerMean || !scalerStd) return kp;
  return kp.map((v, i) => (v - scalerMean[i]) / (scalerStd[i] + 1e-8));
}

// ─────────────────────────────────────────────────────
// Live inference — rolling frame buffer
// ─────────────────────────────────────────────────────

/**
 * Push one scaled keypoint frame into the rolling buffer,
 * then run inference every PRED_EVERY frames once the buffer is full.
 *
 * Call this every frame from camera.js's render loop AFTER
 * extractKeypoints + scalerTransform.
 *
 * @param {number[]} scaledKp - 1662-element z-scored keypoint vector
 */
async function feedFrame(scaledKp) {
  // Maintain a sliding window of the last SEQUENCE_LEN frames
  frameBuffer.push(scaledKp);
  if (frameBuffer.length > SEQUENCE_LEN) frameBuffer.shift();

  // Nothing to predict until the buffer is full
  if (!mizoModel || frameBuffer.length < SEQUENCE_LEN) return;

  // Throttle: only run inference every PRED_EVERY frames
  predCooldown++;
  if (predCooldown < PRED_EVERY) return;
  predCooldown = 0;

  lastPrediction = await runPrediction(frameBuffer);
  if (lastPrediction) updatePredictionUI(lastPrediction);
}

/**
 * Core inference function. Wraps the forward pass in tf.tidy()
 * so all intermediate tensors are disposed automatically.
 *
 * Input tensor shape: [1, 60, 1662]   (batch=1, time=60, features=1662)
 * Output: softmax probabilities over ACTION_LABELS
 *
 * @param {number[][]} sequence - Array of exactly SEQUENCE_LEN keypoint vectors
 * @returns {{ label: string, confidence: number, scores: number[], classIdx: number } | null}
 */
async function runPrediction(sequence) {
  if (!mizoModel || sequence.length < SEQUENCE_LEN) return null;

  // tf.tidy automatically disposes tensors created inside the callback
  return tf.tidy(() => {
    const input  = tf.tensor3d(
      [sequence.slice(-SEQUENCE_LEN)],  // always exactly SEQUENCE_LEN frames
      [1, SEQUENCE_LEN, 1662]
    );
    const output = mizoModel.predict(input);     // Tensor [1, 4]
    const scores = Array.from(output.dataSync()); // sync read inside tidy

    const maxIdx     = scores.indexOf(Math.max(...scores));
    const confidence = scores[maxIdx];
    const label      = ACTION_LABELS[maxIdx] ?? `CLASS_${maxIdx}`;

    return { label, confidence, scores, classIdx: maxIdx };
  });
}

// ─────────────────────────────────────────────────────
// Post-capture inference (submit panel)
// ─────────────────────────────────────────────────────

/**
 * Run a one-shot prediction on a completed 60-frame recorded sequence.
 * Called from submit.js → finishRecording() to pre-fill the sign name field.
 *
 * @param {number[][]} keypoints - capturedSeq.keypoints (60 × 1662)
 * @returns {Promise<{ label, confidence, scores, classIdx } | null>}
 */
async function predictCaptured(keypoints) {
  return runPrediction(keypoints);
}

// ─────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────

/** Reset the rolling buffer — call on camera stop/restart. */
function clearFrameBuffer() {
  frameBuffer    = [];
  lastPrediction = null;
  predCooldown   = 0;
}

/**
 * Return a snapshot of the last prediction (for debugging / export).
 * @returns {{ label, confidence, scores, classIdx } | null}
 */
function getLastPrediction() {
  return lastPrediction;
}
