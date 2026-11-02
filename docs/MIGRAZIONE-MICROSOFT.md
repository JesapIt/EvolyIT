# Migrazione da Google a Microsoft 365: modifiche al sito

## Cosa è cambiato

| File | Prima (Google) | Ora (Microsoft) |
|---|---|---|
| `script.js` (modulo contatti) | invio a Google Apps Script | invio a `api/invio.php` (salva nella lista SharePoint "Contatti") |
| `assessment.js` | invio e lettura domande da Google Apps Script | invio a `api/invio.php`, domande da `api/domande.php` (lista "Domande") |
| `script.js` (statistiche) | Google Analytics 4 (`G-8HV6Y2RN3Y`) | Microsoft Clarity, caricato solo dopo "Accetta tutti" |
| tutte le pagine | link "Scrivi con Gmail" | link `mailto:info@evolyit.it` (si apre il programma di posta del visitatore) |
| `contatti.html` | — | campo nascosto anti-spam (`sito_web`), invisibile ai visitatori |
| `privacy-policy.html`, `cookie-policy.html` | — | testi aggiornati dal legale (revisione FP, novembre 2026). **Citano ancora Google**: vedi sotto |

Aspetto e funzionamento per il visitatore restano identici.

## Da fare prima di andare online

1. **Configurazione del ricevitore**: creare `api/private/config.php` con i dati della chiamata con Salvatore (vedi `api/README.md`).
2. **Clarity** (facoltativo, si può fare anche dopo):
   - creare il progetto su https://clarity.microsoft.com con l'account Microsoft dell'azienda;
   - in Impostazioni → Mascheramento scegliere **Rigido** (la cookie policy dice che i campi dei moduli sono oscurati);
   - copiare l'ID progetto in `script.js`, al posto di `INSERIRE_ID_CLARITY`.
   Finché l'ID non è inserito, il sito non carica nessuna statistica (nessun errore).
3. **Testi legali**: le pagine contengono la revisione del legale (novembre 2026), che descrive ancora Google (Apps Script, Fogli, Google Analytics 4). Prima di mettere online la versione Microsoft vanno aggiornate: privacy policy sezioni 6 e 7, cookie policy sezioni 1 e 3.2. Proposta di testo da sottoporre al legale (DA VERIFICARE: società Microsoft che fornisce Clarity ai clienti europei, elenco e durata esatti dei cookie Clarity, fornitore di hosting):
   - **Privacy, sez. 6**: "**Microsoft** (Microsoft Ireland Operations Limited e Microsoft Corporation), i cui servizi Microsoft 365 (SharePoint, Exchange Online e Power Automate) sono utilizzati per la raccolta e la conservazione, per conto del Titolare, dei dati inviati tramite i moduli del sito e per il relativo avviso e-mail al Titolare. Previo consenso espresso tramite il banner cookie, il sito utilizza inoltre il servizio **Microsoft Clarity** per statistiche di utilizzo del sito, secondo quanto descritto nella Cookie Policy."
   - **Privacy, sez. 7**: sostituire "Google LLC" con "Microsoft Corporation" (aderisce all'EU-U.S. Data Privacy Framework).
   - **Cookie, sez. 1**: "I dati raccolti tramite i cookie di Microsoft Clarity sono trattati da Microsoft Corporation secondo…".
   - **Cookie, sez. 3.2 "Cookie statistici (Microsoft Clarity)"**: "Previo consenso dell'utente, espresso tramite il banner, il sito utilizza **Microsoft Clarity**, servizio di statistica web fornito da Microsoft Corporation, per capire come viene utilizzato il sito: numero di visitatori, pagine consultate, durata della visita e interazioni con le pagine (clic, scorrimento, movimenti del mouse), anche sotto forma di riproduzioni della navigazione e mappe di calore. Clarity è configurato per oscurare i contenuti inseriti nei campi dei moduli. Senza il consenso, Clarity non viene caricato, questi cookie non vengono installati e nessun dato di navigazione viene comunicato a Microsoft." Tabella cookie: `_clck` (1 anno, distingue i visitatori in forma pseudonima), `_clsk` (1 giorno, collega le pagine di una sessione), `CLID` (1 anno, dominio clarity.ms). Link: informativa privacy Microsoft e pagina "Cookie utilizzati da Microsoft Clarity" (learn.microsoft.com/it-it/clarity/setup-and-installation/cookie-list).

## Prove già fatte (con un finto server Microsoft)

- modulo contatti: dati arrivati nella lista con le colonne giuste;
- assessment: domande lette dalla lista (ordine, domande nascoste, risposte aperte) e risposte salvate;
- Clarity: con "Rifiuta tutti" non viene caricato nulla; con "Accetta tutti" si carica.

La prova vera, con Microsoft 365 del cliente, si fa dopo la pubblicazione sull'hosting.
