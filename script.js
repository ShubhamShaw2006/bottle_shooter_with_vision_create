const canvas = document.getElementById("output");
const ctx = canvas.getContext("2d");

let bottles = [];
let shots = [];
let score = 0;
let missed = 0;
let gestureFired = false;

let latestResults = null;
let gameOver = false;
let gameDuration = 60; // 1 minute
let timeLeft = gameDuration;
let timerInterval;

// High scores
let highScores = JSON.parse(localStorage.getItem("highScores")) || [];

// Spawn a single bottle
function spawnBottle() {
  bottles.push({
    x: Math.random() * 0.8 + 0.1,
    y: 0.2,
    r: 0.05,
    hit: false,
  });
}

// Restart
function restartGame() {
  score = 0;
  missed = 0;
  bottles = [];
  shots = [];
  gestureFired = false;
  gameOver = false;
  timeLeft = gameDuration;

  document.getElementById("game-over").classList.add("hidden");

  for (let i = 0; i < 3; i++) spawnBottle();

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
    } else {
      endGame();
    }
  }, 1000);
}

// End game
function endGame() {
  gameOver = true;
  clearInterval(timerInterval);

  // Save score
  highScores.push(score);
  highScores.sort((a, b) => b - a);
  highScores = highScores.slice(0, 3);
  localStorage.setItem("highScores", JSON.stringify(highScores));

  // Update scoreboard
  document.getElementById("final-score").textContent = score;

  const list = document.getElementById("high-scores");
  list.innerHTML = "";
  highScores.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    list.appendChild(li);
  });

  document.getElementById("current-score").textContent = score;
  document.getElementById("game-over").classList.remove("hidden");
}

// Fire shot
function fireShot(x, y) {
  shots.push({ x, y, vy: -0.04, r: 0.012, hit: false });
}

// Manual fire (keyboard + mouse fallback)
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !gameOver) {
    fireShot(0.5, 0.85);
  }
});
canvas.addEventListener("click", (e) => {
  if (gameOver) return;
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) / rect.width;
  const cy = (e.clientY - rect.top) / rect.height;
  fireShot(cx, cy);
});

// Gesture detection: ONLY index finger open
function isIndexOnly(landmarks) {
  if (!landmarks) return false;

  const iTip = landmarks[8], iPIP = landmarks[6];
  const mTip = landmarks[12], mPIP = landmarks[10];
  const rTip = landmarks[16], rPIP = landmarks[14];
  const pTip = landmarks[20], pPIP = landmarks[18];

  const indexStraight = iTip.y < iPIP.y - 0.01;
  const middleFolded = mTip.y > mPIP.y + 0.01;
  const ringFolded = rTip.y > rPIP.y + 0.01;
  const pinkyFolded = pTip.y > pPIP.y + 0.01;

  return indexStraight && middleFolded && ringFolded && pinkyFolded;
}

// Mediapipe setup
const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});
hands.onResults((results) => {
  latestResults = results;
});

const videoElement = document.createElement("video");
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480,
});
camera.start();

// Render loop
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const { width, height } = canvas;

  if (gameOver) {
    requestAnimationFrame(render);
    return;
  }

  // Draw bottles
  bottles.forEach((bottle) => {
    if (!bottle.hit) {
      ctx.fillStyle = "green";
      ctx.fillRect(bottle.x * width - 15, bottle.y * height - 40, 30, 40);
      ctx.fillStyle = "brown";
      ctx.fillRect(bottle.x * width - 12, bottle.y * height, 24, 10);
    }
  });

  // Draw + update shots
  let newShots = [];
  shots.forEach((shot) => {
    shot.y += shot.vy;

    // Draw shot
    ctx.beginPath();
    ctx.arc(shot.x * width, shot.y * height, shot.r * width, 0, Math.PI * 2);
    ctx.fillStyle = "red";
    ctx.fill();

    // If shot goes off-screen without hitting, count as miss
    if (shot.y <= 0) {
      if (!shot.hit) {
        missed++;
        if (missed >= 3) {
          endGame();
        }
      }
    } else {
      newShots.push(shot); // keep active shot
    }
  });
  shots = newShots;

  // Collision detection
  bottles.forEach((bottle) => {
    if (bottle.hit) return;
    shots.forEach((shot) => {
      if (shot.hit) return;
      const dx = shot.x - bottle.x;
      const dy = shot.y - bottle.y;
      if (Math.sqrt(dx * dx + dy * dy) < shot.r + bottle.r) {
        bottle.hit = true;
        shot.hit = true;
        score += 10;
      }
    });
  });

  // Remove hit bottles
  bottles = bottles.filter((b) => !b.hit);

  // Draw score + timer + misses
  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.fillText(`Score: ${score}`, 10, 25);
  ctx.fillText(`Time: ${timeLeft}s`, width - 120, 25);
  ctx.fillText(`Misses: ${missed}/3`, 10, 50);

  // Hand landmarks + fire detection
  if (latestResults && latestResults.multiHandLandmarks.length > 0) {
    const landmarks = latestResults.multiHandLandmarks[0];
    drawConnectors(ctx, landmarks, HAND_CONNECTIONS,
      { color: "#00FF00", lineWidth: 2 });
    drawLandmarks(ctx, landmarks, { color: "#FFFFFF", lineWidth: 1 });

    if (isIndexOnly(landmarks) && !gestureFired) {
      fireShot(landmarks[8].x, landmarks[8].y);
      gestureFired = true;
    } else if (!isIndexOnly(landmarks)) {
      gestureFired = false;
    }
  } else {
    gestureFired = false;
  }

  requestAnimationFrame(render);
}

// Spawn bottles every 2s
restartGame();
setInterval(() => {
  if (!gameOver) spawnBottle();
}, 2000);

render();
