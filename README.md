<div align="center">

# 🤖 Mizo
### Real-Time Action Recognition with LSTM & MediaPipe

*Classify gestures and body actions live through your webcam using deep learning.*

[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.x-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](https://www.tensorflow.org/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Holistic-0097A7?style=for-the-badge&logo=google&logoColor=white)](https://mediapipe.dev/)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.x-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)](https://opencv.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![Jupyter](https://img.shields.io/badge/Notebook-Jupyter-F37626?style=for-the-badge&logo=jupyter&logoColor=white)](https://jupyter.org/)

[Getting Started](#-getting-started) · [How It Works](#️-how-it-works) · [Report Bug](../../issues) · [Request Feature](../../issues)

</div>

---

## 📸 Demo

> 🎥 *Add a screen recording or GIF of Mizo running live here — e.g. record your webcam session with [OBS](https://obsproject.com/) and convert to GIF with [ezgif.com](https://ezgif.com/)*

```
[ demo.gif placeholder ]
```

---

## 📋 Table of Contents

- [About](#-about)
- [Features](#-features)
- [Tech Stack](#️-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [How It Works](#️-how-it-works)
- [Model Architecture](#-model-architecture)
- [Usage](#️-usage)
- [Evaluation](#-evaluation)
- [Roadmap](#️-roadmap)
- [Contributing](#-contributing)
- [License](#-license)
- [Acknowledgements](#-acknowledgements)

---

## 🧩 About

Mizo is a real-time gesture and action recognition model powered by **MediaPipe Holistic**, **TensorFlow LSTM**, and **OpenCV**. It extracts **1,662 body keypoints per frame** — covering pose, face, and both hands — sequences them over 60 frames, and feeds them through a stacked LSTM network to classify what action is being performed — all live through your webcam.

> ⚡ Built to be extended — add your own gestures or sign language vocabulary by simply updating the `actions` array and re-collecting data.

---

## ✨ Features

- 📷 **Live webcam feed** with styled, colour-coded landmark overlays
- 🦴 **Full-body keypoint extraction** — pose (132), face (1404), left hand (63), right hand (63)
- 🧠 **Stacked LSTM model** trained on custom action sequences
- 📊 **TensorBoard integration** for real-time training visualisation
- ⏱️ **Early stopping** with best-weight restoration to prevent overfitting
- 🔢 **On-screen confidence bars** per action with a tunable threshold
- 💾 **Model & scaler persistence** via `.h5` and `.pkl` files for reproducible inference

---

## 🛠️ Tech Stack

| Library | Version | Purpose |
|---|---|---|
| `TensorFlow / Keras` | 2.x | LSTM model building and training |
| `MediaPipe` | Latest | Holistic keypoint detection |
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
├── Mizo.h5                 # Saved model weights       ← generated after training
├── scaler.pkl              # Fitted StandardScaler     ← generated after training
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

## 🚀 Getting Started

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
jupyter notebook mizo.ipynb
```

> ⚠️ **Always run Cell 1 first** every time you open the notebook — it imports all required libraries.

Then follow the numbered sections **1 → 11** in order.

---

## ⚙️ How It Works

### 1. Keypoint Extraction
MediaPipe Holistic detects landmarks across the full body each frame. These are flattened into a single vector of **1,662 values**:

| Region | Landmarks | Values |
|---|---|---|
| Pose | 33 | 132 (x, y, z, visibility) |
| Face | 468 | 1404 (x, y, z) |
| Left Hand | 21 | 63 (x, y, z) |
| Right Hand | 21 | 63 (x, y, z) |
| **Total** | | **1,662** |

### 2. Data Collection
For each action in the `actions` array, the system records **60 sequences × 60 frames**. Keypoints for each frame are saved as `.npy` files under `MP_Data/`.

### 3. Preprocessing
- Keypoints are normalised with `StandardScaler` (fit on training data only)
- The fitted scaler is saved to `scaler.pkl` — **required at inference time**
- Labels are one-hot encoded with `to_categorical`

### 4. Training
The LSTM model trains for up to **2,000 epochs** with early stopping (`patience=50`) monitoring validation loss, automatically restoring the best weights.

### 5. Real-Time Inference
The live detection loop:
1. Captures a frame from the webcam
2. Extracts and scales keypoints using the saved scaler
3. Appends to a rolling **60-frame window**
4. Runs a prediction once the window is full
5. Displays confidence bars and the recognised action sentence on screen

> Press **`x`** at any time to exit the live feed gracefully.

---

## 🧠 Model Architecture

```
Input Shape: (60, 1662)
│
├── LSTM(64,  return_sequences=True,  activation='tanh')
├── Dropout(0.2)
├── LSTM(128, return_sequences=True,  activation='tanh')
├── Dropout(0.2)
├── LSTM(64,  return_sequences=False, activation='tanh')
├── Dense(64, activation='relu')
├── Dropout(0.5)
├── Dense(32, activation='relu')
└── Dense(num_actions, activation='softmax')

Optimiser : Adam
Loss      : Categorical Crossentropy
Metric    : Categorical Accuracy
```

---

## 🖥️ Usage

### Defining Actions
Edit the `actions` array in **Section 4** to include any gestures or signs you want to recognise:

```python
actions = np.array(["hello", "thanks", "yes", "no"])  # customise freely
```

### Monitoring Training with TensorBoard

```bash
tensorboard --logdir=Logs
```
Then open `http://localhost:6006` in your browser.

### Saving & Loading the Model

```python
# Save
model.save("Mizo.h5")

# Load full model
from tensorflow.keras.models import load_model
model = load_model("Mizo.h5")

# Load weights only (emergency recovery)
model.load_weights("Mizo.h5")
```

### Tuning the Confidence Threshold

```python
threshold = 0.5  # raise for stricter predictions, lower for more sensitivity
```

---

## 📈 Evaluation

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

## 🗺️ Roadmap

- [x] Full-body keypoint extraction with MediaPipe Holistic
- [x] Custom data collection pipeline
- [x] Stacked LSTM model with dropout regularisation
- [x] TensorBoard logging + early stopping
- [x] Real-time inference with confidence visualisation
- [ ] Add more default actions / sign language vocabulary
- [ ] Export model to TensorFlow Lite for mobile deployment
- [ ] GUI wrapper for non-technical users
- [ ] Web-based demo using TensorFlow.js

Have an idea? [Open a feature request](../../issues) 🙌

---

## 🤝 Contributing

Contributions are what make open source projects great. Any contribution you make is **greatly appreciated**.

1. **Fork** the repository
2. Create your feature branch: `git checkout -b feature/AmazingFeature`
3. Commit your changes: `git commit -m 'Add some AmazingFeature'`
4. Push to the branch: `git push origin feature/AmazingFeature`
5. **Open a Pull Request**

Please make sure your changes don't break existing notebook cells and include comments where relevant.

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

---

## 🙏 Acknowledgements

- [MediaPipe by Google](https://mediapipe.dev/) — for the powerful holistic landmark detection
- [TensorFlow / Keras](https://www.tensorflow.org/) — for the deep learning framework
- [Nicholas Renotte](https://github.com/nicknochnack) — whose action detection tutorials inspired this project
- [OpenCV](https://opencv.org/) — for real-time computer vision tooling

---

<div align="center">

If you found this project useful, consider giving it a ⭐ — it helps a lot!

</div>
