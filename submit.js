/* =====================================================
   MIZO — SUBMIT.JS
   Sign submission panel: camera, 60-frame recorder,
   thermal toggle, in-memory queue, JSON export.

   Depends on: config.js, thermal.js, model.js, ui.js
   ===================================================== */

let submitStream       = null;
let submitHolistic     = null;
let submitLastResults  = null;
let submitCameraOn     = false;
let submitAnimId       = null;

let isRecording        = false;
let capturedSeq        = null;
let recordBuffer       = [];
const RECORD_TARGET    = 60;
let recordFramesDone   = 0;

let submissionQueue    = [];

// ── Panel open / close ────────────────────────────────

function openSubmitPanel() {
  document.getElementById('submitOverlay').classList.add('open');
  document.getElementById('submitPanel').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSubmitPanel(e) {
  if (e && e.target !== document.getElementById('submitOverlay')) return;
  document.getElementById('submitOverlay').classList.remove('open');
  document.getElementById('submitPanel').classList.remove('open');
  document.body.style.overflow = '';
  if (submitCameraOn) stopSubmitCamera();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSubmitPanel();
});

// ── Submit camera ─────────────────────────────────────

async function startSubmitCamera() {
  if (submitCameraOn) return;
  try {
    submitStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
    });

    const video = document.getElementById('submitVideo');
    video.srcObject     = submitStream;
    video.style.display = 'block';
    document.getElementById('submitCamIdle').style.display = 'none';
    submitCameraOn = true;

    if (window.Holistic && !submitHolistic) {
      submitHolistic = new Holistic({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`,
      });
      submitHolistic.setOptions({
        modelComplexity: 1, smoothLandmarks: true,
        minDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      submitHolistic.onResults(r => { submitLastResults = r; });
    }

    document.getElementById('submitCamStatus').textContent      = 'LIVE';
    document.getElementById('recBtn').disabled                  = false;
    document.getElementById('thermalSubmitBtn').disabled        = false;
    document.getElementById('submitHolisticStatus').textContent = 'HOLISTIC: ACTIVE';

    submitRenderLoop();
  } catch (e) {
    document.getElementById('submitCamStatus').textContent = 'ACCESS DENIED';
    console.error('[Mizo submit] Camera access denied:', e);
  }
}

function stopSubmitCamera() {
  submitCameraOn = false;
  if (submitAnimId) cancelAnimationFrame(submitAnimId);
  if (submitStream) { submitStream.getTracks().forEach(t => t.stop()); submitStream = null; }

  const video = document.getElementById('submitVideo');
  video.srcObject     = null;
  video.style.display = 'none';

  document.getElementById('submitCamIdle').style.display          = 'flex';
  document.getElementById('submitCamStatus').textContent          = 'STANDBY';
  document.getElementById('recBtn').disabled                      = true;
  document.getElementById('thermalSubmitBtn').disabled            = true;
  document.getElementById('submitHolisticStatus').textContent     = 'HOLISTIC: IDLE';

  isRecording = false;
  document.getElementById('recBtn').textContent = '● RECORD (60 FRAMES)';
  document.getElementById('recBtn').classList.remove('recording');
}

async function submitRenderLoop() {
  if (!submitCameraOn) return;

  const video  = document.getElementById('submitVideo');
  const canvas = document.getElementById('submitCanvas');

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;

    if (submitHolistic) await submitHolistic.send({ image: video });

    // Render — thermal or plain, driven by toggle flag
    applyThermal(video, canvas, thermalSubmit);

    if (submitLastResults) {
      const ctx = canvas.getContext('2d');
      drawSkeleton(ctx, submitLastResults, canvas.width, canvas.height);
    }

    const hasLeft  = !!(submitLastResults && submitLastResults.leftHandLandmarks);
    const hasRight = !!(submitLastResults && submitLastResults.rightHandLandmarks);
    const hasPose  = !!(submitLastResults && submitLastResults.poseLandmarks);
    const parts    = [hasPose ? 'POSE' : '', hasLeft ? 'LH' : '', hasRight ? 'RH' : ''].filter(Boolean);
    document.getElementById('submitHolisticStatus').textContent =
      'HOLISTIC: ' + (parts.length ? parts.join('+') : 'SCANNING');

    if (isRecording) {
      const kp       = extractKeypoints(submitLastResults || {});
      const kpScaled = scalerTransform(kp);
      recordBuffer.push(kpScaled);
      recordFramesDone = recordBuffer.length;

      const progress = recordFramesDone / RECORD_TARGET;
      const circ     = 283;
      document.getElementById('recRingBar').style.strokeDashoffset = circ - circ * progress;
      document.getElementById('submitFrameBadge').textContent      = recordFramesDone + '/' + RECORD_TARGET;
      document.getElementById('submitFrameInfo').textContent       =
        'FRAME ' + String(recordFramesDone).padStart(2, '0') + '/' + RECORD_TARGET;

      if (recordFramesDone >= RECORD_TARGET) finishRecording();
    }
  }

  submitAnimId = requestAnimationFrame(submitRenderLoop);
}

// ── Recording controls ────────────────────────────────

function toggleRecording() {
  if (!submitCameraOn) return;
  isRecording ? cancelRecording() : startRecording();
}

function startRecording() {
  recordBuffer     = [];
  recordFramesDone = 0;
  isRecording      = true;
  capturedSeq      = null;

  document.getElementById('recBtn').textContent = '■ CANCEL';
  document.getElementById('recBtn').classList.add('recording');
  document.getElementById('recRingWrap').classList.add('active');
  document.getElementById('recLabel').classList.add('active');
  document.getElementById('submitFrameBadge').classList.add('active');
  document.getElementById('recRingBar').style.strokeDashoffset = '283';
  document.getElementById('captureDot').classList.remove('has-data');
  document.getElementById('captureStatusText').textContent =
    'Recording…  0/' + RECORD_TARGET + ' frames';
  document.getElementById('prevBtn').disabled   = true;
  document.getElementById('submitBtn').disabled = true;
}

function cancelRecording() {
  isRecording  = false;
  recordBuffer = [];
  document.getElementById('recBtn').textContent = '● RECORD (60 FRAMES)';
  document.getElementById('recBtn').classList.remove('recording');
  document.getElementById('recRingWrap').classList.remove('active');
  document.getElementById('recLabel').classList.remove('active');
  document.getElementById('submitFrameBadge').classList.remove('active');
  document.getElementById('captureStatusText').textContent = 'Recording cancelled.';
}

function finishRecording() {
  isRecording = false;
  capturedSeq = { keypoints: recordBuffer.slice(0, RECORD_TARGET), frames: RECORD_TARGET };
  recordBuffer = [];

  document.getElementById('recBtn').textContent = '● RE-RECORD';
  document.getElementById('recBtn').classList.remove('recording');
  document.getElementById('recRingWrap').classList.remove('active');
  document.getElementById('recLabel').classList.remove('active');
  document.getElementById('submitFrameBadge').classList.remove('active');
  document.getElementById('captureDot').classList.add('has-data');
  document.getElementById('captureStatusText').textContent =
    '✓ Captured ' + capturedSeq.frames + ' frames  ·  ' +
    capturedSeq.keypoints[0].length + ' features/frame';
  document.getElementById('prevBtn').disabled   = false;
  document.getElementById('submitBtn').disabled = false;

  showToast('RECORDING COMPLETE — ' + capturedSeq.frames + ' FRAMES CAPTURED');

  // Auto-predict and pre-fill sign name
  predictCaptured(capturedSeq.keypoints).then(pred => {
    if (!pred) return;
    if (pred.confidence >= CONFIDENCE_THRESHOLD) {
      const nameInput = document.getElementById('signName');
      if (nameInput && !nameInput.value.trim()) nameInput.value = pred.label;
      showToast('PREDICTED: ' + pred.label + ' (' + Math.round(pred.confidence * 100) + '%) — verify before submitting');
    } else {
      showToast('LOW CONFIDENCE — PLEASE LABEL MANUALLY');
    }
  }).catch(err => console.warn('[Mizo submit] predictCaptured failed:', err));
}

// ── Preview ───────────────────────────────────────────

function previewCapture() {
  if (!capturedSeq) return;
  const canvas = document.getElementById('submitCanvas');
  canvas.style.outline = '2px solid var(--accent-red, #FF1A1A)';
  setTimeout(() => { canvas.style.outline = 'none'; }, 800);
  showToast('PREVIEW: ' + capturedSeq.frames + ' FRAMES · ' + capturedSeq.keypoints[0].length + ' FEATURES EACH');
}

// ── Submit ────────────────────────────────────────────

function submitSign() {
  if (!capturedSeq) return;
  const raw  = document.getElementById('signName').value.trim().toUpperCase();
  const name = raw.replace(/[^A-Z0-9 _\-]/g, '').slice(0, 40);
  if (!name) { showToast('⚠ ENTER A SIGN NAME FIRST'); document.getElementById('signName').focus(); return; }

  const submission = {
    id:         Date.now(),
    name,
    category:   document.getElementById('signCategory').value,
    hand:       document.getElementById('signHand').value,
    notes:      document.getElementById('signNotes').value.trim().replace(/<[^>]*>/g, '').slice(0, 200),
    frames:     capturedSeq.frames,
    featureDim: capturedSeq.keypoints[0].length,
    timestamp:  new Date().toISOString(),
    status:     'pending',
    keypoints:  capturedSeq.keypoints,
  };

  submissionQueue.push(submission);
  capturedSeq = null;

  document.getElementById('signName').value                = '';
  document.getElementById('signNotes').value               = '';
  document.getElementById('captureDot').classList.remove('has-data');
  document.getElementById('captureStatusText').textContent = 'Submitted! Record another sign.';
  document.getElementById('prevBtn').disabled              = true;
  document.getElementById('submitBtn').disabled            = true;
  document.getElementById('recBtn').textContent            = '● RECORD (60 FRAMES)';

  renderQueue();
  showToast('✓ SUBMITTED: ' + name);
}

// ── Queue ─────────────────────────────────────────────

function renderQueue() {
  const list  = document.getElementById('queueList');
  const count = document.getElementById('queueCount');
  count.textContent = submissionQueue.filter(s => s.status === 'pending').length + ' PENDING';

  if (submissionQueue.length === 0) {
    list.innerHTML = '';
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:11px;color:#C0C4D0;padding:8px 0;letter-spacing:1px;';
    empty.textContent   = 'No submissions yet. Record a sign above to get started.';
    list.appendChild(empty);
    return;
  }

  list.innerHTML = '';
  [...submissionQueue].reverse().forEach(sub => {
    const row     = document.createElement('div');
    row.className = 'queue-item';

    const infoDiv   = document.createElement('div');
    const nameDiv   = document.createElement('div');
    nameDiv.className   = 'qi-name';
    nameDiv.textContent = sub.name;
    infoDiv.appendChild(nameDiv);

    const catDiv    = document.createElement('div');
    catDiv.className   = 'qi-cat';
    catDiv.textContent = sub.category.toUpperCase() + ' · ' + sub.hand.toUpperCase();
    infoDiv.appendChild(catDiv);

    if (sub.notes) {
      const notesDiv = document.createElement('div');
      notesDiv.style.cssText = 'font-size:10px;color:#C0C4D0;margin-top:2px;font-style:italic;';
      notesDiv.textContent   = sub.notes.slice(0, 60) + (sub.notes.length > 60 ? '…' : '');
      infoDiv.appendChild(notesDiv);
    }

    const framesDiv = document.createElement('div');
    framesDiv.className   = 'qi-frames';
    framesDiv.textContent = sub.frames + 'f · ' + sub.featureDim + 'd';

    const statusDiv = document.createElement('div');
    statusDiv.className   = 'qi-status ' + sub.status;
    statusDiv.textContent = sub.status.toUpperCase();

    const actDiv    = document.createElement('div');
    actDiv.className = 'qi-actions';
    actDiv.innerHTML =
      `<button class="qi-btn dl" title="Download" onclick="downloadSingle(${sub.id})">↓</button>` +
      `<button class="qi-btn" title="Mark reviewed" onclick="markReviewed(${sub.id})">✓</button>` +
      `<button class="qi-btn" title="Delete" onclick="deleteSubmission(${sub.id})">✕</button>`;

    row.appendChild(infoDiv);
    row.appendChild(framesDiv);
    row.appendChild(statusDiv);
    row.appendChild(actDiv);
    list.appendChild(row);
  });
}

function markReviewed(id) {
  const sub = submissionQueue.find(s => s.id === id);
  if (sub) { sub.status = 'reviewed'; renderQueue(); showToast('MARKED REVIEWED: ' + sub.name); }
}

function deleteSubmission(id) {
  submissionQueue = submissionQueue.filter(s => s.id !== id);
  renderQueue();
}

// ── Export ────────────────────────────────────────────

function safeName(n) { return String(n).replace(/[^A-Z0-9_\-]/gi, '_').slice(0, 40); }

function sanitiseSub(sub) {
  return {
    id: sub.id, name: sub.name, category: sub.category, hand: sub.hand,
    notes: sub.notes, frames: sub.frames, featureDim: sub.featureDim,
    timestamp: sub.timestamp, status: sub.status, keypoints: sub.keypoints,
  };
}

function downloadSingle(id) {
  const sub = submissionQueue.find(s => s.id === id);
  if (!sub) return;
  const blob = new Blob([JSON.stringify(sanitiseSub(sub), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mizo_sign_${safeName(sub.name)}_${sub.id}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('DOWNLOADED: ' + sub.name);
}

function exportAllSubmissions() {
  if (submissionQueue.length === 0) { showToast('⚠ NO SUBMISSIONS TO EXPORT'); return; }
  const payload = { exported: new Date().toISOString(), count: submissionQueue.length, submissions: submissionQueue.map(sanitiseSub) };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mizo_submissions_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('EXPORTED ' + submissionQueue.length + ' SUBMISSIONS');
}

function clearQueue() {
  if (submissionQueue.length === 0) return;
  submissionQueue = [];
  renderQueue();
  showToast('QUEUE CLEARED');
}
