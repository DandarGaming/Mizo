/* =====================================================
   MIZO — CONFIG
   All constants and configuration in one place.
   Update MODEL_PATH, SCALER_PATH, and ACTIONS to
   match your trained model.
   ===================================================== */

/* ── HOW TO DEPLOY YOUR MODEL ──────────────────────
   1. Convert Mizo.h5 → TF.js:
      tensorflowjs_converter --input_format keras Mizo.h5 ./tfjs_model

   2. Export scaler to JSON:
      python -c "
        import pickle, json
        s = pickle.load(open('scaler.pkl','rb'))
        json.dump({'mean': s.mean_.tolist(), 'std': s.scale_.tolist()}, open('scaler.json','w'))
      "

   3. Place model.json, the weight shards, and scaler.json
      alongside index.html (or update the paths below).
   ─────────────────────────────────────────────────── */

const MODEL_PATH  = './tfjs_model/model.json';
const SCALER_PATH = './scaler.json';

// Minimum softmax confidence required to confirm a prediction
const THRESHOLD   = 0.5;

// Number of frames in one input sequence (must match training)
const SEQ_LEN     = 60;

// How many consecutive identical predictions are required before
// a sign is considered "stable" and added to the sentence buffer
const STABILITY_N = 10;

// ── Actions must match the `actions` array used during training ──
const ACTIONS = ['HELLO', 'THANK YOU', 'YES', 'NO'];
