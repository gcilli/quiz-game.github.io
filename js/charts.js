// Charts functionality

// Variabile globale per memorizzare le posizioni dei punti cliccabili
let chartPoints = [];
let activeTooltip = null;

function disegnaGraficoAccuratezza() {
    const canvas = document.getElementById("accuracy-chart");
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

    // Colori adattivi per dark mode
    const isDarkMode = document.body.classList.contains("dark-mode");
    const lineColor = isDarkMode ? "#4a9eff" : "#007bff";
    const gridColor = isDarkMode ? "#444" : "#ddd";
    const textColor = isDarkMode ? "#e0e0e0" : "#222";

    const padding = 50;
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
        ctx.lineTo(canvas.width - padding, y);
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
        if (accuracy !== null) {
            const x = padding + (chartWidth / (maxSessions - 1 || 1)) * i;
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
        if (accuracy !== null) {
            const x = padding + (chartWidth / (maxSessions - 1 || 1)) * i;
            const y = padding + chartHeight - (accuracy / 100) * chartHeight;

            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();

            // Memorizza le coordinate dei punti per il click
            chartPoints.push({
                x: x,
                y: y,
                accuracy: accuracy,
                sessionNumber: sessionHistory.length - maxSessions + i + 1
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
        const x = padding + (chartWidth / (maxSessions - 1 || 1)) * i;
        const sessionNumber = sessionHistory.length - maxSessions + i + 1;

        // Mostra sempre la prima e l'ultima etichetta, più quelle a intervalli regolari
        if (i === 0 || i === maxSessions - 1 || i % step === 0) {
            ctx.fillText(`#${sessionNumber}`, x, canvas.height - padding + 20);
        }
    });

    // Titoli assi
    ctx.fillStyle = textColor;
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Sessione", canvas.width / 2, canvas.height - 10);

    ctx.save();
    ctx.translate(15, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Accuratezza (%)", 0, 0);
    ctx.restore();
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
    } else {
        // Click fuori dai punti: nasconde il tooltip
        if (activeTooltip) {
            activeTooltip = null;
            disegnaGraficoAccuratezza();
        }
    }
}

function mostraTooltip(canvas, point) {
    const ctx = canvas.getContext("2d");
    const isDarkMode = document.body.classList.contains("dark-mode");

    // Contenuto del tooltip
    const text = `${point.accuracy.toFixed(1)}%`;
    const sessionText = `Sessione #${point.sessionNumber}`;

    // Misura il testo per dimensionare il tooltip
    ctx.font = "14px Arial";
    const textWidth = Math.max(
        ctx.measureText(text).width,
        ctx.measureText(sessionText).width
    );
    const tooltipWidth = textWidth + 20;
    const tooltipHeight = 50;

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
    ctx.fillText(sessionText, tooltipX + tooltipWidth / 2, tooltipY + 20);

    ctx.font = "bold 16px Arial";
    ctx.fillText(text, tooltipX + tooltipWidth / 2, tooltipY + 38);

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

    // Disegna barre
    const larghezzaBarra = 38;
    const gap = 40;
    const maxAltezza = Math.max(...window.CATEGORIE.map(cat => conteggi[cat].corrette + conteggi[cat].errate), 1);

    // Colori adattivi per dark mode
    const isDarkMode = document.body.classList.contains("dark-mode");
    const colorCorrette = isDarkMode ? "#4a7c59" : "#28a745";
    const colorErrate = isDarkMode ? "#8b4a4a" : "#dc3545";
    const colorTesto = isDarkMode ? "#e0e0e0" : "#222";

    window.CATEGORIE.forEach((cat, i) => {
        const x = i * (larghezzaBarra * 2 + gap) + 50;

        // Barre corrette
        const altezzaCorrette = (conteggi[cat].corrette / maxAltezza) * 200;
        ctx.fillStyle = colorCorrette;
        ctx.fillRect(x, canvas.height - altezzaCorrette - 30, larghezzaBarra, altezzaCorrette);

        // Barre errate
        const altezzaErrate = (conteggi[cat].errate / maxAltezza) * 200;
        ctx.fillStyle = colorErrate;
        ctx.fillRect(x + larghezzaBarra, canvas.height - altezzaErrate - 30, larghezzaBarra, altezzaErrate);

        // Etichette categoria - centrate rispetto alle barre
        ctx.fillStyle = colorTesto;
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        const labelText = cat.replace("CULTURA_", "").replace("ATTITUDINALI_LOGICO_", "").replace("_", " ");
        const centerX = x + larghezzaBarra;
        ctx.fillText(labelText, centerX, canvas.height - 10);

        // Conteggi sopra barre
        ctx.font = "14px Arial";
        ctx.fillStyle = colorTesto;

        // numero corrette
        let textCorrette = conteggi[cat].corrette.toString();
        let textWidthC = ctx.measureText(textCorrette).width;
        ctx.fillText(textCorrette, x + larghezzaBarra / 2 - textWidthC / 2, canvas.height - altezzaCorrette - 35);

        // numero errate
        let textErrate = conteggi[cat].errate.toString();
        let textWidthE = ctx.measureText(textErrate).width;
        ctx.fillText(textErrate, x + larghezzaBarra + larghezzaBarra / 2 - textWidthE / 2, canvas.height - altezzaErrate - 35);
    });

    // Asse Y
    ctx.strokeStyle = colorTesto;
    ctx.beginPath();
    ctx.moveTo(40, 10);
    ctx.lineTo(40, canvas.height - 30);
    ctx.stroke();
}

function initializeChartListeners() {
    // Event listener per click (desktop)
    document.getElementById("accuracy-chart").addEventListener("click", (event) => {
        handleChartInteraction(event.clientX, event.clientY);
    });

    // Event listener per touch (mobile) - non passivo per iOS compatibility
    document.getElementById("accuracy-chart").addEventListener("touchstart", (event) => {
        event.preventDefault();
        const touch = event.touches[0];
        handleChartInteraction(touch.clientX, touch.clientY);
    }, { passive: false });
}
