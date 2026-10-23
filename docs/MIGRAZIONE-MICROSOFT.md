# Migrazione da Google a Microsoft 365: modifiche al sito

## Cosa è cambiato

| File | Prima (Google) | Ora (Microsoft) |
|---|---|---|
| `script.js` (modulo contatti) | invio a Google Apps Script | invio a `api/invio.php` (salva nella lista SharePoint "Contatti") |
| `assessment.js` | invio e lettura domande da Google Apps Script | invio a `api/invio.php`, domande da `api/domande.php` (lista "Domande") |
| `script.js` (statistiche) | Google Analytics 4 (`G-8HV6Y2RN3Y`) | Microsoft Clarity, caricato solo dopo "Accetta tutti" |
| tutte le pagine | link "Scrivi con Gmail" | link `mailto:info@evolyit.it` (si apre il programma di posta del visitatore) |
| `contatti.html` | — | campo nascosto anti-spam (`sito_web`), invisibile ai visitatori |
| `privacy-policy.html`, `cookie-policy.html` | Google, Fogli, GA4 | Microsoft 365, Clarity (**bozza da far verificare al legale**) |

Aspetto e funzionamento per il visitatore restano identici.

## Da fare prima di andare online

1. **Configurazione del ricevitore**: creare `api/private/config.php` con i dati della chiamata con Salvatore (vedi `api/README.md`).
2. **Clarity** (facoltativo, si può fare anche dopo):
   - creare il progetto su https://clarity.microsoft.com con l'account Microsoft dell'azienda;
   - in Impostazioni → Mascheramento scegliere **Rigido** (la cookie policy dice che i campi dei moduli sono oscurati);
   - copiare l'ID progetto in `script.js`, al posto di `INSERIRE_ID_CLARITY`.
   Finché l'ID non è inserito, il sito non carica nessuna statistica (nessun errore).
3. **Testi legali**: far rileggere al legale le parti marcate `BOZZA` (sezioni 6–7 della privacy policy, 2.2 e 6 della cookie policy) e aggiornare la data "Ultimo aggiornamento".
   DA VERIFICARE: società Microsoft che fornisce Clarity ai clienti europei, elenco e durata esatti dei cookie Clarity, indicazione del fornitore di hosting.

## Prove già fatte (con un finto server Microsoft)

- modulo contatti: dati arrivati nella lista con le colonne giuste;
- assessment: domande lette dalla lista (ordine, domande nascoste, risposte aperte) e risposte salvate;
- Clarity: con "Rifiuta tutti" non viene caricato nulla; con "Accetta tutti" si carica.

La prova vera, con Microsoft 365 del cliente, si fa dopo la pubblicazione sull'hosting.
