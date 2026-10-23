<?php
/* ============================================================================
   EvolyIT — funzioni comuni del ricevitore dei moduli (Microsoft 365)

   Sostituisce lo script Google Apps Script (google-sheet-endpoint.gs):
   il sito invia gli stessi dati di prima, ma qui vengono scritti nelle liste
   SharePoint del Microsoft 365 di EvolyIT tramite Microsoft Graph.
   Le email di avviso NON partono da qui: le manda un flusso Power Automate
   quando nella lista compare un nuovo elemento.

   Compatibile con PHP 7.4 e successivi. Richiede l'estensione cURL.
   ============================================================================ */

const EVO_GRAPH = 'https://graph.microsoft.com/v1.0';
const EVO_CACHE_HEAD = "<?php exit; ?>\n";

class EvoError extends Exception {}

function evo_config()
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $file = __DIR__ . '/config.php';
    if (!is_file($file)) {
        throw new EvoError('config.php mancante: copiare config.example.php e compilarlo');
    }
    $cfg = require $file;
    foreach (['tenant_id', 'client_id', 'client_secret', 'site_hostname', 'site_path'] as $k) {
        if (empty($cfg[$k]) || strpos($cfg[$k], 'INSERIRE') !== false) {
            throw new EvoError('config.php incompleto: manca ' . $k);
        }
    }
    return $cfg;
}

/* ---------- risposta al browser ---------- */

function evo_send_json($data, $status = 200)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/* Il sito pubblicato sta sullo stesso dominio del ricevitore e non ha bisogno
   di nulla. Le origini in allowed_origins servono solo alle prove in locale. */
function evo_cors($cfg)
{
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    $allowed = isset($cfg['allowed_origins']) ? (array) $cfg['allowed_origins'] : [];
    if ($origin !== '' && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
    }
    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

/* ---------- piccola cache su file (cartella private/cache) ---------- */

function evo_cache_path($key)
{
    // .php con "exit" in testa: anche se il server ignorasse .htaccess,
    // aprendo il file dal browser non si vedrebbe nulla (contiene il token).
    return __DIR__ . '/cache/' . preg_replace('/[^a-z0-9_-]/i', '_', $key) . '.php';
}

/* Restituisce il valore se più recente di $maxAge secondi, altrimenti null.
   Con $maxAge = null ignora l'età (usato come riserva quando Microsoft non
   risponde). */
function evo_cache_get($key, $maxAge)
{
    $file = evo_cache_path($key);
    if (!is_file($file)) {
        return null;
    }
    if ($maxAge !== null && (time() - filemtime($file)) > $maxAge) {
        return null;
    }
    $raw = @file_get_contents($file);
    if ($raw === false) {
        return null;
    }
    $data = json_decode(substr($raw, strlen(EVO_CACHE_HEAD)), true);
    return is_array($data) ? $data : null;
}

function evo_cache_set($key, $value)
{
    $dir = __DIR__ . '/cache';
    if (!is_dir($dir) || !is_writable($dir)) {
        return; // senza cache funziona lo stesso, solo un po' più lento
    }
    $file = evo_cache_path($key);
    $tmp = $file . '.' . getmypid() . '.tmp';
    if (@file_put_contents($tmp, EVO_CACHE_HEAD . json_encode($value, JSON_UNESCAPED_UNICODE)) !== false) {
        @rename($tmp, $file);
    }
}

/* ---------- limite di invii per indirizzo IP ---------- */

function evo_rate_limit($cfg)
{
    $max = isset($cfg['rate_limit_max']) ? (int) $cfg['rate_limit_max'] : 10;
    $window = isset($cfg['rate_limit_window']) ? (int) $cfg['rate_limit_window'] : 600;
    if ($max <= 0) {
        return;
    }
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'sconosciuto';
    $key = 'rl_' . hash('sha256', $ip);
    $now = time();
    $hits = evo_cache_get($key, $window);
    $hits = is_array($hits) ? array_values(array_filter($hits, function ($t) use ($now, $window) {
        return is_int($t) && $t > $now - $window;
    })) : [];
    if (count($hits) >= $max) {
        evo_send_json(['ok' => false, 'error' => 'Troppi invii, riprova più tardi'], 429);
    }
    $hits[] = $now;
    evo_cache_set($key, $hits);
}

/* ---------- chiamate HTTP ---------- */

function evo_http($method, $url, $headers, $body = null)
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    $raw = curl_exec($ch);
    if ($raw === false) {
        $err = curl_error($ch);
        curl_close($ch);
        throw new EvoError('Connessione a Microsoft non riuscita: ' . $err);
    }
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);
    $respHeaders = strtolower(substr($raw, 0, $headerSize));
    $respBody = substr($raw, $headerSize);
    $retryAfter = 0;
    if (preg_match('/^retry-after:\s*(\d+)/m', $respHeaders, $m)) {
        $retryAfter = (int) $m[1];
    }
    return ['status' => $status, 'body' => $respBody, 'retry_after' => $retryAfter];
}

/* Token di accesso dell'applicazione (flusso "client credentials").
   Vale circa un'ora: lo teniamo in cache per non chiederlo a ogni invio. */
function evo_token($cfg)
{
    $cacheKey = 'token_' . substr(hash('sha256', $cfg['tenant_id'] . $cfg['client_id']), 0, 16);
    $cached = evo_cache_get($cacheKey, null);
    if ($cached && isset($cached['token'], $cached['expires']) && $cached['expires'] > time() + 120) {
        return $cached['token'];
    }
    $login = isset($cfg['_login_base']) ? $cfg['_login_base'] : 'https://login.microsoftonline.com';
    $url = $login . '/' . rawurlencode($cfg['tenant_id']) . '/oauth2/v2.0/token';
    $res = evo_http('POST', $url, ['Content-Type: application/x-www-form-urlencoded'], http_build_query([
        'client_id' => $cfg['client_id'],
        'client_secret' => $cfg['client_secret'],
        'scope' => 'https://graph.microsoft.com/.default',
        'grant_type' => 'client_credentials',
    ]));
    $data = json_decode($res['body'], true);
    if ($res['status'] !== 200 || empty($data['access_token'])) {
        $code = isset($data['error']) ? $data['error'] : ('HTTP ' . $res['status']);
        throw new EvoError('Accesso a Microsoft rifiutato (' . $code . '): controllare ID e chiave segreta in config.php');
    }
    $expires = time() + (isset($data['expires_in']) ? (int) $data['expires_in'] : 3600);
    evo_cache_set($cacheKey, ['token' => $data['access_token'], 'expires' => $expires]);
    return $data['access_token'];
}

/* Chiamata a Microsoft Graph. $pathOrUrl può essere un percorso (/sites/...)
   o un URL completo (per le pagine successive di un elenco). */
function evo_graph($cfg, $method, $pathOrUrl, $payload = null)
{
    $base = isset($cfg['_graph_base']) ? $cfg['_graph_base'] : EVO_GRAPH; // _graph_base: solo per i test
    $url = preg_match('#^https?://#', $pathOrUrl) ? $pathOrUrl : $base . $pathOrUrl;
    $headers = ['Authorization: Bearer ' . evo_token($cfg), 'Accept: application/json'];
    $body = null;
    if ($payload !== null) {
        $headers[] = 'Content-Type: application/json';
        $body = json_encode($payload, JSON_UNESCAPED_UNICODE);
    }
    for ($attempt = 1; $attempt <= 2; $attempt++) {
        $res = evo_http($method, $url, $headers, $body);
        if (($res['status'] === 429 || $res['status'] === 503) && $attempt === 1) {
            sleep(min(max($res['retry_after'], 1), 3)); // Microsoft chiede di rallentare
            continue;
        }
        break;
    }
    $data = json_decode($res['body'], true);
    if ($res['status'] < 200 || $res['status'] >= 300) {
        $msg = isset($data['error']['message']) ? $data['error']['message'] : ('HTTP ' . $res['status']);
        if ($res['status'] === 403) {
            $msg .= ' (l\'applicazione non ha il permesso su questo sito SharePoint)';
        }
        throw new EvoError('Microsoft Graph: ' . $msg);
    }
    return is_array($data) ? $data : [];
}

/* ---------- sito, liste e colonne ---------- */

function evo_site_id($cfg)
{
    $key = 'site_' . substr(hash('sha256', $cfg['site_hostname'] . $cfg['site_path']), 0, 16);
    $cached = evo_cache_get($key, 86400);
    if ($cached && !empty($cached['id'])) {
        return $cached['id'];
    }
    $path = '/' . trim($cfg['site_path'], '/');
    $site = evo_graph($cfg, 'GET', '/sites/' . $cfg['site_hostname'] . ':' . $path . '?$select=id');
    if (empty($site['id'])) {
        throw new EvoError('Sito SharePoint non trovato: controllare site_hostname e site_path');
    }
    evo_cache_set($key, ['id' => $site['id']]);
    return $site['id'];
}

/* Restituisce [id lista, mappa colonne]. La mappa collega il nome visibile
   della colonna ("Nome e Cognome") al nome interno usato da Graph, che per le
   liste create da Excel è spesso del tipo field_1, field_2... */
function evo_list($cfg, $listName)
{
    $siteId = evo_site_id($cfg);
    $key = 'list_' . substr(hash('sha256', $siteId . '|' . $listName), 0, 16);
    $cached = evo_cache_get($key, 600);
    if ($cached && !empty($cached['id']) && isset($cached['columns'])) {
        return [$cached['id'], $cached['columns']];
    }
    $lists = evo_graph($cfg, 'GET', '/sites/' . $siteId . '/lists?$select=id,displayName&$top=200');
    $listId = null;
    foreach (isset($lists['value']) ? $lists['value'] : [] as $l) {
        if (isset($l['displayName']) && mb_strtolower(trim($l['displayName'])) === mb_strtolower(trim($listName))) {
            $listId = $l['id'];
            break;
        }
    }
    if ($listId === null) {
        throw new EvoError('Lista "' . $listName . '" non trovata nel sito SharePoint');
    }
    $cols = evo_graph($cfg, 'GET', '/sites/' . $siteId . '/lists/' . $listId . '/columns?$top=200');
    $map = [];
    foreach (isset($cols['value']) ? $cols['value'] : [] as $c) {
        if (empty($c['name']) || empty($c['displayName'])) {
            continue;
        }
        if (!empty($c['hidden']) || (!empty($c['readOnly']) && $c['name'] !== 'Title')) {
            continue;
        }
        $label = mb_strtolower(trim($c['displayName']));
        if (isset($map[$label])) {
            continue; // in caso di doppioni vale la prima colonna
        }
        $map[$label] = [
            'name' => $c['name'],
            'multiline' => !empty($c['text']['allowMultipleLines']),
            'maxLength' => isset($c['text']['maxLength']) ? (int) $c['text']['maxLength'] : 255,
            'number' => isset($c['number']),
            'boolean' => isset($c['boolean']),
        ];
    }
    evo_cache_set($key, ['id' => $listId, 'columns' => $map]);
    return [$listId, $map];
}

function evo_column($map, $label)
{
    $k = mb_strtolower(trim($label));
    return isset($map[$k]) ? $map[$k] : null;
}

/* ---------- pulizia dei testi ---------- */

/* Testo pronto per SharePoint: senza caratteri di controllo, tagliato alla
   lunghezza della colonna, e senza formule. Come nello script Google, un
   valore che inizia con = @ (o + - non seguiti da una cifra) potrebbe essere
   eseguito come formula quando la lista viene esportata in Excel: un
   apostrofo davanti lo rende testo. "+39 333..." resta intatto. */
function evo_clean($value, $maxLength, $empty = '—')
{
    $v = is_scalar($value) ? (string) $value : '';
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v);
    $v = trim(str_replace("\r\n", "\n", $v));
    if ($v === '') {
        return $empty;
    }
    if (preg_match('/^[=@]/', $v) || preg_match('/^[+\-](?![\d\s])/', $v)) {
        $v = "'" . $v;
    }
    if (mb_strlen($v) > $maxLength) {
        $v = mb_substr($v, 0, $maxLength - 1) . '…';
    }
    return $v;
}

/* Prepara i campi di un nuovo elemento a partire da [nome colonna => valore],
   rispettando tipo e lunghezza di ogni colonna. Una colonna mancante blocca
   l'invio con un messaggio chiaro (vuol dire che la lista è stata modificata). */
function evo_build_fields($map, $values, $listName)
{
    $fields = [];
    foreach ($values as $label => $value) {
        $col = evo_column($map, $label);
        if ($col === null) {
            throw new EvoError('Nella lista "' . $listName . '" manca la colonna "' . $label . '"');
        }
        $max = $col['multiline'] ? 60000 : max(1, min($col['maxLength'], 255));
        $fields[$col['name']] = evo_clean($value, $max);
    }
    return $fields;
}

function evo_log($message)
{
    error_log('[EvolyIT moduli] ' . $message);
}
