/* =========================================================
  [Local Storage Adapter JS]
  - Offline-first score storage
  - Saves only the latest 5 completed play scores on this device
========================================================= */

const FirebaseAdapter = {
  storageKey: "ones.recentScores",
  maxRecentScores: 5,

  init() {
    this.ensureStorageAvailable();
  },

  async signInWithGoogle() {
    return {
      uid: "local-player",
      displayName: "Local Player",
      email: null
    };
  },

  getCurrentUser() {
    return {
      uid: "local-player",
      displayName: "Local Player",
      email: null
    };
  },

  async saveScore(score) {
    const normalizedScore = Number(score) || 0;
    const recentScores = this.readScores();

    const scoreRecord = {
      score: normalizedScore,
      playedAt: new Date().toISOString()
    };

    const nextScores = [scoreRecord, ...recentScores]
      .slice(0, this.maxRecentScores);

    this.writeScores(nextScores);

    return {
      success: true,
      score: normalizedScore,
      recentScores: nextScores
    };
  },

  async loadRecentScores() {
    return this.readScores();
  },

  async loadHighScore() {
    const recentScores = this.readScores();

    if (recentScores.length === 0) {
      return 0;
    }

    return Math.max(...recentScores.map(record => record.score));
  },

  ensureStorageAvailable() {
    try {
      const testKey = `${this.storageKey}.test`;

      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
    } catch (error) {
      console.warn("Local score storage is unavailable.", error);
    }
  },

  readScores() {
    try {
      const rawScores = window.localStorage.getItem(this.storageKey);

      if (!rawScores) {
        return [];
      }

      const parsedScores = JSON.parse(rawScores);

      if (!Array.isArray(parsedScores)) {
        return [];
      }

      return parsedScores
        .map(record => ({
          score: Number(record.score) || 0,
          playedAt: typeof record.playedAt === "string"
            ? record.playedAt
            : new Date().toISOString()
        }))
        .slice(0, this.maxRecentScores);
    } catch (error) {
      console.warn("Failed to load local scores.", error);
      return [];
    }
  },

  writeScores(scores) {
    try {
      window.localStorage.setItem(
        this.storageKey,
        JSON.stringify(scores.slice(0, this.maxRecentScores))
      );
    } catch (error) {
      console.warn("Failed to save local scores.", error);
    }
  }
};
