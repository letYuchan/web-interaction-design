const trackInfoMap = {
  1: {
    music: "./src/assets/sounds/cheerful.mp3",
    bg: "./src/assets/imgs/cheerful.png",
  },
  2: {
    music: "./src/assets/sounds/fearful.mp3",
    bg: "./src/assets/imgs/fearful.png",
  },
  3: {
    music: "./src/assets/sounds/relaxed.mp3",
    bg: "./src/assets/imgs/relaxed.png",
  },
  4: {
    music: "./src/assets/sounds/tenseful.mp3",
    bg: "./src/assets/imgs/tenseful.png",
  },
};

const main = document.querySelector("main");
const btnList = [
  document.getElementById("playButton1"),
  document.getElementById("playButton2"),
  document.getElementById("playButton3"),
  document.getElementById("playButton4"),
];

const bgMusic = new Audio();
bgMusic.loop = true;
let current = 1;

const resetBtnStyles = () => {
  btnList.forEach((btn) => {
    btn.classList.remove(
      "border-emerald-400",
      "ring-2",
      "ring-emerald-400",
      "shadow-lg",
      "opacity-100"
    );
    btn.classList.add("border-2", "border-transparent", "opacity-70");
  });
};

const activateBtn = (n) => {
  resetBtnStyles();
  const selectedBtn = btnList[n - 1];
  selectedBtn.classList.remove("border-transparent", "opacity-70");
  selectedBtn.classList.add(
    "border-emerald-400",
    "ring-2",
    "ring-emerald-400",
    "shadow-lg",
    "opacity-100"
  );
};

const playTrack = async (n) => {
  current = n;
  main.style.backgroundImage = `url('${trackInfoMap[n].bg}')`;

  try {
    bgMusic.pause();
  } catch {}
  bgMusic.currentTime = 0;
  bgMusic.src = trackInfoMap[n].music;

  activateBtn(n);

  try {
    await bgMusic.play();
  } catch (e) {
    console.log("재생 실패:", e);
  }
};

// 초기 UI 세팅
(function init() {
  main.style.backgroundImage = `url('${trackInfoMap[current].bg}')`;
  activateBtn(current);
  bgMusic.src = trackInfoMap[current].music;
})();

// 버튼 클릭 → 해당 트랙 재생
btnList.forEach((btn, idx) => {
  btn.addEventListener("click", () => {
    playTrack(idx + 1);
  });
});

// 키보드 이벤트
document.addEventListener("keydown", async (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (bgMusic.paused) {
      try {
        await bgMusic.play();
      } catch {}
    } else {
      bgMusic.pause();
    }
  }
  if (["Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code)) {
    const n = Number(e.code.replace("Digit", ""));
    playTrack(n);
  }
});

// 마우스 속도 → 재생속도
let lastX = null,
  lastY = null,
  lastT = 0;
let idleTimer = null;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;

document.addEventListener("mousemove", (e) => {
  const now = performance.now();
  if (lastX === null) {
    lastX = e.clientX;
    lastY = e.clientY;
    lastT = now;
    return;
  }
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  const dt = (now - lastT) / 1000;
  lastX = e.clientX;
  lastY = e.clientY;
  lastT = now;

  if (dt <= 0) return;
  const dist = Math.hypot(dx, dy);
  const speed = dist / dt;
  const target = clamp(1.0 + (speed / 800) * 1.0, 0.75, 2.0);
  const mixed = lerp(bgMusic.playbackRate || 1.0, target, 0.25);
  bgMusic.playbackRate = mixed;

  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const back = () => {
      if (Math.abs(bgMusic.playbackRate - 1.0) < 0.02) {
        bgMusic.playbackRate = 1.0;
        return;
      }
      bgMusic.playbackRate = lerp(bgMusic.playbackRate, 1.0, 0.2);
      requestAnimationFrame(back);
    };
    back();
  }, 250);
});

/***********************
 * MUSIC-RUNNER GAME JS (Refactored)
 * - A키 점프(더블점프)
 * - Space 일시정지/재개
 * - 트랙별 네온 장애물 색
 * - 테마별 아이템(이모지) → 무적모드 (2.5s)
 * - 비트 감지 → 스크린 쉐이크/가속
 * - 장애물 충돌 시 곡 재시작
 * - 전역(main, bgMusic, current, <canvas id="game"> 존재)
 ************************/

// === 캔버스 & 기본 상태 ===
const gameCanvas = document.getElementById("game");
const ctx = gameCanvas.getContext("2d");

const resizeCanvasToMain = () => {
  gameCanvas.width = main.clientWidth;
  gameCanvas.height = main.clientHeight;
};
window.addEventListener("resize", resizeCanvasToMain);
resizeCanvasToMain();

let canvasWidth = gameCanvas.width;
let canvasHeight = gameCanvas.height;

// 플레이어 상태
let playerState = {
  x: 140,
  y: 0,
  w: 26,
  h: 26,
  vy: 0,
  onGround: false,
  rot: 0,
  rotVel: 0,
};
const GRAVITY = 0.85;
let jumpCount = 0;
const MAX_JUMPS = 2;

// 장애물 및 아이템
let obstacleList = [];
let itemList = [];
let obstacleSpawnTimer = 0;
let itemSpawnTimer = 120;

// 게임 속성
let baseMoveSpeed = 4.2;
let speedBoost = 0;
let score = 0;
let screenShakeStrength = 0;
let paused = false;

// 무적
let invincibleUntil = 0;
const isInvincible = () => performance.now() < invincibleUntil;

// 트랙별 스타일
const OBSTACLE_COLORS = {
  1: "#39ff14",
  2: "#ff4757",
  3: "#00e5ff",
  4: "#ffe600",
};
const ITEM_EMOJIS = {
  1: "🎈",
  2: "👻",
  3: "💧",
  4: "🗡️",
};
const getObstacleColor = () => OBSTACLE_COLORS[current] || "#ffffff";
const getItemEmoji = () => ITEM_EMOJIS[current] || "⭐";

// 오디오 분석
let audioCtx,
  analyser,
  srcNode,
  vizReady = false;
const FFT_SIZE = 256;
const freqBuffer = new Uint8Array(FFT_SIZE / 2);
let avgEnergy = 0;
const SMOOTHING = 0.9;

const initAudioAnalyser = () => {
  if (vizReady) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    srcNode = audioCtx.createMediaElementSource(bgMusic);
    srcNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    vizReady = true;
  } catch (e) {
    console.log("Analyser init failed:", e);
  }
};

["click", "keydown", "touchstart"].forEach((evt) => {
  document.addEventListener(
    evt,
    () => {
      initAudioAnalyser();
      if (audioCtx?.state === "suspended") audioCtx.resume();
    },
    { passive: true }
  );
});

const detectBeatAndReact = () => {
  if (!vizReady) return false;
  analyser.getByteFrequencyData(freqBuffer);

  let low = 0;
  const bins = 10;
  for (let i = 0; i < bins; i++) low += freqBuffer[i];
  low /= bins;

  avgEnergy = avgEnergy * SMOOTHING + low * (1 - SMOOTHING);
  const isBeat = low > avgEnergy * 1.25 && low > 40;

  if (isBeat) {
    screenShakeStrength = Math.min(screenShakeStrength + 4, 14);
    speedBoost = Math.min(speedBoost + 1.2, 3.2);
  }
  return isBeat;
};

// 점프
const handleJump = () => {
  if (jumpCount >= MAX_JUMPS) return;
  playerState.vy = -14;
  playerState.onGround = false;
  playerState.rotVel = 0.35;
  jumpCount++;

  const j = new Audio("./src/assets/sounds/jump.mp3");
  j.volume = 0.5;
  j.play().catch(() => {});
};

document.addEventListener("keydown", (e) => {
  if (e.code === "KeyA") handleJump();
  if (e.code === "Space") paused = !paused;
});

// 스폰 관련
const spawnObstacle = () => {
  const h = 24 + Math.random() * 36;
  const w = 20 + Math.random() * 28;
  const y = canvasHeight - 60 - h;
  obstacleList.push({
    x: canvasWidth + 20,
    y,
    w,
    h,
    color: getObstacleColor(),
  });
};

const spawnItem = () => {
  const size = 20 + Math.random() * 10;
  const y = canvasHeight - 60 - (40 + Math.random() * 120);
  itemList.push({
    x: canvasWidth + 20,
    y,
    size,
    emoji: getItemEmoji(),
    vy: Math.random() * 0.4 - 0.2,
  });
};

// === 충돌 ===
const isHit = (a, b) =>
  !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);

// === 게임 리셋 ===
const resetGameState = () => {
  obstacleList = [];
  itemList = [];
  playerState = {
    x: 140,
    y: canvasHeight - 60 - 26,
    w: 26,
    h: 26,
    vy: 0,
    onGround: true,
    rot: 0,
    rotVel: 0,
  };
  jumpCount = 0;
  score = 0;
  speedBoost = 0;
  screenShakeStrength = 8;
  invincibleUntil = 0;
};

// 메인 루프
const gameLoop = () => {
  requestAnimationFrame(gameLoop);
  canvasWidth = gameCanvas.width;
  canvasHeight = gameCanvas.height;

  if (paused) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = "white";
    ctx.font = "32px system-ui, sans-serif";
    const msg = "PAUSED (Press Space)";
    const tw = ctx.measureText(msg).width;
    ctx.fillText(msg, (canvasWidth - tw) / 2, canvasHeight / 2 - 16);
    return;
  }

  detectBeatAndReact();
  speedBoost *= 0.92;
  screenShakeStrength *= 0.9;

  const ox = (Math.random() * 2 - 1) * screenShakeStrength;
  const oy = (Math.random() * 2 - 1) * screenShakeStrength;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = "rgba(255,255,255,.6)";
  ctx.fillRect(0, canvasHeight - 58, canvasWidth, 2);

  obstacleSpawnTimer--;
  itemSpawnTimer--;
  if (obstacleSpawnTimer <= 0) {
    spawnObstacle();
    obstacleSpawnTimer = 70 + Math.random() * 50;
  }
  if (itemSpawnTimer <= 0) {
    spawnItem();
    itemSpawnTimer = 260 + Math.random() * 240;
  }

  const moveSpeed = baseMoveSpeed + speedBoost;

  // 장애물
  obstacleList.forEach((o) => {
    o.x -= moveSpeed;
  });
  obstacleList = obstacleList.filter((o) => o.x + o.w > -40);
  ctx.save();
  ctx.shadowBlur = 20;
  obstacleList.forEach((o) => {
    ctx.shadowColor = o.color;
    ctx.fillStyle = o.color;
    ctx.fillRect(o.x, o.y, o.w, o.h);
  });
  ctx.restore();

  // 아이템
  itemList.forEach((it) => {
    it.x -= moveSpeed * 0.95;
    it.y += it.vy;
  });
  itemList = itemList.filter((it) => it.x + it.size > -40);
  ctx.font =
    "48px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, system-ui, sans-serif";
  ctx.textBaseline = "top";
  itemList.forEach((it) => ctx.fillText(it.emoji, it.x, it.y));

  // 플레이어 물리
  playerState.vy += GRAVITY;
  playerState.y += playerState.vy;
  const floorY = canvasHeight - 60 - playerState.h;
  if (playerState.y >= floorY) {
    playerState.y = floorY;
    playerState.vy = 0;
    if (!playerState.onGround) {
      playerState.rotVel = 0;
      playerState.rot *= 0.8;
      if (Math.abs(playerState.rot) < 0.02) playerState.rot = 0;
    }
    playerState.onGround = true;
    jumpCount = 0;
  } else {
    playerState.onGround = false;
    playerState.rot += playerState.rotVel;
    playerState.rotVel *= 0.985;
  }

  // 플레이어 그리기
  const blink = Math.max(0, Math.min(1, screenShakeStrength / 10));
  ctx.save();
  ctx.translate(
    playerState.x + playerState.w / 2,
    playerState.y + playerState.h / 2
  );
  ctx.rotate(playerState.rot);
  if (isInvincible()) {
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#7cfffb";
    ctx.fillStyle = "rgba(124,255,251,0.95)";
  } else {
    ctx.fillStyle = `rgba(255,255,255,${0.85 - 0.25 * blink})`;
  }
  ctx.fillRect(
    -playerState.w / 2,
    -playerState.h / 2,
    playerState.w,
    playerState.h
  );
  ctx.restore();

  // 아이템 충돌
  itemList = itemList.filter((it) => {
    const box = { x: it.x, y: it.y, w: 22, h: 22 };
    if (isHit(playerState, box)) {
      invincibleUntil = performance.now() + 2500;
      const s = new Audio("./src/assets/sounds/pick.mp3");
      s.volume = 0.6;
      s.play().catch(() => {});
      return false;
    }
    return true;
  });

  // 장애물 충돌
  if (!isInvincible()) {
    for (const o of obstacleList) {
      if (isHit(playerState, o)) {
        try {
          bgMusic.currentTime = 0;
          bgMusic.play();
        } catch {}
        resetGameState();
        break;
      }
    }
  }

  // UI
  ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.fillText(`SCORE ${score.toFixed(0)}`, 16, 28);
  score += 0.02 * (1 + speedBoost);

  if (isInvincible()) {
    const ms = Math.max(0, invincibleUntil - performance.now());
    ctx.fillText(`INVINCIBLE ${Math.ceil(ms / 1000)}s`, 16, 48);
  }

  ctx.restore();
};

// 초기화 및 실행
resetGameState();
gameLoop();
