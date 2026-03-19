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

// Start the footer clock immediately and update every second
updateClock();
setInterval(updateClock, 1000);

// Animate the radar minimap
drawRadar();

// Load the TF.js model + scaler, then initialise MediaPipe Holistic.
// If either asset is missing the app falls back to demo-stub mode automatically.
loadMizo().then(() => initHolistic());
