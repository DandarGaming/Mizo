/* =====================================================
   MIZO — MAIN.JS
   Application entry point.
   All heavy lifting is in the other modules;
   this file just wires them together on page load.

   Load order in index.html:
     1. CDN: TF.js, MediaPipe Holistic
     2. js/config.js
     3. js/thermal.js
     4. js/model.js
     5. js/holistic.js
     6. js/ui.js
     7. js/camera.js
     8. js/submit.js
     9. js/main.js  ← this file
   ===================================================== */

let thermalMain = false;
let video = null;
let canvas = null;

function toggleMainThermal() {
  thermalMain = !thermalMain;
  console.log('[Thermal Main]', thermalMain);

  const btn = document.getElementById('thermalMainBtn');
  if (btn) {
    btn.textContent = thermalMain ? 'THERMAL: ON' : 'THERMAL: OFF';
    btn.dataset.active = String(thermalMain);
  }
}

async function initCamera() {
  video = document.getElementById('video');
  canvas = document.getElementById('output');

  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  });

  video.srcObject = stream;

  return new Promise(resolve => {
    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });
}

async function mainLoop() {
  if (video.readyState >= 2) {
    await processHolisticFrame(video);

    applyThermal(video, canvas, thermalMain);

    const results = getHolisticResults();

    if (results) {
      drawSkeleton(canvas, results);
      updateStatus(results);
    } else {
      setIdleStatus();
    }
  }

  requestAnimationFrame(mainLoop);
}

function updateStatus(results) {
  const el = document.getElementById('status');

  if (!el) return;

  const hasPose = !!results.poseLandmarks;
  const hasLH = !!results.leftHandLandmarks;
  const hasRH = !!results.rightHandLandmarks;

  el.textContent = `POSE:${hasPose} LH:${hasLH} RH:${hasRH}`;
}

function setIdleStatus() {
  const el = document.getElementById('status');
  if (el) el.textContent = 'IDLE';
}

async function startApp() {
  await initCamera();
  await initHolistic(); // 🔥 now async-safe
  mainLoop();
}

startApp();
