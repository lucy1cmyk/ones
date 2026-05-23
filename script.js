/* ===== Game settings ===== */
const GRID_SIZE = 5;
const MAX_BLOCK_NUMBER = 15;

/* ===== 숫자블럭 컬러 설정 ===== */
const BLOCK_COLORS = {
  1: { text: "#646464", bg: "#e5d1af" },
  2: { text: "#ab383c", bg: "#ff7360" },
  3: { text: "#ffb9a6", bg: "#ca3a3f" },
  4: { text: "#fef886", bg: "#ee8329" },
  5: { text: "#dc5218", bg: "#ffc43e" },
  6: { text: "#fffe86", bg: "#898d2f" },
  7: { text: "#32714f", bg: "#b1ca56" },
  8: { text: "#e7f48f", bg: "#1f7d44" },
  9: { text: "#423f77", bg: "#30a18d" },
  10: { text: "#80e8d5", bg: "#446d9e" },
  11: { text: "#81dcd6", bg: "#52497d" },
  12: { text: "#4b2c3e", bg: "#9e5bad" },
  13: { text: "#e997d0", bg: "#5a3244" },
  14: { text: "#121212", bg: "#444444" },
  15: { text: "#b9b9b9", bg: "#121212" }
};

/* ===== HTML 요소 가져오기 ===== */
const gridElement = document.getElementById("grid");
const scoreText = document.getElementById("scoreText");
const nextBlockArea = document.getElementById("nextBlockArea");
const nextBlockPreview = document.getElementById("nextBlockPreview");

const pauseButton = document.getElementById("pauseButton");
const restartButton = document.getElementById("restartButton");
const resumeButton = document.getElementById("resumeButton");

const pausePopup = document.getElementById("pausePopup");
const gameOverPopup = document.getElementById("gameOverPopup");
const goResultButton = document.getElementById("goResultButton");
const closeGameOverButton = document.getElementById("closeGameOverButton");

/* ===== 게임 상태 ===== */
let board = [];
let nextBlocks = [];
let directionIndex = 0;
let isPaused = false;

/*
  방향 순서:
  0: 오른쪽
  1: 아래
  2: 왼쪽
  3: 위
*/
const directions = [
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: -1, col: 0 }
];

/* ===== 게임 초기화 ===== */
function initGame() {
  board = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => null)
  );

  directionIndex = 0;
  isPaused = false;

  pausePopup.classList.add("hidden");
  gameOverPopup.classList.add("hidden");

  createNextBlocks();
  renderBoard();
  renderNextBlocks();
  updateScore();
}

/* ===== 5x5 그리드 생성 및 화면 표시 ===== */
function renderBoard() {
  gridElement.innerHTML = "";

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";

      cell.dataset.row = row;
      cell.dataset.col = col;

      const value = board[row][col];

      if (value !== null) {
        cell.appendChild(createBlockElement(value));
      }

      cell.addEventListener("click", () => {
        placeNextBlocks(row, col);
      });

      gridElement.appendChild(cell);
    }
  }
}

/* ===== 숫자블럭 HTML 생성 ===== */
function createBlockElement(value) {
  const block = document.createElement("div");
  block.className = "block";
  block.textContent = value;

  const color = BLOCK_COLORS[value];
  block.style.backgroundColor = color.bg;
  block.style.color = color.text;

  return block;
}

/* ===== 현재 보드에서 가장 높은 숫자 찾기 ===== */
function getHighestBlockNumber() {
  let highest = 1;

  for (const row of board) {
    for (const value of row) {
      if (value !== null && value > highest) {
        highest = value;
      }
    }
  }

  return highest;
}

/* ===== 대기 숫자블럭 2개 생성 ===== */
function createNextBlocks() {
  const highest = getHighestBlockNumber();

  /*
    생성 가능한 최대 숫자:
    현재 보드 최고 숫자보다 2단계 낮은 블럭까지.
    단, 처음에는 최소 1이 나오도록 처리.
  */
  const maxRandomNumber = Math.max(1, highest - 2);
  const cappedMaxNumber = Math.min(MAX_BLOCK_NUMBER, maxRandomNumber);

  nextBlocks = [
    getRandomNumber(1, cappedMaxNumber),
    getRandomNumber(1, cappedMaxNumber)
  ];
}

/* ===== 랜덤 숫자 생성 ===== */
function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ===== 대기 숫자블럭 미리보기 표시 ===== */
function renderNextBlocks() {
  nextBlockPreview.innerHTML = "";

  const firstBlock = createBlockElement(nextBlocks[0]);
  const secondBlock = createBlockElement(nextBlocks[1]);

  firstBlock.style.left = "33px";
  firstBlock.style.top = "33px";

  const direction = directions[directionIndex];

  secondBlock.style.left = `${33 + direction.col * 56}px`;
  secondBlock.style.top = `${33 + direction.row * 56}px`;

  nextBlockPreview.appendChild(firstBlock);
  nextBlockPreview.appendChild(secondBlock);
}

/* ===== 대기 블럭 방향 회전 ===== */
function rotateNextBlocks() {
  if (isPaused) return;

  directionIndex = (directionIndex + 1) % directions.length;
  renderNextBlocks();
}

/* ===== 대기 블럭을 그리드에 배치 ===== */
function placeNextBlocks(row, col) {
  if (isPaused) return;

  const direction = directions[directionIndex];

  const secondRow = row + direction.row;
  const secondCol = col + direction.col;

  if (!isInsideBoard(row, col) || !isInsideBoard(secondRow, secondCol)) {
    return;
  }

  if (board[row][col] !== null || board[secondRow][secondCol] !== null) {
    return;
  }

  board[row][col] = nextBlocks[0];
  board[secondRow][secondCol] = nextBlocks[1];

  resolveMatches();
  createNextBlocks();
  renderBoard();
  renderNextBlocks();
  updateScore();
  checkGameOver();
}

/* ===== 보드 범위 체크 ===== */
function isInsideBoard(row, col) {
  return row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE;
}

/* ===== 같은 숫자 3개 이상 합성 처리 ===== */
function resolveMatches() {
  let foundMatch = true;

  while (foundMatch) {
    foundMatch = false;

    const matches = findAllMatches();

    if (matches.length > 0) {
      foundMatch = true;
      mergeMatches(matches);
    }
  }
}

/* ===== 가로/세로 같은 숫자 3개 이상 찾기 ===== */
function findAllMatches() {
  const matches = [];

  /* 가로 방향 검사 */
  for (let row = 0; row < GRID_SIZE; row++) {
    let startCol = 0;

    while (startCol < GRID_SIZE) {
      const value = board[row][startCol];

      if (value === null) {
        startCol++;
        continue;
      }

      let endCol = startCol;

      while (
        endCol + 1 < GRID_SIZE &&
        board[row][endCol + 1] === value
      ) {
        endCol++;
      }

      if (endCol - startCol + 1 >= 3) {
        const cells = [];

        for (let col = startCol; col <= endCol; col++) {
          cells.push({ row, col });
        }

        matches.push({ value, cells });
      }

      startCol = endCol + 1;
    }
  }

  /* 세로 방향 검사 */
  for (let col = 0; col < GRID_SIZE; col++) {
    let startRow = 0;

    while (startRow < GRID_SIZE) {
      const value = board[startRow][col];

      if (value === null) {
        startRow++;
        continue;
      }

      let endRow = startRow;

      while (
        endRow + 1 < GRID_SIZE &&
        board[endRow + 1][col] === value
      ) {
        endRow++;
      }

      if (endRow - startRow + 1 >= 3) {
        const cells = [];

        for (let row = startRow; row <= endRow; row++) {
          cells.push({ row, col });
        }

        matches.push({ value, cells });
      }

      startRow = endRow + 1;
    }
  }

  return matches;
}

/* ===== 합성된 블럭 위치 결정 및 한 단계 높은 블럭 생성 ===== */
function mergeMatches(matches) {
  for (const match of matches) {
    const targetCell = getMergeTargetCell(match.cells);

    for (const cell of match.cells) {
      board[cell.row][cell.col] = null;
    }

    const nextValue = Math.min(match.value + 1, MAX_BLOCK_NUMBER);
    board[targetCell.row][targetCell.col] = nextValue;
  }
}

/*
  합성 위치:
  합성된 숫자블럭 중 가장 왼쪽,
  왼쪽이 같다면 가장 아래쪽 위치.
*/
function getMergeTargetCell(cells) {
  return cells.reduce((best, current) => {
    if (current.col < best.col) return current;
    if (current.col === best.col && current.row > best.row) return current;
    return best;
  });
}

/* ===== 현재 스코어 계산 ===== */
function updateScore() {
  let score = 0;

  for (const row of board) {
    for (const value of row) {
      if (value !== null) {
        score += value * 100;
      }
    }
  }

  scoreText.textContent = score;
}

/* ===== 게임 종료 조건 검사 ===== */
function checkGameOver() {
  const isFull = board.every(row => row.every(cell => cell !== null));

  if (isFull) {
    gameOverPopup.classList.remove("hidden");
  }
}

/* ===== 일시 정지 처리 ===== */
function pauseGame() {
  isPaused = true;
  pausePopup.classList.remove("hidden");
}

/* ===== 일시 정지 해제 ===== */
function resumeGame() {
  isPaused = false;
  pausePopup.classList.add("hidden");
}

/* ===== 결과화면 이동 임시 처리 ===== */
function goToResultScreen() {
  alert("결과화면은 다음 단계에서 제작하면 됩니다.");
}

/* ===== 이벤트 연결 ===== */
nextBlockArea.addEventListener("click", rotateNextBlocks);

pauseButton.addEventListener("click", pauseGame);
resumeButton.addEventListener("click", resumeGame);

restartButton.addEventListener("click", initGame);

goResultButton.addEventListener("click", goToResultScreen);

closeGameOverButton.addEventListener("click", () => {
  gameOverPopup.classList.add("hidden");
});

/* ===== 게임 시작 ===== */
initGame();