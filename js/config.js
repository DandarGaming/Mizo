/* =====================================================
   MIZO — CONFIG.JS
   Central configuration: paths, labels, thresholds.
   Edit ACTION_LABELS to match your trained classes.
   ===================================================== */

// ── Model asset paths ─────────────────────────────────
// Served relative to index.html; put your files in /models/
const MODEL_PATH  = 'models/model.json';
const SCALER_PATH = 'models/scaler.json';

// ── Sign class labels ─────────────────────────────────
// MUST match the class order used during training (index 0 → 3).
// Your model.json shows 4 output units (softmax), so define exactly 4.
const ACTION_LABELS = [
  'HELLO',    // class index 0
  'THANKS',   // class index 1
  'YES',      // class index 2
  'NO',       // class index 3
];

// ── Inference settings ────────────────────────────────
// Predictions below this confidence are shown as "···"
const CONFIDENCE_THRESHOLD = 0.65;

// Run inference every N frames (reduces GPU load; 6 ≈ 10 Hz at 60 fps)
const PRED_EVERY = 6;

// Number of frames in each sequence (must match model training)
const SEQUENCE_LEN = 60;
