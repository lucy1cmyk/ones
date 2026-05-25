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
  titleScreen: document.getElementById("titleScreen"),
  startButton: document.getElementById("startButton"),
  optionButton: document.getElementById("optionButton"),
  optionModal: document.getElementById("optionModal"),
  optionScoreChart: document.getElementById("optionScoreChart"),
  optionCloseButton: document.getElementById("optionCloseButton"),

  resultScreen: document.getElementById("resultScreen"),
  latestScoreButton: document.getElementById("latestScoreButton"),
  latestScoreText: document.getElementById("latestScoreText"),
  scoreChart: document.getElementById("scoreChart"),
  resultRestartButton: document.getElementById("resultRestartButton"),
  resultTitleButton: document.getElementById("resultTitleButton"),
  restartConfirmModal: document.getElementById("restartConfirmModal"),
  restartConfirmNoButton: document.getElementById("restartConfirmNoButton"),
  restartConfirmYesButton: document.getElementById("restartConfirmYesButton"),

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

let hasSavedGameOverScore = false;

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
  hasSavedGameOverScore = false;
  resetGameState();

  hideGameOverModal();
  hidePauseModal();
  hideOptionModal();
  hideRestartConfirmModal();

  renderAll();
}

function showPuzzleScreen() {
  UI.titleScreen.classList.remove("active");
  UI.resultScreen.classList.remove("active");
  UI.gameScreen.classList.add("active");
  resetGame();
}

function showTitleScreen() {
  hideGameOverModal();
  hidePauseModal();
  hideOptionModal();
  hideRestartConfirmModal();

  UI.gameScreen.classList.remove("active");
  UI.resultScreen.classList.remove("active");
  UI.titleScreen.classList.add("active");
}

async function showResultScreen() {
  hideGameOverModal();
  hidePauseModal();
  hideOptionModal();
  hideRestartConfirmModal();

  UI.titleScreen.classList.remove("active");
  UI.gameScreen.classList.remove("active");
  UI.resultScreen.classList.add("active");

  const recentScores = await LocalStorageAdapter.loadRecentScores();
  renderResultScreen(recentScores);
}

function isPuzzleScreenActive() {
  return UI.gameScreen.classList.contains("active");
}

function isResultScreenActive() {
  return UI.resultScreen.classList.contains("active");
}

/* =========================================================
  [UI 05] 점수 표시
========================================================= */
function updateScoreUI() {
  const score = calculateScore();
  UI.scoreText.textContent = score.toLocaleString("ko-KR");
}

function renderResultScreen(recentScores) {
  const scores = Array.isArray(recentScores) ? recentScores.slice(0, 5) : [];
  const latestScore = scores[0]?.score ?? GameState.score ?? 0;

  UI.latestScoreText.textContent = latestScore.toLocaleString("ko-KR");
  renderScoreChart(scores, UI.scoreChart);
}

function renderScoreChart(scores, targetElement = UI.scoreChart) {
  targetElement.innerHTML = "";

  if (!scores.length) {
    const message = document.createElement("p");
    message.className = "empty-chart-message";
    message.textContent = "최근 플레이 기록이 없습니다";
    targetElement.appendChild(message);
    return;
  }

  const chartScores = scores.slice().reverse();
  const maxScore = Math.max(...chartScores.map(record => record.score), 1);
  const minX = 8;
  const maxX = 92;
  const minY = 16;
  const maxY = 84;
  const points = chartScores.map((record, index) => {
    const x = chartScores.length === 1
      ? 50
      : minX + ((maxX - minX) * index) / (chartScores.length - 1);
    const y = maxY - ((Number(record.score) || 0) / maxScore) * (maxY - minY);

    return {
      x,
      y,
      score: Number(record.score) || 0
    };
  });

  const stage = document.createElement("div");
  stage.className = "score-line-stage";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("score-line-svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");

  [minY, 50, maxY].forEach(y => {
    const gridLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    gridLine.classList.add("score-line-grid");
    gridLine.setAttribute("x1", "0");
    gridLine.setAttribute("y1", String(y));
    gridLine.setAttribute("x2", "100");
    gridLine.setAttribute("y2", String(y));
    svg.appendChild(gridLine);
  });

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.classList.add("score-line-path");
  polyline.setAttribute("points", points.map(point => `${point.x},${point.y}`).join(" "));
  svg.appendChild(polyline);

  points.forEach(point => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.classList.add("score-line-dot");
    circle.setAttribute("cx", String(point.x));
    circle.setAttribute("cy", String(point.y));
    circle.setAttribute("r", "2.8");
    svg.appendChild(circle);
  });

  stage.appendChild(svg);

  points.forEach(point => {
    const value = document.createElement("span");
    value.className = "score-line-value";
    value.textContent = point.score.toLocaleString("ko-KR");
    value.style.left = `${point.x}%`;
    value.style.top = `${point.y}%`;
    stage.appendChild(value);
  });

  const labels = document.createElement("div");
  labels.className = "score-line-labels";
  labels.style.gridTemplateColumns = `repeat(${chartScores.length}, minmax(0, 1fr))`;

  chartScores.forEach((record, index) => {
    const label = document.createElement("span");
    label.className = "score-line-label";
    label.textContent = index === chartScores.length - 1
      ? "이번"
      : `${chartScores.length - index - 1}회전`;
    labels.appendChild(label);
  });

  targetElement.appendChild(stage);
  targetElement.appendChild(labels);
}

async function renderOptionScoreChart() {
  const recentScores = await LocalStorageAdapter.loadRecentScores();
  const scores = Array.isArray(recentScores) ? recentScores.slice(0, 5) : [];

  renderScoreChart(scores, UI.optionScoreChart);
}

async function saveGameOverScore() {
  if (hasSavedGameOverScore) {
    return;
  }

  hasSavedGameOverScore = true;
  const finalScore = calculateScore();
  await LocalStorageAdapter.saveScore(finalScore);
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

function renderPendingBlocks(dropResult) {
  UI.previewLayer.innerHTML = "";

  if (!dropResult || !Array.isArray(dropResult.pendingBlocks)) return;

  const cellSize = getBoardCellSize();

  dropResult.pendingBlocks.forEach(pendingBlock => {
    if (pendingBlock.hasResolved) return;

    const element = createBlockElement(pendingBlock.block, "preview");

    element.style.width = `${cellSize}px`;
    element.style.height = `${cellSize}px`;
    element.style.left = `${pendingBlock.col * cellSize}px`;
    element.style.top = `${pendingBlock.renderSlot * cellSize}px`;

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
  if (!isPuzzleScreenActive() || !canControlGame()) return;

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
        await saveGameOverScore();
        showGameOverModal();
      }
    }

    return;
  }

  GameState.isAnimating = true;

  UI.previewLayer.innerHTML = "";
  renderPendingBlocks(result);

  renderBoardBlocks();
  await sleep(GameConfig.animationDelay);

  const hadMerge = await resolveBoardAfterDrop(result);

  /*
    1) 합성 성공: 중력 적용 후 다시 합성 검사 → 더 이상 합성 없으면 종료
       → 새 대기숫자블럭 생성
    2) 합성 실패: 두 개의 블록 중 하나 이상이 보드 밖에 남아 있는지 체크
       → 보드 밖에 남아 있다면 게임오버
  */
  if (!GameState.isGameOver) {
    if (shouldEndGameAfterDropResolve(result)) {
      GameState.isGameOver = true;
      renderPendingBlocks(result);
      await saveGameOverScore();
      showGameOverModal();
    } else {
      /*
        합성이 성공했거나, 합성이 없어도 대기블럭이
        보드에 정상 배치된 경우 다음 대기숫자블럭 생성
      */
      if (!GameState.activePair) {
        spawnActivePair();
      }

      renderAll();
    }
  }

  GameState.isAnimating = false;
}

/* =========================================================
  [UI 12] 드롭 이후 보드 처리
  - 합성 → 중력 → 재합성 반복
  - 모든 합성 완료 후 점수만 갱신
  - 합성 발생 여부를 반환하여 게임 오버 조건 판정에 사용
========================================================= */
async function resolveBoardAfterDrop(dropResult) {
  let hadAnyMerge = false;
  const maxIterations = GameConfig.rows * GameConfig.cols * 2;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    const beforeBoard = getBoardSnapshot();
    const beforePending = getPendingSnapshot(dropResult);
    const beforePendingCount = dropResult?.pendingBlocks?.length || 0;
    const pendingPlacement = tryResolvePendingBlocks(dropResult);
    const afterPendingCount = dropResult?.pendingBlocks?.length || 0;

    if (pendingPlacement.didPlace) {
      renderPendingBlocks(dropResult);
      renderBoardBlocks();
      await sleep(GameConfig.animationDelay);
    }

    const groups = findMergeGroups(dropResult);

    if (groups.length === 0) {
      const didChange =
        pendingPlacement.didPlace ||
        beforePendingCount !== afterPendingCount ||
        beforeBoard !== getBoardSnapshot() ||
        beforePending !== getPendingSnapshot(dropResult);

      if (!didChange) {
        break;
      }

      break;
    }

    hadAnyMerge = true;

    await animateMergeGroups(groups);

    applyMergeGroups(groups, dropResult);
    const didGravityMove = applyGravityWithPending(dropResult);
    renderPendingBlocks(dropResult);
    renderBoardBlocks();
    await sleep(GameConfig.animationDelay);

    const didChange =
      pendingPlacement.didPlace ||
      beforePendingCount !== afterPendingCount ||
      groups.length > 0 ||
      didGravityMove ||
      beforeBoard !== getBoardSnapshot() ||
      beforePending !== getPendingSnapshot(dropResult);

    if (!didChange) {
      break;
    }
  }

  renderPendingBlocks(dropResult);
  updateScoreUI();
  return hadAnyMerge;
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
      if (cell.isPending || !isInsideGrid(cell.row, cell.col)) return;

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

async function showOptionModal() {
  await renderOptionScoreChart();
  UI.optionModal.classList.add("active");
}

function hideOptionModal() {
  UI.optionModal.classList.remove("active");
}

function showRestartConfirmModal() {
  UI.restartConfirmModal.classList.add("active");
}

function hideRestartConfirmModal() {
  UI.restartConfirmModal.classList.remove("active");
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

  if (!isPuzzleScreenActive() || !canControlGame()) return;

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

function preventBrowserGesture(event) {
  event.preventDefault();
}

/* =========================================================
  [UI 17] 버튼 이벤트
========================================================= */
UI.startButton.addEventListener("click", () => {
  showPuzzleScreen();
});

UI.optionButton.addEventListener("click", async () => {
  await showOptionModal();
});

UI.optionCloseButton.addEventListener("click", () => {
  hideOptionModal();
});

UI.pauseButton.addEventListener("click", () => {
  if (GameState.isGameOver) return;

  showPauseModal();
});

UI.restartButton.addEventListener("click", () => {
  resetGame();
});

UI.latestScoreButton.addEventListener("click", () => {
  showRestartConfirmModal();
});

UI.resultRestartButton.addEventListener("click", () => {
  showRestartConfirmModal();
});

UI.resultTitleButton.addEventListener("click", () => {
  showTitleScreen();
});

UI.restartConfirmNoButton.addEventListener("click", () => {
  hideRestartConfirmModal();
});

UI.restartConfirmYesButton.addEventListener("click", () => {
  showPuzzleScreen();
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

UI.gameOverYesButton.addEventListener("click", async () => {
  await showResultScreen();
});

/* =========================================================
  [UI 18] 포인터 이벤트 등록
========================================================= */
UI.playArea.addEventListener("pointerdown", handlePointerDown);
UI.playArea.addEventListener("pointerup", handlePointerUp);

document.addEventListener("touchmove", preventBrowserGesture, { passive: false });
document.addEventListener("touchend", preventDoubleTapZoom, { passive: false });
document.addEventListener("dblclick", preventBrowserGesture);
document.addEventListener("dragstart", preventBrowserGesture);
document.addEventListener("selectstart", preventBrowserGesture);
document.addEventListener("gesturestart", preventBrowserGesture);
document.addEventListener("gesturechange", preventBrowserGesture);
document.addEventListener("gestureend", preventBrowserGesture);

/* =========================================================
  [UI 19] 화면 크기 변경 대응
========================================================= */
window.addEventListener("resize", () => {
  renderAll();

  if (isResultScreenActive()) {
    LocalStorageAdapter.loadRecentScores().then(renderResultScreen);
  }
});

/* =========================================================
  [UI 20] 키보드 테스트용 입력
  - PC 브라우저에서 테스트 편의용
  - 실제 모바일 출시 시 제거 가능
========================================================= */
window.addEventListener("keydown", event => {
  if (!isPuzzleScreenActive() || !canControlGame()) return;

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
LocalStorageAdapter.init();
initGridBackground();
resetGame();
