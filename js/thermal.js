/* =====================================================
   MIZO — THERMAL.JS
   Thermal colour-map rendering, Bayer ordered dither,
   and MediaPipe skeleton drawing.
   No external dependencies — pure canvas operations.
   ===================================================== */

// ── Thermal toggle flags ──────────────────────────────
// Toggled by buttons in index.html.
// Main demo and submit panel are controlled independently.
function applyThermal(srcVideo, destCanvas, enabled = true) {
  const ctx = destCanvas.getContext('2d');

  ctx.drawImage(srcVideo, 0, 0);

  // 🔥 OFF = completely raw video
  if (!enabled) return;

  const frame = ctx.getImageData(0, 0, destCanvas.width, destCanvas.height);
  const data = frame.data;

  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;

    data[i]     = avg * 2;       // R
    data[i + 1] = avg * 0.5;     // G
    data[i + 2] = 255 - avg;     // B
  }

  ctx.putImageData(frame, 0, 0);

  // optional scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  for (let y = 0; y < destCanvas.height; y += 4) {
    ctx.fillRect(0, y, destCanvas.width, 1);
  }
}
