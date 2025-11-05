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
    this.basePoints = 100;
    this.speedBonusMax = 50;
    this.wrongPenalty = 25;
    this.timerDuration = 30; // Default timer
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
  async createRoom(playerName, numQuestions, timer) {
    try {
      this.roomCode = this.generateRoomCode();
      this.playerName = playerName;
      this.isHost = true;
      this.hostId = this.playerId;
      this.timerDuration = timer;

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

    // Listen for questions array changes (when host updates)
    const questionsRef = this.roomRef.child('questions');
    const questionsListener = questionsRef.on('value', (snapshot) => {
      const questions = snapshot.val();
      if (questions) {
        this.questions = questions;
        if (window.updateQuestionCount) {
          window.updateQuestionCount(questions.length);
        }
      }
    });
    this.listeners.push({ ref: questionsRef, event: 'value', callback: questionsListener });

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

  // Submit an answer
  async submitAnswer(answerIndex) {
    if (this.hasAnswered) {
      return;
    }

    this.hasAnswered = true;
    
    // Get the question start time from Firebase to calculate accurate elapsed time
    const questionStartSnapshot = await this.roomRef.child('questionStartTime').once('value');
    const questionStartTime = questionStartSnapshot.val();
    const now = Date.now();
    const timeElapsed = (now - questionStartTime) / 1000; // seconds
    
    const currentQuestion = this.questions[this.currentQuestionIndex];
    const isCorrect = answerIndex === currentQuestion.rispostaCorretta;

    // Calculate score
    let points = 0;
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

    // Record the answer
    await this.roomRef.child(`answers/${this.currentQuestionIndex}/${this.playerId}`).set({
      answer: answerIndex,
      correct: isCorrect,
      time: timeElapsed,
      points: points,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });

    // Update score
    const currentScore = this.scores[this.playerId] || 0;
    await this.roomRef.child('scores/' + this.playerId).set(currentScore + points);

    return { isCorrect, points, timeElapsed };
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

  // Select random questions from the database
  selectRandomQuestions(count) {
    // Load questions from the global questions object (loaded in the page)
    if (typeof window.domande === 'undefined') {
      throw new Error('Domande non caricate');
    }

    const allQuestions = [];
    for (const categoria in window.domande) {
      window.domande[categoria].forEach(q => {
        // Create question object with correct answer index
        // If not specified, default to 0 (first answer is correct)
        const question = {
          categoria: categoria,
          domanda: q.domanda,
          risposte: [...q.risposte], // Create a copy of the array
          rispostaCorretta: (typeof q.rispostaCorretta === 'number') ? q.rispostaCorretta : 0
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
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, actualCount);
    
    // Debug: log the first question to verify structure
    console.log('Sample question:', JSON.stringify(selected[0], null, 2));
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
      questions: newQuestions,
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
  }
}

// Export for global use
window.MultiplayerQuiz = MultiplayerQuiz;
