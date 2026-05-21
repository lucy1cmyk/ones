/* =========================================================
  [UI JS]
  - DOM 렌더링, 입력 처리, 버튼 처리 담당
  - game.js의 GameState / GameConfig / 게임 함수들을 사용
  - 게임 규칙 자체는 이 파일에서 최소화
========================================================= */

/* =========================================================
  [UI 01] DOM 참조
========================================================= */
const UI = {
  gameScreen: document.getElementById("gameScreen"),
  playArea: document.getElementById("playArea"),
  boardWrap: document.getElementById("boardWrap"),
  boardGrid: document.getElementById("boardGrid"),
  blockLayer: document.getElementById("blockLayer"),
  previewLayer: document.getElementById("previewLayer"),

  scoreText: document.getElementById("scoreText"),
  pauseButton: document.getElementById("pauseButton"),
  restartButton: document.getElementById("restartButton"),

  gameOverModal: document.getElementById("gameOverModal"),
  gameOverNoButton: document.getElementById("gameOverNoButton"),
  gameOverYesButton: document.getElementById("gameOverYesButton"),

  pauseModal: document.getElementById("pauseModal"),
  resumeButton: document.getElementById("resumeButton"),
  pauseRestartButton: document.getElementById("pauseRestartButton")
};

/* =========================================================
  [UI 02] 화면 크기 계산
========================================================= */
function getBoardCellSize() {
  return UI.boardWrap.clientWidth / GameConfig.cols;
}

/* =========================================================
  [UI 03] 5x5 배경 그리드 생성
========================================================= */
function initGridBackground() {
  UI.boardGrid.innerHTML = "";

  for (let i = 0; i < GameConfig.rows * GameConfig.cols; i++) {
    const cell = document.createElement("div");
    cell.className = "grid-cell";
    UI.boardGrid.appendChild(cell);
  }
}

/* =========================================================
  [UI 04] 게임 전체 초기화
  - game.js의 resetGameState 호출
  - UI 팝업과 렌더링 초기화
========================================================= */
function resetGame() {
  resetGameState();

  hideGameOverModal();
  hidePauseModal();

  renderAll();
}

/* =========================================================
  [UI 05] 점수 표시
========================================================= */
function updateScoreUI() {
  const score = calculateScore();
  UI.scoreText.textContent = score.toLocaleString("ko-KR");
}

/* =========================================================
  [UI 06] 전체 렌더링
========================================================= */
function renderAll() {
  renderBoardBlocks();
  renderActivePair();
  updateScoreUI();
}

/* =========================================================
  [UI 07] 숫자 블록 DOM 생성
========================================================= */
function createBlockElement(block, className) {
  const color = BLOCK_COLORS[block.value];

  const element = document.createElement("div");
  element.className = `number-block ${className}`;
  element.dataset.blockId = block.id;
  element.textContent = block.value;
  element.style.backgroundColor = color.bg;
  element.style.color = color.text;

  return element;
}

/* =========================================================
  [UI 08] 보드 위 숫자 블록 렌더링
========================================================= */
function renderBoardBlocks() {
  const existingMap = new Map();

  UI.blockLayer.querySelectorAll(".number-block.board").forEach(element => {
    existingMap.set(Number(element.dataset.blockId), element);
  });

  const aliveIds = new Set();

  for (let row = 0; row < GameConfig.rows; row++) {
    for (let col = 0; col < GameConfig.cols; col++) {
      const block = GameState.grid[row][col];

      if (!block) continue;

      aliveIds.add(block.id);

      let element = existingMap.get(block.id);

      if (!element) {
        element = createBlockElement(block, "board pop");
        UI.blockLayer.appendChild(element);
      }

      const color = BLOCK_COLORS[block.value];

      element.textContent = block.value;
      element.style.backgroundColor = color.bg;
      element.style.color = color.text;
      element.style.left = `${col * 20}%`;
      element.style.top = `${row * 20}%`;
    }
  }

  existingMap.forEach((element, id) => {
    if (!aliveIds.has(id)) {
      element.remove();
    }
  });
}

/* =========================================================
  [UI 09] 대기 숫자 블록 렌더링
  - 보드 바로 위 preview-layer에 표시
========================================================= */
function renderActivePair() {
  UI.previewLayer.innerHTML = "";

  if (!GameState.activePair || GameState.isGameOver) return;

  const cellSize = getBoardCellSize();
  const cells = getActivePairCells();

  cells.forEach(cell => {
    const element = createBlockElement(cell.block, "preview");

    element.style.width = `${cellSize}px`;
    element.style.height = `${cellSize}px`;
    element.style.left = `${cell.col * cellSize}px`;

    // dy가 0이면 보드 상단에 하단 밀착
    // dy가 -1이면 그 위 한 칸에 배치
    element.style.top = `${(cell.dy+1) * cellSize}px`;

    UI.previewLayer.appendChild(element);
  });
}

/* =========================================================
  [UI 10] 대기 블록 조작 후 화면 갱신
========================================================= */
function handleRotateActivePair() {
  const didRotate = rotateActivePair();

  if (didRotate) {
    renderActivePair();
  }
}

function handleMoveActivePair(direction) {
  const didMove = moveActivePair(direction);

  if (didMove) {
    renderActivePair();
  }
}

/* =========================================================
  [UI 11] 드롭 처리
  - game.js에서 데이터 배치
  - UI JS에서 애니메이션 타이밍과 렌더링 담당
  - 수정된 게임 종료 규칙:
    드롭 실패만으로 즉시 게임오버 확정하지 않음
    모든 합성 완료 후, 새 대기블럭이 남아 있는 상태에서
    보드가 꽉 찼을 때 게임오버 처리
========================================================= */
async function handleDropActivePair() {
  if (!canControlGame()) return;

  const result = prepareDropActivePair();

  /*
    드롭할 열에 빈칸이 없는 경우:
    현재 대기블럭은 보드 위에 남아 있음.
    이 상태에서 보드가 꽉 차 있다면 게임 종료 조건을 만족한다.
  */
  if (!result.success) {
    if (result.reason === "column-full") {
      if (shouldEndGameAfterDropResolve(result)) {
        GameState.isGameOver = true;
        await FirebaseAdapter.saveScore(GameState.score);
        showGameOverModal();
      }
    }

    return;
  }

  GameState.isAnimating = true;

  UI.previewLayer.innerHTML = "";

  renderBoardBlocks();
  await sleep(GameConfig.animationDelay);

  await resolveBoardAfterDrop();

  /*
    모든 합성이 끝난 뒤, 일부 대기숫자블럭이 보드 밖에 남았다면
    보드가 꽉 차지 않아도 게임 종료.
  */
  if (!GameState.isGameOver) {
    if (shouldEndGameAfterDropResolve(result)) {
      GameState.isGameOver = true;
      await FirebaseAdapter.saveScore(GameState.score);
      showGameOverModal();
    } else {
      /*
        모든 합성이 끝난 뒤 보드가 꽉 차 있지 않으면
        다음 대기숫자블럭을 생성한다.
      */
      if (!GameState.activePair) {
        spawnActivePair();
      }

      renderAll();

      /*
        새 대기숫자블럭이 생성된 뒤에도 보드가 꽉 차 있으면
        "그리드 위에 대기숫자블럭이 남아 있는 상태"이므로 게임 종료.
      */
      if (shouldEndGameAfterResolve()) {
        GameState.isGameOver = true;
        await FirebaseAdapter.saveScore(GameState.score);
        showGameOverModal();
      }
    }
  }

  GameState.isAnimating = false;
}

/* =========================================================
  [UI 12] 드롭 이후 보드 처리
  - 합성 → 중력 → 재합성 반복
  - 모든 합성 완료 후 점수만 갱신
  - 게임 종료 판정은 handleDropActivePair()에서
    새 대기블럭 생성 후 처리
========================================================= */
async function resolveBoardAfterDrop() {
  let hasMerged = true;

  while (hasMerged) {
    hasMerged = false;

    const groups = findMergeGroups();

    if (groups.length > 0) {
      hasMerged = true;

      await animateMergeGroups(groups);

      applyMergeGroups(groups);
      renderBoardBlocks();
      await sleep(GameConfig.animationDelay);

      applyGravity();
      renderBoardBlocks();
      await sleep(GameConfig.animationDelay);
    }
  }

  updateScoreUI();
}

/* =========================================================
  [UI 13] 합성 애니메이션
  - 합성될 블록들이 목표 위치로 빠르게 이동하는 연출
========================================================= */
async function animateMergeGroups(groups) {
  const cellSize = getBoardCellSize();

  groups.forEach(group => {
    const target = getMergeTargetCell(group);

    group.forEach(cell => {
      const block = GameState.grid[cell.row][cell.col];

      if (!block) return;

      const element = UI.blockLayer.querySelector(
        `.number-block.board[data-block-id="${block.id}"]`
      );

      if (!element) return;

      const targetLeft = target.col * cellSize;
      const targetTop = target.row * cellSize;

      element.classList.add("merging");
      element.style.left = `${targetLeft}px`;
      element.style.top = `${targetTop}px`;
    });
  });

  await sleep(GameConfig.animationDelay);
}

/* =========================================================
  [UI 14] 게임 종료 팝업
========================================================= */
function showGameOverModal() {
  UI.gameOverModal.classList.add("active");
}

function hideGameOverModal() {
  UI.gameOverModal.classList.remove("active");
}

/* =========================================================
  [UI 15] 일시 정지 팝업
========================================================= */
function showPauseModal() {
  GameState.isPaused = true;
  UI.pauseModal.classList.add("active");
}

function hidePauseModal() {
  GameState.isPaused = false;
  UI.pauseModal.classList.remove("active");
}

/* =========================================================
  [UI 16] 입력 처리
  - 터치 / 마우스 모두 대응
  - 버튼 위 입력은 게임 조작으로 처리하지 않음
========================================================= */
let pointerStartX = 0;
let pointerStartY = 0;
let pointerStartTime = 0;
let lastTouchEndX = 0;
let lastTouchEndY = 0;
let lastTouchEndTime = 0;

function isInteractiveElement(target) {
  return Boolean(target.closest("button"));
}

function handlePointerDown(event) {
  if (isInteractiveElement(event.target)) return;

  event.preventDefault();

  pointerStartX = event.clientX;
  pointerStartY = event.clientY;
  pointerStartTime = performance.now();
}

function handlePointerUp(event) {
  if (isInteractiveElement(event.target)) return;

  event.preventDefault();

  if (!canControlGame()) return;

  const dx = event.clientX - pointerStartX;
  const dy = event.clientY - pointerStartY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const elapsed = performance.now() - pointerStartTime;

  const isTap =
    absDx < GameConfig.swipeThreshold &&
    absDy < GameConfig.swipeThreshold &&
    elapsed < 450;

  if (isTap) {
    handleRotateActivePair();
    return;
  }

  if (absDy > absDx && dy > GameConfig.swipeThreshold) {
    handleDropActivePair();
    return;
  }

  if (absDx > absDy && absDx > GameConfig.swipeThreshold) {
    handleMoveActivePair(dx > 0 ? 1 : -1);
  }
}

function preventDoubleTapZoom(event) {
  if (event.changedTouches.length !== 1) return;

  const touch = event.changedTouches[0];
  const now = performance.now();
  const dx = touch.clientX - lastTouchEndX;
  const dy = touch.clientY - lastTouchEndY;
  const distance = Math.hypot(dx, dy);
  const elapsed = now - lastTouchEndTime;

  if (elapsed < 350 && distance < GameConfig.swipeThreshold) {
    event.preventDefault();
  }

  lastTouchEndX = touch.clientX;
  lastTouchEndY = touch.clientY;
  lastTouchEndTime = now;
}

/* =========================================================
  [UI 17] 버튼 이벤트
========================================================= */
UI.pauseButton.addEventListener("click", () => {
  if (GameState.isGameOver) return;

  showPauseModal();
});

UI.restartButton.addEventListener("click", () => {
  resetGame();
});

UI.resumeButton.addEventListener("click", () => {
  hidePauseModal();
});

UI.pauseRestartButton.addEventListener("click", () => {
  resetGame();
});

UI.gameOverNoButton.addEventListener("click", () => {
  // 아니오 선택 시 팝업 종료 후 게임 초기화
  resetGame();
});

UI.gameOverYesButton.addEventListener("click", () => {
  // 현재는 결과 화면이 없으므로 콘솔 출력
  // 이후 result-screen으로 이동하도록 교체
  console.log("결과 화면 이동 예정. 현재 점수:", GameState.score);

  hideGameOverModal();
});

/* =========================================================
  [UI 18] 포인터 이벤트 등록
========================================================= */
UI.playArea.addEventListener("pointerdown", handlePointerDown);
UI.playArea.addEventListener("pointerup", handlePointerUp);
UI.playArea.addEventListener("touchend", preventDoubleTapZoom, { passive: false });
UI.playArea.addEventListener("dblclick", event => {
  event.preventDefault();
});

/* =========================================================
  [UI 19] 화면 크기 변경 대응
========================================================= */
window.addEventListener("resize", () => {
  renderAll();
});

/* =========================================================
  [UI 20] 키보드 테스트용 입력
  - PC 브라우저에서 테스트 편의용
  - 실제 모바일 출시 시 제거 가능
========================================================= */
window.addEventListener("keydown", event => {
  if (!canControlGame()) return;

  if (event.key === "ArrowLeft") {
    handleMoveActivePair(-1);
  }

  if (event.key === "ArrowRight") {
    handleMoveActivePair(1);
  }

  if (event.key === "ArrowUp" || event.key === " ") {
    handleRotateActivePair();
  }

  if (event.key === "ArrowDown") {
    
    handleDropActivePair();
  }
});

/* =========================================================
  [UI 21] 앱 시작
========================================================= */
FirebaseAdapter.init();
initGridBackground();
resetGame();
