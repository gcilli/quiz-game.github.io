// Quiz Application Main Logic

// Global constants and variables
let CATEGORIE = [];
let currentDataset = 'questions.json'; // Default dataset

let numDomande = 10;
let tempoTotale = 0;
let tempoRimanente = 0;
let timerInterval = null;
let domande = {};

// DOM elements
let categoryMenu, startBtn, quizContainer, categoryEl, questionEl, answersEl, nextBtn;
let scoreEl, summaryEl, finalScoreEl, progressEl, errorListEl, progressBarFill;
let restartBtn, backBtn, numDomandeSelect, timerInput, timerEl;
let clearPersistentBtn, bookmarkBtn, onlySavedCheckbox, prevBtn, selectionStrategySelect;
let topicCheckboxesContainer;

// Quiz state
let selectedCategories = [];
let selectedTopics = [];
let correctAnswer = null;
let currentCategory = null;
let currentQuestionId = null;
let punteggio = 0;
let domandeFatte = 0;
let errori = [];
let corrette = [];
let quizInCorso = false;
let domandeUsate = [];
let quizHistory = [];
let currentQuestionIndex = -1;
let userActivated = false;
let selectionStrategy = 'random';

// Load questions from JSON
async function loadQuestions(datasetFile = null) {
    if (datasetFile) {
        currentDataset = datasetFile;
    }

    try {
        const response = await fetch(`data/${currentDataset}`);
        domande = await response.json();

        // Extract categories dynamically from the loaded dataset
        CATEGORIE = Object.keys(domande);

        window.domande = domande; // Make available globally for charts
        window.CATEGORIE = CATEGORIE; // Make available globally for charts

        console.log(`Loaded dataset: ${currentDataset} with categories:`, CATEGORIE);
    } catch (error) {
        console.error("Error loading questions:", error);
        // Fallback to embedded data only for the original dataset
        if (currentDataset === 'questions.json') {
            domande = {
                CULTURA_GENERALE: [
                    {
                        domanda: "1) Quale delle seguenti frasi contiene un aggettivo numerale cardinale?",
                        risposte: ["Il mio amico Lassie è un animale a quattro zampe", "Alla notizia della promozione Federico era al settimo cielo", "L'appartamento al primo piano era poco luminoso"]
                    }
                ],
                ATTITUDINALI_LOGICO_DEDUTTIVI: [
                    {
                        domanda: "501) Quale rapporto di parentela lega Antonio alla sorella del marito di sua cugina?",
                        risposte: ["non c'è alcun rapporto di parentela", "zio/nipote", "cugini"]
                    }
                ],
                ATTITUDINALI_LOGICO_MATEMATICI: [
                    {
                        domanda: "1001) Dividi il numero 56 in parti direttamente proporzionali ai numeri 1/4, 1/6, 3/4.",
                        risposte: ["12; 8; 36", "11; 12; 33", "15; 2; 45"]
                    }
                ],
                ATTITUDINALI_LOGICO_VERBALI: [
                    {
                        domanda: "1501) La parola \"portabagagli\" è composta da:",
                        risposte: ["verbo + nome", "aggettivo + nome", "nome + aggettivo"]
                    }
                ]
            };
            CATEGORIE = Object.keys(domande);
            window.domande = domande;
            window.CATEGORIE = CATEGORIE;
        }
    }
}

// Initialize DOM elements
function initDomElements() {
    // Try to get category menu from either location (index.html or singleplayer.html)
    categoryMenu = document.getElementById("singleplayer-menu") || document.querySelector(".category-select");
    startBtn = document.getElementById("start-btn");
    quizContainer = document.getElementById("quiz");
    categoryEl = document.getElementById("category");
    questionEl = document.getElementById("question");
    answersEl = document.getElementById("answers");
    nextBtn = document.getElementById("next-btn");
    scoreEl = document.getElementById("score");
    summaryEl = document.getElementById("summary");
    finalScoreEl = document.getElementById("final-score");
    progressEl = document.getElementById("progress");
    errorListEl = document.getElementById("error-list");
    restartBtn = document.getElementById("restart-btn");
    backBtn = document.getElementById("back-btn");
    numDomandeSelect = document.getElementById("num-domande");
    timerInput = document.getElementById("timer-input");
    timerEl = document.getElementById("timer");
    clearPersistentBtn = document.getElementById("clear-persistent");
    bookmarkBtn = document.getElementById("bookmark-btn");
    onlySavedCheckbox = document.getElementById("only-saved-questions");
    prevBtn = document.getElementById("prev-btn");
    selectionStrategySelect = document.getElementById("selection-strategy");
    progressBarFill = document.getElementById("progress-bar-fill");
    topicCheckboxesContainer = document.getElementById("topic-checkboxes");
}

// Helper per mostrare/nascondere sezioni
const mostraSezione = (sezione) => {
    // Handle index.html sections
    const mainMenu = document.getElementById('main-menu');
    const singleplayerMenu = document.getElementById('singleplayer-menu');
    const multiplayerMenu = document.getElementById('multiplayer-menu');

    if (mainMenu) mainMenu.style.display = sezione === 'main-menu' ? "block" : "none";
    if (singleplayerMenu) singleplayerMenu.style.display = sezione === 'singleplayer-menu' ? "flex" : "none";
    if (multiplayerMenu) multiplayerMenu.style.display = sezione === 'multiplayer-menu' ? "block" : "none";

    // Handle singleplayer.html screens (using screen class system)
    const setupScreen = document.getElementById('setupScreen');
    if (setupScreen) {
        setupScreen.style.display = sezione === 'singleplayer-menu' ? "block" : "none";
        setupScreen.classList.toggle('active', sezione === 'singleplayer-menu');
    }

    // Handle shared sections
    if (quizContainer) {
        quizContainer.style.display = sezione === 'quiz' ? "flex" : "none";
    }
    if (summaryEl) {
        summaryEl.style.display = sezione === 'summary' ? "flex" : "none";
    }
};

// Extract all unique topics from selected categories
function getAvailableTopics(categories) {
    const topics = new Set();

    categories.forEach(cat => {
        if (!domande[cat]) return;

        domande[cat].forEach(q => {
            if (q.topic && q.topic.trim() !== "") {
                topics.add(q.topic.trim());
            }
        });
    });

    return Array.from(topics).sort();
}

// Get topics for a specific category
function getTopicsForCategory(category) {
    const topics = new Set();

    if (!domande[category]) return [];

    domande[category].forEach(q => {
        if (q.topic && q.topic.trim() !== "") {
            topics.add(q.topic.trim());
        }
    });

    return Array.from(topics).sort();
}

// Update topics for a specific category
function updateCategoryTopics(category) {
    const container = document.querySelector(`.category-topics-container[data-category="${category}"] .topics-list`);
    if (!container) return;

    const topics = getTopicsForCategory(category);
    container.innerHTML = "";

    if (topics.length === 0) {
        const p = document.createElement("p");
        p.style.color = "var(--text-muted)";
        p.style.fontStyle = "italic";
        p.style.textAlign = "center";
        p.style.padding = "1rem";
        p.textContent = "Nessun topic disponibile per questa categoria";
        container.appendChild(p);
        return;
    }

    // Calculate topic statistics - count questions per topic
    const topicStats = {};
    domande[category].forEach(q => {
        const topic = q.topic ? q.topic.trim() : "";
        if (topic !== "" && topics.includes(topic)) {
            topicStats[topic] = (topicStats[topic] || 0) + 1;
        }
    });

    // Calculate correct/wrong answers per topic from persistent storage
    const topicAnswerStats = {};
    topics.forEach(topic => {
        topicAnswerStats[topic] = { correct: 0, wrong: 0, uniqueQuestionsViewed: 0 };
    });

    // Get question statistics from storage
    const questionStats = SafeStorage.get("questionStats") || {};
    domande[category].forEach(q => {
        const topic = q.topic ? q.topic.trim() : "";
        if (topic !== "" && topics.includes(topic)) {
            const qKey = `${category}::${q.domanda}`;
            const stats = questionStats[qKey];
            if (stats && stats.timesShown > 0) {
                // This question has been viewed at least once
                topicAnswerStats[topic].uniqueQuestionsViewed++;
                topicAnswerStats[topic].correct += stats.timesCorrect || 0;
                topicAnswerStats[topic].wrong += stats.timesWrong || 0;
            }
        }
    });

    // Add "select all" for this category
    const selectAllDiv = document.createElement("div");
    selectAllDiv.className = "topic-item select-all-topics";

    const selectAllHeader = document.createElement("div");
    selectAllHeader.className = "topic-item-header";

    const selectAllCheckbox = document.createElement("input");
    selectAllCheckbox.type = "checkbox";
    selectAllCheckbox.id = `select-all-${category}`;
    selectAllCheckbox.checked = true;
    selectAllCheckbox.addEventListener("change", (e) => {
        const topicCheckboxes = container.querySelectorAll('.topic-checkbox');
        topicCheckboxes.forEach(cb => cb.checked = e.target.checked);
    });

    const selectAllLabel = document.createElement("label");
    selectAllLabel.htmlFor = `select-all-${category}`;
    selectAllLabel.className = "topic-item-label";
    selectAllLabel.textContent = "Seleziona tutti";
    selectAllLabel.style.fontWeight = "bold";
    selectAllLabel.style.cursor = "pointer";

    selectAllHeader.appendChild(selectAllCheckbox);
    selectAllHeader.appendChild(selectAllLabel);
    selectAllDiv.appendChild(selectAllHeader);
    container.appendChild(selectAllDiv);

    // Add individual topics
    topics.forEach((topic, index) => {
        const topicDiv = document.createElement("div");
        topicDiv.className = "topic-item";

        const topicHeader = document.createElement("div");
        topicHeader.className = "topic-item-header";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = topic;
        checkbox.className = "topic-checkbox";
        checkbox.dataset.category = category;
        checkbox.id = `topic-${category}-${index}`;
        checkbox.checked = true;
        checkbox.addEventListener("change", () => {
            const allChecked = Array.from(container.querySelectorAll('.topic-checkbox'))
                .every(cb => cb.checked);
            const selectAllCb = document.getElementById(`select-all-${category}`);
            if (selectAllCb) selectAllCb.checked = allChecked;
        });

        const label = document.createElement("label");
        label.htmlFor = `topic-${category}-${index}`;
        label.className = "topic-item-label";
        label.textContent = topic;
        label.style.cursor = "pointer";

        const badge = document.createElement("span");
        badge.style.marginLeft = "auto";
        badge.style.padding = "0.25rem 0.5rem";
        badge.style.background = "var(--button-bg)";
        badge.style.borderRadius = "0.5rem";
        badge.style.fontSize = "0.8rem";
        badge.style.fontWeight = "bold";
        badge.style.color = "var(--text-secondary)";
        badge.textContent = `${topicAnswerStats[topic].uniqueQuestionsViewed}/${topicStats[topic] || 0}`;

        topicHeader.appendChild(checkbox);
        topicHeader.appendChild(label);
        topicHeader.appendChild(badge);

        const progressBar = document.createElement("div");
        progressBar.className = "topic-progress-bar";

        // Calculate percentages for correct and wrong answers
        const totalAnswered = topicAnswerStats[topic].correct + topicAnswerStats[topic].wrong;
        const correctPerc = totalAnswered > 0 ? (topicAnswerStats[topic].correct / totalAnswered * 100) : 0;
        const wrongPerc = totalAnswered > 0 ? (topicAnswerStats[topic].wrong / totalAnswered * 100) : 0;

        // Create correct answers section (green)
        if (correctPerc > 0) {
            const correctFill = document.createElement("div");
            correctFill.className = "topic-progress-fill topic-progress-correct";
            correctFill.style.width = `${correctPerc}%`;
            progressBar.appendChild(correctFill);
        }

        // Create wrong answers section (red)
        if (wrongPerc > 0) {
            const wrongFill = document.createElement("div");
            wrongFill.className = "topic-progress-fill topic-progress-wrong";
            wrongFill.style.width = `${wrongPerc}%`;
            progressBar.appendChild(wrongFill);
        }

        topicDiv.appendChild(topicHeader);
        topicDiv.appendChild(progressBar);

        topicDiv.addEventListener('click', (e) => {
            if (e.target !== checkbox && e.target !== label) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
        });

        container.appendChild(topicDiv);
    });
}

// Update topic checkboxes based on selected categories
// Generate category cards dynamically based on loaded dataset
function generateCategoryCards() {
    const container = document.getElementById('category-cards-container');
    if (!container) return;

    // Clear existing cards
    container.innerHTML = '';

    // Create a card for each category
    CATEGORIE.forEach((category, index) => {
        const card = document.createElement('div');
        card.className = 'category-expandable-card';
        card.dataset.category = category;

        // Create a friendly name for the category
        const categoryName = category.replace(/_/g, ' ').toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        const cardId = `cat-${index}`;

        card.innerHTML = `
            <div class="category-expandable-header">
                <input type="checkbox" value="${category}" class="category-checkbox" checked id="${cardId}">
                <label for="${cardId}" class="category-expandable-label">
                    <span class="category-title">${categoryName}</span>
                </label>
                <button class="category-expand-btn" data-category="${category}">
                    <span class="expand-icon">▼</span>
                </button>
            </div>
            <div class="category-topics-container" data-category="${category}" style="display: none;">
                <div class="topics-list"></div>
            </div>
        `;

        container.appendChild(card);
    });

    // Re-attach event listeners for expand buttons
    const expandButtons = container.querySelectorAll('.category-expand-btn');
    expandButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const category = btn.dataset.category;
            const topicsContainer = container.querySelector(`.category-topics-container[data-category="${category}"]`);
            const expandIcon = btn.querySelector('.expand-icon');

            if (topicsContainer.style.display === 'none') {
                topicsContainer.style.display = 'block';
                expandIcon.textContent = '▲';
                // Load topics if not already loaded
                if (topicsContainer.querySelector('.topics-list').children.length === 0) {
                    updateCategoryTopics(category);
                }
            } else {
                topicsContainer.style.display = 'none';
                expandIcon.textContent = '▼';
            }
        });
    });
}

function updateTopicCheckboxes() {
    // Generate category cards dynamically
    generateCategoryCards();

    // Update all categories with topics
    CATEGORIE.forEach(cat => {
        updateCategoryTopics(cat);
    });
}

function avviaQuiz() {
    const checkboxes = categoryMenu.querySelectorAll(".category-checkbox:checked");
    selectedCategories = Array.from(checkboxes).map(cb => cb.value).filter(val => val !== "only-saved-questions");

    // Get selected topics only from selected categories
    selectedTopics = [];
    selectedCategories.forEach(category => {
        const categoryTopicCheckboxes = document.querySelectorAll(`.topic-checkbox[data-category="${category}"]:checked`);
        const categoryTopics = Array.from(categoryTopicCheckboxes).map(cb => cb.value);
        selectedTopics.push(...categoryTopics);
    });

    numDomande = parseInt(numDomandeSelect.value);
    tempoTotale = parseInt(timerInput.value) * 60;
    tempoRimanente = tempoTotale;

    // Get selection strategy
    if (selectionStrategySelect) {
        selectionStrategy = selectionStrategySelect.value;
    }

    if (selectedCategories.length === 0) {
        alert("Seleziona almeno una categoria per iniziare il quiz!");
        return;
    }

    punteggio = 0;
    domandeFatte = 0;
    corrette = [];
    errori = [];
    domandeUsate = [];
    quizHistory = [];
    currentQuestionIndex = -1;
    quizInCorso = true;
    mostraSezione('quiz');
    nuovaDomanda();

    if (tempoTotale > 0) {
        avviaTimer();
    } else {
        timerEl.textContent = "";
    }
}

function avviaTimer() {
    aggiornaTimer();
    timerInterval = setInterval(() => {
        tempoRimanente--;
        aggiornaTimer();
        if (tempoRimanente <= 0) {
            clearInterval(timerInterval);
            mostraRiepilogo(true);
        }
    }, 1000);
}

function aggiornaTimer() {
    const min = Math.floor(tempoRimanente / 60);
    const sec = tempoRimanente % 60;
    timerEl.textContent = `⏱️ ${min}:${sec.toString().padStart(2, '0')}`;
    if (tempoRimanente <= 30 && tempoTotale > 0) {
        timerEl.classList.add("warning");
    } else {
        timerEl.classList.remove("warning");
    }
}

// Question statistics tracking
function getQuestionStats(questionId) {
    const stats = SafeStorage.get("questionStats") || {};
    return stats[questionId] || {
        timesShown: 0,
        timesCorrect: 0,
        timesWrong: 0,
        lastShown: 0
    };
}

function updateQuestionStats(questionId, wasCorrect) {
    const stats = SafeStorage.get("questionStats") || {};
    if (!stats[questionId]) {
        stats[questionId] = {
            timesShown: 0,
            timesCorrect: 0,
            timesWrong: 0,
            lastShown: 0
        };
    }

    stats[questionId].timesShown++;
    if (wasCorrect) {
        stats[questionId].timesCorrect++;
    } else {
        stats[questionId].timesWrong++;
    }
    stats[questionId].lastShown = Date.now();

    SafeStorage.set("questionStats", stats);

    // Note: Don't clear probability cache here - it's only used in statistics screen
    // and will be recalculated when statistics screen is opened
}

function calculateQuestionWeight(questionId, cachedStats, cachedSavedQuestions, strategy) {
    if (strategy === 'random') {
        return 1; // All questions have equal weight
    }

    // Adaptive strategy
    const stats = cachedStats[questionId] || {
        timesShown: 0,
        timesCorrect: 0,
        timesWrong: 0,
        lastShown: 0
    };

    // Never seen before gets highest priority
    if (stats.timesShown === 0) {
        return 100;
    }

    // Calculate success rate
    const successRate = stats.timesCorrect / stats.timesShown;

    // Lower success rate = higher weight (more likely to be shown)
    // Weight formula: inverse of success rate, scaled
    let weight = 1 / (successRate + 0.1); // Add 0.1 to avoid division by zero

    // Boost weight for questions not shown recently
    const daysSinceLastShown = (Date.now() - stats.lastShown) / (1000 * 60 * 60 * 24);
    if (daysSinceLastShown > 5) {
        weight *= 1.5; // 50% boost if not shown in 5 days
    }

    // Boost bookmarked questions (2x multiplier)
    if (cachedSavedQuestions.includes(questionId)) {
        weight *= 2.0; // 100% boost for bookmarked questions
    }

    return weight;
}

function selectWeightedQuestion(availableQuestions, cachedStats, cachedSavedQuestions) {
    if (selectionStrategy === 'random') {
        // Pure random selection
        return availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    }

    // Weighted selection for adaptive strategy
    const weights = availableQuestions.map(q => calculateQuestionWeight(q.id, cachedStats, cachedSavedQuestions, selectionStrategy));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    let random = Math.random() * totalWeight;
    for (let i = 0; i < availableQuestions.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            return availableQuestions[i];
        }
    }

    // Fallback
    return availableQuestions[availableQuestions.length - 1];
}

// Cache for probability calculations (to avoid recalculating for every question)
// Cache for probability calculations (to avoid recalculating for every question)
let probabilityCache = null;

// Calculate all probabilities at once (much faster than individual calculations)
function calculateAllProbabilities() {
    if (probabilityCache) {
        return probabilityCache;
    }
    const allQuestions = [];
    // Gather all questions
    CATEGORIE.forEach(cat => {
        if (domande[cat]) {
            domande[cat].forEach(q => {
                const qId = `${cat}::${q.domanda}`;
                allQuestions.push({ id: qId, categoria: cat, domanda: q });
            });
        }
    });
    if (allQuestions.length === 0) {
        probabilityCache = {};
        return probabilityCache;
    }
    // Calculate all weights at once
    const savedQuestions = SafeStorage.get("savedQuestions") || [];
    const questionStats = SafeStorage.get("questionStats") || {};
    const weights = allQuestions.map(q => calculateQuestionWeight(q.id, questionStats, savedQuestions, 'adaptive'));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    // Create probability map
    const probabilities = {};
    allQuestions.forEach((q, index) => {
        probabilities[q.id] = totalWeight > 0 ? ((weights[index] / totalWeight) * 100) : 0;
    });
    probabilityCache = probabilities;
    return probabilities;
}

// Clear probability cache (call this when stats change)
function clearProbabilityCache() {
    probabilityCache = null;
}

// Statistics screen functions
function populateStatistics(filterCategory = 'all', sortOrder = 'worst') {
    // Render summary cards immediately using cached stats
    const summary = document.getElementById('stats-summary');
    const allStats = SafeStorage.get("questionStats") || {};
    let totalAttempts = 0;
    let totalCorrect = 0;
    let totalQuestionsInDb = 0;
    let questionsSeen = 0;
    if (filterCategory === 'all') {
        for (const cat of CATEGORIE) {
            if (domande[cat]) {
                totalQuestionsInDb += domande[cat].length;
            }
        }
    } else {
        if (domande[filterCategory]) {
            totalQuestionsInDb = domande[filterCategory].length;
        }
    }
    for (const [questionId, stats] of Object.entries(allStats)) {
        const [category] = questionId.split('::');
        if (filterCategory !== 'all' && category !== filterCategory) continue;
        questionsSeen++;
        totalAttempts += stats.timesShown;
        totalCorrect += stats.timesCorrect;
    }
    const questionsSeenPercentage = totalQuestionsInDb > 0 ? ((questionsSeen / totalQuestionsInDb) * 100).toFixed(1) : 0;
    const overallSuccessRate = totalAttempts > 0 ? ((totalCorrect / totalAttempts) * 100).toFixed(1) : 0;
    // Show loading spinner in summary cards and stats list
    summary.innerHTML = `
        <div class="stat-card">
            <div class="stat-card-label">Domande viste</div>
            <div class="stat-card-value"><span class="spinner"></span></div>
        </div>
        <div class="stat-card">
            <div class="stat-card-label">Domande totali</div>
            <div class="stat-card-value"><span class="spinner"></span></div>
        </div>
        <div class="stat-card">
            <div class="stat-card-label">Accuratezza media</div>
            <div class="stat-card-value"><span class="spinner"></span></div>
        </div>
    `;
    const statsList = document.getElementById('stats-list');
    statsList.innerHTML = '<div style="text-align:center;padding:2rem;"><span class="spinner"></span></div>';

    // Now do heavy stats processing asynchronously
    setTimeout(() => {
        // Update summary cards with real values
        summary.innerHTML = `
            <div class="stat-card">
                <div class="stat-card-label">Domande viste</div>
                <div class="stat-card-value">${questionsSeenPercentage}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-label">Domande totali</div>
                <div class="stat-card-value">${totalAttempts}</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-label">Accuratezza media</div>
                <div class="stat-card-value">${overallSuccessRate}%</div>
            </div>
        `;
        const allProbabilities = calculateAllProbabilities();
        const savedQuestions = SafeStorage.get("savedQuestions") || [];
        const statsArray = [];
        for (const [questionId, stats] of Object.entries(allStats)) {
            const [category, questionText] = questionId.split('::');
            if (filterCategory !== 'all' && category !== filterCategory) continue;
            const successRate = stats.timesShown > 0
                ? (stats.timesCorrect / stats.timesShown) * 100
                : 0;
            const probability = (allProbabilities[questionId] || 0)
            const isBookmarked = savedQuestions.includes(questionId);
            statsArray.push({
                id: questionId,
                category,
                question: questionText,
                ...stats,
                successRate,
                probability,
                isBookmarked,
            });
        }
        statsArray.sort((a, b) => {
            switch (sortOrder) {
                case 'worst':
                    return a.successRate - b.successRate;
                case 'best':
                    return b.successRate - a.successRate;
                case 'most-shown':
                    return b.timesShown - a.timesShown;
                case 'least-shown':
                    return a.timesShown - b.timesShown;
                case 'most-likely':
                    return b.probability - a.probability;
                case 'least-likely':
                    return a.probability - b.probability;
                case 'bookmarked':
                    return (b.isBookmarked === a.isBookmarked) ? 0 : b.isBookmarked ? 1 : -1;
                case 'alphabetical': {
                    const numA = parseInt(a.question);
                    const numB = parseInt(b.question);
                    if (!isNaN(numA) && !isNaN(numB)) {
                        return numA - numB;
                    }
                    return a.question.localeCompare(b.question, 'it', { sensitivity: 'base' });
                }
                default:
                    return 0;
            }
        });
        // Populate question list
        const statsList = document.getElementById('stats-list');
        if (statsArray.length === 0) {
            statsList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Nessuna statistica disponibile. Inizia un quiz per vedere i tuoi progressi!</p>';
            populateUnseenQuestions(filterCategory, allProbabilities);
            return;
        }
        renderStatsQuestions(statsArray);
        populateUnseenQuestions(filterCategory, allProbabilities);
    }, 0);
}

function renderStatsQuestions(statsArray) {
    const statsList = document.getElementById('stats-list');
    const BATCH_SIZE = 20;
    statsList.innerHTML = '';
    let rendered = 0;
    function renderBatch() {
        const fragment = document.createDocumentFragment();
        for (let i = rendered; i < Math.min(rendered + BATCH_SIZE, statsArray.length); i++) {
            const stat = statsArray[i];
            const successRate = stat.successRate.toFixed(1);
            let barClass;
            if (stat.timesShown === 0) {
                barClass = 'low';
            } else if (successRate >= 80) {
                barClass = 'high';
            } else if (successRate >= 60) {
                barClass = 'high';
            } else if (successRate >= 40) {
                barClass = 'medium';
            } else {
                barClass = 'low';
            }
            const categoryName = stat.category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
            let answersHtml = '';
            if (domande[stat.category]) {
                const fullQuestion = domande[stat.category].find(q => q.domanda === stat.question);
                if (fullQuestion && fullQuestion.risposte) {
                    const correctAnswer = fullQuestion.risposte[0];
                    const wrongAnswers = fullQuestion.risposte.slice(1);
                    answersHtml = `
                        <div class="question-answers" id="answers-${i}" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                            <div style="margin-bottom: 0.5rem; padding: 0.5rem; background: rgba(40, 167, 69, 0.1); border-left: 3px solid #28a745; border-radius: 4px; color: var(--text-color);">
                                <span style="color: #28a745; font-weight: bold;">✓</span> ${correctAnswer}
                            </div>
                            ${wrongAnswers.map(answer => `
                                <div style="margin-bottom: 0.5rem; padding: 0.5rem; background: var(--container-bg); border-left: 3px solid var(--border-color); border-radius: 4px; color: var(--text-color);">
                                    ${answer}
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
            }
            const div = document.createElement('div');
            div.className = 'question-stat-item';
            div.style.cursor = 'pointer';
            div.setAttribute('onclick', `toggleAnswers(${i})`);
            div.innerHTML = `
                <div class="question-stat-header">
                    <div class="question-stat-text" id="question-text-${i}">${stat.question}</div>
                    <span id="toggle-icon-${i}" style="color: var(--text-secondary); font-size: 1.2rem;">▼</span>
                </div>
                <div class="question-stat-bar">
                    <div class="question-stat-bar-fill ${barClass}" style="width: ${Math.max(successRate, stat.timesShown > 0 ? 8 : 0)}%">
                        ${stat.timesShown > 0 ? successRate + '%' : ''}
                    </div>
                </div>
                <div class="question-stat-details">
                    <span><strong>Categoria:</strong> ${categoryName}</span>
                    <span><strong>Viste:</strong> ${stat.timesShown}</span>
                    <span><strong>Probabilità:</strong> ${stat.probability.toFixed(4)}%</span>
                    ${stat.isBookmarked ? '<span style="color: gold;">⭐</span>' : ''}
                </div>
                ${answersHtml}
            `;
            fragment.appendChild(div);
        }
        statsList.appendChild(fragment);
        rendered += BATCH_SIZE;
        if (rendered < statsArray.length) {
            let spinner = document.getElementById('stats-list-spinner');
            if (!spinner) {
                spinner = document.createElement('div');
                spinner.id = 'stats-list-spinner';
                spinner.innerHTML = '<span class="spinner"></span>';
                spinner.style.textAlign = 'center';
                spinner.style.padding = '1rem';
                statsList.appendChild(spinner);
            }
            setTimeout(renderBatch, 30);
        } else {
            const spinner = document.getElementById('stats-list-spinner');
            if (spinner) spinner.remove();
        }
    }
    renderBatch();
}

function populateUnseenQuestions(filterCategory = 'all', allProbabilities = {}) {
    const allStats = SafeStorage.get("questionStats") || {};
    const unseenQuestions = [];
    const savedQuestions = SafeStorage.get("savedQuestions") || [];

    // Get categories to check
    const categories = filterCategory === 'all' ? CATEGORIE : [filterCategory];

    // Find all questions that have never been shown (don't calculate probabilities yet)
    categories.forEach(cat => {
        if (domande[cat]) {
            domande[cat].forEach(q => {
                const questionId = `${cat}::${q.domanda}`;
                const stats = allStats[questionId];

                // Include if never shown (stats don't exist or timesShown is 0)
                if (!stats || stats.timesShown === 0) {
                    const isBookmarked = savedQuestions.includes(questionId);

                    unseenQuestions.push({
                        id: questionId,
                        category: cat,
                        question: q.domanda,
                        answers: q.risposte,
                        isBookmarked: isBookmarked
                    });
                }
            });
        }
    });

    const unseenList = document.getElementById('unseen-questions-list');

    if (unseenQuestions.length === 0) {
        unseenList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Hai già visto tutte le domande disponibili! 🎉</p>';
        return;
    }

    // Show count first
    unseenList.innerHTML = `<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Trovate ${unseenQuestions.length} domande non viste. Calcolo probabilità...</p>`;

    // Render immediately
    setTimeout(() => {
        renderUnseenQuestions(unseenQuestions, allProbabilities);
    }, 50);
}

function renderUnseenQuestions(unseenQuestions, allProbabilities) {
    const unseenList = document.getElementById('unseen-questions-list');
    const BATCH_SIZE = 20;
    unseenList.innerHTML = '';
    let rendered = 0;
    function renderBatch() {
        const fragment = document.createDocumentFragment();
        for (let i = rendered; i < Math.min(rendered + BATCH_SIZE, unseenQuestions.length); i++) {
            const question = unseenQuestions[i];
            const categoryName = question.category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
            const correctAnswer = question.answers[0];
            const wrongAnswers = question.answers.slice(1);
            const answersHtml = `
                <div class="question-answers" id="unseen-answers-${i}" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                    <div style="margin-bottom: 0.5rem; padding: 0.5rem; background: rgba(40, 167, 69, 0.1); border-left: 3px solid #28a745; border-radius: 4px; color: var(--text-color);">
                        <span style="color: #28a745; font-weight: bold;">✓</span> ${correctAnswer}
                    </div>
                    ${wrongAnswers.map(answer => `
                        <div style="margin-bottom: 0.5rem; padding: 0.5rem; background: var(--container-bg); border-left: 3px solid var(--border-color); border-radius: 4px; color: var(--text-color);">
                            ${answer}
                        </div>
                    `).join('')}
                </div>
            `;
            const div = document.createElement('div');
            div.className = 'question-stat-item';
            div.style.cursor = 'pointer';
            div.setAttribute('onclick', `toggleUnseenAnswers(${i})`);
            div.innerHTML = `
                <div class="question-stat-header">
                    <div class="question-stat-text" id="unseen-question-text-${i}">${question.question}</div>
                    <span id="unseen-toggle-icon-${i}" style="color: var(--text-secondary); font-size: 1.2rem;">▼</span>
                </div>
                <div class="question-stat-details">
                    <span><strong>Categoria:</strong> ${categoryName}</span>
                    <span><strong>Probabilità:</strong> ${allProbabilities[question.id].toFixed(4)}%</span>
                    ${question.isBookmarked ? '<span style="color: gold;">⭐</span>' : ''}
                </div>
                ${answersHtml}
            `;
            fragment.appendChild(div);
        }
        unseenList.appendChild(fragment);
        rendered += BATCH_SIZE;
        if (rendered < unseenQuestions.length) {
            let spinner = document.getElementById('unseen-list-spinner');
            if (!spinner) {
                spinner = document.createElement('div');
                spinner.id = 'unseen-list-spinner';
                spinner.innerHTML = '<span class="spinner"></span>';
                spinner.style.textAlign = 'center';
                spinner.style.padding = '1rem';
                unseenList.appendChild(spinner);
            }
            setTimeout(renderBatch, 30);
        } else {
            const spinner = document.getElementById('unseen-list-spinner');
            if (spinner) spinner.remove();
        }
    }
    renderBatch();
}

function showStatsScreen() {
    // Hide other screens
    const setupScreen = document.getElementById('setupScreen');
    const statsScreen = document.getElementById('stats-screen');
    const quizScreen = document.getElementById('quiz');
    const summaryScreen = document.getElementById('summary');

    if (setupScreen) setupScreen.style.display = 'none';
    if (quizScreen) quizScreen.style.display = 'none';
    if (summaryScreen) summaryScreen.style.display = 'none';
    if (statsScreen) {
        statsScreen.style.display = 'block';

        // Set dataset filter to current dataset
        const datasetFilter = document.getElementById('stats-dataset-filter');
        if (datasetFilter) {
            datasetFilter.value = currentDataset;
        }

        // Populate category filter dropdown dynamically
        populateStatsCategoryFilter();
        populateAccuracyFilter();

        // Show loading indicator
        const statsList = document.getElementById('stats-list');
        const unseenList = document.getElementById('unseen-questions-list');
        if (statsList) statsList.innerHTML = '<p style="text-align: center; padding: 2rem;">Caricamento statistiche...</p>';
        if (unseenList) unseenList.innerHTML = '<p style="text-align: center; padding: 2rem;">Caricamento...</p>';

        // Defer heavy calculations to avoid blocking UI
        setTimeout(() => {
            populateStatistics(); // Load with defaults (now optimized)

            // Initialize toggle handlers
            initDettaglioDomandeToggle();
            initDomandeNonVisteToggle();
            initAccuratezzaTempoToggle();
            initRisultatiCategoriaToggle();
        }, 50);

        // Draw charts after a brief delay to let UI update
        setTimeout(() => {
            if (typeof disegnaGraficoAccuratezza === 'function') {
                disegnaGraficoAccuratezza();
            }
            if (typeof disegnaGraficoRisultati === 'function') {
                disegnaGraficoRisultati();
            }
        }, 100);
    }
}

// Populate stats category filter dropdown dynamically
function populateStatsCategoryFilter() {
    const filterSelect = document.getElementById('stats-category-filter');
    if (!filterSelect) return;

    // Clear existing options except "All"
    filterSelect.innerHTML = '<option value="all">Tutte le categorie</option>';

    // Add options for each category
    CATEGORIE.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category.replace(/_/g, ' ').toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        filterSelect.appendChild(option);
    });
}

function populateAccuracyFilter() {
    const filterSelect = document.getElementById('accuracy-filter');
    if (!filterSelect) return;

    // Clear existing options except "Overall"
    filterSelect.innerHTML = '<option value="overall">Accuratezza complessiva</option>';

    // Add options for each category
    CATEGORIE.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category.replace(/_/g, ' ').toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        filterSelect.appendChild(option);
    });
}


function initDettaglioDomandeToggle() {
    const toggle = document.getElementById('dettaglio-domande-toggle');
    const icon = document.getElementById('dettaglio-domande-icon');
    const statsList = document.getElementById('stats-list');

    if (!toggle || !icon || !statsList) return;

    // Remove existing listener if any
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);

    // Get updated references
    const updatedToggle = document.getElementById('dettaglio-domande-toggle');
    const updatedIcon = document.getElementById('dettaglio-domande-icon');
    const updatedStatsList = document.getElementById('stats-list');

    updatedToggle.addEventListener('click', () => {
        if (updatedStatsList.style.display === 'none') {
            updatedStatsList.style.display = 'block';
            updatedIcon.textContent = '▼';
        } else {
            updatedStatsList.style.display = 'none';
            updatedIcon.textContent = '▶';
        }
    });
}

function initDomandeNonVisteToggle() {
    const toggle = document.getElementById('domande-non-viste-toggle');
    const icon = document.getElementById('domande-non-viste-icon');
    const list = document.getElementById('unseen-questions-list');

    if (!toggle || !icon || !list) return;

    // Remove existing listener if any
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);

    // Get updated references
    const updatedToggle = document.getElementById('domande-non-viste-toggle');
    const updatedIcon = document.getElementById('domande-non-viste-icon');
    const updatedList = document.getElementById('unseen-questions-list');

    updatedToggle.addEventListener('click', () => {
        if (updatedList.style.display === 'none') {
            updatedList.style.display = 'block';
            updatedIcon.textContent = '▼';
        } else {
            updatedList.style.display = 'none';
            updatedIcon.textContent = '▶';
        }
    });
}

function initAccuratezzaTempoToggle() {
    const toggle = document.getElementById('accuratezza-tempo-toggle');
    const icon = document.getElementById('accuratezza-tempo-icon');
    const content = document.getElementById('accuratezza-tempo-content');

    if (!toggle || !icon || !content) return;

    // Remove existing listener if any
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);

    // Get updated references
    const updatedToggle = document.getElementById('accuratezza-tempo-toggle');
    const updatedIcon = document.getElementById('accuratezza-tempo-icon');
    const updatedContent = document.getElementById('accuratezza-tempo-content');

    updatedToggle.addEventListener('click', () => {
        if (updatedContent.style.display === 'none') {
            updatedContent.style.display = 'block';
            updatedIcon.textContent = '▼';
            // Redraw chart when expanded
            if (typeof disegnaGraficoAccuratezza === 'function') {
                setTimeout(() => disegnaGraficoAccuratezza(), 50);
            }
        } else {
            updatedContent.style.display = 'none';
            updatedIcon.textContent = '▶';
        }
    });
}

function initRisultatiCategoriaToggle() {
    const toggle = document.getElementById('risultati-categoria-toggle');
    const icon = document.getElementById('risultati-categoria-icon');
    const content = document.getElementById('risultati-categoria-content');

    if (!toggle || !icon || !content) return;

    // Remove existing listener if any
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);

    // Get updated references
    const updatedToggle = document.getElementById('risultati-categoria-toggle');
    const updatedIcon = document.getElementById('risultati-categoria-icon');
    const updatedContent = document.getElementById('risultati-categoria-content');

    updatedToggle.addEventListener('click', () => {
        if (updatedContent.style.display === 'none') {
            updatedContent.style.display = 'block';
            updatedIcon.textContent = '▼';
            // Redraw chart when expanded
            if (typeof disegnaGraficoRisultati === 'function') {
                setTimeout(() => disegnaGraficoRisultati(), 50);
            }
        } else {
            updatedContent.style.display = 'none';
            updatedIcon.textContent = '▶';
        }
    });
}

function hideStatsScreen() {
    const setupScreen = document.getElementById('setupScreen');
    const statsScreen = document.getElementById('stats-screen');

    if (statsScreen) statsScreen.style.display = 'none';
    if (setupScreen) setupScreen.style.display = 'block';
}

function nuovaDomanda() {
    nextBtn.disabled = true;
    answersEl.innerHTML = "";

    if (currentQuestionIndex < quizHistory.length - 1) {
        currentQuestionIndex++;
        mostraDomandaDaCronologia();
        return;
    }

    if (domandeFatte >= numDomande) {
        mostraRiepilogo();
        return;
    }

    // Cache localStorage reads ONCE at the start (instead of reading hundreds of times)
    const savedQuestions = SafeStorage.get("savedQuestions") || [];
    const questionStats = SafeStorage.get("questionStats") || {};
    const onlySaved = onlySavedCheckbox.checked;

    // Convert to Set for O(1) lookup instead of O(n)
    const domandeUsateSet = new Set(domandeUsate);
    const savedQuestionsSet = onlySaved ? new Set(savedQuestions) : null;

    let domandeDisponibili = [];

    selectedCategories.forEach(cat => {
        if (!domande[cat]) {
            console.warn(`Categoria ${cat} non trovata nel database delle domande`);
            return;
        }

        domande[cat].forEach(q => {
            const domandaId = `${cat}::${q.domanda}`;

            if (onlySaved && !savedQuestionsSet.has(domandaId)) {
                return;
            }

            // Filter by topic if topics are selected
            if (selectedTopics.length > 0) {
                const questionTopic = q.topic ? q.topic.trim() : "";
                if (questionTopic === "" || !selectedTopics.includes(questionTopic)) {
                    return;
                }
            }

            if (!domandeUsateSet.has(domandaId)) {
                domandeDisponibili.push({ categoria: cat, domanda: q, id: domandaId });
            }
        });
    });

    if (domandeDisponibili.length === 0) {
        domandeUsate = [];
        domandeUsateSet.clear();
        selectedCategories.forEach(cat => {
            if (!domande[cat]) return;

            domande[cat].forEach(q => {
                const domandaId = `${cat}::${q.domanda}`;
                if (onlySaved && !savedQuestionsSet.has(domandaId)) return;

                // Filter by topic if topics are selected
                if (selectedTopics.length > 0) {
                    const questionTopic = q.topic ? q.topic.trim() : "";
                    if (questionTopic === "" || !selectedTopics.includes(questionTopic)) {
                        return;
                    }
                }

                domandeDisponibili.push({ categoria: cat, domanda: q, id: domandaId });
            });
        });
    }

    if (domandeDisponibili.length === 0) {
        alert("Nessuna domanda salvata disponibile nelle categorie selezionate. Disattiva 'Solo domande salvate' o salva alcune domande.");
        mostraSezione('singleplayer-menu');
        quizInCorso = false;
        return;
    }

    // Use weighted selection with cached data (no more localStorage reads!)
    const scelta = selectWeightedQuestion(domandeDisponibili, questionStats, savedQuestions);
    currentCategory = scelta.categoria;
    currentQuestionId = scelta.id;
    const q = scelta.domanda;

    domandeUsate.push(scelta.id);

    progressEl.textContent = `Domanda ${domandeFatte + 1} / ${numDomande}`;
    categoryEl.textContent = currentCategory.replace(/_/g, " ").toLowerCase();
    questionEl.textContent = q.domanda;

    // Update bookmark button with cached data (avoid extra localStorage read)
    if (savedQuestions.includes(currentQuestionId)) {
        bookmarkBtn.classList.add("saved");
        bookmarkBtn.textContent = "⭐";
    } else {
        bookmarkBtn.classList.remove("saved");
        bookmarkBtn.textContent = "☆";
    }

    // Store the correct answer before shuffling (first answer is correct by default)
    correctAnswer = q.risposte[0];

    // Shuffle the answers
    const risposteMischiate = [...q.risposte].sort(() => Math.random() - 0.5);

    currentQuestionIndex = quizHistory.length;
    quizHistory.push({
        domanda: q.domanda,
        categoria: currentCategory,
        id: currentQuestionId,
        risposteMischiate: risposteMischiate,
        rispostaData: null,
        correctAnswer: correctAnswer,
        answered: false
    });

    prevBtn.disabled = currentQuestionIndex === 0;

    // Batch DOM operations using DocumentFragment (faster than individual appends)
    const fragment = document.createDocumentFragment();
    risposteMischiate.forEach(r => {
        const btn = document.createElement("button");
        btn.textContent = r;
        btn.addEventListener("click", () => selezionaRisposta(r, btn, q));
        fragment.appendChild(btn);
    });
    answersEl.appendChild(fragment);

    aggiornaPunteggio();
    aggiornaProgressBar();
}

function mostraDomandaDaCronologia() {
    const item = quizHistory[currentQuestionIndex];

    currentCategory = item.categoria;
    currentQuestionId = item.id;
    correctAnswer = item.correctAnswer;

    progressEl.textContent = `Domanda ${currentQuestionIndex + 1} / ${numDomande}`;
    categoryEl.textContent = currentCategory.replace(/_/g, " ").toLowerCase();
    questionEl.textContent = item.domanda;

    aggiornaBookmarkButton();

    prevBtn.disabled = currentQuestionIndex === 0;

    if (item.answered) {
        nextBtn.disabled = false;
    }

    const progressBarFill = document.getElementById("progress-bar-fill");
    const percentuale = ((currentQuestionIndex + 1) / numDomande) * 100;
    progressBarFill.style.width = `${percentuale}%`;

    item.risposteMischiate.forEach(r => {
        const btn = document.createElement("button");
        btn.textContent = r;

        if (item.answered) {
            btn.disabled = true;

            if (r === item.rispostaData) {
                if (r === correctAnswer) {
                    btn.classList.add("correct");
                } else {
                    btn.classList.add("wrong");
                }
            }

            if (r === correctAnswer) {
                btn.classList.add("correct");
            }
        } else {
            btn.addEventListener("click", () => selezionaRisposta(r, btn, { domanda: item.domanda, risposte: [correctAnswer] }));
        }

        answersEl.appendChild(btn);
    });
}

function selezionaRisposta(risposta, btn, domandaCorrente) {
    const buttons = answersEl.querySelectorAll("button");
    buttons.forEach(b => b.disabled = true);

    const isCorrect = risposta === correctAnswer;

    // Apply visual feedback FIRST (before any localStorage operations)
    if (isCorrect) {
        btn.classList.add("correct");
        punteggio++;
    } else {
        btn.classList.add("wrong");
        const corretto = Array.from(buttons).find(b => b.textContent === correctAnswer);
        if (corretto) corretto.classList.add("correct");
    }

    // Update UI state immediately
    domandeFatte++;
    aggiornaPunteggio();
    aggiornaProgressBar();
    nextBtn.disabled = false;

    // Now do all the heavy lifting in background (after visual feedback is done)
    setTimeout(() => {
        // Update question statistics
        updateQuestionStats(currentQuestionId, isCorrect);

        if (isCorrect) {
            corrette.push({
                domanda: domandaCorrente.domanda,
                rispostaData: risposta,
                rispostaCorretta: correctAnswer,
                categoria: currentCategory
            });

            const correttePersistenti = SafeStorage.get("corretteQuiz") || [];
            correttePersistenti.push({
                domanda: domandaCorrente.domanda,
                rispostaData: risposta,
                rispostaCorretta: correctAnswer,
                categoria: currentCategory
            });
            SafeStorage.set("corretteQuiz", correttePersistenti);
        } else {
            errori.push({
                domanda: domandaCorrente.domanda,
                rispostaData: risposta,
                rispostaCorretta: correctAnswer,
                categoria: currentCategory
            });

            const erroriPersistenti = SafeStorage.get("erroriQuiz") || [];
            erroriPersistenti.push({
                domanda: domandaCorrente.domanda,
                rispostaData: risposta,
                rispostaCorretta: correctAnswer,
                categoria: currentCategory
            });
            SafeStorage.set("erroriQuiz", erroriPersistenti);
        }

        if (currentQuestionIndex >= 0 && currentQuestionIndex < quizHistory.length) {
            quizHistory[currentQuestionIndex].rispostaData = risposta;
            quizHistory[currentQuestionIndex].answered = true;
        }

        // Update result chart in real-time if stats screen is visible
        const statsScreen = document.getElementById('stats-screen');
        if (statsScreen && statsScreen.style.display === 'block' && typeof disegnaGraficoRisultati === 'function') {
            disegnaGraficoRisultati();
        }
    }, 0);
}

function aggiornaPunteggio() {
    scoreEl.textContent = `Punteggio: ${punteggio}`;
}

function aggiornaProgressBar() {
    const progressBarFill = document.getElementById("progress-bar-fill");
    const percentuale = (domandeFatte / numDomande) * 100;
    progressBarFill.style.width = `${percentuale}%`;
}

function mostraRiepilogo(scaduto = false) {
    clearInterval(timerInterval);
    mostraSezione('summary');
    quizInCorso = false;

    finalScoreEl.textContent = scaduto
        ? `⏰ Tempo scaduto! Hai risposto correttamente a ${punteggio} domande su ${numDomande}.`
        : `Hai risposto correttamente a ${punteggio} domande su ${numDomande}.`;

    errorListEl.innerHTML = "";
    if (errori.length === 0) {
        errorListEl.innerHTML = "<p><strong>Perfetto!</strong> Non hai commesso errori 🎉</p>";
    } else {
        errorListEl.innerHTML = "<p><strong>Domande da rivedere:</strong></p>";
        errori.forEach((err, i) => {
            const div = document.createElement("div");
            div.classList.add("wrong-question");
            div.innerHTML = `
                <p><strong>${i + 1}. ${err.domanda}</strong></p>
                <p>❌ Tua risposta: <em>${err.rispostaData}</em></p>
                <p>✅ Corretta: <em>${err.rispostaCorretta}</em></p>
            `;
            errorListEl.appendChild(div);
        });
    }

    // Data already saved incrementally in selezionaRisposta, no need to duplicate here
    // Just save the session history for the accuracy chart
    const sessionHistory = SafeStorage.get("sessionHistory") || [];
    const accuracy = numDomande > 0 ? (punteggio / numDomande) * 100 : 0;

    const categoryAccuracy = {};
    const categoryQuestionCount = {};
    CATEGORIE.forEach(cat => {
        const catCorrette = corrette.filter(c => c.categoria === cat).length;
        const catErrate = errori.filter(e => e.categoria === cat).length;
        const catTotale = catCorrette + catErrate;
        categoryAccuracy[cat] = catTotale > 0 ? (catCorrette / catTotale) * 100 : null;
        categoryQuestionCount[cat] = catTotale; // Store actual count of questions per category
    });

    sessionHistory.push({
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('it-IT'),
        totalQuestions: numDomande,
        correctAnswers: punteggio,
        accuracy: accuracy,
        categoryAccuracy: categoryAccuracy,
        categoryQuestionCount: categoryQuestionCount
    });
    SafeStorage.set("sessionHistory", sessionHistory);

    if (punteggio === numDomande && numDomande > 0) {
        lanceConfetti();
    }
}

function lanceConfetti() {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#ff69b4'];
    const confettiCount = 150;

    for (let i = 0; i < confettiCount; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = (Math.random() * 1.5 + 1.5) + 's';
            confetti.style.animationDelay = '0s';
            confetti.style.width = (Math.random() * 10 + 5) + 'px';
            confetti.style.height = (Math.random() * 10 + 5) + 'px';

            const shapes = ['0%', '50%'];
            confetti.style.borderRadius = shapes[Math.floor(Math.random() * shapes.length)];

            document.body.appendChild(confetti);

            setTimeout(() => {
                confetti.remove();
            }, 3000);
        }, i * 20);
    }
}

function aggiornaBookmarkButton() {
    if (!currentQuestionId) return;

    const savedQuestions = SafeStorage.get("savedQuestions") || [];
    if (savedQuestions.includes(currentQuestionId)) {
        bookmarkBtn.classList.add("saved");
        bookmarkBtn.textContent = "⭐";
    } else {
        bookmarkBtn.classList.remove("saved");
        bookmarkBtn.textContent = "☆";
    }
}

function tornaAlMenu() {
    clearInterval(timerInterval);
    timerEl.textContent = "";

    // Check if we're on singleplayer.html or index.html
    if (window.location.pathname.includes('singleplayer.html')) {
        window.location.href = 'index.html';
    } else {
        mostraSezione('singleplayer-menu');
        const checkboxes = categoryMenu.querySelectorAll("input[type='checkbox']");
        checkboxes.forEach(cb => cb.checked = false);
    }

    quizInCorso = false;
}

// Load and apply quiz settings
function loadQuizSettings() {
    const savedSettings = SafeStorage.get("quizSettings");

    // Default settings
    const defaults = {
        categories: CATEGORIE, // All categories selected
        numDomande: 30,
        timer: 0,
        onlySavedQuestions: false,
        selectionStrategy: 'adaptive'
    };

    const settings = savedSettings || defaults;

    // Apply category selections
    if (categoryMenu) {
        const checkboxes = categoryMenu.querySelectorAll("input[type='checkbox']");
        checkboxes.forEach(cb => {
            if (cb.value === "only-saved-questions") {
                return; // Skip this one, handled separately
            }
            cb.checked = settings.categories.includes(cb.value);
        });
    }

    // Apply other settings
    if (numDomandeSelect) numDomandeSelect.value = settings.numDomande;
    if (timerInput) timerInput.value = settings.timer;
    if (onlySavedCheckbox) onlySavedCheckbox.checked = settings.onlySavedQuestions;
    if (selectionStrategySelect) selectionStrategySelect.value = settings.selectionStrategy;
}

// Save quiz settings
function saveQuizSettings() {
    if (!categoryMenu) return;

    const checkboxes = categoryMenu.querySelectorAll("input[type='checkbox']:checked");
    const categories = Array.from(checkboxes)
        .map(cb => cb.value)
        .filter(val => val !== "only-saved-questions");

    const settings = {
        categories: categories,
        numDomande: numDomandeSelect ? parseInt(numDomandeSelect.value) : 30,
        timer: timerInput ? parseInt(timerInput.value) : 0,
        onlySavedQuestions: onlySavedCheckbox ? onlySavedCheckbox.checked : false,
        selectionStrategy: selectionStrategySelect ? selectionStrategySelect.value : 'adaptive'
    };

    SafeStorage.set("quizSettings", settings);
}

// Event Listeners
function initializeEventListeners() {
    // Main menu navigation (only on index.html)
    const singleplayerModeBtn = document.getElementById("singleplayer-mode-btn");
    if (singleplayerModeBtn) {
        singleplayerModeBtn.addEventListener("click", () => {
            window.location.href = 'singleplayer.html';
        });
    }

    const multiplayerModeBtn = document.getElementById("multiplayer-mode-btn");
    if (multiplayerModeBtn) {
        multiplayerModeBtn.addEventListener("click", () => {
            window.location.href = 'multiplayer.html';
        });
    }

    // Back to main menu buttons
    const backToMainBtn = document.getElementById("back-to-main-btn");
    if (backToMainBtn) {
        backToMainBtn.addEventListener("click", () => {
            window.location.href = 'index.html';
        });
    }

    // Dataset switcher in singleplayer view
    const datasetSwitcher = document.getElementById("dataset-switcher");
    if (datasetSwitcher) {
        // Set initial value from current dataset
        datasetSwitcher.value = currentDataset;

        datasetSwitcher.addEventListener("change", async () => {
            const selectedDataset = datasetSwitcher.value;

            // Show loading indicator
            const container = document.getElementById('category-cards-container');
            if (container) {
                container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">Caricamento domande...</p>';
            }

            // Load the new dataset
            await loadQuestions(selectedDataset);
            window.currentDataset = currentDataset;

            // Regenerate category cards and topics
            updateTopicCheckboxes();

            console.log(`Switched to dataset: ${selectedDataset}`);
        });
    }

    const backToMainMenuBtn = document.getElementById("back-to-main-menu-btn");
    if (backToMainMenuBtn) {
        backToMainMenuBtn.addEventListener("click", () => {
            mostraSezione('main-menu');
        });
    }

    const backToMainFromMpBtn = document.getElementById("back-to-main-from-mp-btn");
    if (backToMainFromMpBtn) {
        backToMainFromMpBtn.addEventListener("click", () => {
            mostraSezione('main-menu');
        });
    }

    // Multiplayer menu buttons - redirect to multiplayer.html
    const createRoomMpBtn = document.getElementById("create-room-mp-btn");
    if (createRoomMpBtn) {
        createRoomMpBtn.addEventListener("click", () => {
            window.location.href = 'multiplayer.html';
        });
    }

    const joinRoomMpBtn = document.getElementById("join-room-mp-btn");
    if (joinRoomMpBtn) {
        joinRoomMpBtn.addEventListener("click", () => {
            window.location.href = 'multiplayer.html';
        });
    }

    // Quiz controls - only add if elements exist
    if (nextBtn) {
        nextBtn.addEventListener("click", nuovaDomanda);
    }

    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            if (currentQuestionIndex > 0) {
                currentQuestionIndex--;
                answersEl.innerHTML = "";
                mostraDomandaDaCronologia();
            }
        });
    }

    if (bookmarkBtn) {
        bookmarkBtn.addEventListener("click", () => {
            if (!currentQuestionId) return;

            const savedQuestions = SafeStorage.get("savedQuestions") || [];
            const index = savedQuestions.indexOf(currentQuestionId);

            if (index >= 0) {
                savedQuestions.splice(index, 1);
            } else {
                savedQuestions.push(currentQuestionId);
            }

            SafeStorage.set("savedQuestions", savedQuestions);
            aggiornaBookmarkButton();
        });
    }

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            if (quizInCorso && !confirm("Sei sicuro di voler tornare al menu? Il quiz in corso andrà perso.")) return;
            tornaAlMenu();
        });
    }

    if (restartBtn) {
        restartBtn.addEventListener("click", tornaAlMenu);
    }

    if (clearPersistentBtn) {
        clearPersistentBtn.addEventListener("click", () => {
            const confirmText = prompt("Per confermare l'eliminazione di tutta la cronologia, le domande salvate e le impostazioni preferite, scrivi ELIMINA (in maiuscolo):");
            if (confirmText !== "ELIMINA") {
                if (confirmText !== null) {
                    alert("Operazione annullata. Il testo inserito non corrisponde.");
                }
                return;
            }
            SafeStorage.remove("erroriQuiz");
            SafeStorage.remove("corretteQuiz");
            SafeStorage.remove("sessionHistory");
            SafeStorage.remove("savedQuestions");
            SafeStorage.remove("questionStats");
            SafeStorage.remove("quizSettings");
            alert("Cronologia, domande salvate e impostazioni preferite cancellate.");

            // Reload settings to apply defaults
            loadQuizSettings();
        });
    }

    // Statistics screen event listeners
    const viewStatsBtn = document.getElementById("view-stats-btn");
    if (viewStatsBtn) {
        viewStatsBtn.addEventListener("click", () => {
            showStatsScreen();
        });
    }

    const backFromStatsBtn = document.getElementById("back-from-stats-btn");
    if (backFromStatsBtn) {
        backFromStatsBtn.addEventListener("click", () => {
            hideStatsScreen();
        });
    }

    const statsDatasetFilter = document.getElementById("stats-dataset-filter");
    if (statsDatasetFilter) {
        statsDatasetFilter.addEventListener("change", async () => {
            const selectedDataset = statsDatasetFilter.value;

            // Show loading indicator
            const statsList = document.getElementById('stats-list');
            const unseenList = document.getElementById('unseen-questions-list');
            if (statsList) statsList.innerHTML = '<p style="text-align: center; padding: 2rem;">Caricamento...</p>';
            if (unseenList) unseenList.innerHTML = '<p style="text-align: center; padding: 2rem;">Caricamento...</p>';

            // Load the new dataset
            await loadQuestions(selectedDataset);
            window.currentDataset = currentDataset;

            // Update category filter with new categories
            populateStatsCategoryFilter();
            populateAccuracyFilter();

            // Reload statistics
            const filterValue = document.getElementById("stats-category-filter")?.value || 'all';
            const sortValue = document.getElementById("stats-sort-order")?.value || 'worst';
            populateStatistics(filterValue, sortValue);

            // Redraw charts
            if (typeof disegnaGraficoAccuratezza === 'function') {
                disegnaGraficoAccuratezza();
            }
            if (typeof disegnaGraficoRisultati === 'function') {
                disegnaGraficoRisultati();
            }
        });
    }

    const statsCategoryFilter = document.getElementById("stats-category-filter");
    if (statsCategoryFilter) {
        statsCategoryFilter.addEventListener("change", () => {
            const filterValue = statsCategoryFilter.value;
            const sortValue = document.getElementById("stats-sort-order")?.value || 'worst';
            populateStatistics(filterValue, sortValue);
        });
    }

    const statsSortOrder = document.getElementById("stats-sort-order");
    if (statsSortOrder) {
        statsSortOrder.addEventListener("change", () => {
            const filterValue = document.getElementById("stats-category-filter")?.value || 'all';
            const sortValue = statsSortOrder.value;
            populateStatistics(filterValue, sortValue);
        });
    }

    if (startBtn) {
        startBtn.addEventListener("click", (event) => {
            if (!userActivated) {
                userActivated = true;
                try {
                    const ac = new (window.AudioContext || window.webkitAudioContext)();
                    ac.close().catch(() => { });
                } catch (e) { }
            }

            event.preventDefault();
            saveQuizSettings(); // Save settings before starting quiz
            avviaQuiz();
        });
    }

    // Save settings when changed
    if (categoryMenu) {
        const checkboxes = categoryMenu.querySelectorAll("input[type='checkbox']");
        checkboxes.forEach(cb => {
            cb.addEventListener("change", saveQuizSettings);
        });
    }
    if (numDomandeSelect) numDomandeSelect.addEventListener("change", saveQuizSettings);
    if (timerInput) timerInput.addEventListener("change", saveQuizSettings);
    if (selectionStrategySelect) selectionStrategySelect.addEventListener("change", saveQuizSettings);
    if (onlySavedCheckbox) onlySavedCheckbox.addEventListener("change", saveQuizSettings);

    const accuracyFilter = document.getElementById("accuracy-filter");
    if (accuracyFilter) {
        accuracyFilter.addEventListener("change", () => {
            disegnaGraficoAccuratezza();
        });
    }

    // Dark Mode Toggle
    const darkModeCheckbox = document.getElementById("dark-mode-checkbox");
    const body = document.body;

    const savedDarkMode = SafeStorage.get("darkMode");
    if (savedDarkMode) {
        body.classList.add("dark-mode");
        if (darkModeCheckbox) {
            darkModeCheckbox.checked = true;
        }
    }

    if (darkModeCheckbox) {
        darkModeCheckbox.addEventListener("change", () => {
            body.classList.toggle("dark-mode");
            const isDarkMode = body.classList.contains("dark-mode");
            SafeStorage.set("darkMode", isDarkMode);

            if (summaryEl && summaryEl.style.display === "flex") {
                disegnaGraficoAccuratezza();
                disegnaGraficoRisultati();
            }
        });
    }

    // Multiplayer button
    const multiplayerBtn = document.getElementById("multiplayer-btn");
    if (multiplayerBtn) {
        multiplayerBtn.addEventListener("click", () => {
            window.location.href = "multiplayer.html";
        });
    }
}

// Migrate old statistics to new namespaced format
function migrateOldStatistics() {
    try {
        // Check if old statistics exist (without namespace)
        const oldStats = localStorage.getItem('questionStats');
        const oldSaved = localStorage.getItem('savedQuestions');
        const oldSettings = localStorage.getItem('quizSettings');
        
        // Check if new statistics already exist for questions.json
        const newStatsKey = 'q_questionStats';
        const newStats = localStorage.getItem(newStatsKey);
        
        // Only migrate if old data exists and new data doesn't
        if (oldStats && !newStats) {
            console.log('Migrating old statistics to new format...');
            localStorage.setItem(newStatsKey, oldStats);
            console.log('Statistics migrated to:', newStatsKey);
        }
        
        if (oldSaved && !localStorage.getItem('q_savedQuestions')) {
            localStorage.setItem('q_savedQuestions', oldSaved);
            console.log('Saved questions migrated');
        }
        
        if (oldSettings && !localStorage.getItem('q_quizSettings')) {
            localStorage.setItem('q_quizSettings', oldSettings);
            console.log('Quiz settings migrated');
        }
    } catch (e) {
        console.warn('Could not migrate old statistics:', e);
    }
}

// Initialize app
document.addEventListener("DOMContentLoaded", async () => {
    // Migrate old statistics before anything else
    migrateOldStatistics();
    
    // Check if there's a dataset parameter in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const datasetParam = urlParams.get('dataset');

    if (datasetParam) {
        await loadQuestions(datasetParam);
    } else {
        await loadQuestions();
    }

    // Make currentDataset available globally for SafeStorage
    window.currentDataset = currentDataset;

    initDomElements();
    initializeEventListeners();
    initializeChartListeners();

    // Load saved quiz settings or apply defaults
    loadQuizSettings();

    if (!SafeStorage.isAvailable()) {
        console.warn("localStorage non disponibile — verrà usato storage in-memory.");
    }

    // Determine which page we're on and show appropriate screen
    if (window.location.pathname.includes('singleplayer.html')) {
        mostraSezione('singleplayer-menu');
        // Initialize topic checkboxes after loading questions
        updateTopicCheckboxes();
    } else if (document.getElementById('main-menu')) {
        // We're on index.html
        mostraSezione('main-menu');
    }
});

// Prevent user from leaving page during quiz
window.addEventListener('beforeunload', function (e) {
    if (quizInCorso) {
        // Cancel the event
        e.preventDefault();
        // Chrome requires returnValue to be set
        e.returnValue = '';
        return '';
    }
});

// Make toggleAnswers globally accessible for onclick handlers
window.toggleAnswers = function (index) {
    const answersDiv = document.getElementById(`answers-${index}`);
    const toggleIcon = document.getElementById(`toggle-icon-${index}`);
    const questionText = document.getElementById(`question-text-${index}`);

    if (answersDiv) {
        if (answersDiv.style.display === 'none') {
            answersDiv.style.display = 'block';
            if (toggleIcon) toggleIcon.textContent = '▲';
            if (questionText) questionText.classList.add('expanded');
        } else {
            answersDiv.style.display = 'none';
            if (toggleIcon) toggleIcon.textContent = '▼';
            if (questionText) questionText.classList.remove('expanded');
        }
    }
};

// Make toggleUnseenAnswers globally accessible for onclick handlers
window.toggleUnseenAnswers = function (index) {
    const answersDiv = document.getElementById(`unseen-answers-${index}`);
    const toggleIcon = document.getElementById(`unseen-toggle-icon-${index}`);
    const questionText = document.getElementById(`unseen-question-text-${index}`);

    if (answersDiv) {
        if (answersDiv.style.display === 'none') {
            answersDiv.style.display = 'block';
            if (toggleIcon) toggleIcon.textContent = '▲';
            if (questionText) questionText.classList.add('expanded');
        } else {
            answersDiv.style.display = 'none';
            if (toggleIcon) toggleIcon.textContent = '▼';
            if (questionText) questionText.classList.remove('expanded');
        }
    }
};
