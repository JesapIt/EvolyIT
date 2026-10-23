(function () {
  'use strict';

  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');

  if (!toggle || !nav) {
    return;
  }

  function closeNav() {
    toggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  }

  function openNav() {
    toggle.setAttribute('aria-expanded', 'true');
    nav.classList.add('is-open');
  }

  toggle.addEventListener('click', function () {
    var isOpen = toggle.getAttribute('aria-expanded') === 'true';
    if (isOpen) {
      closeNav();
    } else {
      openNav();
    }
  });

  nav.addEventListener('click', function (event) {
    if (event.target.tagName === 'A') {
      closeNav();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeNav();
      toggle.focus();
    }
  });

  document.addEventListener('click', function (event) {
    var isClickInside = nav.contains(event.target) || toggle.contains(event.target);
    if (!isClickInside && toggle.getAttribute('aria-expanded') === 'true') {
      closeNav();
    }
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth >= 900) {
      closeNav();
    }
  });
})();

(function () {
  'use strict';

  var form = document.getElementById('contact-form');
  if (!form) {
    return;
  }

  var feedback = document.getElementById('contact-feedback');

  // Ricevitore PHP sullo stesso hosting: salva in SharePoint (Microsoft 365).
  var ENDPOINT_INVIO = 'api/invio.php';

  function val(name) {
    var el = form.elements[name];
    return el && el.value ? el.value.trim() : '';
  }

  function showFeedback(message) {
    if (!feedback) {
      return;
    }
    feedback.textContent = message;
    feedback.hidden = false;
  }

  form.addEventListener('submit', function (event) {
 
    event.preventDefault();

    var nome = val('Nome');

    var submitBtn = form.querySelector('button[type="submit"]');
    var label = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Invio…';
    }

    var invio = fetch(ENDPOINT_INVIO, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        tipo: 'contatti',
        nome: nome,
        email: val('Email'),
        azienda: val('Azienda') || '—',
        telefono: val('Telefono') || '—',
        area: val('Area') || '—',
        messaggio: val('Messaggio'),
        consenso: 'Sì',
        hp: val('sito_web')
      })
    }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.json();
    }).then(function (data) {
      if (!data || data.ok !== true) {
        throw new Error((data && data.error) || 'Invio rifiutato');
      }
    });

    invio.then(function () {
      if (window.evolyitTrack) { window.evolyitTrack('contatto_inviato'); }
      form.reset();
      showFeedback('Grazie ' + nome + '! Il tuo messaggio è stato inviato: ti ricontatteremo al più presto.');
    }).catch(function () {
      showFeedback('Invio non riuscito. Riprova tra qualche istante, oppure scrivici direttamente a info@evolyit.it.');
    }).then(function () {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = label;
      }
    });
  });
})();

(function () {
  'use strict';

  var COOKIE_NAME = 'evolyit_cookie_consent';
  var COOKIE_DAYS = 180;

  function getConsent() {
    var m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=(accepted|rejected)'));
    return m ? m[1] : null;
  }

  function setConsent(value) {
    document.cookie = COOKIE_NAME + '=' + value +
      '; max-age=' + (COOKIE_DAYS * 24 * 60 * 60) + '; path=/; SameSite=Lax';
  }

  window.evolyitConsent = { get: getConsent };

  // Microsoft Clarity (statistiche). Si carica solo dopo il consenso ai cookie.
  // Inserire l'ID del progetto Clarity: finché resta 'INSERIRE_ID_CLARITY'
  // non viene caricato nulla (interruttore di sicurezza).
  var CLARITY_PROJECT_ID = 'INSERIRE_ID_CLARITY';

  var clarityCaricato = false;

  function ambienteLocale() {
    return !location.hostname || location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1';
  }

  function clarityAttivo() {
    return /^[a-z0-9]{6,20}$/i.test(CLARITY_PROJECT_ID) &&
      CLARITY_PROJECT_ID !== 'INSERIRE_ID_CLARITY' && !ambienteLocale();
  }

  function loadAnalytics() {
    if (!clarityAttivo()) {
      return;
    }
    if (!clarityCaricato) {
      clarityCaricato = true;
      window.clarity = window.clarity || function () {
        (window.clarity.q = window.clarity.q || []).push(arguments);
      };
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.clarity.ms/tag/' + encodeURIComponent(CLARITY_PROJECT_ID);
      document.head.appendChild(s);
    }
    window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });
  }

  function stopAnalytics() {
    if (typeof window.clarity === 'function') {
      window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });
      window.clarity('consent', false);
    }
    var righe = document.cookie.split('; ');
    var parti = location.hostname.split('.');
    for (var i = 0; i < righe.length; i++) {
      var nome = righe[i].split('=')[0];
      if (nome !== '_clck' && nome !== '_clsk' && nome.indexOf('_ga') !== 0) { continue; }
      document.cookie = nome + '=; max-age=0; path=/';
      for (var j = 0; j < parti.length - 1; j++) {
        document.cookie = nome + '=; max-age=0; path=/; domain=.' + parti.slice(j).join('.');
      }
    }
  }

  window.evolyitTrack = function (nome, parametri) {
    if (!clarityCaricato || typeof window.clarity !== 'function') {
      return;
    }
    var evento = nome;
    if (parametri && parametri.numero) {
      evento = nome + '_' + parametri.numero;
    }
    window.clarity('event', evento);
  };

  function hideBanner() {
    var banner = document.getElementById('cookie-banner');
    if (banner && banner.parentNode) {
      banner.parentNode.removeChild(banner);
    }
  }

  function choose(value) {
    setConsent(value);
    hideBanner();
    if (value === 'accepted') {
      loadAnalytics();
    } else {
      stopAnalytics();
    }
  }

  function buildBanner() {
    var wrap = document.createElement('div');
    wrap.className = 'cookie-banner';
    wrap.id = 'cookie-banner';
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'Informativa cookie');

    var inner = document.createElement('div');
    inner.className = 'cookie-banner__inner';

    var title = document.createElement('p');
    title.className = 'cookie-banner__title';
    title.textContent = 'Questo sito utilizza cookie';

    var text = document.createElement('p');
    text.className = 'cookie-banner__text';
    text.innerHTML = 'Utilizziamo un cookie tecnico per ricordare le tue preferenze. ' +
      'Solo con il tuo consenso potremo utilizzare, quando presenti, cookie statistici ' +
      'e di marketing anche di terze parti. Puoi cambiare la scelta in ogni momento dal ' +
      'link "Preferenze Cookie" nel footer. Per saperne di più leggi la ' +
      '<a href="cookie-policy.html">Cookie Policy</a>.';

    var actions = document.createElement('div');
    actions.className = 'cookie-banner__actions';

    var accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'btn btn-teal cookie-banner__btn';
    accept.textContent = 'Accetta tutti';
    accept.addEventListener('click', function () { choose('accepted'); });

    var reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'btn cookie-banner__btn cookie-banner__btn--reject';
    reject.textContent = 'Rifiuta tutti';
    reject.addEventListener('click', function () { choose('rejected'); });

    actions.appendChild(accept);
    actions.appendChild(reject);
    inner.appendChild(title);
    inner.appendChild(text);
    inner.appendChild(actions);
    wrap.appendChild(inner);
    return wrap;
  }

  function showBanner() {
    if (!document.getElementById('cookie-banner')) {
      document.body.appendChild(buildBanner());
    }
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest ? event.target.closest('[data-cookie-prefs]') : null;
    if (trigger) {
      event.preventDefault();
      showBanner();
    }
  });

  if (!getConsent()) {
    showBanner();
  } else if (getConsent() === 'accepted') {
    loadAnalytics(); 
  }
})();
