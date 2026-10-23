<?php
/* ============================================================================
   EvolyIT — configurazione del ricevitore dei moduli (Microsoft 365)

   COME SI USA
   1. Copia questo file nella stessa cartella con il nome  config.php
   2. Compila i valori annotati durante la configurazione con Salvatore
      (ID organizzazione, ID applicazione, chiave segreta, indirizzo del sito
      SharePoint).
   3. Carica config.php SOLO sull'hosting. Non va mai su GitHub, Drive,
      email o chat: contiene la chiave segreta.

   La cartella "private" è protetta da .htaccess: il browser non può leggerla.
   ============================================================================ */

return [
    // ID dell'organizzazione Microsoft 365 (Entra ID → Panoramica → "ID tenant")
    'tenant_id' => 'INSERIRE-ID-TENANT',

    // ID dell'applicazione registrata ("ID applicazione (client)")
    'client_id' => 'INSERIRE-ID-APPLICAZIONE',

    // Chiave segreta dell'applicazione (il "Valore", visibile una sola volta).
    // Scade: annotare la data di scadenza e rinnovarla prima.
    'client_secret' => 'INSERIRE-CHIAVE-SEGRETA',

    // Sito SharePoint che contiene le liste, scomposto in due parti.
    // Esempio: https://evolyit.sharepoint.com/sites/EvolyITSito
    //   site_hostname => 'evolyit.sharepoint.com'
    //   site_path     => '/sites/EvolyITSito'
    'site_hostname' => 'INSERIRE.sharepoint.com',
    'site_path'     => '/sites/INSERIRE',

    // Nomi delle liste come appaiono in SharePoint.
    'list_contatti'   => 'Contatti',
    'list_assessment' => 'Assessment',
    'list_domande'    => 'Domande',

    // Siti autorizzati a chiamare il ricevitore da un altro indirizzo
    // (servono solo per prove, es. il sito aperto in locale con AVVIA-SITO).
    // Il sito pubblicato sullo stesso hosting non ha bisogno di essere elencato.
    'allowed_origins' => [
        // 'http://localhost:8099',
    ],

    // Secondi per cui le domande restano in memoria prima di essere rilette
    // dalla lista (0 = rilette a ogni visita). Una modifica alla lista si vede
    // sul sito al massimo dopo questo tempo.
    'domande_cache_seconds' => 60,

    // Protezione da invii a raffica: massimo N invii per indirizzo IP
    // nell'arco di "rate_limit_window" secondi.
    'rate_limit_max'    => 10,
    'rate_limit_window' => 600,
];
