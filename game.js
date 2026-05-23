/* =========================================================
  [Game JS]
  - 순수 게임 데이터와 게임 규칙 담당
  - DOM 조작을 직접 하지 않도록 설계
  - Unity 포팅 시 이 파일의 구조를 GameManager / BoardManager로 옮기기 쉬움
========================================================= */

/* =========================================================
  [Game 01] 숫자 블록 색상 데이터
  - 현재는 UI에서도 사용하므로 전역 const로 둠
  - Unity 포팅 시 ScriptableObject 또는 enum 데이터로 이동 가능
========================================================= */
const BLOCK_COLORS = {
  1:  { text: "#646464", bg: "#e5d1af" },
  2:  { text: "#ab383c", bg: "#ff7360" },
  3:  { text: "#ffb9a6", bg: "#ca3a3f" },
  4:  { text: "#fef886", bg: "#ee8329" },
  5:  { text: "#dc5218", bg: "#ffc43e" },
  6:  { text: "#fffe86", bg: "#898d2f" },
  7:  { text: "#32714f", bg: "#b1ca56" },
  8:  { text: "#e7f48f", bg: "#1f7d44" },
  9:  { text: "#423f77", bg: "#30a18d" },
  10: { text: "#80e8d5", bg: "#446d9e" },
  11: { text: "#81dcd6", bg: "#52497d" },
  12: { text: "#4b2c3e", bg: "#9e5bad" },
  13: { text: "#e997d0", bg: "#5a3244" },
  14: { text: "#121212", bg: "#444444" },
  15: { text: "#b9b9b9", bg: "#121212" }
};

/* =========================================================
  [Game 02] 게임 설정값
========================================================= */
const GameConfig = {
  rows: 5,
  cols: 5,
  minBlockValue: 1,
  maxBlockValue: 15,
  mergeNeedCount: 3,
  scorePerValue: 100,
  swipeThreshold: 28,
  animationDelay: 140
};

/* =========================================================
  [Game 03] 게임 상태
  - grid[row][col]에는 block 객체 또는 null 저장
========================================================= */
const GameState = {
  grid: [],
  activePair: null,
  score: 0,
  isPaused: false,
  isAnimating: false,
  isGameOver: false,
  nextBlockId: 1
};

/* =========================================================
  [Game 04] 유틸리티 함수
========================================================= */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createBlock(value, row = null, col = null) {
  return {
    id: GameState.nextBlockId++,
    value,
    row,
    col
  };
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isInsideGrid(row, col) {
  return (
    row >= 0 &&
    row < GameConfig.rows &&
    col >= 0 &&
    col < GameConfig.cols
  );
}

/* =========================================================
  [Game 05] 게임 초기화
========================================================= */
function resetGameState() {
  GameState.grid = Array.from({ length: GameConfig.rows }, () =>
    Array.from({ length: GameConfig.cols }, () => null)
  );

  GameState.activePair = null;
  GameState.score = 0;
  GameState.isPaused = false;
  GameState.isAnimating = false;
  GameState.isGameOver = false;
  GameState.nextBlockId = 1;

  spawnActivePair();
}

/* =========================================================
  [Game 06] 점수 계산
  - 그리드에 존재하는 모든 숫자 블록 점수 합산
========================================================= */
function calculateScore() {
  let total = 0;

  for (let row = 0; row < GameConfig.rows; row++) {
    for (let col = 0; col < GameConfig.cols; col++) {
      const block = GameState.grid[row][col];

      if (block) {
        total += block.value * GameConfig.scorePerValue;
      }
    }
  }

  GameState.score = total;
  return total;
}

/* =========================================================
  [Game 07] 대기 숫자 블록 생성 조건
  - 최소: 1
  - 최대: 현재 그리드 최고 숫자보다 2단계 낮은 숫자
  - 단, 빈 그리드 또는 낮은 숫자만 있을 경우 1만 생성
========================================================= */
function getHighestBlockValueOnGrid() {
  let highest = 1;

  for (let row = 0; row < GameConfig.rows; row++) {
    for (let col = 0; col < GameConfig.cols; col++) {
      const block = GameState.grid[row][col];

      if (block && block.value > highest) {
        highest = block.value;
      }
    }
  }

  return highest;
}

function getSpawnMaxValue() {
  const highest = getHighestBlockValueOnGrid();

  const maxValue = Math.max(
    GameConfig.minBlockValue,
    highest - 2
  );

  return Math.min(maxValue, GameConfig.maxBlockValue);
}

function spawnActivePair() {
  const maxValue = getSpawnMaxValue();

  GameState.activePair = {
    // 중심축 블록의 열 위치
    col: 2,

    // 0: 오른쪽, 1: 아래, 2: 왼쪽, 3: 위
    orientation: Math.random() < 0.5 ? 0 : 1,

    blocks: [
      createBlock(getRandomInt(GameConfig.minBlockValue, maxValue)),
      createBlock(getRandomInt(GameConfig.minBlockValue, maxValue))
    ]
  };

  clampActivePairToBoardWidth();
}

/* =========================================================
  [Game 08] 대기 블록 상대 위치
  - 첫 번째 블록: 중심축
  - 두 번째 블록: 회전 방향에 따라 상하좌우 배치
========================================================= */
function getPairOffsets(orientation) {
  if (orientation === 0) {
    return [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 }
    ];
  }

  if (orientation === 1) {
    return [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 0 }
    ];
  }

  if (orientation === 2) {
    return [
      { dx: 0, dy: 0 },
      { dx: -1, dy: 0 }
    ];
  }

  return [
    { dx: 0, dy: 0 },
    { dx: 0, dy: -1 }
  ];
}

function getActivePairCells() {
  const pair = GameState.activePair;

  if (!pair) {
    return [];
  }

  const offsets = getPairOffsets(pair.orientation);

  return pair.blocks.map((block, index) => ({
    block,
    pairIndex: index,
    col: pair.col + offsets[index].dx,
    dy: offsets[index].dy
  }));
}

function clampActivePairToBoardWidth() {
  if (!GameState.activePair) return;

  const cells = getActivePairCells();

  const minCol = Math.min(...cells.map(cell => cell.col));
  const maxCol = Math.max(...cells.map(cell => cell.col));

  if (minCol < 0) {
    GameState.activePair.col += Math.abs(minCol);
  }

  if (maxCol >= GameConfig.cols) {
    GameState.activePair.col -= maxCol - (GameConfig.cols - 1);
  }
}

/* =========================================================
  [Game 09] 조작 가능 여부
========================================================= */
function canControlGame() {
  return (
    !GameState.isPaused &&
    !GameState.isAnimating &&
    !GameState.isGameOver &&
    GameState.activePair
  );
}

function rotateActivePair() {
  if (!canControlGame()) return false;

  GameState.activePair.orientation =
    (GameState.activePair.orientation + 1) % 4;

  clampActivePairToBoardWidth();

  return true;
}

function moveActivePair(direction) {
  if (!canControlGame()) return false;

  GameState.activePair.col += direction;
  clampActivePairToBoardWidth();

  return true;
}

/* =========================================================
  [Game 10] 드롭 처리
  - 좌우 배치: 각 열의 가장 아래 빈칸으로 떨어짐
  - 상하 배치: 같은 열에 아래 블록부터 순서대로 쌓음
  - 중요:
    현재는 드롭 중 column-full이 발생해도 즉시 게임오버로 확정하지 않음
    게임 종료 판정은 모든 합성 완료 후 별도 함수에서 처리
========================================================= */
function prepareDropActivePair() {
  if (!canControlGame()) {
    return {
      success: false,
      reason: "cannot-control"
    };
  }

  const cells = getActivePairCells();

  // 아래에 있는 대기 블록부터 먼저 배치
  const sortedCells = [...cells].sort((a, b) => b.dy - a.dy);

  const placedBlocks = [];
  const pendingBlocks = [];
  const pendingCountByCol = {};
  let stackOrder = 0;
  let hasOverflowedBlocks = false;

  sortedCells.forEach(cell => {
    const targetRow = findLowestEmptyRow(cell.col);

    /*
      해당 열에 빈칸이 없으면 배치 실패.
      단, 여기서 바로 게임오버 처리하지 않는다.
      최종 게임오버는 모든 합성 완료 후 판정한다.
    */
    if (targetRow === -1) {
      const pendingCount = pendingCountByCol[cell.col] || 0;

      hasOverflowedBlocks = true;
      pendingBlocks.push({
        block: cell.block,
        value: cell.block.value,
        turnBlockId: cell.block.id,
        originalOrder: cell.pairIndex,
        col: cell.col,
        selectedCol: cell.col,
        row: -1 - pendingCount,
        renderSlot: 1 - pendingCount,
        isInsideBoard: false,
        hasResolved: false,
        isTurnPending: true,
        stackOrder,
        order: cell.pairIndex
      });
      pendingCountByCol[cell.col] = pendingCount + 1;
      stackOrder++;
      return;
    }

    cell.block.row = targetRow;
    cell.block.col = cell.col;

    GameState.grid[targetRow][cell.col] = cell.block;
    placedBlocks.push(cell.block);
    stackOrder++;
  });

  GameState.activePair = null;

  return {
    success: true,
    placedBlocks,
    pendingBlocks,
    hasOverflowedBlocks
  };
}

function findLowestEmptyRow(col) {
  for (let row = GameConfig.rows - 1; row >= 0; row--) {
    if (!GameState.grid[row][col]) {
      return row;
    }
  }

  return -1;
}

function placeResolvablePendingBlocks(dropResult) {
  if (!dropResult || !Array.isArray(dropResult.pendingBlocks)) {
    return {
      didPlace: false,
      placedBlocks: []
    };
  }

  const placedBlocks = [];
  const remainingBlocks = [];

  dropResult.pendingBlocks
    .sort(comparePendingBlocks)
    .forEach(pendingBlock => {
      if (pendingBlock.hasResolved) {
        return;
      }

      const targetRow = findLowestEmptyRow(pendingBlock.col);

      if (targetRow === -1) {
        remainingBlocks.push(pendingBlock);
        return;
      }

      pendingBlock.block.row = targetRow;
      pendingBlock.block.col = pendingBlock.col;
      pendingBlock.row = targetRow;
      pendingBlock.isInsideBoard = true;
      pendingBlock.hasResolved = true;

      GameState.grid[targetRow][pendingBlock.col] = pendingBlock.block;
      dropResult.placedBlocks.push(pendingBlock.block);
      placedBlocks.push(pendingBlock.block);
    });

  dropResult.pendingBlocks = remainingBlocks;
  updatePendingVirtualRows(dropResult);

  return {
    didPlace: placedBlocks.length > 0,
    placedBlocks
  };
}

function tryResolvePendingBlocks(dropResult) {
  const beforePlacedCount = dropResult?.placedBlocks?.length || 0;
  const beforePendingCount = dropResult?.pendingBlocks?.length || 0;
  const didGravityMove = applyGravityWithPending(dropResult, true);
  const afterPlacedCount = dropResult?.placedBlocks?.length || 0;
  const afterPendingCount = dropResult?.pendingBlocks?.length || 0;

  return {
    didPlace: afterPlacedCount > beforePlacedCount,
    didGravityMove,
    placedBlocks: dropResult.placedBlocks.slice(beforePlacedCount),
    pendingCountChanged: beforePendingCount !== afterPendingCount
  };
}

function updatePendingVirtualRows(dropResult) {
  if (!dropResult || !Array.isArray(dropResult.pendingBlocks)) return;

  const pendingCountByCol = {};

  dropResult.pendingBlocks
    .sort(comparePendingBlocks)
    .forEach(pendingBlock => {
      const pendingCount = pendingCountByCol[pendingBlock.col] || 0;

      pendingBlock.row = -1 - pendingCount;
      pendingBlock.renderSlot = 1 - pendingCount;
      pendingCountByCol[pendingBlock.col] = pendingCount + 1;
    });
}

function comparePendingBlocks(a, b) {
  if (a.col !== b.col) return a.col - b.col;
  return a.stackOrder - b.stackOrder;
}

function hasUnresolvedPendingBlocks(dropResult) {
  return Boolean(
    dropResult &&
    Array.isArray(dropResult.pendingBlocks) &&
    dropResult.pendingBlocks.some(pendingBlock => !pendingBlock.hasResolved)
  );
}

function getBoardSnapshot() {
  return GameState.grid
    .map(row => row.map(block => (block ? `${block.id}:${block.value}` : ".")).join(","))
    .join("|");
}

function getPendingSnapshot(dropResult) {
  if (!dropResult || !Array.isArray(dropResult.pendingBlocks)) return "";

  return dropResult.pendingBlocks
    .map(pendingBlock =>
      [
        pendingBlock.turnBlockId,
        pendingBlock.value,
        pendingBlock.col,
        pendingBlock.row,
        pendingBlock.hasResolved ? 1 : 0
      ].join(":")
    )
    .join("|");
}

/* =========================================================
  [Game 11] 합성 그룹 찾기
  - 상하좌우 연결된 같은 숫자 블록이 3개 이상이면 합성
  - 대각선은 연결로 보지 않음
========================================================= */
function findMergeGroups(dropResult = null) {
  if (dropResult && Array.isArray(dropResult.pendingBlocks)) {
    return findMergeGroupsWithPending(dropResult);
  }

  const visited = Array.from({ length: GameConfig.rows }, () =>
    Array.from({ length: GameConfig.cols }, () => false)
  );

  const groups = [];

  for (let row = 0; row < GameConfig.rows; row++) {
    for (let col = 0; col < GameConfig.cols; col++) {
      if (visited[row][col]) continue;

      const startBlock = GameState.grid[row][col];

      if (!startBlock) continue;

      const group = collectSameValueGroup(row, col, startBlock.value, visited);

      if (group.length >= GameConfig.mergeNeedCount) {
        groups.push(group);
      }
    }
  }

  return groups;
}

function findMergeGroupsWithPending(dropResult) {
  const allCells = [];
  const visited = new Set();
  const groups = [];

  for (let row = 0; row < GameConfig.rows; row++) {
    for (let col = 0; col < GameConfig.cols; col++) {
      const block = GameState.grid[row][col];

      if (!block) continue;

      allCells.push({
        key: `grid-${row}-${col}`,
        row,
        col,
        block,
        isPending: false
      });
    }
  }

  dropResult.pendingBlocks
    .filter(pendingBlock => !pendingBlock.hasResolved)
    .forEach(pendingBlock => {
      allCells.push({
        key: `pending-${pendingBlock.turnBlockId}`,
        row: pendingBlock.row,
        col: pendingBlock.col,
        block: pendingBlock.block,
        pendingBlock,
        isPending: true
      });
    });

  allCells.forEach(startCell => {
    if (visited.has(startCell.key)) return;

    const group = collectSameValueCells(startCell, allCells, visited);

    if (group.length >= GameConfig.mergeNeedCount) {
      groups.push(group);
    }
  });

  return groups;
}

function collectSameValueCells(startCell, allCells, visited) {
  const queue = [startCell];
  const group = [];
  const value = startCell.block.value;
  const directions = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 }
  ];

  visited.add(startCell.key);

  while (queue.length > 0) {
    const current = queue.shift();
    group.push(current);

    directions.forEach(direction => {
      const nextRow = current.row + direction.dr;
      const nextCol = current.col + direction.dc;
      const nextCell = allCells.find(cell =>
        cell.row === nextRow &&
        cell.col === nextCol &&
        cell.block.value === value
      );

      if (!nextCell || visited.has(nextCell.key)) return;

      visited.add(nextCell.key);
      queue.push(nextCell);
    });
  }

  return group;
}

function collectSameValueGroup(startRow, startCol, value, visited) {
  const queue = [{ row: startRow, col: startCol }];
  const group = [];

  visited[startRow][startCol] = true;

  const directions = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 }
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    group.push(current);

    directions.forEach(direction => {
      const nextRow = current.row + direction.dr;
      const nextCol = current.col + direction.dc;

      if (!isInsideGrid(nextRow, nextCol)) return;
      if (visited[nextRow][nextCol]) return;

      const nextBlock = GameState.grid[nextRow][nextCol];

      if (!nextBlock || nextBlock.value !== value) return;

      visited[nextRow][nextCol] = true;
      queue.push({
        row: nextRow,
        col: nextCol
      });
    });
  }

  return group;
}

/* =========================================================
  [Game 12] 합성 위치 계산
  - 합성 위치: 가장 아래쪽 행
  - 같은 행 안에서는 가장 왼쪽 칸
========================================================= */
function getMergeTargetCell(group) {
  return [...group].sort((a, b) => {
    if (b.row !== a.row) return b.row - a.row;
    return a.col - b.col;
  })[0];
}

/* =========================================================
  [Game 13] 합성 적용
  - 실제 grid 데이터 변경
  - 애니메이션은 UI JS에서 담당
========================================================= */
function applyMergeGroups(groups, dropResult = null) {
  groups.forEach(group => {
    const target = getMergeTargetCell(group);
    const targetBlock = target.isPending
      ? target.block
      : GameState.grid[target.row][target.col];

    if (!targetBlock) return;

    const nextValue = Math.min(
      targetBlock.value + 1,
      GameConfig.maxBlockValue
    );

    // 그룹 전체 제거
    group.forEach(cell => {
      if (cell.isPending) {
        cell.pendingBlock.hasResolved = true;
        return;
      }

      GameState.grid[cell.row][cell.col] = null;
    });

    if (dropResult && Array.isArray(dropResult.pendingBlocks)) {
      dropResult.pendingBlocks = dropResult.pendingBlocks.filter(
        pendingBlock => !pendingBlock.hasResolved
      );
      updatePendingVirtualRows(dropResult);
    }

    // 목표 위치에 합성 블록 생성
    if (!target.isPending) {
      const mergedBlock = createBlock(nextValue, target.row, target.col);
      GameState.grid[target.row][target.col] = mergedBlock;
    }
  });
}

/* =========================================================
  [Game 14] 중력 처리
  - 각 열에서 아래가 비어 있으면 가장 아래 빈칸으로 떨어짐
========================================================= */
function applyGravity() {
  let didMove = false;

  for (let col = 0; col < GameConfig.cols; col++) {
    const blocks = [];

    for (let row = GameConfig.rows - 1; row >= 0; row--) {
      const block = GameState.grid[row][col];

      if (block) {
        blocks.push(block);
        GameState.grid[row][col] = null;
      }
    }

    let targetRow = GameConfig.rows - 1;

    blocks.forEach(block => {
      if (block.row !== targetRow || block.col !== col) {
        didMove = true;
      }

      block.row = targetRow;
      block.col = col;
      GameState.grid[targetRow][col] = block;
      targetRow--;
    });
  }

  return didMove;
}

function applyGravityWithPending(dropResult, onlyPendingColumns = false) {
  if (!dropResult || !Array.isArray(dropResult.pendingBlocks)) {
    return applyGravity();
  }

  let didMove = false;
  const pendingCols = new Set(
    dropResult.pendingBlocks
      .filter(pendingBlock => !pendingBlock.hasResolved)
      .map(pendingBlock => pendingBlock.col)
  );

  for (let col = 0; col < GameConfig.cols; col++) {
    if (onlyPendingColumns && !pendingCols.has(col)) {
      continue;
    }

    const boardBlocks = [];
    const pendingBlocks = dropResult.pendingBlocks
      .filter(pendingBlock =>
        !pendingBlock.hasResolved &&
        pendingBlock.col === col
      )
      .sort(comparePendingBlocks);

    for (let row = GameConfig.rows - 1; row >= 0; row--) {
      const block = GameState.grid[row][col];

      if (block) {
        boardBlocks.push(block);
        GameState.grid[row][col] = null;
      }
    }

    const stackBlocks = [
      ...boardBlocks.map(block => ({ block, pendingBlock: null })),
      ...pendingBlocks.map(pendingBlock => ({
        block: pendingBlock.block,
        pendingBlock
      }))
    ];

    const boardItems = stackBlocks.slice(0, GameConfig.rows);
    const overflowItems = stackBlocks.slice(GameConfig.rows);
    let targetRow = GameConfig.rows - 1;

    boardItems.forEach(item => {
      const { block, pendingBlock } = item;

      if (block.row !== targetRow || block.col !== col || pendingBlock) {
        didMove = true;
      }

      block.row = targetRow;
      block.col = col;
      GameState.grid[targetRow][col] = block;

      if (pendingBlock) {
        pendingBlock.row = targetRow;
        pendingBlock.isInsideBoard = true;
        pendingBlock.hasResolved = true;
        dropResult.placedBlocks.push(block);
      }

      targetRow--;
    });

    const remainingPendingBlocks = overflowItems
      .filter(item => item.pendingBlock)
      .map(item => item.pendingBlock);

    dropResult.pendingBlocks = dropResult.pendingBlocks.filter(pendingBlock =>
      pendingBlock.col !== col ||
      remainingPendingBlocks.includes(pendingBlock)
    );
  }

  updatePendingVirtualRows(dropResult);

  return didMove;
}

/* =========================================================
  [Game 15] 게임 종료 판정
  - 모든 합성이 완료된 후 호출해야 함
========================================================= */
function isBoardFull() {
  for (let row = 0; row < GameConfig.rows; row++) {
    for (let col = 0; col < GameConfig.cols; col++) {
      if (!GameState.grid[row][col]) {
        return false;
      }
    }
  }

  return true;
}

/* =========================================================
  [Game 16] 최종 게임 종료 조건
  - 두 대기블록 중 하나 이상이 배치 실패로 보드 밖에 남아 있으면 게임오버
  - 배치 실패: 해당 열이 가득 찼으므로 블록을 배치하지 못함
========================================================= */
function shouldEndGameAfterDropResolve(dropResult) {
  return hasUnresolvedPendingBlocks(dropResult);
}
