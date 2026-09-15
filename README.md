# Vocabolario giapponese — PWA

```
index.html              app + logica (Alpine.js)   <- si modifica questo
src/app.css             sorgente degli stili        <- e questo
manifest.webmanifest    nome, icone, display standalone
sw.js                   service worker: precache di tutto -> funziona offline
icons/                  192, 512, maskable 512, apple-touch 180
package.json            versioni di Tailwind e Alpine; non serve a chi usa l'app

dist/                   GENERATA da `npm run build` - è quello che si pubblica
```

**`dist/` è l'unica cartella da pubblicare**, e contiene solo i 9 file che
servono all'app: `index.html`, `app.css`, `alpine.min.js`, `sw.js`,
`manifest.webmanifest` e le 4 icone. Sorgenti, `package.json` e `node_modules`
non ci finiscono.

Non si modifica niente dentro `dist/`: il build la cancella e la rifà da zero
ogni volta.

## Requisito: va servita via HTTPS

Service worker e installazione **non funzionano da `file://`**. Serve un origin
`https://` (oppure `http://localhost`, che i browser trattano come sicuro).

Prova in locale:

```sh
npm run serve      # ricostruisce dist/ e la serve su http://localhost:8080
```

Pubblicazione: ci pensa GitHub Pages. A ogni push su `main` il workflow in
`.github/workflows/deploy.yml` lancia `npm run build` su una macchina pulita e
pubblica il contenuto di `dist/` — che infatti non sta nel repo, resta una
cartella generata. Il sito è
<https://nekostark.github.io/jdd-app/>.

L'app va installata sempre da quell'URL: `localStorage` e cache sono legati
all'origin, quindi cambiare dominio significa ripartire da mazzo e statistiche
vuoti (per quello c'è Esporta / Importa backup).

## Installazione sul dispositivo

- **Android / Chrome**: compare il bottone "Installa sul dispositivo" nella
  sezione *App*, oppure menu ⋮ → "Installa app".
- **iOS / Safari**: `beforeinstallprompt` non esiste, quindi il bottone non
  compare mai. Va fatto a mano: Condividi → "Aggiungi a Home". Solo Safari,
  non funziona da Chrome su iOS.

## Il build

Due librerie, nessun bundler: l'app resta un `index.html` che carica un CSS e
uno script. Il build si limita a generare quei due file.

```sh
npm install        # solo la prima volta
npm run build      # cancella e ricostruisce dist/ (~70 ms)
npm run serve      # build + server locale su :8080
```

`npm run build` è la somma di quattro passi, lanciabili anche singolarmente:

- **`clean`** — `rm -rf dist`. Si riparte sempre da zero, così un file che
  togli dal progetto non resta a marcire nella cartella pubblicata.
- **`build:static`** — copia in `dist/` i file che non hanno bisogno di
  trasformazioni: `index.html`, `sw.js`, `manifest.webmanifest`, `icons/`.
- **`build:css`** — Tailwind legge `index.html`, tiene le sole classi che trova
  e scrive `dist/app.css` (~20 KB). **Se cambi una classe e non rilanci il
  build, il CSS resta indietro** e la classe nuova non ha effetto: è l'unica
  trappola di questo approccio.
- **`build:js`** — copia `node_modules/alpinejs/dist/cdn.min.js` in
  `dist/alpine.min.js`. Di tutti i file in `alpinejs/dist/` serve proprio quello: è
  il build IIFE che si avvia da solo ed espone `window.Alpine`, l'unico che
  funziona con un `<script>` tag. `module.esm.js` presuppone un bundler, che qui
  non c'è. Per sapere quale versione è stata copiata: `npm ls alpinejs`.

Nessuna delle due passa da un CDN: lascerebbe l'app senza stile o senza logica
al primo avvio offline.

### Aggiornare le librerie

```sh
npm i -D alpinejs@latest tailwindcss@latest @tailwindcss/cli@latest
npm run build
```

Le versioni restano scritte in `package.json`, non più deducibili solo aprendo un
file minificato.

Il tema chiaro/scuro segue l'impostazione di sistema (`prefers-color-scheme`),
non c'è un interruttore.

### Colori degli esiti

Verde e rosso distano ΔE 4.1 in deuteranopia: per un daltonico sono lo stesso
colore. Per questo l'esito è **sempre scritto a parole** accanto al pallino
colorato, e la barra di avanzamento durante la sessione mostra solo a che punto
sei, non com'è andata. I contrasti sono misurati, non stimati:

| uso | colore | contrasto |
|---|---|---|
| bottone *Indovinata*, tema chiaro | `#006300` | 7.54:1 col bianco |
| bottone *Indovinata*, tema scuro | `#15803d` | 5.02:1 col bianco |
| bottone *Sbagliata* | `#d03b3b` | 4.80:1 col bianco |
| pallini negli elenchi e nelle tabelle | `#0ca30c` / `#d03b3b` | ≥ 3.35:1 sulla carta |

## Aggiornamenti

Dopo ogni modifica **incrementa `CACHE_VERSION` in `sw.js`** (`v1` → `v2`) e
fai push: senza quello il service worker continua a servire la copia in cache e
non vedi le modifiche. Il build lo fa il workflow, in locale serve solo per
provare (`npm run serve`). Alla prima apertura dopo il deploy l'app mostra
"È disponibile una nuova versione" con il bottone per applicarla.

La navigazione è servita **sempre dalla cache**, anche online: l'avvio non
aspetta mai la rete, nemmeno per un istante. È il motivo per cui l'aggiornamento
passa per forza dal giro qui sopra.

## Come funziona una sessione

Ogni fascia oraria propone 3 parole, **una per volta**: finché non scegli
*Indovinata*, *Sbagliata* o *Salta* non si passa alla successiva. *Salta* non
consuma il posto, rimpiazza la parola con un'altra nella stessa posizione.

A sessione finita compare il riepilogo: le parole appena viste, il totale di
oggi e quello degli ultimi 7 giorni (indovinate / sbagliate / saltate), con il
dettaglio giorno per giorno.

## Dati e backup

Mazzo, storico dei ripassi, statistiche giornaliere e sessione corrente stanno
in `localStorage`, che è legato all'origin: pubblicando su un dominio diverso
riparti da zero.

Su iOS i dati di un sito possono essere cancellati dopo ~7 giorni di inutilizzo
(ITP). Per una PWA aggiunta alla Home il rischio è basso, ma non nullo: per
questo c'è **Esporta / Importa backup**, che salva mazzo, storico e statistiche
in un JSON.

## Limite noto: nessuna notifica

L'app propone le parole quando la apri, non ti avvisa lei. Notifiche pianificate
in locale non esistono nelle PWA; servirebbero le Web Push con un server, e su
iOS funzionano solo se l'app è già stata aggiunta alla Home. Nel frattempo la
cosa più semplice è un promemoria nell'app Orologio alle tue tre fasce orarie.
