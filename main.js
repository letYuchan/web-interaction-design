const trackInfoMap = {
  1: {
    music: "/src/assets/sounds/cheerful.mp3",
    bg: "/src/assets/imgs/cheerful.png",
  },
  2: {
    music: "/src/assets/sounds/fearful.mp3",
    bg: "/src/assets/imgs/fearful.png",
  },
  3: {
    music: "/src/assets/sounds/relaxed.mp3",
    bg: "/src/assets/imgs/relaxed.png",
  },
  4: {
    music: "/src/assets/sounds/tenseful.mp3",
    bg: "/src/assets/imgs/tenseful.png",
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
