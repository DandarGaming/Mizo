// ── Model paths ───────────────────────────────────────
const MODEL_PATH  = 'models/model.json';   // served relative to index.html
const SCALER_PATH = 'models/scaler.json';

// ── Sign class labels (must match model output order) ─
// Edit these to match exactly what you trained on
const ACTION_LABELS = [
  'HELLO',    // index 0
  'THANKS',   // index 1
  'YES',      // index 2
  'NO',       // index 3
];

// Minimum confidence threshold — predictions below this are shown as "…"
const CONFIDENCE_THRESHOLD = 0.65;
