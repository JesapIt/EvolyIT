<?php
/* ============================================================================
   EvolyIT — ricezione dei moduli del sito (contatti e assessment)

   Sostituisce doPost() dello script Google Apps Script. Riceve lo stesso JSON
   che il sito mandava a Google (Content-Type text/plain, campo "tipo") e
   risponde { ok: true } oppure { ok: false, error: ... }, come prima.

   - tipo "assessment" → nuovo elemento nella lista "Assessment"
   - qualunque altro tipo → nuovo elemento nella lista "Contatti"

   L'email di avviso a info@ la manda il flusso Power Automate collegato alle
   liste, non questo file.
   ============================================================================ */

require __DIR__ . '/private/lib.php';

try {
    $cfg = evo_config();
} catch (EvoError $e) {
    evo_log($e->getMessage());
    evo_send_json(['ok' => false, 'error' => 'Servizio non configurato'], 503);
}

evo_cors($cfg);

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST, OPTIONS');
    evo_send_json(['ok' => false, 'error' => 'Metodo non consentito'], 405);
}

$raw = file_get_contents('php://input', false, null, 0, 100001);
if ($raw === false || $raw === '' || strlen($raw) > 100000) {
    evo_send_json(['ok' => false, 'error' => 'Richiesta non valida'], 400);
}
$data = json_decode($raw, true);
if (!is_array($data)) {
    evo_send_json(['ok' => false, 'error' => 'Richiesta non valida'], 400);
}

/* Campo trappola per i programmi automatici: è nascosto ai visitatori, quindi
   se arriva compilato l'invio viene scartato in silenzio. */
if (!empty($data['hp'])) {
    evo_send_json(['ok' => true]);
}

evo_rate_limit($cfg);

$nome = isset($data['nome']) ? trim((string) $data['nome']) : '';
$email = isset($data['email']) ? trim((string) $data['email']) : '';
if ($nome === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    evo_send_json(['ok' => false, 'error' => 'Nome o email mancanti o non validi'], 400);
}
$consenso = isset($data['consenso']) ? (string) $data['consenso'] : '';

try {
    if (isset($data['tipo']) && $data['tipo'] === 'assessment') {
        $listName = $cfg['list_assessment'];
        $risposte = isset($data['risposte']) && is_array($data['risposte']) ? $data['risposte'] : [];
        $testo = [];
        $json = [];
        $n = 0;
        foreach (array_slice($risposte, 0, 100) as $r) {
            if (!is_array($r)) {
                continue;
            }
            $n++;
            $domanda = isset($r['domanda']) ? trim((string) $r['domanda']) : '';
            $risposta = isset($r['risposta']) ? trim((string) $r['risposta']) : '';
            if ($risposta === '') {
                $risposta = '—';
            }
            $testo[] = $n . '. ' . $domanda . "\n   → " . $risposta;
            $json[] = ['n' => $n, 'domanda' => $domanda, 'risposta' => $risposta];
        }
        $values = [
            'Nome e Cognome' => $nome,
            'Email' => $email,
            'Consenso privacy' => $consenso,
            'Risposte' => implode("\n\n", $testo),
            'Risposte JSON' => json_encode($json, JSON_UNESCAPED_UNICODE),
        ];
    } else {
        $listName = $cfg['list_contatti'];
        $values = [
            'Nome e Cognome' => $nome,
            'Email' => $email,
            'Azienda' => isset($data['azienda']) ? $data['azienda'] : '',
            'Telefono' => isset($data['telefono']) ? $data['telefono'] : '',
            'Area di interesse' => isset($data['area']) ? $data['area'] : '',
            'Messaggio' => isset($data['messaggio']) ? $data['messaggio'] : '',
            'Consenso privacy' => $consenso,
        ];
    }

    list($listId, $columns) = evo_list($cfg, $listName);
    $fields = evo_build_fields($columns, $values, $listName);
    evo_graph($cfg, 'POST', '/sites/' . evo_site_id($cfg) . '/lists/' . $listId . '/items', ['fields' => $fields]);
} catch (EvoError $e) {
    evo_log($e->getMessage());
    evo_send_json(['ok' => false, 'error' => 'Invio non riuscito'], 502);
}

evo_send_json(['ok' => true]);
