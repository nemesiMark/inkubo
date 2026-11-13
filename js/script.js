/* Rain Ink Tattoo — script del sito */
(function () {
'use strict';
var R = document.documentElement;
var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
var EASE = 'cubic-bezier(.16, 1, .3, 1)';
var canAnimate = !reduce && !!Element.prototype.animate;
function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function all(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }

/* ======================================================
   NAVBAR (come nel sito Olimp)
   ====================================================== */
var h = document.querySelector('header'), nav = document.getElementById('nav'), b = document.querySelector('.burger');
var home = document.body.classList.contains('home-page');
function barFill() {
  if (!h) return;
  h.classList.toggle('solid', window.scrollY > 40);
  /* Home: la barra si riempie man mano nei primi 160 px di scorrimento; col menu a panino aperto è piena. */
  if (home) h.style.setProperty('--fill', nav && nav.classList.contains('open') ? 1 : clamp(window.scrollY / 160).toFixed(3));
}
if (nav && b) {
  b.addEventListener('click', function () { var o = nav.classList.toggle('open'); b.setAttribute('aria-expanded', o); barFill(); });
  var dds = all('.dd', nav);
  var closeAll = function () { dds.forEach(function (it) { it.classList.remove('open'); it.querySelector(':scope > a').setAttribute('aria-expanded', 'false'); }); };
  dds.forEach(function (item) {
    var t = item.querySelector(':scope > a');
    t.setAttribute('aria-expanded', 'false');
    /* Su telefono, tablet e schermi senza mouse il primo tocco apre il menu invece di cambiare pagina. */
    t.addEventListener('click', function (e) {
      if (matchMedia('(max-width:1100px)').matches || matchMedia('(hover:none)').matches) {
        e.preventDefault();
        var o = !item.classList.contains('open');
        item.classList.toggle('open', o); t.setAttribute('aria-expanded', String(o));
      }
    });
    item.addEventListener('keydown', function (e) { if (e.key === 'Escape') { item.classList.remove('open'); t.setAttribute('aria-expanded', 'false'); t.focus(); } });
  });
  document.addEventListener('click', function (e) { if (!nav.contains(e.target)) closeAll(); });
  all('a[href]', nav).forEach(function (a) {
    a.addEventListener('click', function () { if (!a.matches('.dd > a')) { nav.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); closeAll(); barFill(); } });
  });
}

/* ======================================================
   MOVIMENTI LEGATI ALLO SCORRIMENTO
   Ogni effetto registra una funzione che riceve l'altezza dello schermo;
   girano tutte insieme una volta per fotogramma mentre si scorre.
   ====================================================== */
var onScrollFns = [barFill], onResizeFns = [], ticking = false;
function runScroll() { ticking = false; var vh = window.innerHeight; onScrollFns.forEach(function (f) { f(vh); }); }
function requestRun() { if (!ticking) { ticking = true; requestAnimationFrame(runScroll); } }
window.addEventListener('scroll', requestRun, { passive: true });
window.addEventListener('resize', function () { onResizeFns.forEach(function (f) { f(); }); requestRun(); });
window.addEventListener('pageshow', requestRun);
window.addEventListener('load', function () { onResizeFns.forEach(function (f) { f(); }); requestRun(); });

/* Prima schermata: scorrendo l'inchiostro e il nome rimpiccioliscono e sfumano */
function heroOut() {
  var hero = document.querySelector('.hero');
  if (!hero || reduce) return;
  onScrollFns.push(function () {
    hero.style.setProperty('--p', clamp(window.scrollY / (hero.offsetHeight * .85)).toFixed(3));
  });
}

/* Frase manifesto: le parole si accendono una alla volta */
function words() {
  all('.words').forEach(function (el) {
    if (reduce) return;
    var ws = [];
    (function split(node) {
      [].slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (t) {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
            var s = document.createElement('span'); s.className = 'w'; s.textContent = t; frag.appendChild(s); ws.push(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) split(n);
      });
    })(el);
    onScrollFns.push(function (vh) {
      var r = el.getBoundingClientRect(), c = r.top + r.height / 2;
      var p = clamp((vh * .92 - c) / (vh * .55)), k = Math.round(p * ws.length);
      ws.forEach(function (w, i) { w.classList.toggle('on', i < k); });
    });
  });
}

/* Immagini che si aprono dal riquadro stretto e si assestano */
function clipZoom() {
  all('.cz').forEach(function (el) {
    if (reduce) return;
    el.style.setProperty('--p', 0);
    onScrollFns.push(function (vh) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--p', clamp((vh - r.top) / (vh * .8)).toFixed(3));
    });
  });
}

/* Stili in home: la sezione si blocca e le schede scorrono in orizzontale */
function hscroll() {
  var sec = document.querySelector('.hs'); if (!sec) return;
  var track = sec.querySelector('.hs-track'), bar = sec.querySelector('.hs-bar'), dist = 0, on = false;
  function measure() {
    on = !reduce && window.innerWidth > 860 && window.innerHeight >= 680;
    sec.classList.toggle('hs-on', on);
    track.style.transform = '';
    if (!on) return;
    var last = track.lastElementChild, pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    dist = Math.max(0, last.offsetLeft + last.offsetWidth + pad - track.clientWidth);
    sec.style.setProperty('--hs-dist', dist + 'px');
  }
  function setBar(p) { if (bar) bar.style.setProperty('--p', p.toFixed(4)); }
  onResizeFns.push(measure);
  measure();
  onScrollFns.push(function () {
    if (!on) return;
    var p = dist ? clamp(-sec.getBoundingClientRect().top / dist) : 0;
    track.style.transform = 'translate3d(' + (-p * dist).toFixed(1) + 'px,0,0)';
    setBar(p);
  });
  /* senza blocco (telefono): la barra segue lo scorrimento col dito */
  track.addEventListener('scroll', function () { if (!on) { var m = track.scrollWidth - track.clientWidth; setBar(m > 0 ? track.scrollLeft / m : 0); } }, { passive: true });
}

/* Come funziona: le schede si impilano, quella sotto rimpicciolisce */
function stack() {
  var cards = all('.stack-card'); if (cards.length < 2 || reduce) return;
  onScrollFns.push(function (vh) {
    cards.forEach(function (c, i) {
      var next = cards[i + 1];
      if (!next) return;
      var top = parseFloat(getComputedStyle(c).top) || 0;
      var p = clamp(1 - (next.getBoundingClientRect().top - top) / (vh * .7));
      c.style.setProperty('--s', (1 - p * .06).toFixed(4));
      c.style.setProperty('--dim', p.toFixed(3));
    });
  });
}

/* Hai già un'idea?: il rosso si apre a cerchio e il titolo cresce */
function ctaCircle() {
  all('.cta-band').forEach(function (el) {
    if (reduce) return;
    el.style.setProperty('--p', 0);
    onScrollFns.push(function (vh) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--p', clamp((vh - r.top) / (vh * .85)).toFixed(3));
    });
  });
}

/* Cura del tatuaggio: la linea si riempie e i punti si accendono */
function timeline() {
  var tl = document.querySelector('.timeline'); if (!tl) return;
  var steps = all(':scope > li', tl);
  if (reduce) { steps.forEach(function (s) { s.classList.add('on'); }); return; }
  onScrollFns.push(function (vh) {
    var r = tl.getBoundingClientRect(), line = vh * .6;
    tl.style.setProperty('--p', clamp((line - r.top) / r.height).toFixed(4));
    steps.forEach(function (s) { s.classList.toggle('on', s.getBoundingClientRect().top < line); });
  });
}

/* ======================================================
   ELEMENTI CHE COMPAIONO (rv, rv-pop, rv-tilt): salgono sfocati e si mettono a fuoco,
   uno dopo l'altro. Finito il movimento le classi si tolgono, così restano liberi
   gli effetti al passaggio del mouse.
   ====================================================== */
function reveal() {
  var els = all('.rv');
  if (!els.length) return;
  var done = function (e) { e.classList.remove('rv', 'rv-pop', 'rv-tilt', 'in'); e.style.removeProperty('--rv-d'); };
  if (reduce || !('IntersectionObserver' in window)) { els.forEach(done); return; }
  var io = new IntersectionObserver(function (es) {
    var k = 0;
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      var d = Math.min(k++, 7) * 90;
      e.target.style.setProperty('--rv-d', d + 'ms');
      e.target.classList.add('in');
      setTimeout(function () { done(e.target); }, d + 1300);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: .1 });
  els.forEach(function (e) { io.observe(e); });
}

/* ======================================================
   CAROSELLO: frecce tonde, pallini, schede ai lati attenuate
   ====================================================== */
function carousels() {
  all('[data-car]').forEach(function (c) {
    var track = c.querySelector('.car-track'), items = [].slice.call(track.children);
    var prev = c.querySelector('.car-prev'), next = c.querySelector('.car-next'), dotsBox = c.querySelector('.car-dots');
    var step = function () { return items[1] ? items[1].offsetLeft - items[0].offsetLeft : track.clientWidth; };
    var go = function (i) { track.scrollTo({ left: items[Math.max(0, Math.min(items.length - 1, i))].offsetLeft - items[0].offsetLeft, behavior: reduce ? 'auto' : 'smooth' }); };
    var dots = items.map(function (it, i) {
      var d = document.createElement('button');
      d.type = 'button'; d.setAttribute('aria-label', 'Vai al disegno ' + (i + 1));
      d.addEventListener('click', function () { go(i); });
      dotsBox.appendChild(d); return d;
    });
    var page = function () { var pad = parseFloat(getComputedStyle(track).paddingLeft) || 0; return Math.max(1, Math.floor((track.clientWidth - pad * 2 + 20) / step())); };
    var cur = function () { return Math.round(track.scrollLeft / step()); };
    prev.addEventListener('click', function () { go(cur() - page()); });
    next.addEventListener('click', function () { go(cur() + page()); });
    function update() {
      var i = Math.min(items.length - 1, cur()), max = track.scrollWidth - track.clientWidth;
      dots.forEach(function (d, k) { d.setAttribute('aria-current', String(k === i)); });
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft > max - 4;
    }
    var t = false;
    track.addEventListener('scroll', function () { if (!t) { t = true; requestAnimationFrame(function () { t = false; update(); }); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('vis', e.intersectionRatio > .6); }); }, { root: track, threshold: [0, .6, 1] });
      items.forEach(function (it) { io.observe(it); });
    } else items.forEach(function (it) { it.classList.add('vis'); });
  });
}

/* ======================================================
   PORTFOLIO: filtro a pillola con indicatore che scivola, foto che si riordinano
   in movimento, foto a schermo intero che si ingrandisce dalla miniatura
   ====================================================== */
function portfolio() {
  var bar = document.querySelector('.filters'), works = all('.work');
  if (bar) {
    var btns = all('button', bar), thumb = document.createElement('span'), tok = 0;
    thumb.className = 'seg-thumb'; bar.insertBefore(thumb, bar.firstChild); bar.classList.add('has-thumb');
    // su telefono la sfumatura a destra sparisce quando il filtro è scorso fino in fondo
    var atEnd = function () { bar.classList.toggle('at-end', bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 4); };
    bar.addEventListener('scroll', atEnd, { passive: true }); window.addEventListener('resize', atEnd); atEnd();
    var moveThumb = function (bt, instant) {
      if (instant) thumb.style.transition = 'none';
      thumb.style.width = bt.offsetWidth + 'px';
      thumb.style.transform = 'translateX(' + (bt.offsetLeft - 4) + 'px)';
      if (instant) { void thumb.offsetWidth; thumb.style.transition = ''; }
    };
    var active = function () { return bar.querySelector('[aria-pressed="true"]') || btns[0]; };
    moveThumb(active(), true);
    window.addEventListener('resize', function () { moveThumb(active(), true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moveThumb(active(), true); });

    var apply = function (f, animate) {
      var my = ++tok;
      var match = function (w) { return f === 'tutti' || w.getAttribute('data-cat') === f; };
      var out = works.filter(function (w) { return !w.hidden && !match(w); });
      var inn = works.filter(function (w) { return w.hidden && match(w); });
      var keep = works.filter(function (w) { return !w.hidden && match(w); });
      if (!animate || !canAnimate) { works.forEach(function (w) { w.hidden = !match(w); }); return; }
      Promise.all(out.map(function (w) {
        return w.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.92)' }], { duration: 220, easing: 'ease-in' }).finished;
      })).then(function () {
        if (my !== tok) return;
        var first = keep.map(function (w) { return w.getBoundingClientRect(); });
        out.forEach(function (w) { w.hidden = true; });
        inn.forEach(function (w) { w.hidden = false; });
        keep.forEach(function (w, i) {
          var a = first[i], b2 = w.getBoundingClientRect(), dx = a.left - b2.left, dy = a.top - b2.top;
          if (dx || dy) w.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 700, easing: EASE });
        });
        inn.forEach(function (w, i) {
          w.animate([{ opacity: 0, transform: 'translateY(30px) scale(.94)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
            { duration: 800, delay: 80 + i * 60, easing: EASE, fill: 'backwards' });
        });
      });
    };
    bar.addEventListener('click', function (e) {
      var bt = e.target.closest('button'); if (!bt || bt.getAttribute('aria-pressed') === 'true') return;
      btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === bt)); });
      moveThumb(bt);
      bt.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
      apply(bt.getAttribute('data-f'), true);
    });
    /* filtro già scelto dall'indirizzo, es. portfolio.html#dotwork */
    var pre = location.hash && bar.querySelector('[data-f="' + location.hash.slice(1) + '"]');
    if (pre) { btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === pre)); }); moveThumb(pre, true); apply(pre.getAttribute('data-f'), false); }
  }

  works.forEach(function (w) { var bt = w.querySelector('button'); if (bt) bt.addEventListener('click', function () { openLb(w); }); });

  function openLb(w) {
    var list = works.filter(function (x) { return !x.hidden; }), i = list.indexOf(w), last = document.activeElement;
    var lb = document.createElement('div');
    lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Foto a schermo intero');
    lb.innerHTML = '<figure><img alt=""><figcaption><span></span><small></small></figcaption></figure><button class="lb-x" type="button" aria-label="Chiudi">×</button><button class="lb-p" type="button" aria-label="Foto precedente">‹</button><button class="lb-n" type="button" aria-label="Foto successiva">›</button>';
    var im = lb.querySelector('img'), cap = lb.querySelector('figcaption span'), sub = lb.querySelector('figcaption small');
    function fill(n) {
      i = (n + list.length) % list.length;
      var src = list[i].querySelector('img'), fc = list[i].querySelector('figcaption');
      im.src = src.getAttribute('src'); im.alt = src.alt;
      cap.textContent = fc.querySelector('b').textContent; sub.textContent = fc.querySelector('span').textContent;
    }
    /* la foto parte dalla posizione della miniatura e si ingrandisce al centro */
    function zoomFrom(el, reverse) {
      if (!canAnimate) return null;
      var a = el.querySelector('img').getBoundingClientRect(), z = im.getBoundingClientRect();
      if (!z.width || !a.width) return null;
      var from = 'translate(' + (a.left + a.width / 2 - z.left - z.width / 2) + 'px,' + (a.top + a.height / 2 - z.top - z.height / 2) + 'px) scale(' + (a.width / z.width) + ')';
      var k = [{ transform: from, borderRadius: '18px' }, { transform: 'none' }];
      return im.animate(reverse ? k.reverse() : k, { duration: reverse ? 450 : 650, easing: EASE, fill: 'forwards' });
    }
    function show(n, dir) {
      fill(n);
      if (canAnimate) im.animate([{ opacity: 0, transform: 'translateX(' + (dir * 40) + 'px)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 550, easing: EASE });
    }
    function key(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(i - 1, -1);
      else if (e.key === 'ArrowRight') show(i + 1, 1);
      else if (e.key === 'Tab') {
        var f = all('button', lb), a = f.indexOf(document.activeElement);
        e.preventDefault(); f[(a + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    }
    function close() {
      document.removeEventListener('keydown', key);
      var end = function () { lb.remove(); document.body.style.overflow = ''; if (last && last.focus) last.focus(); };
      var anim = zoomFrom(list[i], true);
      lb.classList.add('out');
      if (anim) anim.finished.then(end, end); else setTimeout(end, 300);
    }
    lb.querySelector('.lb-x').addEventListener('click', close);
    lb.querySelector('.lb-p').addEventListener('click', function () { show(i - 1, -1); });
    lb.querySelector('.lb-n').addEventListener('click', function () { show(i + 1, 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.tagName === 'FIGURE') close(); });
    document.addEventListener('keydown', key);
    fill(i);
    document.body.appendChild(lb); document.body.style.overflow = 'hidden';
    lb.querySelector('.lb-x').focus();
    var go = function () { zoomFrom(w, false); };
    if (im.complete && im.naturalWidth) go(); else im.addEventListener('load', go, { once: true });
  }
}

/* ======================================================
   FAQ: risposte che si aprono e si chiudono morbide
   ====================================================== */
function faq() {
  all('.faq details').forEach(function (d) {
    var s = d.querySelector('summary'), c = d.querySelector('.ans');
    if (!s || !c || !canAnimate) return;
    var anim = null;
    s.addEventListener('click', function (e) {
      e.preventDefault();
      if (anim) anim.cancel();
      if (d.open) {
        anim = c.animate([{ height: c.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 380, easing: EASE });
        anim.onfinish = function () { d.open = false; anim = null; };
      } else {
        d.open = true;
        anim = c.animate([{ height: '0px', opacity: 0, transform: 'translateY(-8px)' }, { height: c.offsetHeight + 'px', opacity: 1, transform: 'none' }], { duration: 520, easing: EASE });
        anim.onfinish = function () { anim = null; };
      }
    });
  });
}

/* ======================================================
   MODULO DI PRENOTAZIONE
   Invio con Web3Forms senza lasciare la pagina. Finché nel modulo c'è la chiave
   provvisoria (INSERIRE-CHIAVE-WEB3FORMS) l'invio è solo simulato, per le prove.
   ====================================================== */
function thanks(title, text) {
  var last = document.activeElement, m = document.createElement('div');
  m.className = 'thanks'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'thanks-t');
  m.innerHTML = '<div class="thanks-box"><h2 id="thanks-t"></h2><p></p><button type="button" class="btn">Chiudi</button></div>';
  m.querySelector('h2').textContent = title; m.querySelector('p').textContent = text;
  document.body.appendChild(m); document.body.style.overflow = 'hidden';
  var bt = m.querySelector('button'); bt.focus();
  function key(e) { if (e.key === 'Escape') close(); else if (e.key === 'Tab') { e.preventDefault(); bt.focus(); } }
  function close() { document.removeEventListener('keydown', key); m.remove(); document.body.style.overflow = ''; if (last && last.focus) last.focus(); }
  bt.addEventListener('click', close); m.addEventListener('click', function (e) { if (e.target === m) close(); });
  document.addEventListener('keydown', key);
}

function bookingForm() {
  var f = document.getElementById('book-form'); if (!f) return;
  var sb = f.querySelector('button[type=submit]'), sbText = sb.textContent;
  var msg = document.createElement('p'); msg.className = 'form-msg'; msg.setAttribute('role', 'status'); msg.hidden = true; f.appendChild(msg);
  var done = function () {
    f.reset(); sb.disabled = false; sb.textContent = sbText; msg.hidden = true;
    thanks('Richiesta inviata', 'Grazie! Abbiamo ricevuto il tuo messaggio e ti risponderemo il prima possibile.');
  };
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    sb.disabled = true; sb.textContent = 'Invio in corso…'; msg.hidden = true;
    var key = f.querySelector('[name=access_key]');
    if (!key || /INSERIRE/.test(key.value)) { setTimeout(done, 700); return; }
    fetch(f.action, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(f) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok || d.success === false) throw new Error('send'); }); })
      .then(done)
      .catch(function () {
        msg.textContent = 'Non è stato possibile inviare la richiesta. Riprova tra poco oppure chiamaci al 339 260 5135.';
        msg.hidden = false; sb.disabled = false; sb.textContent = sbText;
      });
  });
}

heroOut();
words();
clipZoom();
hscroll();
stack();
ctaCircle();
timeline();
reveal();
carousels();
portfolio();
faq();
bookingForm();
runScroll();
var y = document.getElementById('y'); if (y) y.textContent = new Date().getFullYear();
})();
