/* =========================================================
   game-core.js

   역할:
   - 순수 게임 플레이 로직 담당
   - DOM, HTML, CSS에 직접 접근하지 않음
   - 유니티 포팅 시 이 파일의 구조를 C# 클래스로 옮기기 쉬움
   - Firebase / Firestore와 직접 연결하지 않음
========================================================= */

(function () {
  "use strict";

  /* ============================= */
  /* 게임 상수 */
  /* ============================= */

  const GAME_CONFIG = {
    boardCols: 5,
    boardRows: 5,
    waitingCols: 5,
    waitingRows: 2,
    minBlockValue: 1,
    maxBlockValue: 15,
    mergeCount: 3
  };

  /* ============================= */
  /* 숫자블럭 색상 정의 */
  /* ============================= */

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

  /* ============================= */
  /* 유틸리티 */
  /* ============================= */

  function createEmptyBoard() {
    const board = [];

    for (let row = 0; row < GAME_CONFIG.boardRows; row += 1) {
      const line = [];

      for (let col = 0; col < GAME_CONFIG.boardCols; col += 1) {
        line.push(null);
      }

      board.push(line);
    }

    return board;
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function cloneBoard(board) {
    return board.map((row) => row.slice());
  }

  /* ============================= */
  /* 게임 코어 클래스 */
  /* ============================= */

  class NumberPuzzleCore {
    constructor() {
      this.reset();
    }

    /* ============================= */
    /* 게임 초기화 */
    /* ============================= */

    reset() {
      this.board = createEmptyBoard();
      this.score = 0;
      this.isGameOver = false;
      this.pendingBlocks = this.createPendingBlocks();

      return this.getState();
    }

    /* ============================= */
    /* 현재 상태 반환 */
    /* ============================= */

    getState() {
      return {
        board: cloneBoard(this.board),
        score: this.score,
        isGameOver: this.isGameOver,
        pendingBlocks: JSON.parse(JSON.stringify(this.pendingBlocks)),
        config: { ...GAME_CONFIG },
        colors: JSON.parse(JSON.stringify(BLOCK_COLORS))
      };
    }

    /* ============================= */
    /* 보드에서 가장 높은 숫자 찾기 */
    /* ============================= */

    getHighestBlockValueOnBoard() {
      let highest = GAME_CONFIG.minBlockValue;

      for (let row = 0; row < GAME_CONFIG.boardRows; row += 1) {
        for (let col = 0; col < GAME_CONFIG.boardCols; col += 1) {
          const value = this.board[row][col];

          if (value !== null) {
            highest = Math.max(highest, value);
          }
        }
      }

      return highest;
    }

    /* ============================= */
    /* 대기 숫자블럭 생성 */
    /* ============================= */

    createPendingBlocks() {
      const highest = this.getHighestBlockValueOnBoard();

      /*
        최대 생성 숫자:
        - 보드 내 최고 숫자보다 2단계 낮은 숫자
        - 단, 최소값 1보다 낮아지지 않게 보정
        - 숫자블럭 종류는 1~15까지만 사용
      */
      const maxSpawnValue = Math.max(
        GAME_CONFIG.minBlockValue,
        Math.min(GAME_CONFIG.maxBlockValue, highest - 2)
      );

      const valueA = randomInt(GAME_CONFIG.minBlockValue, maxSpawnValue);
      const valueB = randomInt(GAME_CONFIG.minBlockValue, maxSpawnValue);

      /*
        orientation:
        0 = 좌우 배치
        1 = 상하 배치
      */
      const orientation = randomInt(0, 1);

      if (orientation === 0) {
        return {
          anchorCol: 2,
          anchorRow: 0,
          orientation: 0,
          blocks: [
            { id: crypto.randomUUID(), value: valueA, dx: 0, dy: 0 },
            { id: crypto.randomUUID(), value: valueB, dx: 1, dy: 0 }
          ]
        };
      }

      return {
        anchorCol: 2,
        anchorRow: 0,
        orientation: 1,
        blocks: [
          { id: crypto.randomUUID(), value: valueA, dx: 0, dy: 0 },
          { id: crypto.randomUUID(), value: valueB, dx: 0, dy: 1 }
        ]
      };
    }

    /* ============================= */
    /* 대기블럭의 실제 대기그리드 좌표 */
    /* ============================= */

    getPendingCells() {
      return this.pendingBlocks.blocks.map((block) => ({
        id: block.id,
        value: block.value,
        col: this.pendingBlocks.anchorCol + block.dx,
        row: this.pendingBlocks.anchorRow + block.dy
      }));
    }

    /* ============================= */
    /* 대기블럭 좌우 이동 */
    /* ============================= */

    movePending(direction) {
      const cells = this.getPendingCells();
      const minCol = Math.min(...cells.map((cell) => cell.col));
      const maxCol = Math.max(...cells.map((cell) => cell.col));

      if (direction < 0 && minCol <= 0) {
        return this.getState();
      }

      if (direction > 0 && maxCol >= GAME_CONFIG.waitingCols - 1) {
        return this.getState();
      }

      this.pendingBlocks.anchorCol += direction;

      return this.getState();
    }

    /* ============================= */
    /* 대기블럭 회전 */
    /* ============================= */

    rotatePending() {
      const oldBlocks = this.pendingBlocks.blocks;

      /*
        회전 방식:
        - 좌우 배치 → 상하 배치
        - 상하 배치 → 좌우 배치
        - 두 블럭의 숫자와 id는 유지
      */
      const nextOrientation = this.pendingBlocks.orientation === 0 ? 1 : 0;

      if (nextOrientation === 0) {
        this.pendingBlocks.blocks = [
          { ...oldBlocks[0], dx: 0, dy: 0 },
          { ...oldBlocks[1], dx: 1, dy: 0 }
        ];
      } else {
        this.pendingBlocks.blocks = [
          { ...oldBlocks[0], dx: 0, dy: 0 },
          { ...oldBlocks[1], dx: 0, dy: 1 }
        ];
      }

      this.pendingBlocks.orientation = nextOrientation;

      this.clampPendingInsideWaitingGrid();

      return this.getState();
    }

    /* ============================= */
    /* 회전 후 대기그리드 밖으로 나가지 않게 보정 */
    /* ============================= */

    clampPendingInsideWaitingGrid() {
      const cells = this.getPendingCells();

      const minCol = Math.min(...cells.map((cell) => cell.col));
      const maxCol = Math.max(...cells.map((cell) => cell.col));
      const minRow = Math.min(...cells.map((cell) => cell.row));
      const maxRow = Math.max(...cells.map((cell) => cell.row));

      if (minCol < 0) {
        this.pendingBlocks.anchorCol += Math.abs(minCol);
      }

      if (maxCol >= GAME_CONFIG.waitingCols) {
        this.pendingBlocks.anchorCol -= maxCol - GAME_CONFIG.waitingCols + 1;
      }

      if (minRow < 0) {
        this.pendingBlocks.anchorRow += Math.abs(minRow);
      }

      if (maxRow >= GAME_CONFIG.waitingRows) {
        this.pendingBlocks.anchorRow -= maxRow - GAME_CONFIG.waitingRows + 1;
      }
    }

    /* ============================= */
    /* 선택 열에 대기블럭 배치 */
    /* ============================= */

    placePendingBlocks() {
      const pendingCells = this.getPendingCells();

      /*
        같은 열에 두 블럭이 있을 수 있으므로 열별로 묶는다.
        아래쪽에 있던 대기블럭이 먼저 아래 칸으로 들어가도록 dy 기준 정렬한다.
      */
      const cellsByColumn = new Map();

      pendingCells.forEach((cell) => {
        if (!cellsByColumn.has(cell.col)) {
          cellsByColumn.set(cell.col, []);
        }

        cellsByColumn.get(cell.col).push(cell);
      });

      let hasOutsideBlock = false;

      cellsByColumn.forEach((cells, col) => {
        cells.sort((a, b) => b.row - a.row);

        cells.forEach((cell) => {
          const targetRow = this.findLowestEmptyRow(col);

          if (targetRow === -1) {
            /*
              빈 공간 부족.
              해당 블럭은 보드 위쪽 바깥에 남은 것으로 판정한다.
            */
            hasOutsideBlock = true;
            return;
          }

          this.board[targetRow][col] = cell.value;
        });
      });

      return {
        hasOutsideBlock,
        state: this.getState()
      };
    }

    /* ============================= */
    /* 특정 열의 가장 아래 빈칸 찾기 */
    /* ============================= */

    findLowestEmptyRow(col) {
      for (let row = GAME_CONFIG.boardRows - 1; row >= 0; row -= 1) {
        if (this.board[row][col] === null) {
          return row;
        }
      }

      return -1;
    }

    /* ============================= */
    /* 중력 적용 */
    /* ============================= */

    applyGravity() {
      for (let col = 0; col < GAME_CONFIG.boardCols; col += 1) {
        const values = [];

        /*
          아래에서 위로 읽어 실제 블럭만 수집
        */
        for (let row = GAME_CONFIG.boardRows - 1; row >= 0; row -= 1) {
          if (this.board[row][col] !== null) {
            values.push(this.board[row][col]);
          }
        }

        /*
          해당 열 초기화
        */
        for (let row = 0; row < GAME_CONFIG.boardRows; row += 1) {
          this.board[row][col] = null;
        }

        /*
          수집한 블럭을 가장 아래부터 다시 배치
        */
        for (let i = 0; i < values.length; i += 1) {
          const targetRow = GAME_CONFIG.boardRows - 1 - i;
          this.board[targetRow][col] = values[i];
        }
      }

      return this.getState();
    }

    /* ============================= */
    /* 합성 가능한 그룹 찾기 */
    /* ============================= */

    findMergeGroups() {
      const visited = Array.from(
        { length: GAME_CONFIG.boardRows },
        () => Array(GAME_CONFIG.boardCols).fill(false)
      );

      const groups = [];

      for (let row = 0; row < GAME_CONFIG.boardRows; row += 1) {
        for (let col = 0; col < GAME_CONFIG.boardCols; col += 1) {
          const value = this.board[row][col];

          if (value === null || visited[row][col]) {
            continue;
          }

          const group = this.collectConnectedGroup(row, col, value, visited);

          if (group.length >= GAME_CONFIG.mergeCount) {
            groups.push({
              value,
              cells: group
            });
          }
        }
      }

      return groups;
    }

    /* ============================= */
    /* 같은 숫자의 상하좌우 연결 그룹 수집 */
    /* ============================= */

    collectConnectedGroup(startRow, startCol, value, visited) {
      const stack = [{ row: startRow, col: startCol }];
      const group = [];

      visited[startRow][startCol] = true;

      while (stack.length > 0) {
        const current = stack.pop();
        group.push(current);

        const directions = [
          { row: -1, col: 0 },
          { row: 1, col: 0 },
          { row: 0, col: -1 },
          { row: 0, col: 1 }
        ];

        directions.forEach((dir) => {
          const nextRow = current.row + dir.row;
          const nextCol = current.col + dir.col;

          if (!this.isInsideBoard(nextRow, nextCol)) {
            return;
          }

          if (visited[nextRow][nextCol]) {
            return;
          }

          if (this.board[nextRow][nextCol] !== value) {
            return;
          }

          visited[nextRow][nextCol] = true;
          stack.push({ row: nextRow, col: nextCol });
        });
      }

      return group;
    }

    /* ============================= */
    /* 보드 범위 확인 */
    /* ============================= */

    isInsideBoard(row, col) {
      return (
        row >= 0 &&
        row < GAME_CONFIG.boardRows &&
        col >= 0 &&
        col < GAME_CONFIG.boardCols
      );
    }

    /* ============================= */
    /* 합성 결과 생성 위치 찾기 */
    /* ============================= */

    getMergeTargetCell(cells) {
      /*
        규칙:
        - 합성된 숫자블럭 중 가장 아래 행
        - 그 행에서 가장 왼쪽 칸
      */
      const maxRow = Math.max(...cells.map((cell) => cell.row));

      const bottomCells = cells.filter((cell) => cell.row === maxRow);
      const minCol = Math.min(...bottomCells.map((cell) => cell.col));

      return {
        row: maxRow,
        col: minCol
      };
    }

    /* ============================= */
    /* 합성 1회 실행 */
    /* ============================= */

    executeMergeOnce() {
      const groups = this.findMergeGroups();

      if (groups.length === 0) {
        return {
          merged: false,
          state: this.getState()
        };
      }

      /*
        여러 그룹을 동시에 합성한다.
        서로 다른 연결 그룹이므로 기본적으로 겹치지 않는다.
      */
      groups.forEach((group) => {
        const target = this.getMergeTargetCell(group.cells);

        group.cells.forEach((cell) => {
          this.board[cell.row][cell.col] = null;
        });

        const nextValue = Math.min(
          GAME_CONFIG.maxBlockValue,
          group.value + 1
        );

        this.board[target.row][target.col] = nextValue;

        /*
          점수 계산:
          - 합성된 원래 숫자 × 합성 개수 × 10
          - 필요하면 이 공식만 바꾸면 됨
        */
        this.score += group.value * group.cells.length * 10;
      });

      return {
        merged: true,
        state: this.getState()
      };
    }

    /* ============================= */
    /* 한 턴 전체 처리 */
    /* ============================= */

    resolveTurn() {
      /*
        처리 순서:
        1. 대기블럭 배치
        2. 중력 적용
        3. 합성 가능 검사
        4. 합성 / 중력 반복
        5. 턴 시작 시 보드 밖에 남은 블럭 여부 확인
        6. 게임오버 또는 새 대기블럭 생성
      */

      const placement = this.placePendingBlocks();

      this.applyGravity();

      let mergeResult = this.executeMergeOnce();

      while (mergeResult.merged) {
        this.applyGravity();
        mergeResult = this.executeMergeOnce();
      }

      this.applyGravity();

      if (placement.hasOutsideBlock) {
        this.isGameOver = true;

        return {
          isGameOver: true,
          state: this.getState()
        };
      }

      this.pendingBlocks = this.createPendingBlocks();

      return {
        isGameOver: false,
        state: this.getState()
      };
    }
  }

  /* ============================= */
  /* 전역 노출 */
  /* ============================= */

  window.NumberPuzzleCore = NumberPuzzleCore;
  window.NumberPuzzleConfig = GAME_CONFIG;
  window.NumberPuzzleBlockColors = BLOCK_COLORS;
})();