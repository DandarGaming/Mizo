/* =====================================================
   MIZO — THERMAL.JS
   Thermal colour-map rendering, Bayer ordered dither,
   and MediaPipe skeleton drawing.
   No external dependencies — pure canvas operations.
   ===================================================== */

// ── Thermal toggle flags ──────────────────────────────
// Toggled by buttons in index.html.
// Main demo and submit panel are controlled independently.
var thermalMain   = false;
var thermalSubmit = false;

// Full-spectrum thermal colour stops
const THERMAL_STOPS = [
  [0,    [0,   0,   0  ]],
  [0.13, [0,   0,   128]],
  [0.28, [0,   0,   255]],
  [0.42, [0,   255, 255]],
  [0.57, [0,   255, 0  ]],
  [0.71, [255, 255, 0  ]],
  [0.85, [255, 128, 0  ]],
  [0.93, [255, 0,   0  ]],
  [1.0,  [255, 255, 255]],
];

function thermalColor(luminance) {
  let lo = THERMAL_STOPS[0];
  let hi = THERMAL_STOPS[THERMAL_STOPS.length - 1];
  for (let i = 0; i < THERMAL_STOPS.length - 1; i++) {
    if (luminance >= THERMAL_STOPS[i][0] && luminance <= THERMAL_STOPS[i + 1][0]) {
      lo = THERMAL_STOPS[i];
      hi = THERMAL_STOPS[i + 1];
      break;
    }
  }
  const t = (luminance - lo[0]) / (hi[0] - lo[0] + 0.0001);
  return [
    Math.round(lo[1][0] + t * (hi[1][0] - lo[1][0])),
    Math.round(lo[1][1] + t * (hi[1][1] - lo[1][1])),
    Math.round(lo[1][2] + t * (hi[1][2] - lo[1][2])),
  ];
}

const BAYER8 = [
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
].map(v => v / 64 - 0.5);

/**
 * Render a video frame onto destCanvas.
 * enabled=true  → Bayer-dithered thermal colour-map + HUD overlays.
 * enabled=false → plain colour video + scanlines only.
 */
function applyThermal(srcVideo, destCanvas, enabled = true) {
  destCanvas.width  = srcVideo.videoWidth  || destCanvas.width;
  destCanvas.height = srcVideo.videoHeight || destCanvas.height;

  const ctx = destCanvas.getContext('2d');
  ctx.drawImage(srcVideo, 0, 0);

  if (enabled) {
    const imgData = ctx.getImageData(0, 0, destCanvas.width, destCanvas.height);
    const d = imgData.data;
    const W = destCanvas.width;

    for (let i = 0; i < d.length; i += 4) {
      const px = (i / 4) % W;
      const py = Math.floor(i / 4 / W);
      const lum         = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
      const threshold   = BAYER8[(py % 8) * 8 + (px % 8)] * 0.18;
      const ditheredLum = Math.min(1, Math.max(0, lum + threshold));
      const quantised   = Math.round(ditheredLum * 7) / 7;
      const [r, g, b]   = thermalColor(quantised);
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    ctx.putImageData(imgData, 0, 0);

    ctx.strokeStyle = 'rgba(26,63,255,0.08)';
    ctx.lineWidth   = 1;
    const step = 40;
    for (let x = 0; x < destCanvas.width; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, destCanvas.height); ctx.stroke();
    }
    for (let y = 0; y < destCanvas.height; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(destCanvas.width, y); ctx.stroke();
    }

    const cx = destCanvas.width / 2, cy = destCanvas.height / 2;
    ctx.strokeStyle = 'rgba(26,63,255,0.4)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(cx - 40, cy - 40, 80, 80);
  }

  // Scanlines always
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  for (let y = 0; y < destCanvas.height; y += 4) {
    ctx.fillRect(0, y, destCanvas.width, 2);
  }
}

// ── Toggle helpers ────────────────────────────────────

function toggleMainThermal() {
  thermalMain = !thermalMain;
  const btn = document.getElementById('thermalMainBtn');
  if (btn) {
    btn.textContent = thermalMain ? 'THERMAL: ON' : 'THERMAL: OFF';
    btn.setAttribute('data-active', String(thermalMain));
  }
}

function toggleSubmitThermal() {
  thermalSubmit = !thermalSubmit;
  const btn = document.getElementById('thermalSubmitBtn');
  if (btn) {
    btn.textContent = thermalSubmit ? 'THERMAL: ON' : 'THERMAL: OFF';
    btn.setAttribute('data-active', String(thermalSubmit));
  }
}

// ── Skeleton overlay ──────────────────────────────────

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

const POSE_CONNECTIONS = [
  [11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],
];

function drawSkeleton(ctx, results, w, h) {
  if (!results) return;

  function drawLandmarks(landmarks, connections, color) {
    if (!landmarks) return;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    connections.forEach(([a, b]) => {
      if (!landmarks[a] || !landmarks[b]) return;
      ctx.beginPath();
      ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
      ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
      ctx.stroke();
    });
    ctx.fillStyle = color;
    landmarks.forEach(l => {
      ctx.beginPath();
      ctx.arc(l.x * w, l.y * h, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawLandmarks(results.leftHandLandmarks,  HAND_CONNECTIONS, 'rgba(26,63,255,0.75)');
  drawLandmarks(results.rightHandLandmarks, HAND_CONNECTIONS, 'rgba(255,26,26,0.85)');

  if (results.poseLandmarks) {
    ctx.strokeStyle = 'rgba(255,100,0,0.4)';
    ctx.lineWidth   = 1;
    POSE_CONNECTIONS.forEach(([a, b]) => {
      const la = results.poseLandmarks[a];
      const lb = results.poseLandmarks[b];
      if (!la || !lb) return;
      ctx.beginPath();
      ctx.moveTo(la.x * w, la.y * h);
      ctx.lineTo(lb.x * w, lb.y * h);
      ctx.stroke();
    });
  }
}
