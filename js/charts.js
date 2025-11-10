// Charts functionality

// Variabile globale per memorizzare le posizioni dei punti cliccabili
let chartPoints = [];
let activeTooltip = null;

// Helper function to set canvas size based on container
function setCanvasSize(canvas, heightRatio = 0.5) {
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth;
    
    // Set canvas internal resolution
    canvas.width = containerWidth;
    canvas.height = containerWidth * heightRatio;
}

function disegnaGraficoAccuratezza() {
    const canvas = document.getElementById("accuracy-chart");
    if (!canvas) return;
    
    // Set canvas size to match container width
    setCanvasSize(canvas, 0.65); // 65% of width for height (increased from 0.5)
    
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sessionHistory = SafeStorage.get("sessionHistory") || [];
    const filterValue = document.getElementById("accuracy-filter").value;

    // Resetta i punti cliccabili
    chartPoints = [];

    if (sessionHistory.length === 0) {
        const isDarkMode = document.body.classList.contains("dark-mode");
        ctx.fillStyle = isDarkMode ? "#e0e0e0" : "#222";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Nessun dato disponibile", canvas.width / 2, canvas.height / 2);
        return;
    }

    // Filtra e prepara i dati in base alla selezione
    const dataPoints = sessionHistory.map(session => {
        if (filterValue === "overall") {
            return session.accuracy;
        } else {
            // Accuratezza per categoria specifica
            return session.categoryAccuracy && session.categoryAccuracy[filterValue] !== null
                ? session.categoryAccuracy[filterValue]
                : null;
        }
    });

    // Mostra tutte le sessioni (non solo le ultime 10)
    const recentData = dataPoints;
    const recentSessions = sessionHistory;

    // Verifica se ci sono dati validi da visualizzare
    const hasValidData = recentData.some(d => d !== null && d !== undefined);
    if (!hasValidData) {
        const isDarkMode = document.body.classList.contains("dark-mode");
        ctx.fillStyle = isDarkMode ? "#e0e0e0" : "#222";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Nessun dato disponibile per questa categoria", canvas.width / 2, canvas.height / 2);
        return;
    }

    // Colori adattivi per dark mode
    const isDarkMode = document.body.classList.contains("dark-mode");
    const lineColor = isDarkMode ? "#4a9eff" : "#007bff";
    const gridColor = isDarkMode ? "#444" : "#ddd";
    const textColor = isDarkMode ? "#e0e0e0" : "#222";

    const padding = 0.15 * canvas.width;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    const maxSessions = recentData.length;

    // Disegna griglia
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + chartWidth, y);
        ctx.stroke();

        // Etichette asse Y (percentuale)
        ctx.fillStyle = textColor;
        ctx.font = "12px Arial";
        ctx.textAlign = "right";
        ctx.fillText(`${100 - (i * 25)}%`, padding - 10, y + 4);
    }

    // Disegna linea accuratezza
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.beginPath();

    let firstValidPoint = true;
    recentData.forEach((accuracy, i) => {
        if (accuracy !== null && accuracy !== undefined) {
            // Gestisce correttamente sia sessioni singole che multiple
            const x = maxSessions === 1 
                ? padding + chartWidth / 2 
                : padding + (chartWidth / (maxSessions - 1)) * i;
            const y = padding + chartHeight - (accuracy / 100) * chartHeight;

            if (firstValidPoint) {
                ctx.moveTo(x, y);
                firstValidPoint = false;
            } else {
                ctx.lineTo(x, y);
            }
        }
    });
    ctx.stroke();

    // Disegna punti
    ctx.fillStyle = lineColor;
    recentData.forEach((accuracy, i) => {
        if (accuracy !== null && accuracy !== undefined) {
            // Gestisce correttamente sia sessioni singole che multiple
            const x = maxSessions === 1 
                ? padding + chartWidth / 2 
                : padding + (chartWidth / (maxSessions - 1)) * i;
            const y = padding + chartHeight - (accuracy / 100) * chartHeight;

            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();

            // Memorizza le coordinate dei punti per il click
            const sessionIndex = sessionHistory.length - maxSessions + i;
            chartPoints.push({
                x: x,
                y: y,
                accuracy: accuracy,
                sessionNumber: sessionIndex + 1,
                totalQuestions: recentSessions[sessionIndex].totalQuestions
            });

            // Mostra percentuale sopra il punto solo se il totale storico è 12 o meno
            if (sessionHistory.length <= 12) {
                ctx.fillStyle = textColor;
                ctx.font = "12px Arial";
                ctx.textAlign = "center";
                ctx.fillText(`${accuracy.toFixed(0)}%`, x, y - 10);
            }
        }
    });

    // Etichette asse X (numero sessione) - mostra solo un sottoinsieme per evitare sovrapposizioni
    ctx.fillStyle = textColor;
    ctx.font = "12px Arial";
    ctx.textAlign = "center";

    // Calcola quante etichette possiamo mostrare senza sovrapposizioni
    const labelWidth = 40;
    const maxLabels = Math.floor(chartWidth / labelWidth);
    const step = Math.max(1, Math.ceil(maxSessions / maxLabels));

    recentData.forEach((accuracy, i) => {
        // Gestisce correttamente sia sessioni singole che multiple
        const x = maxSessions === 1 
            ? padding + chartWidth / 2 
            : padding + (chartWidth / (maxSessions - 1)) * i;
        const sessionNumber = sessionHistory.length - maxSessions + i + 1;

        // Mostra sempre la prima e l'ultima etichetta, più quelle a intervalli regolari
        if (maxSessions === 1 || i === 0 || i === maxSessions - 1 || i % step === 0) {
            ctx.fillText(`#${sessionNumber}`, x, canvas.height - padding*0.6);
        }
    });

    // Titoli assi - posizionato più in basso per evitare sovrapposizioni
    ctx.fillStyle = textColor;
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Sessione", canvas.width / 2, canvas.height - padding *0.3);
}

function handleChartInteraction(clientX, clientY) {
    const canvas = document.getElementById("accuracy-chart");
    const rect = canvas.getBoundingClientRect();

    // Account for CSS scaling and canvas internal resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clickX = (clientX - rect.left) * scaleX;
    const clickY = (clientY - rect.top) * scaleY;

    // Trova se abbiamo cliccato vicino a un punto
    let clickedPoint = null;
    const tolerance = 15;

    for (let point of chartPoints) {
        const distance = Math.sqrt(
            Math.pow(clickX - point.x, 2) +
            Math.pow(clickY - point.y, 2)
        );

        if (distance <= tolerance) {
            clickedPoint = point;
            break;
        }
    }

    if (clickedPoint) {
        // Toggle: se clicco sullo stesso punto, lo nascondo
        if (activeTooltip &&
            activeTooltip.x === clickedPoint.x &&
            activeTooltip.y === clickedPoint.y) {
            activeTooltip = null;
        } else {
            activeTooltip = clickedPoint;
        }

        // Ridisegna il grafico con il tooltip
        disegnaGraficoAccuratezza();

        if (activeTooltip) {
            mostraTooltip(canvas, activeTooltip);
        }
        return true; // Point was clicked
    } else {
        // Click fuori dai punti: nasconde il tooltip
        if (activeTooltip) {
            activeTooltip = null;
            disegnaGraficoAccuratezza();
        }
        return false; // No point clicked
    }
}

function mostraTooltip(canvas, point) {
    const ctx = canvas.getContext("2d");
    const isDarkMode = document.body.classList.contains("dark-mode");

    // Contenuto del tooltip
    const text = `${point.accuracy.toFixed(1)}%`;
    const sessionText = `Sessione #${point.sessionNumber}`;
    const questionsText = `${point.totalQuestions} domande`;

    // Misura il testo per dimensionare il tooltip
    ctx.font = "14px Arial";
    const textWidth = Math.max(
        ctx.measureText(text).width,
        ctx.measureText(sessionText).width,
        ctx.measureText(questionsText).width
    );
    const tooltipWidth = textWidth + 20;
    const tooltipHeight = 70; // Aumentato per 3 righe

    // Posiziona il tooltip sopra il punto, ma evita che esca dal canvas
    let tooltipX = point.x - tooltipWidth / 2;
    let tooltipY = point.y - tooltipHeight - 15;

    // Aggiusta se esce dai bordi
    if (tooltipX < 5) tooltipX = 5;
    if (tooltipX + tooltipWidth > canvas.width - 5) {
        tooltipX = canvas.width - tooltipWidth - 5;
    }
    if (tooltipY < 5) {
        tooltipY = point.y + 15;
    }

    // Disegna il box del tooltip
    ctx.fillStyle = isDarkMode ? "#333" : "#fff";
    ctx.strokeStyle = isDarkMode ? "#666" : "#ccc";
    ctx.lineWidth = 2;

    ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
    ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

    // Disegna il testo
    ctx.fillStyle = isDarkMode ? "#e0e0e0" : "#222";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(sessionText, tooltipX + tooltipWidth / 2, tooltipY + 18);

    ctx.font = "bold 16px Arial";
    ctx.fillText(text, tooltipX + tooltipWidth / 2, tooltipY + 38);

    ctx.font = "12px Arial";
    ctx.fillText(questionsText, tooltipX + tooltipWidth / 2, tooltipY + 56);

    // Evidenzia il punto selezionato
    const lineColor = isDarkMode ? "#4a9eff" : "#007bff";
    ctx.fillStyle = lineColor;
    ctx.strokeStyle = isDarkMode ? "#fff" : "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
}

function disegnaGraficoRisultati() {
    const canvas = document.getElementById("result-chart");
    if (!canvas) return;
    
    // Set canvas size to match container width
    setCanvasSize(canvas, 0.6); // 60% of width for height
    
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Usa tutti i dati storici persistenti
    const erroriPersistenti = SafeStorage.get("erroriQuiz") || [];
    const correttePersistenti = SafeStorage.get("corretteQuiz") || [];

    // Conteggi totali e errori per categoria
    const conteggi = {};
    window.CATEGORIE.forEach(cat => {
        conteggi[cat] = { corrette: 0, errate: 0 };
    });

    // Funzione helper per contare risposte per categoria
    const contaRisposte = (risposte, tipo) => {
        risposte.forEach(risp => {
            if (risp.categoria && conteggi[risp.categoria]) {
                conteggi[risp.categoria][tipo]++;
            } else if (!risp.categoria) {
                // Fallback per dati vecchi senza categoria
                for (let cat of window.CATEGORIE) {
                    if (window.domande[cat].some(d => d.domanda === risp.domanda)) {
                        conteggi[cat][tipo]++;
                        break;
                    }
                }
            }
        });
    };

    contaRisposte(erroriPersistenti, 'errate');
    contaRisposte(correttePersistenti, 'corrette');

    // Disegna barre - calcoli responsivi basati sulla larghezza del canvas
    const numCategorie = window.CATEGORIE.length;
    const leftMargin = 50;
    const rightMargin = 20;
    const availableWidth = canvas.width - leftMargin - rightMargin;
    
    // Calcola larghezza di ogni gruppo (2 barre + gap)
    const groupWidth = availableWidth / numCategorie;
    const gap = Math.min(groupWidth * 0.15, 20); // 15% del gruppo o max 20px
    const larghezzaBarra = (groupWidth - gap) / 2;
    
    const maxAltezza = Math.max(...window.CATEGORIE.map(cat => conteggi[cat].corrette + conteggi[cat].errate), 1);

    // Colori adattivi per dark mode
    const isDarkMode = document.body.classList.contains("dark-mode");
    const colorCorrette = isDarkMode ? "#4a7c59" : "#28a745";
    const colorErrate = isDarkMode ? "#8b4a4a" : "#dc3545";
    const colorTesto = isDarkMode ? "#e0e0e0" : "#222";

    // Riserva spazio per i numeri sopra le barre e le etichette sotto
    const topMargin = 25; // Spazio per i numeri sopra
    const bottomMargin = 30; // Spazio per le etichette sotto
    const maxBarHeight = canvas.height - topMargin - bottomMargin;

    window.CATEGORIE.forEach((cat, i) => {
        const x = leftMargin + (i * groupWidth);

        // Barre corrette - scala in base all'altezza disponibile
        const altezzaCorrette = (conteggi[cat].corrette / maxAltezza) * maxBarHeight;
        ctx.fillStyle = colorCorrette;
        ctx.fillRect(x, canvas.height - altezzaCorrette - bottomMargin, larghezzaBarra, altezzaCorrette);

        // Barre errate - scala in base all'altezza disponibile
        const altezzaErrate = (conteggi[cat].errate / maxAltezza) * maxBarHeight;
        ctx.fillStyle = colorErrate;
        ctx.fillRect(x + larghezzaBarra + gap, canvas.height - altezzaErrate - bottomMargin, larghezzaBarra, altezzaErrate);

        // Etichette categoria - centrate rispetto al gruppo di barre
        ctx.fillStyle = colorTesto;
        // Font size scala con larghezza barra, min 8px, max 12px
        const labelFontSize = Math.max(8, Math.min(10, larghezzaBarra * 0.8));
        ctx.font = labelFontSize + "px Arial";
        ctx.textAlign = "center";
        const labelText = cat.replace("CULTURA_", "").replace("ATTITUDINALI_LOGICO_", "").replace("_", " ");
        const centerX = x + groupWidth / 2;
        
        // Se la label è troppo larga, spezza su due righe
        const maxLabelWidth = groupWidth - 4; // Piccolo margine
        const labelWidth = ctx.measureText(labelText).width;
        
        if (labelWidth > maxLabelWidth && labelText.includes(" ")) {
            // Spezza la label in due parole
            const words = labelText.split(" ");
            const line1 = words[0];
            const line2 = words.slice(1).join(" ");
            ctx.fillText(line1, centerX, canvas.height - 18);
            ctx.fillText(line2, centerX, canvas.height - 6);
        } else {
            ctx.fillText(labelText, centerX, canvas.height - 10);
        }

        // Conteggi sopra barre
        // Font size scala con larghezza barra, min 8px, max 14px
        const numberFontSize = Math.max(8, Math.min(14, larghezzaBarra * 0.9));
        ctx.font = numberFontSize + "px Arial";
        ctx.fillStyle = colorTesto;
        ctx.textAlign = "center";

        // numero corrette - sempre sopra la barra con spazio garantito
        let textCorrette = conteggi[cat].corrette.toString();
        const topPositionCorrette = altezzaCorrette > 0 
            ? canvas.height - altezzaCorrette - bottomMargin - 10 // 10px sopra la barra
            : canvas.height - bottomMargin - 10; // Alla base se barra = 0
        ctx.fillText(textCorrette, x + larghezzaBarra / 2, topPositionCorrette);

        // numero errate - sempre sopra la barra con spazio garantito
        let textErrate = conteggi[cat].errate.toString();
        const topPositionErrate = altezzaErrate > 0 
            ? canvas.height - altezzaErrate - bottomMargin - 10 // 10px sopra la barra
            : canvas.height - bottomMargin - 10; // Alla base se barra = 0
        ctx.fillText(textErrate, x + larghezzaBarra + gap + larghezzaBarra / 2, topPositionErrate);
    });

    // Asse Y
    ctx.strokeStyle = colorTesto;
    ctx.beginPath();
    ctx.moveTo(40, topMargin);
    ctx.lineTo(40, canvas.height - bottomMargin);
    ctx.stroke();
}

function initializeChartListeners() {
    const accuracyChart = document.getElementById("accuracy-chart");
    
    if (!accuracyChart) return;
    
    // Event listener per click (desktop)
    accuracyChart.addEventListener("click", (event) => {
        handleChartInteraction(event.clientX, event.clientY);
    });

    // Event listener per touch (mobile) - solo previene default se si tocca un punto
    accuracyChart.addEventListener("touchstart", (event) => {
        const touch = event.touches[0];
        const pointClicked = handleChartInteraction(touch.clientX, touch.clientY);
        
        // Previeni lo scroll solo se hai toccato un punto del grafico
        if (pointClicked && event.cancelable) {
            event.preventDefault();
        }
    }, { passive: false });
    
    // Redraw charts on window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const statsScreen = document.getElementById('stats-screen');
            if (statsScreen && statsScreen.style.display === 'block') {
                if (typeof disegnaGraficoAccuratezza === 'function') {
                    disegnaGraficoAccuratezza();
                }
                if (typeof disegnaGraficoRisultati === 'function') {
                    disegnaGraficoRisultati();
                }
            }
        }, 250); // Debounce resize events
    });
}
