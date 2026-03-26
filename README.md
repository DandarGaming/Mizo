<div align="center">

# Mizo
### Real-Time Irish Sign Language Recognition with LSTM & MediaPipe

*Classify ISL gestures live through your webcam using deep learning — or try it instantly in your browser.*

[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.x-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](https://www.tensorflow.org/)
[![TF.js](https://img.shields.io/badge/TF.js-Web%20Demo-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](https://www.tensorflow.org/js)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Holistic-0097A7?style=for-the-badge&logo=google&logoColor=white)](https://mediapipe.dev/)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.x-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)](https://opencv.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![Jupyter](https://img.shields.io/badge/Notebook-Jupyter-F37626?style=for-the-badge&logo=jupyter&logoColor=white)](https://jupyter.org/)

[Getting Started](#getting-started) · [Web Demo](#web-demo) · [How It Works](#how-it-works) · [Report Bug](../../issues) · [Request Feature](../../issues)

</div>

## Table of Contents

- [About](#about)
- [Web Demo](#web-demo)
- [Features](#-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#getting-started)
- [How It Works](#how-it-works)
- [Model Architecture](#model-architecture)
- [Usage](#usage)
- [Evaluation](#evaluation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## About

Mizo is a real-time gesture and action recognition model powered by **MediaPipe Holistic**, **TensorFlow LSTM**, and **OpenCV**. It extracts **1,662 body keypoints per frame** by covering pose, face, and both hands and sequences them over 60 frames, and feeds them through a stacked LSTM network to classify what Irish Sign Language sign is being performed which is all live through your webcam.

The project now ships in two forms: a **Jupyter notebook** for training and local inference, and a **browser-based web demo** powered by TensorFlow.js that runs entirely client-side with no installation required.

> Built to be extended — add your own gestures or sign language vocabulary by simply updating the `actions` array and re-collecting data.

---

## Web Demo

The web demo runs **entirely in your browser** — no Python, no server, no install. It loads the exported TF.js model and the StandardScaler JSON directly, then mirrors the full notebook inference pipeline client-side.

### Features of the web interface

- **Live webcam feed** with MediaPipe Holistic landmark overlays rendered on a canvas
- **Real-time predictions** — rolling 60-frame buffer feeds the LSTM every 6 frames (~10 Hz at 60 fps)
- **Confidence HUD** — per-class score bars and a radar minimap in the sidebar
- **Thermal filter toggle** — an orange-tinted thermal-style overlay for landmark visualisation
- **Submit / record panel** — record a 60-frame sequence, get an auto-predicted label, and export to JSON for dataset contribution
- **Demo-stub mode** — gracefully falls back if the model assets are missing, so the UI still runs

### File structure

```
Mizo-website/
├── index.html              # Single-page application shell
├── css/styles.css          # Dark HUD theme (CSS variables)
├── js/
│   ├── config.js           # MODEL_PATH, ACTION_LABELS, thresholds
│   ├── main.js             # Boot sequence — wires all modules
│   ├── model.js            # TF.js model load, scaler, inference loop
│   ├── holistic.js         # MediaPipe Holistic initialisation
│   ├── camera.js           # Webcam capture & render loop
│   ├── ui.js               # HUD helpers, status badge, radar, clock
│   ├── submit.js           # Record panel, in-memory queue, JSON export
│   └── thermal.js          # Thermal colour-map filter
├── Model/
│   ├── model.json          # TF.js model graph
│   ├── group1-shard1of1.bin# Weight shard
│   └── scaler.json         # StandardScaler mean & std (1662 values each)
└── gifs/                   # Sign demonstration GIFs (hello, thanks, yes, no)
    ├── hello.gif
    ├── thanks.gif
    ├── yes.gif
    └── no.gif
```

### Customising the web demo

Edit `js/config.js` to point at your own model and update the class labels:

```javascript
const MODEL_PATH       = 'Model/model.json';
const SCALER_PATH      = 'Model/scaler.json';
const ACTION_LABELS    = ['HELLO', 'THANKS', 'YES', 'NO'];  // must match training order
const CONFIDENCE_THRESHOLD = 0.65;   // predictions below this show as "···"
const PRED_EVERY       = 6;          // run inference every N frames
const SEQUENCE_LEN     = 60;         // must match model input shape
```

---

## ✨ Features

- 📷 **Live webcam feed** with styled, colour-coded landmark overlays
- 🦴 **Full-body keypoint extraction** — pose (132), face (1404), left hand (63), right hand (63)
- 🧠 **Stacked LSTM model** with L2 regularisation and LayerNormalization
- 📊 **TensorBoard integration** for real-time training visualisation
- ⏱️ **Early stopping** with best-weight restoration and adaptive learning rate scheduling
- 🎛️ **HUD overlay** during data collection — progress bars, countdown timer, live recording indicator
- 🔢 **On-screen confidence bars** per action with a tunable per-class threshold
- 📱 **TFLite export** for mobile deployment
- 🌐 **TF.js export** for browser-based deployment (no server required)
- 💾 **Model & scaler persistence** via `.keras` and `.pkl` files for reproducible inference

---

## Tech Stack

| Library | Version | Purpose |
|---|---|---|
| `TensorFlow / Keras` | 2.x | LSTM model building and training |
| `TensorFlow.js` | Latest | In-browser inference |
| `MediaPipe` | Latest | Holistic keypoint detection (Python & browser) |
| `OpenCV` | 4.x | Webcam capture and frame rendering |
| `NumPy` | Latest | Keypoint array manipulation |
| `scikit-learn` | Latest | Data splitting, scaling, evaluation |
| `Matplotlib` | Latest | Frame visualisation |
| `TensorBoard` | Bundled | Training metrics logging |

---

## 📁 Project Structure

```
mizo/
│
├── mizo.ipynb              # Main notebook (steps 1–11)
├── mizo_V2.77.ipynb        # Latest notebook version
│
├── Models/
│   ├── Keras/
│   │   ├── Mizo.keras      # Saved model (primary format)  ← generated after training
│   │   └── Mizo.h5         # Saved model (legacy format)   ← generated after training
│   ├── TFJS/
│   │   ├── model.json      # TF.js model graph             ← generated after export
│   │   └── *.bin           # Weight shards
│   ├── TFLITE/
│   │   └── Mizo.tflite     # TFLite model for mobile       ← generated after conversion
│   └── scaler.pkl          # Fitted StandardScaler         ← generated after training
│
├── Mizo-website/           # Browser-based web demo
│   ├── index.html
│   ├── css/styles.css
│   ├── js/                 # config, model, holistic, camera, ui, submit, thermal
│   ├── Model/              # TF.js model.json + .bin + scaler.json
│   └── gifs/               # Sign demonstration GIFs
│
├── MP_Data/                # Keypoint data             ← generated during collection
│   ├── <action>/
│   │   ├── 0/
│   │   │   ├── 0.npy
│   │   │   └── ...
│   │   └── ...
│   └── ...
│
└── Logs/                   # TensorBoard logs          ← generated during training
    └── YYYYMMDD-HHMMSS/
```

---

## Getting Started

### Prerequisites

- Python **3.9+**
- A working **webcam**
- [Jupyter Notebook](https://jupyter.org/install) or JupyterLab

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/DandarGaming/Mizo
cd mizo
```

**2. (Recommended) Create a virtual environment**

```bash
python -m venv venv
source venv/bin/activate        # macOS / Linux
venv\Scripts\activate           # Windows
```

**3. Install dependencies**

```bash
pip install tensorflow opencv-python mediapipe scikit-learn matplotlib
```

### Running the Notebook

```bash
jupyter notebook mizo_V2.77.ipynb
```

> ⚠️ **Always run Cell 1 first** every time you open the notebook — it imports all required libraries.

Then follow the numbered sections **1 → 11** in order.

### Running the Web Demo

Serve the `Mizo-website/` folder from any static file server:

```bash
cd Mizo-website
python -m http.server 8000
# then open http://localhost:8000 in your browser
```

> ⚠️ The web demo **must be served over HTTP/HTTPS** — opening `index.html` directly as a `file://` URL will block webcam access and model loading due to browser security restrictions.

---

## How It Works

### 1. Keypoint Extraction

MediaPipe Holistic detects landmarks across the full body each frame. These are flattened into a single vector of **1,662 values**:

| Region | Landmarks | Values |
|---|---|---|
| Pose | 33 | 132 (x, y, z, visibility) |
| Face | 468 | 1404 (x, y, z) |
| Left Hand | 21 | 63 (x, y, z) |
| Right Hand | 21 | 63 (x, y, z) |
| **Total** | | **1,662** |

The web demo replicates this extraction in `js/model.js → extractKeypoints()`, mirroring the Python `extract_keypoints()` function exactly.

### 2. Data Collection

For each action in the `actions` array, the system records **150 sequences × 60 frames**. A HUD overlay guides recording with a countdown timer, dual progress bars (frames and sets), and a live recording indicator dot. Keypoints for each frame are saved as `.npy` files under `MP_Data/`.

### 3. Preprocessing

- Keypoints are normalised with `StandardScaler` (fit on training data only)
- The fitted scaler is saved to `scaler.pkl` — **required at inference time**
- For the web demo, the scaler is exported to `scaler.json` (mean & std arrays of 1662 values) and applied in `js/model.js → scalerTransform()`
- Labels are one-hot encoded with `to_categorical`

### 4. Training

The LSTM model trains for up to **2,000 epochs** with:
- **Early stopping** (`patience=75`) monitoring validation loss, restoring best weights
- **ReduceLROnPlateau** — reduces learning rate by a factor of 0.8 after 20 epochs of no improvement, down to a minimum of `1e-5`

### 5. Real-Time Inference

The live detection loop (identical in both notebook and web demo):

1. Captures a frame from the webcam
2. Extracts and scales keypoints using the saved scaler
3. Appends to a rolling **60-frame window**
4. Runs a prediction once the window is full
5. Displays confidence bars and the recognised action on screen

> Press **`x`** at any time to exit the live feed gracefully (notebook only).
>
> Press **`p`** at any time to pause the live feed (notebook only).

---

## Model Architecture

```
Input Shape: (60, 1662)
│
├── LSTM(64, return_sequences=True, activation='tanh', kernel_regularizer=L2)
├── LayerNormalization()
├── Dropout(0.4)
│
├── LSTM(64, return_sequences=False, activation='tanh', kernel_regularizer=L2)
├── LayerNormalization()
├── Dropout(0.4)
│
├── Dense(32, activation='relu', kernel_regularizer=L2)
├── LayerNormalization()
├── Dropout(0.4)
│
└── Dense(num_actions, activation='softmax')

Optimiser : AdamW (lr=0.0005, weight_decay=1e-4)
Loss      : Categorical Crossentropy
Metric    : Categorical Accuracy
```

---

## Usage

### Defining Actions

Edit the `actions` array in **Section 4** of the notebook to include any gestures or signs you want to recognise:

```python
actions = np.array(["hello", "thanks", "yes", "no"])  # customise freely
```

Update `ACTION_LABELS` in `js/config.js` to match when deploying to the web demo.

### Monitoring Training with TensorBoard

```bash
tensorboard --logdir=Logs
```
Then open `http://localhost:6006` in your browser.

### Saving & Loading the Model

```python
# Save (primary format)
model.save("Mizo.keras")
model.save("Mizo.h5")  # legacy

# Load full model
from tensorflow.keras.models import load_model
model = load_model("Mizo.keras")

# Load weights only (emergency recovery)
model.load_weights("Mizo.keras")
```

### Exporting to TFLite

```python
import tensorflow as tf

model = tf.keras.models.load_model("Mizo.keras")
converter = tf.lite.TFLiteConverter.from_keras_model(model)

# Required for LSTM support
converter.target_spec.supported_ops = [
    tf.lite.OpsSet.TFLITE_BUILTINS,
    tf.lite.OpsSet.SELECT_TF_OPS
]
converter._experimental_lower_tensor_list_ops = False
converter.optimizations = [tf.lite.Optimize.DEFAULT]

tflite_model = converter.convert()
with open("Mizo.tflite", "wb") as f:
    f.write(tflite_model)

print(f"TFLite model saved — {len(tflite_model) / 1024:.1f} KB")
```

### Exporting to TF.js

> ⚠️ `tensorflowjs` has known install issues on Windows due to a `uvloop` dependency. The recommended approach is to mock the broken modules so only the Keras converter is loaded — no CLI or extra installs needed.

```python
import sys
from unittest.mock import MagicMock
import tensorflow as tf

# Mock modules that break on Windows — not needed for Keras conversion
sys.modules['tensorflow_decision_forests'] = MagicMock()
sys.modules['uvloop'] = MagicMock()
sys.modules['tensorflow_hub'] = MagicMock()
sys.modules['jax'] = MagicMock()

from tensorflowjs.converters import keras_h5_conversion

model = tf.keras.models.load_model("Mizo.keras")
keras_h5_conversion.save_keras_model(model, "Mizo_tfjs/")

print("TF.js model saved to Mizo_tfjs/")
```

This produces `model.json` and one or more `.bin` weight shards. Copy these into `Mizo-website/Model/` to update the web demo. No precision is lost — weights are exported as `float32` by default.

> ⚠️ **Always load `scaler.pkl` / `scaler.json` alongside the model** — keypoints must be scaled before inference regardless of export format.

### Tuning the Confidence Threshold

```python
threshold = 0.65  # raise for stricter predictions, lower for more sensitivity
```

In the web demo, adjust `CONFIDENCE_THRESHOLD` in `js/config.js`.

---

## Evaluation

After training, evaluate the model with:

```python
from sklearn.metrics import multilabel_confusion_matrix, accuracy_score

yhat  = model.predict(X_test)
ytrue = np.argmax(y_test, axis=1).tolist()
yhat  = np.argmax(yhat,   axis=1).tolist()

multilabel_confusion_matrix(ytrue, yhat)  # per-class TP/FP/TN/FN breakdown
accuracy_score(ytrue, yhat)               # overall accuracy
```

---

## Roadmap

- ✅ Full-body keypoint extraction with MediaPipe Holistic
- ✅ Custom data collection pipeline with HUD overlay
- ✅ Stacked LSTM model with L2 regularisation and LayerNormalization
- ✅ TensorBoard logging + early stopping + learning rate scheduling
- ✅ Real-time inference with confidence visualisation
- ✅ Export model to TensorFlow Lite for mobile deployment
- ✅ Export model to TensorFlow.js for web deployment
- ✅ Browser-based web demo (no install required)
- ⬜ Add more ISL signs / expand vocabulary
- ⬜ GUI wrapper for non-technical users

Have an idea? [Open a feature request](../../issues)

---

## Contributing

Contributions are what make open source projects great. Any contribution you make is **greatly appreciated**.

1. **Fork** the repository
2. Create your feature branch: `git checkout -b feature/AmazingFeature`
3. Commit your changes: `git commit -m 'Add some AmazingFeature'`
4. Push to the branch: `git push origin feature/AmazingFeature`
5. **Open a Pull Request**

Please make sure your changes don't break existing notebook cells and include comments where relevant.

---

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

---

## Acknowledgements

- [MediaPipe by Google](https://mediapipe.dev/) — for the powerful holistic landmark detection (Python & browser)
- [TensorFlow / Keras](https://www.tensorflow.org/) — for the deep learning framework
- [TensorFlow.js](https://www.tensorflow.org/js) — for enabling in-browser inference with no server required
- [Nicholas Renotte](https://github.com/nicknochnack) — whose action detection tutorials inspired this project
- [OpenCV](https://opencv.org/) — for real-time computer vision tooling

---

<div align="center">

If you found this project useful, consider giving it a star⭐ — it helps a lot!

</div>
