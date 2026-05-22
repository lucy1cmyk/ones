/* =========================================================
   ui-controller.js

   역할:
   - 화면 전환
   - 팝업 표시 / 숨김
   - 그리드와 숫자블럭 렌더링
   - 로컬 저장소 처리
   - 게임 규칙 계산은 하지 않음
========================================================= */

(function () {
  "use strict";

  /* ============================= */
  /* 로컬 저장소 키 */
  /* ============================= */

  const STORAGE_KEYS = {
    recentScores: "numberPuzzle.recentScores"
  };

  /* ============================= */
  /* UI 컨트롤러 클래스 */
  /* ============================= */

  class NumberPuzzleUI {
    constructor() {
      this.screens = {
        title: document.getElementById("title-screen"),
        puzzle: document.getElementById("puzzle-screen"),
        result: document.getElementById("result-screen")
      };

      this.popups = {
        option: document.getElementById("option-popup"),
        pause: document.getElementById("pause-popup"),
        confirm: document.getElementById("confirm-popup")
      };

      this.elements = {
        waitingGrid: document.getElementById("waiting-grid"),
        boardGrid: document.getElementById("board-grid"),
        currentScore: document.getElementById("current-score"),
        latestScoreButton: document.getElementById("latest-score-button"),
        scoreGraph: document.getElementById("score-graph"),
        confirmMessage: document.getElementById("confirm-message")
      };

      this.confirmCallback = null;

      this.createGridCells();
      this.preventBrowserGestures();
    }

    /* ============================= */
    /* 브라우저 기본 제스처 방지 */
    /* ============================= */

    preventBrowserGestures() {
      /*
        모바일 브라우저 더블탭 확대 방지 보조 처리.
        CSS touch-action: none과 함께 사용.
      */
      let lastTouchEndTime = 0;

      document.addEventListener(
        "touchend",
        (event) => {
          const now = Date.now();

          if (now - lastTouchEndTime <= 300) {
            event.preventDefault();
          }

          lastTouchEndTime = now;
        },
        { passive: false }
      );

      /*
        PC 드래그, 컨텍스트 메뉴 방지.
        개발 중 우클릭이 필요하면 contextmenu 부분만 제거하면 됨.
      */
      document.addEventListener("dragstart", (event) => {
        event.preventDefault();
      });

      document.addEventListener("contextmenu", (event) => {
        event.preventDefault();
      });
    }

    /* ============================= */
    /* 그리드 셀 생성 */
    /* ============================= */

    createGridCells() {
      this.elements.waitingGrid.innerHTML = "";
      this.elements.boardGrid.innerHTML = "";

      for (let i = 0; i < 10; i += 1) {
        const cell = document.createElement("div");
        cell.className = "cell waiting-cell";
        this.elements.waitingGrid.appendChild(cell);
      }

      for (let i = 0; i < 25; i += 1) {
        const cell = document.createElement("div");
        cell.className = "cell board-cell";
        this.elements.boardGrid.appendChild(cell);
      }
    }

    /* ============================= */
    /* 화면 전환 */
    /* ============================= */

    showScreen(screenName) {
      Object.values(this.screens).forEach((screen) => {
        screen.classList.remove("active");
      });

      this.screens[screenName].classList.add("active");
    }

    /* ============================= */
    /* 팝업 열기 / 닫기 */
    /* ============================= */

    showPopup(popupName) {
      this.popups[popupName].classList.remove("hidden");
    }

    hidePopup(popupName) {
      this.popups[popupName].classList.add("hidden");
    }

    hideAllPopups() {
      Object.values(this.popups).forEach((popup) => {
        popup.classList.add("hidden");
      });
    }

    /* ============================= */
    /* 예 / 아니오 팝업 */
    /* ============================= */

    showConfirm(message, callback) {
      this.elements.confirmMessage.textContent = message;
      this.confirmCallback = callback;
      this.showPopup("confirm");
    }

    runConfirm(result) {
      this.hidePopup("confirm");

      if (typeof this.confirmCallback === "function") {
        this.confirmCallback(result);
      }

      this.confirmCallback = null;
    }

    /* ============================= */
    /* 게임 상태 렌더링 */
    /* ============================= */

    renderGameState(state) {
      this.renderScore(state.score);
      this.renderWaitingGrid(state);
      this.renderBoardGrid(state);
    }

    /* ============================= */
    /* 현재 스코어 표시 */
    /* ============================= */

    renderScore(score) {
      this.elements.currentScore.textContent = String(score);
    }

    /* ============================= */
    /* 대기 그리드 렌더링 */
    /* ============================= */

    renderWaitingGrid(state) {
      const cells = Array.from(
        this.elements.waitingGrid.querySelectorAll(".waiting-cell")
      );

      cells.forEach((cell) => {
        cell.innerHTML = "";
      });

      const pending = state.pendingBlocks;

      pending.blocks.forEach((block) => {
        const row = pending.anchorRow + block.dy;
        const col = pending.anchorCol + block.dx;
        const index = row * state.config.waitingCols + col;
        const cell = cells[index];

        if (!cell) {
          return;
        }

        cell.appendChild(this.createBlockElement(block.value, state.colors));
      });

      this.updateBlockFontSizes();
    }

    /* ============================= */
    /* 실제 보드 렌더링 */
    /* ============================= */

    renderBoardGrid(state) {
      const cells = Array.from(
        this.elements.boardGrid.querySelectorAll(".board-cell")
      );

      cells.forEach((cell) => {
        cell.innerHTML = "";
      });

      for (let row = 0; row < state.config.boardRows; row += 1) {
        for (let col = 0; col < state.config.boardCols; col += 1) {
          const value = state.board[row][col];

          if (value === null) {
            continue;
          }

          const index = row * state.config.boardCols + col;
          const cell = cells[index];

          cell.appendChild(this.createBlockElement(value, state.colors));
        }
      }

      this.updateBlockFontSizes();
    }

    /* ============================= */
    /* 숫자블럭 DOM 생성 */
    /* ============================= */

    createBlockElement(value, colors) {
      const block = document.createElement("div");
      const color = colors[value];

      block.className = "number-block";
      block.textContent = String(value);

      block.style.backgroundColor = color.bg;
      block.style.color = color.text;

      return block;
    }

    /* ============================= */
    /* 블럭 숫자 폰트 크기 조정 */
    /* ============================= */

    updateBlockFontSizes() {
      const blocks = document.querySelectorAll(".number-block");

      blocks.forEach((block) => {
        const rect = block.getBoundingClientRect();

        /*
          요구사항:
          - 블럭 내 숫자폰트는 숫자블럭 크기의 60%
        */
        block.style.fontSize = `${rect.width * 0.6}px`;
      });
    }

    /* ============================= */
    /* 최근 스코어 저장 */
    /* ============================= */

    saveRecentScore(score) {
      const scores = this.loadRecentScores();

      scores.unshift(score);

      const latestFiveScores = scores.slice(0, 5);

      localStorage.setItem(
        STORAGE_KEYS.recentScores,
        JSON.stringify(latestFiveScores)
      );

      return latestFiveScores;
    }

    /* ============================= */
    /* 최근 스코어 불러오기 */
    /* ============================= */

    loadRecentScores() {
      const rawData = localStorage.getItem(STORAGE_KEYS.recentScores);

      if (!rawData) {
        return [];
      }

      try {
        const parsed = JSON.parse(rawData);

        if (!Array.isArray(parsed)) {
          return [];
        }

        return parsed
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value));
      } catch {
        return [];
      }
    }

    /* ============================= */
    /* 결과 화면 렌더링 */
    /* ============================= */

    renderResultScreen(latestScore) {
      const recentScores = this.saveRecentScore(latestScore);

      this.elements.latestScoreButton.textContent = String(latestScore);
      this.renderScoreGraph(recentScores);
    }

    /* ============================= */
    /* 최근 5회 스코어 그래프 */
    /* ============================= */

    renderScoreGraph(scores) {
      this.elements.scoreGraph.innerHTML = "";

      const maxScore = Math.max(...scores, 1);

      /*
        최신 스코어가 왼쪽에 오도록 표시.
      */
      scores.forEach((score, index) => {
        const wrap = document.createElement("div");
        wrap.className = "graph-bar-wrap";

        const scoreLabel = document.createElement("div");
        scoreLabel.className = "graph-score";
        scoreLabel.textContent = String(score);

        const bar = document.createElement("div");
        bar.className = "graph-bar";
        bar.style.height = `${Math.max(4, (score / maxScore) * 78)}%`;

        const indexLabel = document.createElement("div");
        indexLabel.className = "graph-index";
        indexLabel.textContent = index === 0 ? "최신" : `-${index}`;

        wrap.appendChild(scoreLabel);
        wrap.appendChild(bar);
        wrap.appendChild(indexLabel);

        this.elements.scoreGraph.appendChild(wrap);
      });

      /*
        저장된 점수가 5개 미만이어도 5칸 기준 시각 구조 유지.
      */
      for (let i = scores.length; i < 5; i += 1) {
        const wrap = document.createElement("div");
        wrap.className = "graph-bar-wrap";

        const scoreLabel = document.createElement("div");
        scoreLabel.className = "graph-score";
        scoreLabel.textContent = "-";

        const bar = document.createElement("div");
        bar.className = "graph-bar";
        bar.style.height = "2px";
        bar.style.opacity = "0.25";

        const indexLabel = document.createElement("div");
        indexLabel.className = "graph-index";
        indexLabel.textContent = "-";

        wrap.appendChild(scoreLabel);
        wrap.appendChild(bar);
        wrap.appendChild(indexLabel);

        this.elements.scoreGraph.appendChild(wrap);
      }
    }
  }

  /* ============================= */
  /* 전역 노출 */
  /* ============================= */

  window.NumberPuzzleUI = NumberPuzzleUI;
})();