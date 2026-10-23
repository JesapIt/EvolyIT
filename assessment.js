(function () {
  'use strict';

  var stage = document.getElementById('assessment-stage');
  if (!stage) {
    return;
  }

  var topbar = document.getElementById('assessment-topbar');
  var progressEl = document.getElementById('assessment-progress');
  var progressFill = document.getElementById('assessment-progress-fill');
  var stepLabel = document.getElementById('assessment-step-label');

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var QUESTIONS = [
    { id: 'q1',  title: "L'azienda possiede una strategia digitale formalizzata",
      options: ["Sì", "No"] },
    { id: 'q2',  title: "Politiche/procedure per sicurezza informatica e protezione dati",
      options: ["Sì", "No", "In parte"] },
    { id: 'q3',  title: "Apertura verso nuove tecnologie (AI, IoT, cloud, automazione)",
      options: ["Molto aperta, già investiamo attivamente", "Abbastanza aperta, ma con cautela", "Poco aperta, valutiamo solo se necessario", "Per niente aperta al momento"], other: true },
    { id: 'q4',  title: "Organigramma formalizzato e aggiornato",
      options: ["Sì", "No", "Esiste ma non è aggiornato"] },
    { id: 'q5',  title: "Misuratori per monitorare i risultati aziendali",
      options: ["Sì", "No", "In parte (solo alcuni ambiti)"] },
    { id: 'q6',  title: "Riunioni/momenti regolari dedicati al miglioramento interno",
      options: ["Sì", "No", "Solo occasionalmente"] },
    { id: 'q7',  title: "Come reagisce l'organizzazione in una fase di cambiamento",
      options: ["Con facilità, ci adattiamo rapidamente", "Con qualche difficoltà, ma alla fine ci adattiamo", "Con resistenza, il cambiamento è complicato da gestire", "Non abbiamo ancora affrontato cambiamenti importanti"] },
    { id: 'q8',  title: "Funzione HR strutturata",
      options: ["Sì, funzione dedicata", "No, gestita dal titolare/altra funzione", "No, esternalizzata"], other: true },
    { id: 'q9',  title: "Stile di leadership prevalente",
      options: ["Direttivo", "Partecipativo", "Delegante", "Misto, a seconda del contesto"] },
    { id: 'q10', title: "Attività descritte da procedure documentate",
      options: ["Sì", "No", "Solo per alcune attività"] },
    { id: 'q11', title: "C'è qualcos'altro che vorresti farci sapere?", type: 'open',
      help: "Raccontaci qualsiasi esigenza, criticità o obiettivo che non è emerso nelle domande precedenti: più contesto ci dai, più la call sarà mirata e utile." }
  ];
  var TOTAL = QUESTIONS.length;

  var state = {
    answers: {},
    contact: { nome: '', email: '', consenso: false }
  };

  var STEPS = [];
  STEPS.push({ kind: 'intro' });
  for (var i = 0; i < QUESTIONS.length; i++) {
    STEPS.push({ kind: 'question', q: QUESTIONS[i], number: i + 1 });
  }
  STEPS.push({ kind: 'form' });
  STEPS.push({ kind: 'thanks' });

  var index = 0;
  var animating = false;

  var domandePronte = false;
  var attesaDomande = null;
  var ATTESA_MAX = 8000;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  function buildStep(n) {
    var step = STEPS[n];
    if (step.kind === 'intro') { return buildIntro(); }
    if (step.kind === 'question') { return buildQuestion(step); }
    if (step.kind === 'form') { return buildForm(); }
    return buildThanks();
  }

  function buildIntro() {
    var wrap = el('div', 'assessment-step assessment-hero');
    wrap.setAttribute('tabindex', '-1');
    wrap.appendChild(el('p', 'assessment-hero__eyebrow', 'Assessment di maturità'));
    wrap.appendChild(el('h2', 'assessment-hero__title', 'RACCONTACI LA TUA AZIENDA'));
    wrap.appendChild(el('p', 'assessment-hero__lead',
      "Per ogni domanda seleziona l'opzione più vicina alla tua situazione attuale: ci aiuta a capire il punto di partenza della tua azienda. In fondo trovi uno spazio libero per aggiungere altre informazioni prima della call."));
    wrap.appendChild(el('p', 'assessment-hero__meta', TOTAL + ' domande · circa 3 minuti'));
    var cta = el('button', 'btn btn-teal assessment-hero__cta', "Inizia l'assessment");
    cta.type = 'button';
    cta.addEventListener('click', function () {
      if (domandePronte || !attesaDomande) { goNext(); return; }
      var etichetta = cta.textContent;
      cta.disabled = true;
      cta.textContent = 'Un attimo…';
      var partito = false;
      var vai = function () {
        if (partito) { return; }
        partito = true;
        cta.disabled = false;
        cta.textContent = etichetta;
        goNext();
      };
      attesaDomande.then(vai);
      window.setTimeout(vai, ATTESA_MAX);
    });
    wrap.appendChild(cta);
    return wrap;
  }

  function buildQuestion(step) {
    var q = step.q;
    var wrap = el('div', 'assessment-step assessment-q');
    wrap.setAttribute('tabindex', '-1');
    wrap.appendChild(el('p', 'assessment-q__eyebrow', 'Domanda ' + step.number + ' di ' + TOTAL));
    wrap.appendChild(el('h2', 'assessment-q__title', q.title));
    if (q.help) { wrap.appendChild(el('p', 'assessment-q__help', q.help)); }

    if (q.type === 'open') {
      var ta = el('textarea', 'assessment-open contact-field__input contact-field__textarea');
      ta.id = 'as-open-' + q.id;
      ta.rows = 4;
      ta.placeholder = 'Scrivi qui… (facoltativo)';
      ta.value = state.answers[q.id] || '';
      ta.addEventListener('input', function () { state.answers[q.id] = ta.value; });
      wrap.appendChild(ta);
      wrap.appendChild(buildNav(step, {
        continueLabel: 'Continua',
        onContinue: function () {
          state.answers[q.id] = ta.value.trim();
          goNext();
        }
      }));
      return wrap;
    }

    var list = el('div', 'assessment-options');
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', q.title);
    var otherWrap = null;
    var otherInput = null;
    var otherError = null;

    q.options.forEach(function (opt, i) {
      var b = el('button', 'assessment-option');
      b.type = 'button';
      b.appendChild(el('span', 'assessment-option__key', String.fromCharCode(65 + i)));
      b.appendChild(el('span', 'assessment-option__label', opt));
      if (state.answers[q.id] === opt) { b.classList.add('is-selected'); }
      b.addEventListener('click', function () {
        if (otherWrap) { otherWrap.hidden = true; }
        if (otherError) { otherError.hidden = true; }
        selectOption(q, opt, list, b);
      });
      list.appendChild(b);
    });

    if (q.other) {
      var saved = state.answers[q.id] || '';
      var savedOther = saved === 'Altro' || saved.indexOf('Altro: ') === 0;

      var otherBtn = el('button', 'assessment-option');
      otherBtn.type = 'button';
      otherBtn.appendChild(el('span', 'assessment-option__key', String.fromCharCode(65 + q.options.length)));
      otherBtn.appendChild(el('span', 'assessment-option__label', 'Altro (specificare)'));
      if (savedOther) { otherBtn.classList.add('is-selected'); }
      list.appendChild(otherBtn);

      otherWrap = el('div', 'assessment-other');
      otherWrap.hidden = !savedOther;
      otherInput = el('input', 'assessment-other__input contact-field__input');
      otherInput.type = 'text';
      otherInput.id = 'as-other-' + q.id;
      otherInput.placeholder = 'Scrivi qui la tua risposta…';
      otherInput.setAttribute('aria-label', 'Specifica la risposta "Altro"');
      if (savedOther && saved !== 'Altro') { otherInput.value = saved.slice('Altro: '.length); }

      otherError = el('p', 'assessment-other__error', 'Per continuare scrivi la tua risposta nel campo "Altro".');
      otherError.hidden = true;

      var storeOther = function () {
        var txt = otherInput.value.trim();
        state.answers[q.id] = txt ? 'Altro: ' + txt : 'Altro';
      };
      
      var continuaAltro = function () {
        storeOther();
        if (!otherInput.value.trim()) {
          otherError.hidden = false;
          try { otherInput.focus({ preventScroll: true }); } catch (e) { otherInput.focus(); }
          return;
        }
        otherError.hidden = true;
        goNext();
      };
      otherInput.addEventListener('input', function () {
        storeOther();
        otherError.hidden = true;
      });
      otherInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          continuaAltro();
        }
      });

      var otherGo = el('button', 'btn btn-teal assessment-other__go', 'Continua');
      otherGo.type = 'button';
      otherGo.addEventListener('click', continuaAltro);

      otherWrap.appendChild(otherInput);
      otherWrap.appendChild(otherGo);

      otherBtn.addEventListener('click', function () {
        if (animating) { return; }
        var opts = list.querySelectorAll('.assessment-option');
        for (var j = 0; j < opts.length; j++) { opts[j].classList.remove('is-selected'); }
        otherBtn.classList.add('is-selected');
        otherWrap.hidden = false;
        otherError.hidden = true;
        storeOther();
        try { otherInput.focus({ preventScroll: true }); } catch (e) { otherInput.focus(); }
      });
    }

    wrap.appendChild(list);
    if (otherWrap) {
      wrap.appendChild(otherWrap);
      wrap.appendChild(otherError); 
    }

    wrap.addEventListener('keydown', function (event) {
      if (otherInput && event.target === otherInput) { return; }
      var n = parseInt(event.key, 10);
      var opts = list.querySelectorAll('.assessment-option');
      if (!isNaN(n) && n >= 1 && n <= opts.length) {
        if (opts[n - 1] && !opts[n - 1].disabled) { opts[n - 1].click(); }
      }
    });

    wrap.appendChild(buildNav(step, {})); 
    return wrap;
  }

  function selectOption(q, opt, list, btn) {
    if (animating) { return; }
    state.answers[q.id] = opt;
    var opts = list.querySelectorAll('.assessment-option');
    for (var i = 0; i < opts.length; i++) {
      opts[i].classList.remove('is-selected');
      opts[i].disabled = true;
    }
    btn.classList.add('is-selected');
    window.setTimeout(goNext, reduceMotion ? 0 : 260);
  }

  function buildForm() {
    var wrap = el('div', 'assessment-step assessment-formstep');
    wrap.setAttribute('tabindex', '-1');
    wrap.appendChild(el('p', 'assessment-q__eyebrow', 'Ultimo passo'));
    wrap.appendChild(el('h2', 'assessment-formstep__title', 'Lasciaci i tuoi contatti per completare'));
    wrap.appendChild(el('p', 'assessment-formstep__lead',
      'Analizzeremo le tue risposte e ti ricontatteremo per organizzare la call.'));

    var form = el('form', 'assessment-form');
    form.appendChild(field('as-nome', 'nome', 'text', 'Nome e Cognome', true, 'Mario Rossi…', 'name', state.contact.nome));
    form.appendChild(field('as-email', 'email', 'email', 'E-mail', true, 'mariorossi@gmail.it', 'email', state.contact.email));

    var consent = el('label', 'contact-consent');
    var box = el('input', 'contact-consent__box');
    box.type = 'checkbox';
    box.name = 'consenso';
    box.required = true;
    box.checked = !!state.contact.consenso;
    var ctxt = el('span', 'contact-consent__text');
    ctxt.innerHTML = "Ho letto e accetto l'<a href=\"privacy-policy.html\" target=\"_blank\" rel=\"noopener\">Informativa sulla Privacy</a> e acconsento al trattamento dei miei dati per essere ricontattato<span class=\"contact-field__req\">*</span>";
    consent.appendChild(box);
    consent.appendChild(ctxt);
    form.appendChild(consent);

    var note = el('p', 'contact-form__note');
    note.innerHTML = 'I campi con <span class="contact-field__req">*</span> sono obbligatori';
    form.appendChild(note);

    var nav = el('div', 'assessment-nav');
    var back = el('button', 'assessment-back', '← Indietro');
    back.type = 'button';
    back.addEventListener('click', goBack);
    var submit = el('button', 'btn btn-teal', "Completa l'assessment");
    submit.type = 'submit';
    nav.appendChild(back);
    nav.appendChild(submit);
    form.appendChild(nav);

    var feedback = el('p', 'assessment-form__feedback');
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    feedback.hidden = true;
    form.appendChild(feedback);

    form.addEventListener('input', function () {
      state.contact.nome = (form.elements.nome.value || '').trim();
      state.contact.email = (form.elements.email.value || '').trim();
      state.contact.consenso = form.elements.consenso.checked;
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      onSubmit(form, submit, feedback);
    });

    wrap.appendChild(form);
    return wrap;
  }

  function field(id, name, type, label, required, placeholder, autocomplete, value) {
    var w = el('div', 'contact-field');
    var l = el('label', 'contact-field__label');
    l.setAttribute('for', id);
    l.appendChild(document.createTextNode(label));
    if (required) { l.appendChild(el('span', 'contact-field__req', '*')); }
    var inp = el('input', 'contact-field__input');
    inp.type = type;
    inp.id = id;
    inp.name = name;
    if (required) { inp.required = true; }
    if (placeholder) { inp.placeholder = placeholder; }
    if (autocomplete) { inp.setAttribute('autocomplete', autocomplete); }
    if (value) { inp.value = value; }
    w.appendChild(l);
    w.appendChild(inp);
    return w;
  }

  function buildThanks() {
    var wrap = el('div', 'assessment-step assessment-thanks');
    wrap.setAttribute('tabindex', '-1');
    var badge = el('div', 'assessment-thanks__badge');
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = '✓';
    wrap.appendChild(badge);
    wrap.appendChild(el('h2', 'assessment-thanks__title', 'Grazie per aver completato l’assessment!'));
    wrap.appendChild(el('p', 'assessment-thanks__text',
      'Le tue risposte sono state ricevute: le analizzeremo con attenzione e ti ricontatteremo al più presto per organizzare la call.'));
    var actions = el('div', 'assessment-thanks__actions');
    var home = el('a', 'assessment-textlink', 'Torna alla home');
    home.href = 'index.html';
    actions.appendChild(home);
    wrap.appendChild(actions);
    return wrap;
  }

  function buildNav(step, opts) {
    var nav = el('div', 'assessment-nav');
    var showBack = (step.kind === 'question' && step.number > 1);
    if (showBack) {
      var back = el('button', 'assessment-back', '← Indietro');
      back.type = 'button';
      back.addEventListener('click', goBack);
      nav.appendChild(back);
    }
    if (opts && opts.onContinue) {
      var cont = el('button', 'btn btn-teal', opts.continueLabel || 'Continua');
      cont.type = 'button';
      cont.addEventListener('click', opts.onContinue);
      nav.appendChild(cont);
    }
    return nav;
  }

  // Ricevitori PHP sullo stesso hosting: salvano e leggono da SharePoint (Microsoft 365).
  var ENDPOINT_INVIO = 'api/invio.php';
  var ENDPOINT_DOMANDE = 'api/domande.php';

  function buildPayload() {
    return {
      completedAt: new Date().toISOString(),
      answers: QUESTIONS.map(function (q) {
        return { id: q.id, domanda: q.title, risposta: state.answers[q.id] || null };
      }),
      contatto: state.contact
    };
  }

  function submitAssessment(payload) {
    return fetch(ENDPOINT_INVIO, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        tipo: 'assessment',
        nome: payload.contatto.nome,
        email: payload.contatto.email,
        consenso: payload.contatto.consenso ? 'Sì' : 'No',
        risposte: payload.answers.map(function (a) {
          return { domanda: a.domanda, risposta: a.risposta || '—' };
        }),
        hp: ''
      })
    }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.json();
    }).then(function (data) {
      if (!data || data.ok !== true) {
        throw new Error((data && data.error) || 'Invio rifiutato');
      }
      return data;
    });
  }

  function onSubmit(form, submitBtn, feedback) {
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    state.contact.nome = form.elements.nome.value.trim();
    state.contact.email = form.elements.email.value.trim();
    state.contact.consenso = form.elements.consenso.checked;

    var label = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Invio…';

    submitAssessment(buildPayload()).then(function () {
      if (window.evolyitTrack) { window.evolyitTrack('assessment_completato'); }
      goNext();
    }).catch(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = label;
      if (feedback) {
        feedback.hidden = false;
        feedback.textContent = 'Invio non riuscito. Riprova, oppure scrivici dai contatti.';
      }
    });
  }

  var gaMaxDomanda = 0;
  var gaModuloVisto = false;

  function tracciaPassaggio(n) {
    if (!window.evolyitTrack) { return; }
    var step = STEPS[n];
    if (step.kind === 'question' && step.number > gaMaxDomanda) {
      gaMaxDomanda = step.number;
      window.evolyitTrack('assessment_domanda', { numero: step.number });
    } else if (step.kind === 'form' && !gaModuloVisto) {
      gaModuloVisto = true;
      window.evolyitTrack('assessment_modulo');
    }
  }

  function goNext() { go(index + 1); }
  function goBack() { go(index - 1); }

  function go(n) {
    if (animating || n === index || n < 0 || n >= STEPS.length) { return; }
    var forward = n > index;
    index = n;
    tracciaPassaggio(n);
    updateChrome(n);
    transitionTo(n, forward);
  }

  function transitionTo(n, forward) {
    var next = buildStep(n);
    var current = stage.firstElementChild;

    if (!current || reduceMotion) {
      if (current) { stage.removeChild(current); }
      stage.appendChild(next);
      afterEnter(next);
      return;
    }

    animating = true;
    current.classList.add(forward ? 'is-leaving' : 'is-leaving-back');

    var finished = false;
    var swap = function () {
      if (finished) { return; }
      finished = true;
      current.removeEventListener('transitionend', swap);
      if (current.parentNode) { stage.removeChild(current); }
      stage.appendChild(next);
      next.classList.add(forward ? 'is-entering' : 'is-entering-back');
      void next.offsetWidth; 
      var entered = false;
      var finishEnter = function () {
        if (entered) { return; }
        entered = true;
        next.classList.remove('is-entering');
        next.classList.remove('is-entering-back');
        animating = false;
        afterEnter(next);
      };
      window.requestAnimationFrame(finishEnter);
      window.setTimeout(finishEnter, 90);
    };
    current.addEventListener('transitionend', swap);
    window.setTimeout(swap, 460); 
  }

  function updateChrome(n) {
    var step = STEPS[n];
    if (step.kind === 'question') {
      topbar.hidden = false;
      progressFill.style.width = (step.number / TOTAL * 100) + '%';
      progressEl.setAttribute('aria-valuenow', String(step.number));
      stepLabel.textContent = 'Domanda ' + step.number + ' di ' + TOTAL;
    } else if (step.kind === 'form') {
      topbar.hidden = false;
      progressFill.style.width = '100%';
      progressEl.setAttribute('aria-valuenow', String(TOTAL));
      stepLabel.textContent = 'Ultimo passo';
    } else {
      topbar.hidden = true; 
    }
  }

  function afterEnter(node) {
    if (node.scrollIntoView) {
      try {
        node.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
      } catch (e) {
        node.scrollIntoView();
      }
    }
    var focusTarget = node.querySelector('textarea, input, .assessment-option, .btn') || node;
    try {
      focusTarget.focus({ preventScroll: true });
    } catch (e2) {
      focusTarget.focus();
    }
  }

  var first = buildStep(0);
  stage.appendChild(first);
  updateChrome(0);

  function applicaDomandeRemote(domande, origine) {
    if (index !== 0) { return; } 
    var nuove = [];
    for (var i = 0; i < domande.length; i++) {
      var d = domande[i];
      var testo = (d && typeof d.testo === 'string') ? d.testo.trim() : '';
      if (!testo) { continue; }
      var q = { id: 'q' + (nuove.length + 1), title: testo };
      if (d.sottotitolo) { q.help = String(d.sottotitolo); }
      var opzioni = [];
      if (d.opzioni && d.opzioni.length) {
        for (var j = 0; j < d.opzioni.length; j++) {
          var o = String(d.opzioni[j] || '').trim();
          if (o) { opzioni.push(o); }
        }
      }
      if (opzioni.length) {
        q.options = opzioni;
        if (d.altro) { q.other = true; }
      } else {
        q.type = 'open';
      }
      nuove.push(q);
    }
    if (!nuove.length) { return; }
    QUESTIONS = nuove;
    TOTAL = QUESTIONS.length;
    STEPS = [{ kind: 'intro' }];
    for (var k = 0; k < QUESTIONS.length; k++) {
      STEPS.push({ kind: 'question', q: QUESTIONS[k], number: k + 1 });
    }
    STEPS.push({ kind: 'form' });
    STEPS.push({ kind: 'thanks' });
    var meta = stage.querySelector('.assessment-hero__meta');
    if (meta) { meta.textContent = TOTAL + ' domande · circa 3 minuti'; }
    console.info('Assessment: domande ' + (origine || 'caricate dal foglio') + ' (' + TOTAL + ').');
  }

  function fetchDomande(msTimeout) {
    var url = ENDPOINT_DOMANDE + (ENDPOINT_DOMANDE.indexOf('?') === -1 ? '?' : '&') + 'nocache=' + Date.now();
    if (!window.AbortController) { return fetch(url); }
    var controllo = new AbortController();
    var timer = window.setTimeout(function () { controllo.abort(); }, msTimeout);
    return fetch(url, { signal: controllo.signal }).then(function (r) {
      window.clearTimeout(timer);
      return r;
    }, function (err) {
      window.clearTimeout(timer);
      throw err;
    });
  }

  function scaricaDomande(tentativi) {
    return fetchDomande(6000).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.json();
    }).catch(function (err) {
      if (tentativi <= 1) { throw err; }
      return new Promise(function (procedi) {
        window.setTimeout(procedi, 500);
      }).then(function () {
        return scaricaDomande(tentativi - 1);
      });
    });
  }

  var CACHE_DOMANDE = 'evolyit_assessment_domande';

  function salvaCacheDomande(domande) {
    try { window.sessionStorage.setItem(CACHE_DOMANDE, JSON.stringify(domande)); } catch (e) {}
  }

  function leggiCacheDomande() {
    try {
      var raw = window.sessionStorage.getItem(CACHE_DOMANDE);
      if (!raw) { return null; }
      var domande = JSON.parse(raw);
      return (domande && domande.length) ? domande : null;
    } catch (e) { return null; }
  }

  if (ENDPOINT_DOMANDE && window.fetch) {
    attesaDomande = scaricaDomande(3).then(function (data) {
      if (data && data.ok === true && data.domande && data.domande.length) {
        applicaDomandeRemote(data.domande);
        salvaCacheDomande(data.domande);
      } else {
        console.info('Assessment: scheda "Domande" vuota o non valida, uso le domande incorporate.');
      }
    }).catch(function () {
      var cache = leggiCacheDomande();
      if (cache) {
        applicaDomandeRemote(cache, 'riprese dalla copia in memoria, foglio non raggiungibile');
      } else {
        console.info('Assessment: domande del foglio non disponibili, uso le domande incorporate.');
      }
    }).then(function () {
      domandePronte = true; 
    });
  }
})();
