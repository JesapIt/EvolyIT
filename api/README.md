# Ricevitore dei moduli — Microsoft 365

Sostituisce lo script Google Apps Script (`google-sheet-endpoint.gs`).
Il sito manda gli stessi dati di prima; qui vengono scritti nelle liste
SharePoint di EvolyIT tramite Microsoft Graph.

| File | Cosa fa | Prima (Google) |
|---|---|---|
| `invio.php` | Riceve modulo contatti e assessment e crea un elemento nella lista **Contatti** o **Assessment** | `doPost()` |
| `domande.php` | Legge la lista **Domande** e la consegna alla pagina assessment | `doGet()` |
| `private/lib.php` | Funzioni comuni (accesso a Microsoft, liste, pulizia testi, cache) | — |
| `private/config.example.php` | Modello della configurazione | costante `SHEET_ENDPOINT` |

Le **email di avviso** a info@ non partono da qui: le manda un flusso
Power Automate quando nella lista compare un nuovo elemento.

## Requisiti dell'hosting
- PHP 7.4 o successivo con estensione **cURL** (hosting Linux, es. Aruba Hosting Linux)
- Apache con `.htaccess` attivo (protegge la cartella `private`)
- HTTPS attivo sul dominio
- La cartella `api/private/cache` deve essere scrivibile da PHP

## Installazione
1. Caricare la cartella `api/` nella stessa cartella del sito (accanto a `index.html`).
2. Copiare `api/private/config.example.php` in `api/private/config.php` e compilarlo
   con i valori annotati durante la configurazione di Microsoft 365.
3. Verificare:
   - `https://<dominio>/api/domande.php` → deve rispondere `{"ok":true,"domande":[...]}`
   - `https://<dominio>/api/private/config.php` → deve dare **errore 403** (accesso negato)
4. Compilare il modulo contatti dal sito → deve comparire una riga nella lista **Contatti**.

`config.php` contiene la chiave segreta: **non va mai** su GitHub, Drive, email o chat.

## Permessi Microsoft necessari
Applicazione registrata in Microsoft Entra con il permesso applicazione
**Sites.Selected** (con consenso amministratore) e ruolo **write** concesso
solo sul sito SharePoint delle liste. Nessun altro accesso ai dati di EvolyIT.

## Le liste
Create da Excel (file `EvolyIT-liste-SharePoint.xlsx` e `EvolyIT-lista-Domande-v2.xlsx`).
Il ricevitore cerca le colonne **per nome visibile**, quindi funziona anche se
SharePoint le chiama internamente `field_1`, `field_2`...

- **Contatti**: Nome e Cognome · Email · Azienda · Telefono · Area di interesse · Messaggio · Consenso privacy
- **Assessment**: Nome e Cognome · Email · Consenso privacy · Risposte · Risposte JSON
- **Domande**: Domanda · Ordine · Sottotitolo · Opzione 1…Opzione N (facoltativa: Attiva Sì/No)

Se si rinomina o si elimina una di queste colonne, gli invii smettono di funzionare
(dopo al massimo 10 minuti) finché il nome non viene ripristinato.
