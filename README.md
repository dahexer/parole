# Parole

Applicazione Next.js bilingue (Italiano/English) per trascrivere conversazioni e mettere in evidenza segnali linguistici che meritano attenzione. Il sistema combina un primo livello locale, deterministico e immediato con un secondo livello contestuale OpenAI avviato soltanto dall’utente. La verifica di affermazioni pubbliche tramite ricerca web è un’azione ulteriore e separata.

> **Principio fondamentale:** l’applicazione identifica linguaggio ed evidenze che possono meritare attenzione. Non può determinare in modo affidabile le intenzioni nascoste di una persona, diagnosticarla o provare che abbia mentito deliberatamente.

## Funzioni

- Analisi locale in tempo reale con i dizionari italiani e inglesi esistenti, senza chiamate API.
- Registrazione tramite Web Speech API locale oppure trascrizione remota OpenAI.
- Importazione e drag-and-drop di MP3, WAV, M4A, MP4, WebM, OGG e AAC (massimo 25 MB).
- Segmenti finali con ID stabili, timestamp quando disponibili, origine e stato finale; il testo provvisorio resta distinto.
- Analisi contestuale facoltativa dell’intera conversazione tramite Responses API e Structured Outputs.
- Parafrasi, funzioni conversazionali, linguaggio citato o negato, possibili schemi, domande non risposte e panoramica neutrale.
- Contraddizioni mostrate con entrambe le dichiarazioni e collegamenti ai passaggi originali.
- Estrazione di affermazioni fattuali separata dalla loro verifica.
- Verifica web esplicita delle sole affermazioni pubblicamente verificabili, con fonti realmente citate dalla ricerca.
- Evidenziazioni accessibili che combinano risultati sovrapposti senza elementi `<mark>` annidati.
- Cronologia cliccabile e ricerca nel punto audio quando sono presenti timestamp.
- Cache dell’analisi identica nella sessione del browser per evitare invii a pagamento accidentali.
- Esportazione TXT, HTML con legenda e JSON strutturato.
- Tema chiaro/scuro, interfaccia responsive e controlli da tastiera.

## I livelli di analisi

### 1. Dizionario locale

I file `lib/redFlags.ts` e `lib/redFlagsEn.ts` restano la fonte del matching immediato. Ogni voce contiene frase, categoria, gravità e spiegazione. Il confronto non distingue maiuscole/minuscole e, in caso di sovrapposizione, vince la frase più lunga. L’audio e il testo non vengono inviati all’endpoint di analisi per questo livello.

Un risultato del dizionario non viene cancellato silenziosamente dall’AI. Dopo l’analisi contestuale può ricevere uno stato come “supportato dal contesto”, “indebolito”, “probabile citazione” o “probabile falso positivo”.

### 2. Analisi contestuale OpenAI

L’analisi viene eseguita solo premendo **Analizza l’intera conversazione** oppure attivando esplicitamente l’opzione automatica dopo la registrazione. Durante la registrazione continua a funzionare soltanto il matching locale.

`POST /api/analyse` riceve lingua, segmenti finali, opzioni e i soli match del dizionario pertinenti. La route:

1. valida la richiesta e i limiti;
2. invia il testo a OpenAI dal server con `store: false`;
3. richiede JSON con schema rigoroso;
4. verifica ogni ID, citazione e offset contro la trascrizione originale;
5. riallinea soltanto differenze conservative di punteggiatura o normalizzazione;
6. scarta il singolo risultato non valido mantenendo quelli validi;
7. analizza trascrizioni lunghe in blocchi sovrapposti su confini di segmento e segnala il limite nell’interfaccia.

L’AI analizza il linguaggio e la sua possibile funzione, non la personalità. Il prompt vieta diagnosi e affermazioni certe su intenzioni private.

### 3. Contraddizioni

Una contraddizione è un conflitto tra due dichiarazioni presenti nella conversazione. Non equivale a una menzogna provata. Correzioni, cambi espliciti di opinione, interlocutori diversi, periodi temporali diversi, citazioni e ipotesi non vengono automaticamente classificati come contraddizioni.

### 4. Affermazioni fattuali

L’estrazione distingue tra affermazioni esternamente verificabili, controllabili nella trascrizione, opinioni, esperienze personali, previsioni, fatti privati e formulazioni troppo vaghe. Il modello non usa la propria memoria come database di fact-checking.

### 5. Verifica web

`POST /api/fact-check` è un’azione separata. Invia solo l’affermazione selezionata e il minimo contesto utile, usa lo strumento di ricerca web della Responses API e conserva esclusivamente URL presenti nelle citazioni effettive della risposta. L’assenza di una fonte non rende automaticamente falsa un’affermazione: il risultato diventa “non verificabile” o “evidenza affidabile insufficiente”.

## Termini importanti

- **Segnale linguistico:** una formulazione che può meritare revisione nel suo contesto.
- **Possibile scopo conversazionale:** un’inferenza prudente sulla funzione delle parole, non la prova di un’intenzione nascosta.
- **Contraddizione:** incompatibilità tra dichiarazioni nella trascrizione, non prova di inganno.
- **Affermazione fattuale:** proposizione potenzialmente controllabile; non è automaticamente vera.
- **Fatto verificato:** affermazione confrontata con fonti esterne affidabili e citate.
- **Inganno provato:** richiederebbe evidenza sull’intenzione di fuorviare; questa applicazione non può stabilirlo.

## Requisiti

- Node.js 20.9 o successivo
- npm 10 o successivo
- Chiave API OpenAI per trascrizione remota, analisi contestuale e verifica web
- HTTPS in produzione per l’accesso al microfono

## Installazione

```bash
npm install
cp .env.example .env.local
```

Configura `.env.local`:

```dotenv
OPENAI_API_KEY=sk-...
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_ANALYSIS_MODEL=gpt-5-mini
OPENAI_FACT_CHECK_MODEL=gpt-5-mini
```

I nomi dei modelli sono configurabili. La chiave non deve avere il prefisso `NEXT_PUBLIC_`, non deve essere inserita nel client e non deve essere committata.

## Avvio e test

```bash
npm run dev
npm test
npm run lint
npm run build
```

Apri [http://localhost:3000](http://localhost:3000). I test usano output sintetici e mock/boundary locali: non effettuano chiamate API a pagamento.

## Endpoint

### `POST /api/transcribe`

Richiede `multipart/form-data` con `audio` e `language` (`it` o `en`). Valida formato e dimensione, usa `OPENAI_TRANSCRIPTION_MODEL` e restituisce testo, durata e segmenti temporali quando il modello li fornisce. I caricamenti non vengono salvati permanentemente.

### `POST /api/analyse`

Accetta esclusivamente dati di trascrizione e opzioni, mai una chiave API. Il limite corrente è 240.000 caratteri e 2.000 segmenti. Le trascrizioni lunghe vengono suddivise su confini di segmento, senza troncarle silenziosamente.

### `POST /api/fact-check`

Accetta da 1 a 20 affermazioni estratte. La route rifiuta una selezione priva di affermazioni esternamente verificabili. La ricerca pubblica non riceve l’intera trascrizione.

## Privacy e sicurezza

- L’analisi locale non invia la trascrizione a `/api/analyse`.
- La trascrizione remota invia audio a OpenAI; l’analisi contestuale invia testo a OpenAI; la verifica può cercare l’affermazione selezionata sul web pubblico.
- Ogni invio esterno richiede un’azione o un’impostazione esplicita e viene spiegato nell’interfaccia.
- Le richieste di analisi impostano `store: false`.
- API key, metadata interni e prompt server non vengono inclusi negli export.
- L’output del modello viene trattato come dato non affidabile, validato e renderizzato come testo React, mai con `dangerouslySetInnerHTML`.
- Le route non registrano il contenuto completo della trascrizione nei normali log.
- L’app non dispone di un database e non conserva audio o trascrizioni sul server.
- Tema, lingua, impostazione automatica e cache temporanea restano nel browser.

Prima di registrare altre persone, informale e verifica le norme sul consenso applicabili nel luogo in cui ti trovi.

## Costi e limiti

La trascrizione, l’analisi e la ricerca web consumano API separatamente. L’interfaccia mostra la dimensione implicitamente attraverso la trascrizione, impedisce richieste sovrapposte e usa un hash SHA-256 per recuperare una risposta identica dalla cache della sessione. Modificare testo, lingua o opzioni produce correttamente una nuova analisi.

Nessun modello comprende perfettamente sarcasmo, relazioni, potere o intenzioni. La qualità dipende da accuratezza della trascrizione, speaker label, punteggiatura e contesto disponibile. I timestamp non vengono inventati; una modifica manuale li rimuove perché rompe l’allineamento con l’audio.

## Deploy su Vercel

1. Pubblica il repository su GitHub.
2. Importalo in Vercel come progetto Next.js.
3. Configura `OPENAI_API_KEY` e, facoltativamente, le tre variabili dei modelli nelle impostazioni del progetto.
4. Avvia il deploy. Vercel eseguirà `npm run build` e servirà l'app tramite HTTPS.

Non inserire mai segreti nel repository o in variabili `NEXT_PUBLIC_*`. Per il deploy Cloudflare/Vinext è disponibile `npm run build:sites`.

## Deploy con Docker

L'immagine usa l'output standalone di Next.js:

```bash
docker build -t parole .
docker run --rm -p 3000:3000 \
  -e OPENAI_API_KEY=sk-... \
  -e OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe \
  -e OPENAI_ANALYSIS_MODEL=gpt-5-mini \
  -e OPENAI_FACT_CHECK_MODEL=gpt-5-mini \
  parole
```

In produzione pubblica la porta `3000` dietro un reverse proxy HTTPS. Il container non contiene chiavi API e non conserva permanentemente audio o trascrizioni.

## Struttura

```text
app/
  api/analyse/route.ts
  api/fact-check/route.ts
  api/transcribe/route.ts
  page.tsx
components/
  AnalysisControls.tsx
  AnalysisPanels.tsx
  AudioImport.tsx
  ConversationTimeline.tsx
  TranscriptView.tsx
lib/
  analysisSchema.ts
  analysisTypes.ts
  dictionaryAnalysis.ts
  openai.ts
  prompts/
  redFlags.ts
  redFlagsEn.ts
  transcriptSegments.ts
tests/
```
