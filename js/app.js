// Quiz Application Main Logic

// Global constants and variables
const CATEGORIE = ["CULTURA_GENERALE", "ATTITUDINALI_LOGICO_DEDUTTIVI", "ATTITUDINALI_LOGICO_MATEMATICI", "ATTITUDINALI_LOGICO_VERBALI"];

let numDomande = 10;
let tempoTotale = 0;
let tempoRimanente = 0;
let timerInterval = null;
let domande = {};

// DOM Elements
let categoryMenu, startBtn, quizContainer, categoryEl, questionEl, answersEl;
let nextBtn, scoreEl, summaryEl, finalScoreEl, progressEl, errorListEl;
let restartBtn, backBtn, numDomandeSelect, timerInput, timerEl;
let clearPersistentBtn, bookmarkBtn, onlySavedCheckbox, prevBtn;

// Quiz state
let selectedCategories = [];
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

// Load questions from JSON
async function loadQuestions() {
    try {
        const response = await fetch('data/questions.json');
        domande = await response.json();
        window.domande = domande; // Make available globally for charts
        window.CATEGORIE = CATEGORIE; // Make available globally for charts
    } catch (error) {
        console.error("Error loading questions:", error);
        // Fallback to embedded data
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
        window.domande = domande;
        window.CATEGORIE = CATEGORIE;
    }
}

// Initialize DOM references
function initializeDOMReferences() {
    categoryMenu = document.getElementById("category-menu");
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
}

// Helper per mostrare/nascondere sezioni
const mostraSezione = (sezione) => {
    categoryMenu.style.display = sezione === 'menu' ? "flex" : "none";
    quizContainer.style.display = sezione === 'quiz' ? "flex" : "none";
    summaryEl.style.display = sezione === 'summary' ? "flex" : "none";
};

function avviaQuiz() {
    const checkboxes = categoryMenu.querySelectorAll("input[type='checkbox']:checked");
    selectedCategories = Array.from(checkboxes).map(cb => cb.value).filter(val => val !== "only-saved-questions");
    numDomande = parseInt(numDomandeSelect.value);
    tempoTotale = parseInt(timerInput.value) * 60;
    tempoRimanente = tempoTotale;

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

    let domandeDisponibili = [];
    const savedQuestions = SafeStorage.get("savedQuestions") || [];
    const onlySaved = onlySavedCheckbox.checked;

    selectedCategories.forEach(cat => {
        if (!domande[cat]) {
            console.warn(`Categoria ${cat} non trovata nel database delle domande`);
            return;
        }

        domande[cat].forEach(q => {
            const domandaId = `${cat}::${q.domanda}`;

            if (onlySaved && !savedQuestions.includes(domandaId)) {
                return;
            }

            if (!domandeUsate.includes(domandaId)) {
                domandeDisponibili.push({ categoria: cat, domanda: q, id: domandaId });
            }
        });
    });

    if (domandeDisponibili.length === 0) {
        domandeUsate = [];
        selectedCategories.forEach(cat => {
            if (!domande[cat]) return;

            domande[cat].forEach(q => {
                const domandaId = `${cat}::${q.domanda}`;
                if (onlySaved && !savedQuestions.includes(domandaId)) return;
                domandeDisponibili.push({ categoria: cat, domanda: q, id: domandaId });
            });
        });
    }

    if (domandeDisponibili.length === 0) {
        alert("Nessuna domanda salvata disponibile nelle categorie selezionate. Disattiva 'Solo domande salvate' o salva alcune domande.");
        tornaAlMenu();
        return;
    }

    const scelta = domandeDisponibili[Math.floor(Math.random() * domandeDisponibili.length)];
    currentCategory = scelta.categoria;
    currentQuestionId = scelta.id;
    const q = scelta.domanda;

    domandeUsate.push(scelta.id);

    progressEl.textContent = `Domanda ${domandeFatte + 1} / ${numDomande}`;
    categoryEl.textContent = currentCategory.replace(/_/g, " ").toLowerCase();
    questionEl.textContent = q.domanda;

    aggiornaBookmarkButton();

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

    risposteMischiate.forEach(r => {
        const btn = document.createElement("button");
        btn.textContent = r;
        btn.addEventListener("click", () => selezionaRisposta(r, btn, q));
        answersEl.appendChild(btn);
    });

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

    if (risposta === correctAnswer) {
        btn.classList.add("correct");
        punteggio++;

        corrette.push({
            domanda: domandaCorrente.domanda,
            rispostaData: risposta,
            rispostaCorretta: correctAnswer,
            categoria: currentCategory
        });
    } else {
        btn.classList.add("wrong");
        const corretto = Array.from(buttons).find(b => b.textContent === correctAnswer);
        if (corretto) corretto.classList.add("correct");

        errori.push({
            domanda: domandaCorrente.domanda,
            rispostaData: risposta,
            rispostaCorretta: correctAnswer,
            categoria: currentCategory
        });
    }

    if (currentQuestionIndex >= 0 && currentQuestionIndex < quizHistory.length) {
        quizHistory[currentQuestionIndex].rispostaData = risposta;
        quizHistory[currentQuestionIndex].answered = true;
    }

    domandeFatte++;
    aggiornaPunteggio();
    aggiornaProgressBar();
    nextBtn.disabled = false;
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

    const erroriPersistenti = SafeStorage.get("erroriQuiz") || [];
    erroriPersistenti.push(...errori);
    SafeStorage.set("erroriQuiz", erroriPersistenti);

    const correttePersistenti = SafeStorage.get("corretteQuiz") || [];
    correttePersistenti.push(...corrette);
    SafeStorage.set("corretteQuiz", correttePersistenti);

    const sessionHistory = SafeStorage.get("sessionHistory") || [];
    const accuracy = numDomande > 0 ? (punteggio / numDomande) * 100 : 0;

    const categoryAccuracy = {};
    CATEGORIE.forEach(cat => {
        const catCorrette = corrette.filter(c => c.categoria === cat).length;
        const catErrate = errori.filter(e => e.categoria === cat).length;
        const catTotale = catCorrette + catErrate;
        categoryAccuracy[cat] = catTotale > 0 ? (catCorrette / catTotale) * 100 : null;
    });

    sessionHistory.push({
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('it-IT'),
        totalQuestions: numDomande,
        correctAnswers: punteggio,
        accuracy: accuracy,
        categoryAccuracy: categoryAccuracy
    });
    SafeStorage.set("sessionHistory", sessionHistory);

    disegnaGraficoAccuratezza();
    disegnaGraficoRisultati();

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
    mostraSezione('menu');
    timerEl.textContent = "";
    const checkboxes = categoryMenu.querySelectorAll("input[type='checkbox']");
    checkboxes.forEach(cb => cb.checked = false);
    quizInCorso = false;
}

// Event Listeners
function initializeEventListeners() {
    nextBtn.addEventListener("click", nuovaDomanda);

    prevBtn.addEventListener("click", () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            answersEl.innerHTML = "";
            mostraDomandaDaCronologia();
        }
    });

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

    backBtn.addEventListener("click", () => {
        if (quizInCorso && !confirm("Sei sicuro di voler tornare al menu? Il quiz in corso andrà perso.")) return;
        tornaAlMenu();
    });

    restartBtn.addEventListener("click", tornaAlMenu);

    clearPersistentBtn.addEventListener("click", () => {
        if (!confirm("Sei sicuro di voler cancellare tutta la cronologia e le domande salvate? Questa azione non può essere annullata.")) return;
        SafeStorage.remove("erroriQuiz");
        SafeStorage.remove("corretteQuiz");
        SafeStorage.remove("sessionHistory");
        SafeStorage.remove("savedQuestions");
        alert("Cronologia e domande salvate cancellate.");
    });

    const accuracyFilter = document.getElementById("accuracy-filter");
    accuracyFilter.addEventListener("change", () => {
        disegnaGraficoAccuratezza();
    });

    // Dark Mode Toggle
    const darkModeCheckbox = document.getElementById("dark-mode-checkbox");
    const body = document.body;

    const savedDarkMode = SafeStorage.get("darkMode");
    if (savedDarkMode) {
        body.classList.add("dark-mode");
        darkModeCheckbox.checked = true;
    }

    darkModeCheckbox.addEventListener("change", () => {
        body.classList.toggle("dark-mode");
        const isDarkMode = body.classList.contains("dark-mode");
        SafeStorage.set("darkMode", isDarkMode);

        if (summaryEl.style.display === "flex") {
            disegnaGraficoAccuratezza();
            disegnaGraficoRisultati();
        }
    });

    startBtn.addEventListener("click", (event) => {
        if (!userActivated) {
            userActivated = true;
            try {
                const ac = new (window.AudioContext || window.webkitAudioContext)();
                ac.close().catch(() => { });
            } catch (e) { }
        }

        avviaQuiz();
    });

    // Multiplayer button
    const multiplayerBtn = document.getElementById("multiplayer-btn");
    if (multiplayerBtn) {
        multiplayerBtn.addEventListener("click", () => {
            window.location.href = "multiplayer.html";
        });
    }
}

// Initialize app
document.addEventListener("DOMContentLoaded", async () => {
    await loadQuestions();
    initializeDOMReferences();
    initializeEventListeners();
    initializeChartListeners();

    if (!SafeStorage.isAvailable()) {
        console.warn("localStorage non disponibile — verrà usato storage in-memory.");
    }
});
