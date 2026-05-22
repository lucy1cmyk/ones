/* =========================================================
   app.js

   역할:
   - game-core와 ui-controller 연결
   - 입력 처리
   - 화면 흐름 처리
   - Firebase 설치 가능성을 위한 분리 지점 제공
========================================================= */

(function () {
  "use strict";

  /* ============================= */
  /* 앱 상태 */
  /* ============================= */

  const game = new window.NumberPuzzleCore();
  const ui = new window.NumberPuzzleUI();

  const appState = {
    currentScreen: "title",
    isInputLocked: false,
    touchStartX: 0,
    touchStartY: 0,
    touchStartTime: 0
  };

  /* ============================= */
  /* Firebase 확장 예정 지점 */
  /* ============================= */

  const firebaseBridge = {
    /*
      추후 Firebase Auth 연동 시 이곳에 로그인 상태를 저장.
      현재는 오프라인 플레이가 가능하도록 null 유지.
    */
    currentUser: null,

    /*
      추후 Firestore 저장을 사용하려면
      localStorage 저장과 별도로 이 함수에서 서버 저장을 호출하면 됨.
    */
    saveScoreToFirestore(score) {
      console.log("Firestore 저장 예정 점수:", score);
    }
  };

  /* ============================= */
  /* 초기 실행 */
  /* ============================= */

  function initApp() {
    bindButtons();
    bindKeyboardInput();
    bindTouchInput();

    ui.showScreen("title");
    ui.renderGameState(game.getState());
  }

  /* ============================= */
  /* 버튼 이벤트 연결 */
  /* ============================= */

  function bindButtons() {
    /* 타이틀 화면 */
    document.getElementById("start-button").addEventListener("click", () => {
      startNewGame();
    });

    document.getElementById("option-button").addEventListener("click", () => {
      ui.showPopup("option");
    });

    document.getElementById("option-close-button").addEventListener("click", () => {
      ui.hidePopup("option");
    });

    /* 퍼즐 화면 */
    document.getElementById("pause-button").addEventListener("click", () => {
      if (appState.currentScreen !== "puzzle") {
        return;
      }

      ui.showPopup("pause");
    });

    document.getElementById("restart-button").addEventListener("click", () => {
      askRestart();
    });

    /* 일시정지 팝업 */
    document.getElementById("pause-restart-button").addEventListener("click", () => {
      askRestart();
    });

    document.getElementById("continue-button").addEventListener("click", () => {
      ui.hidePopup("pause");
    });

    document.getElementById("pause-title-button").addEventListener("click", () => {
      goToTitle();
    });

    /* 게임 결과 화면 */
    document.getElementById("latest-score-button").addEventListener("click", () => {
      askRestart();
    });

    document.getElementById("result-restart-button").addEventListener("click", () => {
      askRestart();
    });

    document.getElementById("result-title-button").addEventListener("click", () => {
      goToTitle();
    });

    /* 공용 예 / 아니오 팝업 */
    document.getElementById("confirm-yes-button").addEventListener("click", () => {
      ui.runConfirm(true);
    });

    document.getElementById("confirm-no-button").addEventListener("click", () => {
      ui.runConfirm(false);
    });
  }

  /* ============================= */
  /* 새 게임 시작 */
  /* ============================= */

  function startNewGame() {
    game.reset();

    appState.currentScreen = "puzzle";
    appState.isInputLocked = false;

    ui.hideAllPopups();
    ui.showScreen("puzzle");
    ui.renderGameState(game.getState());
  }

  /* ============================= */
  /* 타이틀로 이동 */
  /* ============================= */

  function goToTitle() {
    appState.currentScreen = "title";
    appState.isInputLocked = false;

    ui.hideAllPopups();
    ui.showScreen("title");
  }

  /* ============================= */
  /* 결과 화면으로 이동 */
  /* ============================= */

  function goToResult() {
    const latestScore = game.getState().score;

    /*
      로컬 저장은 ui-controller에서 처리.
      Firestore 연동 시에는 아래 함수도 실제 구현하면 됨.
    */
    firebaseBridge.saveScoreToFirestore(latestScore);

    appState.currentScreen = "result";
    appState.isInputLocked = false;

    ui.hideAllPopups();
    ui.renderResultScreen(latestScore);
    ui.showScreen("result");
  }

  /* ============================= */
  /* 다시 시작 확인 */
  /* ============================= */

  function askRestart() {
    ui.showConfirm("다시 시작하시겠습니까?", (yes) => {
      if (!yes) {
        return;
      }

      startNewGame();
    });
  }

  /* ============================= */
  /* 게임오버 확인 */
  /* ============================= */

  function askGameOverResult() {
    ui.showConfirm("결과화면으로 이동하겠습니까?", (yes) => {
      if (yes) {
        goToResult();
        return;
      }

      /*
        요구사항:
        - 아니오 선택 시 팝업 종료 후 게임 초기화
      */
      startNewGame();
    });
  }

  /* ============================= */
  /* 키보드 입력 */
  /* ============================= */

  function bindKeyboardInput() {
    window.addEventListener("keydown", (event) => {
      if (appState.currentScreen !== "puzzle") {
        return;
      }

      if (appState.isInputLocked) {
        return;
      }

      /*
        방향키 사용 시 브라우저 기본 스크롤 방지
      */
      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        event.preventDefault();
      }

      if (event.key === "ArrowUp") {
        rotatePending();
      }

      if (event.key === "ArrowLeft") {
        movePending(-1);
      }

      if (event.key === "ArrowRight") {
        movePending(1);
      }

      if (event.key === "ArrowDown") {
        dropPending();
      }
    });
  }

  /* ============================= */
  /* 터치 입력 */
  /* ============================= */

  function bindTouchInput() {
    const puzzleScreen = document.getElementById("puzzle-screen");

    puzzleScreen.addEventListener(
      "touchstart",
      (event) => {
        if (appState.currentScreen !== "puzzle") {
          return;
        }

        const touch = event.touches[0];

        appState.touchStartX = touch.clientX;
        appState.touchStartY = touch.clientY;
        appState.touchStartTime = Date.now();
      },
      { passive: false }
    );

    puzzleScreen.addEventListener(
      "touchend",
      (event) => {
        if (appState.currentScreen !== "puzzle") {
          return;
        }

        if (appState.isInputLocked) {
          return;
        }

        const touch = event.changedTouches[0];

        const dx = touch.clientX - appState.touchStartX;
        const dy = touch.clientY - appState.touchStartY;
        const elapsed = Date.now() - appState.touchStartTime;

        const distanceX = Math.abs(dx);
        const distanceY = Math.abs(dy);

        /*
          스와이프 기준값.
          너무 작으면 탭으로 처리.
        */
        const swipeThreshold = 35;

        if (distanceX < swipeThreshold && distanceY < swipeThreshold && elapsed < 400) {
          rotatePending();
          return;
        }

        if (distanceX > distanceY) {
          if (dx > 0) {
            movePending(1);
          } else {
            movePending(-1);
          }

          return;
        }

        if (dy > 0) {
          dropPending();
        }
      },
      { passive: false }
    );
  }

  /* ============================= */
  /* 대기블럭 회전 */
  /* ============================= */

  function rotatePending() {
    game.rotatePending();
    ui.renderGameState(game.getState());
  }

  /* ============================= */
  /* 대기블럭 이동 */
  /* ============================= */

  function movePending(direction) {
    game.movePending(direction);
    ui.renderGameState(game.getState());
  }

  /* ============================= */
  /* 대기블럭 낙하 */
  /* ============================= */

  function dropPending() {
    if (appState.isInputLocked) {
      return;
    }

    appState.isInputLocked = true;

    /*
      현재 버전은 빠른 낙하 애니메이션을 단순 렌더링으로 표현.
      이후 각 블럭 이동 경로를 반환하도록 game-core를 확장하면
      CSS transform 애니메이션을 더 정확히 붙일 수 있음.
    */
    const result = game.resolveTurn();

    ui.renderGameState(result.state);

    window.setTimeout(() => {
      appState.isInputLocked = false;

      if (result.isGameOver) {
        askGameOverResult();
      }
    }, 120);
  }

  /* ============================= */
  /* 화면 크기 변경 시 폰트 비율 보정 */
  /* ============================= */

  window.addEventListener("resize", () => {
    ui.renderGameState(game.getState());
  });

  /* ============================= */
  /* 앱 시작 */
  /* ============================= */

  initApp();
})();