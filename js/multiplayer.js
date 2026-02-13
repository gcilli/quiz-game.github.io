// Multiplayer Quiz Game Logic
// Handles room creation, joining, real-time synchronization, and scoring

class MultiplayerQuiz {
  constructor() {
    this.database = null;
    this.roomCode = null;
    this.playerId = null;
    this.playerName = null;
    this.isHost = false;
    this.roomRef = null;
    this.listeners = [];

    // Game state
    this.players = {};
    this.currentQuestionIndex = 0;
    this.questions = [];
    this.scores = {};
    this.gameStarted = false;
    this.questionStartTime = null;
    this.hasAnswered = false;

    // Configuration
    this.maxPlayers = 10;
    this.minPlayers = 2;
    this.timerDuration = 30; // Default timer
    this.scoringSystem = 'standard'; // Default scoring system: 'standard' or 'exam'
    
    // Standard scoring system
    this.basePoints = 100;
    this.speedBonusMax = 50;
    this.wrongPenalty = 25;
  }

  // Generate a 6-character room code
  generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Generate a unique player ID
  generatePlayerId() {
    return 'player_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  }

  // Initialize multiplayer (call after Firebase is ready)
  init() {
    this.database = firebase.database();
    this.playerId = this.generatePlayerId();
  }

  // Create a new room
  async createRoom(playerName, numQuestions, timer, scoringSystem = 'standard') {
    try {
      this.roomCode = this.generateRoomCode();
      this.playerName = playerName;
      this.isHost = true;
      this.hostId = this.playerId;
      this.timerDuration = timer;
      this.scoringSystem = scoringSystem;

      // Select random questions
      this.questions = this.selectRandomQuestions(numQuestions);

      const roomData = {
        code: this.roomCode,
        host: this.playerId,
        hostName: playerName,
        created: firebase.database.ServerValue.TIMESTAMP,
        gameStarted: false,
        currentQuestion: 0,
        numQuestions: numQuestions,
        timer: timer,
        scoringSystem: scoringSystem,
        questionsVersion: 0, // Track when questions change
        players: {
          [this.playerId]: {
            name: playerName,
            joined: firebase.database.ServerValue.TIMESTAMP,
            ready: true
          }
        },
        scores: {
          [this.playerId]: 0
        },
        questions: this.questions
      };

      this.roomRef = this.database.ref('rooms/' + this.roomCode);
      await this.roomRef.set(roomData);

      this.setupListeners();
      return this.roomCode;
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  }

  // Join an existing room
  async joinRoom(roomCode, playerName) {
    try {
      this.roomCode = roomCode.toUpperCase();
      this.playerName = playerName;
      this.roomRef = this.database.ref('rooms/' + this.roomCode);

      // Check if room exists
      const snapshot = await this.roomRef.once('value');
      if (!snapshot.exists()) {
        throw new Error('Stanza non trovata');
      }

      const roomData = snapshot.val();

      // Store host ID
      this.hostId = roomData.host;

      // Check if game already started
      if (roomData.gameStarted) {
        throw new Error('La partita è già iniziata');
      }

      // Check if room is full
      const playerCount = Object.keys(roomData.players || {}).length;
      if (playerCount >= this.maxPlayers) {
        throw new Error('Stanza piena');
      }

      // Add player to room
      await this.roomRef.child('players/' + this.playerId).set({
        name: playerName,
        joined: firebase.database.ServerValue.TIMESTAMP,
        ready: false
      });

      await this.roomRef.child('scores/' + this.playerId).set(0);

      this.questions = roomData.questions;
      this.timerDuration = roomData.timer;
      this.numQuestions = roomData.numQuestions; // Store the configured number
      this.scoringSystem = roomData.scoringSystem || 'standard'; // Load scoring system (default to standard for backwards compatibility)
      this.setupListeners();

      return true;
    } catch (error) {
      console.error('Error joining room:', error);
      throw error;
    }
  }

  // Setup real-time listeners
  setupListeners() {
    // Listen for player changes
    const playersRef = this.roomRef.child('players');
    const playersListener = playersRef.on('value', (snapshot) => {
      this.players = snapshot.val() || {};
      if (window.updatePlayersList) {
        window.updatePlayersList(this.players);
      }
    });
    this.listeners.push({ ref: playersRef, event: 'value', callback: playersListener });

    // Listen for numQuestions changes (lightweight - only a number, not full array)
    const numQuestionsRef = this.roomRef.child('numQuestions');
    const numQuestionsListener = numQuestionsRef.on('value', (snapshot) => {
      const count = snapshot.val();
      if (count && window.updateQuestionCount) {
        window.updateQuestionCount(count);
      }
    });
    this.listeners.push({ ref: numQuestionsRef, event: 'value', callback: numQuestionsListener });

    // Listen for questions version changes (triggers reload only when needed)
    const questionsVersionRef = this.roomRef.child('questionsVersion');
    const questionsVersionListener = questionsVersionRef.on('value', (snapshot) => {
      const version = snapshot.val();
      // Only reload if we're not the host (host already has the new questions)
      if (version !== null && version > 0 && !this.isHost) {
        this.fetchQuestions();
      }
    });
    this.listeners.push({ ref: questionsVersionRef, event: 'value', callback: questionsVersionListener });

    // Listen for game start
    const gameStartedRef = this.roomRef.child('gameStarted');
    const gameStartedListener = gameStartedRef.on('value', (snapshot) => {
      const started = snapshot.val();
      if (started && !this.gameStarted) {
        this.gameStarted = true;
        if (window.onGameStart) {
          window.onGameStart();
        }
      } else if (!started && this.gameStarted) {
        // Game was restarted
        this.gameStarted = false;
        if (window.onGameRestart) {
          window.onGameRestart();
        }
      }
    });
    this.listeners.push({ ref: gameStartedRef, event: 'value', callback: gameStartedListener });

    // Listen for current question changes
    const questionRef = this.roomRef.child('currentQuestion');
    const questionListener = questionRef.on('value', (snapshot) => {
      const questionIndex = snapshot.val();
      if (questionIndex !== null && questionIndex !== this.currentQuestionIndex) {
        this.currentQuestionIndex = questionIndex;
        this.hasAnswered = false;
        // Set up listener for answers to this question
        this.setupAnswersListener(questionIndex);
        // Don't set questionStartTime here - we'll get it from Firebase when answering
        if (window.onNewQuestion) {
          window.onNewQuestion(this.questions[questionIndex], questionIndex);
        }
      }
    });
    this.listeners.push({ ref: questionRef, event: 'value', callback: questionListener });

    // Listen for scores
    const scoresRef = this.roomRef.child('scores');
    const scoresListener = scoresRef.on('value', (snapshot) => {
      this.scores = snapshot.val() || {};
      if (window.updateScores) {
        window.updateScores(this.scores);
      }
    });
    this.listeners.push({ ref: scoresRef, event: 'value', callback: scoresListener });

    // Listen for answers - will be set up when question changes
    this.answersListener = null;
    this.answersRef = null;

    // Listen for game end
    const gameEndedRef = this.roomRef.child('gameEnded');
    const gameEndedListener = gameEndedRef.on('value', (snapshot) => {
      const ended = snapshot.val();
      if (ended && window.onGameEnd) {
        window.onGameEnd();
      }
    });
    this.listeners.push({ ref: gameEndedRef, event: 'value', callback: gameEndedListener });
  }

  // Set up listener for answers to a specific question
  setupAnswersListener(questionIndex) {
    // Remove previous answers listener if exists
    if (this.answersRef && this.answersListener) {
      this.answersRef.off('value', this.answersListener);
    }

    // Set up new listener for this question's answers
    this.answersRef = this.roomRef.child('answers/' + questionIndex);
    this.answersListener = this.answersRef.on('value', (snapshot) => {
      const answers = snapshot.val() || {};
      console.log('Answers for question', questionIndex, ':', answers);
      if (window.updateAnswersStatus) {
        window.updateAnswersStatus(answers);
      }
    });
  }

  // Clean up listeners
  cleanup() {
    this.listeners.forEach(({ ref, event, callback }) => {
      ref.off(event, callback);
    });
    this.listeners = [];

    // Remove answers listener
    if (this.answersRef && this.answersListener) {
      this.answersRef.off('value', this.answersListener);
    }

    // Remove player from room if not game ended
    if (this.roomRef && this.playerId) {
      this.roomRef.child('players/' + this.playerId).remove();
    }
  }

  // Start the game (host only)
  async startGame() {
    if (!this.isHost) {
      throw new Error('Solo l\'host può avviare la partita');
    }

    const playerCount = Object.keys(this.players).length;
    if (playerCount < this.minPlayers) {
      throw new Error(`Servono almeno ${this.minPlayers} giocatori per iniziare`);
    }

    await this.roomRef.update({
      gameStarted: true,
      currentQuestion: 0,
      gameStartTime: firebase.database.ServerValue.TIMESTAMP,
      questionStartTime: firebase.database.ServerValue.TIMESTAMP
    });
  }

  // Helper function to calculate and update score
  async calculateAndUpdateScore(answerRef, isCorrect, timeElapsed, isNoAnswer = false) {
    // Calculate score based on scoring system
    let points = 0;

    if (this.scoringSystem === 'exam') {
      // Exam scoring system: +1 for correct, -0.17 for wrong, 0 for no answer
      if (isNoAnswer) {
        points = 0; // No answer = 0 points
      } else if (isCorrect) {
        points = 1;
      } else {
        // Use fraction to avoid floating point issues: -17/100 = -0.17
        points = Math.round(-17 / 100 * 100) / 100; // -0.17 exactly
      }
    } else {
      // Standard scoring system: base points + speed bonus
      // Speed ratio from 0.1 (slowest) to 1.0 (fastest) - always has some impact
      const speedRatio = Math.max(0.1, 1 - (timeElapsed / this.timerDuration));

      if (isCorrect) {
        // Base points + speed bonus (more points for faster correct answers)
        const speedBonus = Math.floor(this.speedBonusMax * speedRatio);
        points = this.basePoints + speedBonus;
      } else {
        // Penalty for wrong answer, increased for faster wrong answers
        // Fast wrong answers get bigger penalty (up to 3x the base penalty)
        const speedPenaltyMultiplier = 1 + (speedRatio * 2); // 1.2x to 3x penalty
        points = -Math.floor(this.wrongPenalty * speedPenaltyMultiplier);
      }
    }

    // Update the answer with time and points
    await answerRef.update({
      time: timeElapsed,
      points: points
    });

    // Update score
    const currentScore = this.scores[this.playerId] || 0;
    await this.roomRef.child('scores/' + this.playerId).set(currentScore + points);

    return { isCorrect, points, timeElapsed };
  }

  // Submit an answer
  async submitAnswer(answerIndex) {
    if (this.hasAnswered) {
      return;
    }

    this.hasAnswered = true;

    const currentQuestion = this.questions[this.currentQuestionIndex];
    const isCorrect = answerIndex === currentQuestion.rispostaCorretta;
    const isNoAnswer = answerIndex === -1; // Track if user didn't answer

    // Write answer with server timestamp first
    const answerRef = this.roomRef.child(`answers/${this.currentQuestionIndex}/${this.playerId}`);
    await answerRef.set({
      answer: answerIndex,
      correct: isCorrect,
      noAnswer: isNoAnswer,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });

    // Now read back both timestamps to calculate elapsed time using server clock
    const questionStartSnapshot = await this.roomRef.child('questionStartTime').once('value');
    const answerSnapshot = await answerRef.once('value');

    const questionStartTime = questionStartSnapshot.val();
    const answerTime = answerSnapshot.val().timestamp;

    // Validate timestamps
    if (!questionStartTime || questionStartTime === 0) {
      console.error('questionStartTime is null or 0, using fallback calculation');
      // Fallback: use local timer duration as approximate time
      const timeElapsed = Math.max(0.1, this.timerDuration - (this.timeRemaining || this.timerDuration));
      return await this.calculateAndUpdateScore(answerRef, isCorrect, timeElapsed, isNoAnswer);
    }

    // Calculate elapsed time using server timestamps (both from same clock)
    const timeElapsed = Math.max(0.1, (answerTime - questionStartTime) / 1000); // seconds, minimum 0.1s

    return await this.calculateAndUpdateScore(answerRef, isCorrect, timeElapsed, isNoAnswer);
  }

  // Move to next question (host only)
  async nextQuestion() {
    if (!this.isHost) {
      return;
    }

    const nextIndex = this.currentQuestionIndex + 1;

    console.log('nextQuestion called. Current:', this.currentQuestionIndex, 'Next:', nextIndex, 'Total questions:', this.questions.length);

    if (nextIndex >= this.questions.length) {
      // Game over
      console.log('Game ending - no more questions');
      await this.roomRef.update({
        gameEnded: true,
        endTime: firebase.database.ServerValue.TIMESTAMP
      });
    } else {
      console.log('Moving to next question:', nextIndex);
      await this.roomRef.update({
        currentQuestion: nextIndex,
        questionStartTime: firebase.database.ServerValue.TIMESTAMP
      });
    }
  }

  shuffleQuesions(allQuestions) {
    for (let i = allQuestions.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }

    return allQuestions
  }

  // Select random questions from the database
  selectRandomQuestions(count) {
    // Load questions from the global questions object (loaded in the page)
    if (typeof window.domande === 'undefined') {
      throw new Error('Domande non caricate');
    }

    const allQuestions = [];
    for (const categoria in window.domande) {
      window.domande[categoria].forEach(q => {
        // Get the correct answer (default to first one if not specified)
        const correctAnswerIndex = (typeof q.rispostaCorretta === 'number') ? q.rispostaCorretta : 0;
        const correctAnswer = q.risposte[correctAnswerIndex];

        // Create a copy of answers and shuffle them
        const shuffledAnswers = [...q.risposte].sort(() => Math.random() - 0.5);

        // Find the new index of the correct answer after shuffling
        const newCorrectIndex = shuffledAnswers.indexOf(correctAnswer);

        const question = {
          categoria: categoria,
          domanda: q.domanda,
          risposte: shuffledAnswers,
          rispostaCorretta: newCorrectIndex
        };
        allQuestions.push(question);
      });
    }

    // Check if we have enough questions
    const availableCount = allQuestions.length;
    const actualCount = Math.min(count, availableCount);

    if (actualCount < count) {
      console.warn(`Requested ${count} questions but only ${availableCount} available. Using ${actualCount} questions.`);
    }

    // Shuffle and select
    const shuffled = this.shuffleQuesions(allQuestions);
    const selected = shuffled.slice(0, actualCount);

    // Debug: log the first question to verify structure
    console.log(`Selected ${selected.length} questions out of ${count} requested`);

    return selected;
  }

  // Get current leaderboard
  getLeaderboard() {
    const leaderboard = [];
    for (const playerId in this.scores) {
      const playerName = this.players[playerId]?.name || 'Unknown';
      leaderboard.push({
        playerId,
        name: playerName,
        score: this.scores[playerId] || 0
      });
    }
    leaderboard.sort((a, b) => b.score - a.score);
    return leaderboard;
  }

  // Toggle player ready status
  async toggleReady() {
    if (this.isHost) {
      return; // Host is always ready
    }

    const currentReady = this.players[this.playerId]?.ready || false;
    await this.roomRef.child('players/' + this.playerId + '/ready').set(!currentReady);
  }

  // Update game settings (host only)
  async updateSettings(timer) {
    if (!this.isHost) {
      return;
    }

    this.timerDuration = timer;
    await this.roomRef.update({ timer });
  }

  // Replay game with new questions (host only)
  async replayGame() {
    if (!this.isHost) {
      throw new Error('Solo l\'host può riavviare la partita');
    }

    // Select new random questions
    const newQuestions = this.selectRandomQuestions(this.questions.length);

    // Reset all scores to 0
    const updates = {
      gameStarted: false,
      gameEnded: false,
      currentQuestion: 0,
      questions: newQuestions, // Still need to update for new joiners
      answers: null, // Clear all previous answers
      questionStartTime: null
    };

    // Reset scores for all players
    for (const playerId in this.scores) {
      updates[`scores/${playerId}`] = 0;
    }

    await this.roomRef.update(updates);

    // Update local state
    this.questions = newQuestions;
    this.currentQuestionIndex = 0;
    this.gameStarted = false;
    this.hasAnswered = false;

    // Notify other players to reload questions
    this.notifyQuestionsChanged();
  }

  // Notify players that questions have changed (for optimization)
  async notifyQuestionsChanged() {
    // Increment a counter to trigger non-host players to reload questions
    const questionsVersionRef = this.roomRef.child('questionsVersion');
    const snapshot = await questionsVersionRef.once('value');
    const currentVersion = snapshot.val() || 0;
    await questionsVersionRef.set(currentVersion + 1);
  }

  // Fetch questions from Firebase (called when questionsVersion changes)
  async fetchQuestions() {
    const snapshot = await this.roomRef.child('questions').once('value');
    const questions = snapshot.val();
    if (questions) {
      this.questions = questions;
      console.log('Questions reloaded from Firebase:', questions.length);
    }
  }
}

// Export for global use
window.MultiplayerQuiz = MultiplayerQuiz;

// =============================================================================
// Game UI Controller
// =============================================================================

class MultiplayerUI {
  constructor() {
    this.game = null;
    this.timerInterval = null;
    this.timeRemaining = 30;
    this.domande = {};
    this.previousScores = {}; // Track previous scores to show differences
    this.allPlayersAnswered = false; // Track if all players answered current question
    this.currentQuestionId = null; // Track current question ID for bookmarking
    this.bookmarkBtn = null; // Bookmark button reference
    this.currentDataset = 'questions.json'; // Default dataset
  }

  async init() {
    // Check for dataset parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const datasetParam = urlParams.get('dataset');
    if (datasetParam) {
      this.currentDataset = datasetParam;
    }

    // Make currentDataset available globally for SafeStorage
    window.currentDataset = this.currentDataset;

    // Numero atteso di domande nel database (modifica qui se necessario)
    const EXPECTED_TOTAL_QUESTIONS = 2000;

    // Mostra spinner di caricamento
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.style.margin = '3em auto';
    spinner.style.display = 'block';
    spinner.innerHTML = '';
    document.body.appendChild(spinner);

    // Blocca la UI
    document.querySelectorAll('button, input').forEach(el => el.disabled = true);

    // Setup dark mode (always works, no dependencies)
    this.setupDarkMode();
    // Setup event listeners (always works, no dependencies)
    this.setupEventListeners();

    // Load questions
    let loaded = false;
    let total = 0;
    try {
      const response = await fetch(`data/${this.currentDataset}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.domande = await response.json();
      window.domande = this.domande;
      loaded = true;
      // Controllo che tutte le domande siano caricate
      for (const cat in this.domande) {
        total += this.domande[cat].length;
      }
      console.log(`Questions loaded from ${this.currentDataset}:`, total);

      // Skip the total check for prova_scritta dataset as it has fewer questions
      if (this.currentDataset === 'questions.json' && total < EXPECTED_TOTAL_QUESTIONS) {
        alert('Errore: sono state caricate solo ' + total + ' domande su ' + EXPECTED_TOTAL_QUESTIONS + '. Il quiz non può essere avviato finché tutte le domande non sono caricate.');
        spinner.remove();
        return false;
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      alert('Errore nel caricamento delle domande. Dettagli nella console (F12).\nAssicurati di aprire il file tramite un server locale (non file://)');
      spinner.remove();
      return false;
    }

    // Rimuovi spinner e sblocca la UI
    spinner.remove();
    document.querySelectorAll('button, input').forEach(el => el.disabled = false);

    // Initialize Firebase
    if (!initializeFirebase()) {
      alert('Impossibile connettersi a Firebase. Controlla la configurazione.');
      return false;
    }

    // Setup global callbacks
    this.setupGlobalCallbacks();
    // Show home screen
    this.showScreen('homeScreen');
    return loaded;
  }

  setupDarkMode() {
    const darkModeCheckbox = document.getElementById("dark-mode-checkbox");
    const body = document.body;

    // Load saved dark mode preference
    const savedDarkMode = SafeStorage.get("darkMode");
    if (savedDarkMode) {
      body.classList.add("dark-mode");
    }

    // Only set up event listener if checkbox exists
    if (darkModeCheckbox) {
      if (savedDarkMode) {
        darkModeCheckbox.checked = true;
      }

      // Toggle dark mode on checkbox change
      darkModeCheckbox.addEventListener("change", () => {
        body.classList.toggle("dark-mode");
        const isDarkMode = body.classList.contains("dark-mode");
        SafeStorage.set("darkMode", isDarkMode);
      });
    }
  }

  setupEventListeners() {
    // Dataset switcher
    const datasetSwitcher = document.getElementById('mp-dataset-switcher');
    if (datasetSwitcher) {
      // Set initial value from current dataset
      datasetSwitcher.value = this.currentDataset;

      datasetSwitcher.addEventListener('change', async () => {
        const selectedDataset = datasetSwitcher.value;

        // Reload the page with the new dataset parameter
        window.location.href = `multiplayer.html?dataset=${encodeURIComponent(selectedDataset)}`;
      });
    }

    // Home screen
    document.getElementById('createRoomBtn').addEventListener('click', () => {
      this.showScreen('createRoomScreen');
    });

    document.getElementById('joinRoomBtn').addEventListener('click', () => {
      this.showScreen('joinRoomScreen');
    });

    document.getElementById('backToMainBtn').addEventListener('click', () => {
      window.location.href = 'index.html';
    });

    // Create room
    document.getElementById('createRoomForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.createRoom();
    });

    document.getElementById('cancelCreateBtn').addEventListener('click', () => {
      this.showScreen('homeScreen');
    });

    // Join room
    document.getElementById('joinRoomForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.joinRoom();
    });

    document.getElementById('cancelJoinBtn').addEventListener('click', () => {
      this.showScreen('homeScreen');
    });

    // Lobby
    document.getElementById('startGameBtn').addEventListener('click', async () => {
      try {
        await this.game.startGame();
      } catch (error) {
        alert(error.message);
      }
    });

    document.getElementById('leaveLobbyBtn').addEventListener('click', () => {
      if (this.game) {
        this.game.cleanup();
        this.game = null;
      }
      this.showScreen('homeScreen');
    });

    // Game
    document.getElementById('nextQuestionBtn').addEventListener('click', async () => {
      await this.game.nextQuestion();
      document.getElementById('nextQuestionBtn').style.display = 'none';
    });

    // Bookmark button
    this.bookmarkBtn = document.getElementById('mp-bookmark-btn');
    this.bookmarkBtn.addEventListener('click', () => {
      this.toggleBookmark();
    });

    // Results
    document.getElementById('playAgainBtn').addEventListener('click', async () => {
      try {
        await this.game.replayGame();
        this.showScreen('lobbyScreen');
      } catch (error) {
        alert(error.message);
      }
    });

    document.getElementById('backToHomeBtn').addEventListener('click', () => {
      if (this.game) {
        this.game.cleanup();
        this.game = null;
      }
      this.showScreen('homeScreen');
    });
  }

  setupGlobalCallbacks() {
    // Callback functions for multiplayer events
    window.updatePlayersList = (players) => {
      const playersList = document.getElementById('playersList');
      const playerCount = document.getElementById('playerCount');

      const playerArray = Object.entries(players).map(([id, data]) => ({
        id,
        ...data
      }));

      playerCount.textContent = playerArray.length;

      playersList.innerHTML = playerArray.map(player => {
        const isHost = player.id === this.game.hostId;
        const hostBadge = isHost ? ' 👑' : '';
        return `<div class="player-item">${player.name}${hostBadge}</div>`;
      }).join('');
    };

    window.onGameStart = () => {
      // Initialize previous scores (all should be 0 at game start)
      this.previousScores = { ...this.game.scores };
      this.allPlayersAnswered = false;

      // Set up listener for first question (question 0)
      this.game.setupAnswersListener(0);
      this.showScreen('gameScreen');
      this.displayQuestion();

      // Initialize leaderboard with current scores (no diff yet)
      const leaderboard = this.game.getLeaderboard();
      this.updateMiniLeaderboard(leaderboard);

      this.startTimer();
    };

    window.onGameRestart = () => {
      // Game was restarted, go back to lobby
      this.showScreen('lobbyScreen');
    };

    window.onNewQuestion = (question, index) => {
      // Save current scores before new question starts
      this.previousScores = { ...this.game.scores };
      this.allPlayersAnswered = false; // Reset flag for new question

      document.getElementById('currentQuestionNum').textContent = index + 1;
      this.displayQuestion();
      document.getElementById('answerFeedback').style.display = 'none';
      document.getElementById('waitingForPlayers').style.display = 'none';
      document.getElementById('nextQuestionBtn').style.display = 'none';
      this.game.hasAnswered = false;
      this.startTimer();

      // Update leaderboard without diff for new question
      const leaderboard = this.game.getLeaderboard();
      this.updateMiniLeaderboard(leaderboard);
    };

    window.updateScores = (scores) => {
      // Only update leaderboard after all players have answered or timeout
      if (this.allPlayersAnswered) {
        const leaderboard = this.game.getLeaderboard();
        this.updateMiniLeaderboardWithDiff(leaderboard);
      }
      // Otherwise, don't update the leaderboard during active question
    };

    window.updateQuestionCount = (count) => {
      document.getElementById('lobbyNumQuestions').textContent = count;
      document.getElementById('totalQuestions').textContent = count;
    };

    window.updateAnswersStatus = (answers) => {
      // Check if all players have answered
      const totalPlayers = Object.keys(this.game.players).length;
      const answeredPlayers = Object.keys(answers || {}).length;

      console.log('Total players:', totalPlayers, 'Answered:', answeredPlayers, 'Is host:', this.game.isHost);

      if (answeredPlayers === totalPlayers) {
        // All players have answered
        console.log('All players answered!');

        // Set flag to show diff in leaderboard
        this.allPlayersAnswered = true;

        // Stop the timer for everyone
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }

        // Update leaderboard with score differences
        const leaderboard = this.game.getLeaderboard();
        this.updateMiniLeaderboardWithDiff(leaderboard);

        // Show next button for host
        if (this.game.isHost) {
          document.getElementById('nextQuestionBtn').style.display = 'block';
          document.getElementById('waitingForPlayers').style.display = 'none';
        }
      }
    };

    window.onGameEnd = () => {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
      }
      this.showResults();
    };
  }

  async createRoom() {
    const hostName = document.getElementById('hostName').value.trim();
    const numQuestions = parseInt(document.getElementById('numQuestions').value);
    const timer = parseInt(document.getElementById('timerSetting').value);
    const scoringSystem = document.getElementById('scoringSystem').value;

    if (!hostName) {
      alert('Inserisci il tuo nome');
      return;
    }

    try {
      this.game = new MultiplayerQuiz();
      this.game.init();

      const roomCode = await this.game.createRoom(hostName, numQuestions, timer, scoringSystem);

      // Check if we got fewer questions than requested
      const actualQuestions = this.game.questions.length;
      if (actualQuestions < numQuestions) {
        alert(`Attenzione: Hai richiesto ${numQuestions} domande ma sono disponibili solo ${actualQuestions} domande nel database.`);
      }

      // Show lobby
      document.getElementById('roomCodeDisplay').textContent = roomCode;
      document.getElementById('lobbyNumQuestions').textContent = actualQuestions;
      document.getElementById('lobbyTimer').textContent = timer;
      document.getElementById('totalQuestions').textContent = actualQuestions;
      
      // Display scoring system
      const scoringSystemText = scoringSystem === 'exam' ? 'Esame (+1/-0.17)' : 'Standard (100+bonus)';
      document.getElementById('lobbyScoringSystem').textContent = scoringSystemText;
      
      document.getElementById('startGameBtn').style.display = 'block';
      document.getElementById('waitingMessage').style.display = 'none';

      this.showScreen('lobbyScreen');
    } catch (error) {
      alert('Errore nella creazione della stanza: ' + error.message);
    }
  }

  async joinRoom() {
    const playerName = document.getElementById('playerName').value.trim();
    const roomCode = document.getElementById('roomCodeInput').value.trim();

    if (!playerName || !roomCode) {
      alert('Inserisci nome e codice stanza');
      return;
    }

    try {
      this.game = new MultiplayerQuiz();
      this.game.init();

      await this.game.joinRoom(roomCode, playerName);

      // Show lobby
      document.getElementById('roomCodeDisplay').textContent = roomCode;
      document.getElementById('lobbyNumQuestions').textContent = this.game.numQuestions || this.game.questions.length;
      document.getElementById('lobbyTimer').textContent = this.game.timerDuration;
      document.getElementById('totalQuestions').textContent = this.game.numQuestions || this.game.questions.length;
      
      // Display scoring system
      const scoringSystemText = this.game.scoringSystem === 'exam' ? 'Esame (+1/-0.17)' : 'Standard (100+bonus)';
      document.getElementById('lobbyScoringSystem').textContent = scoringSystemText;
      
      document.getElementById('startGameBtn').style.display = 'none';
      document.getElementById('waitingMessage').style.display = 'block';

      this.showScreen('lobbyScreen');
    } catch (error) {
      alert('Errore: ' + error.message);
    }
  }

  displayQuestion() {
    const question = this.game.questions[this.game.currentQuestionIndex];
    document.getElementById('gameQuestion').textContent = question.domanda;

    // Generate unique question ID for bookmarking (same format as single player)
    this.currentQuestionId = `${question.categoria}::${question.domanda}`;
    this.updateBookmarkButton();

    const answersContainer = document.getElementById('gameAnswers');
    answersContainer.innerHTML = question.risposte.map((risposta, index) =>
      `<button data-index="${index}">${risposta}</button>`
    ).join('');

    // Add click handlers
    answersContainer.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => this.handleAnswer(parseInt(btn.dataset.index)));
    });
  }

  async handleAnswer(answerIndex) {
    if (this.game.hasAnswered) return;

    const question = this.game.questions[this.game.currentQuestionIndex];
    const correctIndex = question.rispostaCorretta;

    try {
      const result = await this.game.submitAnswer(answerIndex);

      // Show correct/wrong on buttons
      const buttons = document.querySelectorAll('#gameAnswers button');
      buttons.forEach((btn, index) => {
        btn.disabled = true;
        if (index === correctIndex) {
          btn.classList.add('correct');
        } else if (index === answerIndex && !result.isCorrect) {
          btn.classList.add('wrong');
        }
      });

      // Show feedback
      const feedbackEl = document.getElementById('answerFeedback');
      const feedbackText = document.getElementById('feedbackText');
      const feedbackPoints = document.getElementById('feedbackPoints');

      if (result.isCorrect) {
        feedbackText.textContent = '✓ Risposta corretta!';
        feedbackText.style.color = '#4CAF50';
      } else {
        feedbackText.textContent = '✗ Risposta errata';
        feedbackText.style.color = '#f44336';
      }

      feedbackPoints.textContent = `${result.points > 0 ? '+' : ''}${result.points} punti (${result.timeElapsed.toFixed(1)}s)`;
      feedbackEl.style.display = 'block';

      // Show waiting message (next button will appear when all players answered)
      document.getElementById('waitingForPlayers').style.display = 'block';

      // Don't stop timer - let it continue for other players

      // Check if we need to hide waiting message (for host when all answered)
      // This will be updated by the Firebase listener, but we'll double-check
      setTimeout(() => {
        const nextBtn = document.getElementById('nextQuestionBtn');
        if (nextBtn.style.display === 'block') {
          document.getElementById('waitingForPlayers').style.display = 'none';
        }
      }, 100);
    } catch (error) {
      console.error('Error submitting answer:', error);
    }
  }

  startTimer() {
    this.timeRemaining = this.game.timerDuration;
    const timerEl = document.getElementById('gameTimer');
    timerEl.textContent = this.timeRemaining;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      timerEl.textContent = this.timeRemaining;

      if (this.timeRemaining <= 0) {
        clearInterval(this.timerInterval);

        // Timer expired - set flag to show diff
        this.allPlayersAnswered = true;

        // Update leaderboard with differences
        const leaderboard = this.game.getLeaderboard();
        this.updateMiniLeaderboardWithDiff(leaderboard);

        if (!this.game.hasAnswered) {
          // Time's up - show correct answer and auto-submit
          const question = this.game.questions[this.game.currentQuestionIndex];
          const correctIndex = question.rispostaCorretta;

          const buttons = document.querySelectorAll('#gameAnswers button');
          buttons.forEach((btn, index) => {
            btn.disabled = true;
            if (index === correctIndex) {
              btn.classList.add('correct');
            }
          });

          this.handleAnswer(-1);
        }
      }
    }, 1000);
  }

  updateMiniLeaderboard(leaderboard) {
    const miniLeaderboard = document.getElementById('miniLeaderboard');
    miniLeaderboard.innerHTML = leaderboard.slice(0, 5).map((player, index) =>
      `<div class="leaderboard-item">
        <span>${index + 1}. ${player.name}</span>
        <span>${player.score}</span>
      </div>`
    ).join('');
  }

  updateMiniLeaderboardWithDiff(leaderboard) {
    const miniLeaderboard = document.getElementById('miniLeaderboard');
    miniLeaderboard.innerHTML = leaderboard.slice(0, 5).map((player, index) => {
      const previousScore = this.previousScores[player.playerId] || 0;
      const diff = player.score - previousScore;
      const diffText = diff > 0 ? `+${diff}` : `${diff}`;
      const diffColor = diff > 0 ? '#4CAF50' : (diff < 0 ? '#f44336' : 'var(--text-color)');

      return `<div class="leaderboard-item">
        <span>${index + 1}. ${player.name}</span>
        <span>
          <span style="color: ${diffColor}; font-weight: bold; margin-right: 8px;">${diffText}</span>
          <span>${player.score}</span>
        </span>
      </div>`;
    }).join('');
  }

  showResults() {
    const leaderboard = this.game.getLeaderboard();
    const finalLeaderboard = document.getElementById('finalLeaderboard');

    finalLeaderboard.innerHTML = leaderboard.map((player, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
      return `<div class="final-leaderboard-item ${index < 3 ? 'podium' : ''}">
        <span class="rank">${index + 1}</span>
        <span class="player-name">${medal} ${player.name}</span>
        <span class="player-score">${player.score}</span>
      </div>`;
    }).join('');

    // Show "Play Again" button only for host
    const playAgainBtn = document.getElementById('playAgainBtn');
    if (this.game.isHost) {
      playAgainBtn.style.display = 'block';
    } else {
      playAgainBtn.style.display = 'none';
    }

    this.showScreen('resultsScreen');
  }

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
  }

  updateBookmarkButton() {
    if (!this.currentQuestionId || !this.bookmarkBtn) return;

    const savedQuestions = SafeStorage.get("savedQuestions") || [];
    if (savedQuestions.includes(this.currentQuestionId)) {
      this.bookmarkBtn.classList.add("saved");
      this.bookmarkBtn.textContent = "⭐";
    } else {
      this.bookmarkBtn.classList.remove("saved");
      this.bookmarkBtn.textContent = "☆";
    }
  }

  toggleBookmark() {
    if (!this.currentQuestionId) return;

    const savedQuestions = SafeStorage.get("savedQuestions") || [];
    const index = savedQuestions.indexOf(this.currentQuestionId);

    if (index >= 0) {
      // Remove bookmark
      savedQuestions.splice(index, 1);
    } else {
      // Add bookmark
      savedQuestions.push(this.currentQuestionId);
    }

    SafeStorage.set("savedQuestions", savedQuestions);
    this.updateBookmarkButton();
  }

  cleanup() {
    if (this.game) {
      this.game.cleanup();
    }
  }
}

// Initialize the app when DOM is ready
let multiplayerUI = null;

window.addEventListener('DOMContentLoaded', async () => {
  multiplayerUI = new MultiplayerUI();
  await multiplayerUI.init();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (multiplayerUI) {
    multiplayerUI.cleanup();
  }
});
