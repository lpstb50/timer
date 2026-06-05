const minutesInput = document.getElementById("minutesInput");
const minutesRange = document.getElementById("minutesRange");
const digitalVisible = document.getElementById("digitalVisible");
const startPauseBtn = document.getElementById("startPauseBtn");
const resetBtn = document.getElementById("resetBtn");
const timeText = document.getElementById("timeText");
const canvas = document.getElementById("clockCanvas");
const ctx = canvas.getContext("2d");

const MAX_MINUTES = 60;
const MAX_SECONDS = MAX_MINUTES * 60;

canvas.width = 460;
canvas.height = 460;

let selectedMinutes = 20;
let selectedDurationMs = selectedMinutes * 60_000;
let remainingMs = selectedDurationMs;
let running = false;
let runStartTime = 0;
let remainingAtRunStart = remainingMs;
let rafId = null;
let draggingHand = false;

function clampMinutes(value) {
  if (Number.isNaN(value)) return 1;
  return Math.max(1, Math.min(MAX_MINUTES, value));
}

function formatTime(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function unitToAngle(unit, maxUnit) {
  return (-Math.PI / 2) + (unit / maxUnit) * Math.PI * 2;
}

function drawDial() {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const outer = 198;

  ctx.clearRect(0, 0, w, h);

  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2);
  ctx.fillStyle = "#fffaf0";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#d3bfa0";
  ctx.stroke();

  for (let i = 0; i < 60; i += 1) {
    const a = unitToAngle(i, 60);
    const longTick = i % 5 === 0;
    const inner = longTick ? outer - 18 : outer - 10;
    const ox = cx + Math.cos(a) * outer;
    const oy = cy + Math.sin(a) * outer;
    const ix = cx + Math.cos(a) * inner;
    const iy = cy + Math.sin(a) * inner;

    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(ox, oy);
    ctx.lineWidth = longTick ? 3 : 1.2;
    ctx.strokeStyle = longTick ? "#8f7758" : "#bba588";
    ctx.stroke();
  }

  ctx.fillStyle = "#6e5a42";
  ctx.font = "700 24px Avenir Next, Hiragino Kaku Gothic ProN, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < 60; i += 5) {
    const angle = unitToAngle(i, 60);
    const tx = cx + Math.cos(angle) * (outer - 42);
    const ty = cy + Math.sin(angle) * (outer - 42);
    const labelValue = (60 - i) % 60;
    const label = String(labelValue);
    ctx.fillText(label, tx, ty);
  }
}

function drawRemainingArc(remainingSecondsFloat) {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const radius = 160;

  if (remainingSecondsFloat <= 0) return;

  ctx.beginPath();

  if (remainingSecondsFloat >= MAX_SECONDS) {
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  } else {
    const startSecond = MAX_SECONDS - remainingSecondsFloat;
    const start = unitToAngle(startSecond, MAX_SECONDS);
    const end = unitToAngle(MAX_SECONDS, MAX_SECONDS);
    ctx.arc(cx, cy, radius, start, end, false);
  }

  ctx.lineWidth = 30;
  ctx.strokeStyle = "rgba(207, 47, 31, 0.72)";
  ctx.lineCap = "butt";
  ctx.stroke();
}

function drawHand(remainingSecondsFloat) {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  const secondPos = MAX_SECONDS - remainingSecondsFloat;
  const angle = unitToAngle(secondPos, MAX_SECONDS);
  const handLength = 148;

  const hx = cx + Math.cos(angle) * handLength;
  const hy = cy + Math.sin(angle) * handLength;

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(hx, hy);
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#2f2a24";
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#2f2a24";
  ctx.fill();
}

function render() {
  const remainingSecondsFloat = remainingMs / 1000;
  drawDial();
  drawRemainingArc(remainingSecondsFloat);
  drawHand(Math.max(0, remainingSecondsFloat));
  timeText.textContent = formatTime(remainingMs);
}

function stopRunning() {
  running = false;
  startPauseBtn.textContent = "開始";
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function syncInputsFromDuration(durationMs) {
  const minutesApprox = clampMinutes(Math.max(1, Math.round(durationMs / 60_000)));
  selectedMinutes = minutesApprox;
  minutesInput.value = String(minutesApprox);
  minutesRange.value = String(minutesApprox);
}

function updateFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  const angle = Math.atan2(y - cy, x - cx);
  let elapsedSeconds = ((angle + Math.PI / 2) / (Math.PI * 2)) * MAX_SECONDS;
  elapsedSeconds = ((elapsedSeconds % MAX_SECONDS) + MAX_SECONDS) % MAX_SECONDS;

  const nextRemainingMs = (MAX_SECONDS - elapsedSeconds) * 1000;
  remainingMs = Math.max(0, Math.min(MAX_SECONDS * 1000, nextRemainingMs));
  selectedDurationMs = remainingMs;
  syncInputsFromDuration(selectedDurationMs);
  render();
}

function endDragging(pointerId) {
  draggingHand = false;
  canvas.classList.remove("dragging");
  if (pointerId !== undefined && canvas.hasPointerCapture(pointerId)) {
    canvas.releasePointerCapture(pointerId);
  }
}

function loop(now) {
  if (!running) return;

  const elapsed = now - runStartTime;
  remainingMs = Math.max(0, remainingAtRunStart - elapsed);

  if (remainingMs <= 0) {
    render();
    stopRunning();
    return;
  }

  render();
  rafId = requestAnimationFrame(loop);
}

function startTimer() {
  if (remainingMs <= 0) {
    remainingMs = selectedDurationMs;
  }

  running = true;
  runStartTime = performance.now();
  remainingAtRunStart = remainingMs;
  startPauseBtn.textContent = "一時停止";
  rafId = requestAnimationFrame(loop);
}

function pauseTimer() {
  if (!running) return;
  const now = performance.now();
  const elapsed = now - runStartTime;
  remainingMs = Math.max(0, remainingAtRunStart - elapsed);
  stopRunning();
  render();
}

function resetTimer() {
  stopRunning();
  remainingMs = selectedDurationMs;
  render();
}

function syncInputValue(value) {
  const clamped = clampMinutes(Number(value));
  selectedMinutes = clamped;
  minutesInput.value = String(clamped);
  minutesRange.value = String(clamped);
  selectedDurationMs = selectedMinutes * 60_000;

  if (!running) {
    remainingMs = selectedDurationMs;
    render();
  }
}

minutesInput.addEventListener("change", (event) => {
  syncInputValue(event.target.value);
});

minutesRange.addEventListener("input", (event) => {
  syncInputValue(event.target.value);
});

startPauseBtn.addEventListener("click", () => {
  if (running) {
    pauseTimer();
  } else {
    startTimer();
  }
});

resetBtn.addEventListener("click", () => {
  resetTimer();
});

canvas.addEventListener("pointerdown", (event) => {
  stopRunning();
  draggingHand = true;
  canvas.classList.add("dragging");
  canvas.setPointerCapture(event.pointerId);
  updateFromPointer(event);
});

canvas.addEventListener("pointermove", (event) => {
  if (!draggingHand) return;
  updateFromPointer(event);
});

canvas.addEventListener("pointerup", (event) => {
  endDragging(event.pointerId);
});

canvas.addEventListener("pointercancel", (event) => {
  endDragging(event.pointerId);
});

digitalVisible.addEventListener("change", (event) => {
  timeText.classList.toggle("hidden", !event.target.checked);
});

render();
