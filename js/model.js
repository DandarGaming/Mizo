/* =====================================================
   MIZO — MODEL.JS
   TF.js model loading, StandardScaler transform,
   and MediaPipe keypoint extraction.

   Mirrors the pipeline from mizo__3_.ipynb exactly:
     pose(132) + face(1404) + lh(63) + rh(63) = 1662 features
   ===================================================== */

// ── Module state ──────────────────────────────────────
let mizoModel  = null;  // loaded TF.js LayersModel
let scalerMean = null;  // Float64Array of 1662 mean values
let scalerStd  = null;  // Float64Array of 1662 std-dev values

/**
 * Load the TF.js model and its associated StandardScaler.
 * Falls back to demo-stub mode if either file is missing.
 * Reads MODEL_PATH and SCALER_PATH from config.js.
 */
async function loadMizo() {
  setStatus('LOADING MODEL…');

  try {
    mizoModel = await tf.loadLayersModel(MODEL_PATH);

    const scalerRes = await fetch(SCALER_PATH);
    if (!scalerRes.ok) throw new Error('Scaler fetch failed: ' + scalerRes.status);

    const scalerData = await scalerRes.json();

    // Validate: must be two arrays of exactly 1662 finite numbers
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
 * Extract a flat 1662-element keypoint vector from a MediaPipe
 * Holistic results object.  Mirrors extract_keypoints() in the notebook.
 *
 * @param {object} results - MediaPipe Holistic results
 * @returns {number[]} Array of 1662 numbers
 */
function extractKeypoints(results) {
  // pose: 33 landmarks × 4 (x, y, z, visibility) = 132
  const pose = results.poseLandmarks
    ? results.poseLandmarks.flatMap(l => [l.x, l.y, l.z, l.visibility])
    : new Array(132).fill(0);

  // face: 468 landmarks × 3 = 1404
  const face = results.faceLandmarks
    ? results.faceLandmarks.flatMap(l => [l.x, l.y, l.z])
    : new Array(1404).fill(0);

  // left hand: 21 × 3 = 63
  const lh = results.leftHandLandmarks
    ? results.leftHandLandmarks.flatMap(l => [l.x, l.y, l.z])
    : new Array(63).fill(0);

  // right hand: 21 × 3 = 63
  const rh = results.rightHandLandmarks
    ? results.rightHandLandmarks.flatMap(l => [l.x, l.y, l.z])
    : new Array(63).fill(0);

  return [...pose, ...face, ...lh, ...rh]; // 1662 total
}

/**
 * Apply sklearn StandardScaler transform: (x - mean) / std
 * Returns the raw keypoints unchanged if the scaler is not loaded.
 *
 * @param {number[]} kp - raw 1662-element keypoint vector
 * @returns {number[]} scaled vector
 */
function scalerTransform(kp) {
  if (!scalerMean || !scalerStd) return kp;
  return kp.map((v, i) => (v - scalerMean[i]) / (scalerStd[i] + 1e-8));
}
