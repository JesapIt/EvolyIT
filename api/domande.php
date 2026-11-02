<?php
/* ============================================================================
   EvolyIT — domande dell'assessment

   Sostituisce doGet() dello script Google Apps Script: legge la lista
   SharePoint "Domande" e la consegna al sito nello stesso formato di prima:
     { ok: true, domande: [ { testo, sottotitolo, opzioni: [...], altro } ] }

   Regole (identiche alla scheda "Domande" del foglio Google):
   - una riga per domanda, in ordine crescente di "Ordine";
   - colonne "Opzione 1", "Opzione 2", ... (se ne possono aggiungere altre);
   - un'opzione "Altro" o "Altro (specificare)" diventa la scelta con campo
     di testo libero;
   - una riga senza opzioni è una domanda a risposta aperta;
   - una riga senza testo viene ignorata;
   - se la lista ha una colonna Sì/No "Attiva", le righe con "No" sono nascoste.

   Da qui escono solo i testi pubblici delle domande, mai le risposte.
   ============================================================================ */

require __DIR__ . '/private/lib.php';

try {
    $cfg = evo_config();
} catch (EvoError $e) {
    evo_log($e->getMessage());
    evo_send_json(['ok' => false, 'error' => 'Servizio non configurato'], 503);
}

evo_cors($cfg);

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET, OPTIONS');
    evo_send_json(['ok' => false, 'error' => 'Metodo non consentito'], 405);
}

$cacheSeconds = isset($cfg['domande_cache_seconds']) ? (int) $cfg['domande_cache_seconds'] : 60;
$cached = $cacheSeconds > 0 ? evo_cache_get('domande', $cacheSeconds) : null;
if ($cached !== null) {
    evo_send_json(['ok' => true, 'domande' => $cached]);
}

try {
    $domande = evo_leggi_domande($cfg);
    evo_cache_set('domande', $domande);
    evo_send_json(['ok' => true, 'domande' => $domande]);
} catch (EvoError $e) {
    evo_log($e->getMessage());
    // Microsoft non risponde: meglio l'ultima versione buona che niente.
    $stale = evo_cache_get('domande', null);
    if ($stale !== null) {
        evo_send_json(['ok' => true, 'domande' => $stale]);
    }
    // Il sito userà le domande incorporate in assessment.js.
    evo_send_json(['ok' => false, 'error' => 'Domande non disponibili'], 502);
}

function evo_leggi_domande($cfg)
{
    list($listId, $columns) = evo_list($cfg, $cfg['list_domande']);

    $colTesto = evo_column($columns, 'Domanda');
    if ($colTesto === null) {
        $colTesto = evo_column($columns, 'Titolo');
    }
    if ($colTesto === null) {
        $colTesto = evo_column($columns, 'Title');
    }
    if ($colTesto === null) {
        throw new EvoError('Nella lista "' . $cfg['list_domande'] . '" manca la colonna "Domanda"');
    }
    $colSotto = evo_column($columns, 'Sottotitolo');
    $colOrdine = evo_column($columns, 'Ordine');
    $colAttiva = evo_column($columns, 'Attiva');

    // Tutte le colonne "Opzione N", in ordine di numero.
    $opzioni = [];
    foreach ($columns as $label => $col) {
        if (preg_match('/^opzione\s*(\d+)$/u', $label, $m)) {
            $opzioni[(int) $m[1]] = $col['name'];
        }
    }
    ksort($opzioni);

    $righe = [];
    $url = '/sites/' . evo_site_id($cfg) . '/lists/' . $listId . '/items?expand=fields&$top=200';
    $pagine = 0;
    while ($url !== null && $pagine < 10) {
        $res = evo_graph($cfg, 'GET', $url);
        foreach (isset($res['value']) ? $res['value'] : [] as $item) {
            if (isset($item['fields']) && is_array($item['fields'])) {
                $righe[] = ['id' => isset($item['id']) ? (int) $item['id'] : 0, 'f' => $item['fields']];
            }
        }
        $url = isset($res['@odata.nextLink']) ? $res['@odata.nextLink'] : null;
        $pagine++;
    }

    $domande = [];
    foreach ($righe as $r) {
        $f = $r['f'];
        if ($colAttiva !== null && array_key_exists($colAttiva['name'], $f) && $f[$colAttiva['name']] === false) {
            continue;
        }
        $testo = isset($f[$colTesto['name']]) ? trim((string) $f[$colTesto['name']]) : '';
        if ($testo === '') {
            continue;
        }
        $sotto = ($colSotto !== null && isset($f[$colSotto['name']])) ? trim((string) $f[$colSotto['name']]) : '';
        $lista = [];
        $altro = false;
        foreach ($opzioni as $nomeInterno) {
            $o = isset($f[$nomeInterno]) ? trim((string) $f[$nomeInterno]) : '';
            if ($o === '') {
                continue;
            }
            $min = mb_strtolower($o);
            if ($min === 'altro' || $min === 'altro (specificare)') {
                $altro = true;
            } else {
                $lista[] = $o;
            }
        }
        $ordine = ($colOrdine !== null && isset($f[$colOrdine['name']]) && is_numeric($f[$colOrdine['name']]))
            ? (float) $f[$colOrdine['name']] : PHP_INT_MAX;
        $domande[] = [
            'ordine' => $ordine,
            'id' => $r['id'],
            'dato' => ['testo' => $testo, 'sottotitolo' => $sotto, 'opzioni' => $lista, 'altro' => $altro],
        ];
    }

    usort($domande, function ($a, $b) {
        if ($a['ordine'] == $b['ordine']) {
            return $a['id'] - $b['id'];
        }
        return $a['ordine'] < $b['ordine'] ? -1 : 1;
    });

    return array_map(function ($d) {
        return $d['dato'];
    }, $domande);
}
