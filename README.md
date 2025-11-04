# Quiz Interattivo

Un'applicazione web per quiz di allenamento con categorie personalizzabili, tracking delle statistiche e modalità scura.

## Struttura del Progetto

```
barsa_dxc/
├── index_new.html          # Nuova versione con file separati
├── index.html              # Versione originale (singolo file)
├── css/
│   └── styles.css          # Tutti gli stili CSS
├── js/
│   ├── app.js              # Logica principale dell'applicazione
│   ├── storage.js          # Gestione localStorage con fallback
│   └── charts.js           # Grafici e visualizzazioni
└── data/
    └── questions.json      # Database domande (formato JSON)
```

## Caratteristiche

- ✅ Quiz multi-categoria
- ✅ Timer configurabile
- ✅ Salvataggio domande preferite (bookmark)
- ✅ Navigazione avanti/indietro tra domande
- ✅ Grafici di accuratezza nel tempo
- ✅ Modalità scura/chiara
- ✅ Statistiche persistenti
- ✅ Effetti confetti per punteggio perfetto
- ✅ Compatibile con iOS, Android e Desktop

## Come Usare

### Versione Locale (File Separati)

1. Aprire `index_new.html` in un browser moderno
2. **IMPORTANTE per iOS**: Deve essere servito tramite un web server, non può essere aperto direttamente come file locale

### Servire tramite Web Server

**Opzione 1: Python** (se installato)
```bash
python -m http.server 8000
```
Poi apri: `http://localhost:8000/index_new.html`

**Opzione 2: Node.js con http-server**
```bash
npx http-server -p 8000
```

**Opzione 3: GitHub Pages**
1. Crea un repository su GitHub
2. Carica tutti i file
3. Vai su Settings → Pages
4. Seleziona il branch main
5. Salva e attendi qualche minuto
6. L'app sarà disponibile su: `https://tuousername.github.io/tuorepo/index_new.html`

### Versione Singolo File

Per compatibilità immediata (anche se meno organizzata), usa `index.html` - contiene tutto in un unico file.

## Aggiungere Nuove Domande

Modifica il file `data/questions.json`:

```json
{
    "CULTURA_GENERALE": [
        {
            "domanda": "Testo della domanda?",
            "risposte": [
                "Risposta corretta (sempre prima)",
                "Risposta sbagliata 1",
                "Risposta sbagliata 2"
            ]
        }
    ]
}
```

**Nota**: La prima risposta nell'array è sempre quella corretta. Le risposte vengono mescolate automaticamente durante il quiz.

## Compatibilità Browser

- ✅ Chrome/Edge (Desktop e Mobile)
- ✅ Firefox
- ✅ Safari (Desktop e iOS) - richiede web server
- ✅ Brave

## Risoluzione Problemi iOS

Se il pulsante "Inizia quiz" non funziona su iOS:

1. **Assicurati di usare un web server** - non aprire il file direttamente
2. Verifica che JavaScript sia abilitato in Safari
3. Prova in modalità privata
4. Cancella la cache del browser

## Tecnologie Usate

- HTML5
- CSS3 (con CSS Variables per temi)
- JavaScript ES6+ (Vanilla, nessuna libreria esterna)
- Canvas API per i grafici
- LocalStorage API con fallback in-memory

## Licenza

Uso personale ed educativo.
