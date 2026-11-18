/* Rain Ink Tattoo — script comune a tutte le pagine
   Navbar 3D, comparsa allo scorrimento, cura del tatuaggio, portfolio (filtri e foto a
   schermo intero), FAQ, invio del modulo dei contatti. */
(function () {
'use strict';
var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
var EASE = 'cubic-bezier(.23, 1, .32, 1)';
var canAnimate = !reduce && !!Element.prototype.animate;
function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function all(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }

/* ======================================================
   NAVBAR 3D: panino su telefono, più bassa scorrendo, si inclina col mouse
   ====================================================== */
function navbar() {
  var nav = document.getElementById('nav3d'); if (!nav) return;
  var slab = nav.querySelector('.slab'), burger = nav.querySelector('.burger');
  function setOpen(o) {
    nav.classList.toggle('open', o);
    burger.setAttribute('aria-expanded', String(o));
    burger.setAttribute('aria-label', o ? 'Chiudi il menu' : 'Apri il menu');
  }
  burger.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
  all('.links a', nav).forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); burger.focus(); } });
  document.addEventListener('click', function (e) { if (!nav.contains(e.target)) setOpen(false); });

  var small = function () { nav.classList.toggle('small', window.scrollY > 40); };
  window.addEventListener('scroll', small, { passive: true }); small();

  if (!fine || reduce) return;
  // al massimo un aggiornamento per fotogramma
  var ev = null;
  slab.addEventListener('mousemove', function (e) { if (!ev) requestAnimationFrame(tilt); ev = e; });
  function tilt() {
    var e = ev; ev = null; if (!e) return;
    var r = slab.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    slab.style.setProperty('--ry', ((x - .5) * 6).toFixed(2) + 'deg');
    slab.style.setProperty('--rx', ((.5 - y) * 14).toFixed(2) + 'deg');
    slab.style.setProperty('--mx', (x * 100) + '%'); slab.style.setProperty('--my', (y * 100) + '%');
    slab.style.setProperty('--glow', 1);
  }
  slab.addEventListener('mouseleave', function () {
    ev = null;
    slab.style.setProperty('--rx', '0deg'); slab.style.setProperty('--ry', '0deg'); slab.style.setProperty('--glow', 0);
  });
}

/* ======================================================
   COMPARSA: gli elementi .rv salgono di poco e si accendono, uno dopo l'altro.
   Finito il movimento la classe si toglie, così restano liberi gli effetti al passaggio.
   ====================================================== */
function reveal() {
  var els = all('.rv'); if (!els.length) return;
  var done = function (e) { e.classList.remove('rv', 'in'); e.style.removeProperty('--rv-d'); };
  if (reduce || !('IntersectionObserver' in window)) { els.forEach(done); return; }
  var io = new IntersectionObserver(function (es) {
    var k = 0;
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      var d = Math.min(k++, 5) * 70;
      e.target.style.setProperty('--rv-d', d + 'ms');
      e.target.classList.add('in');
      setTimeout(function () { done(e.target); }, d + 600);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: .12 });
  els.forEach(function (e) { io.observe(e); });
}

/* ======================================================
   CURA DEL TATUAGGIO: la linea si riempie e i punti si accendono scorrendo
   ====================================================== */
function timeline() {
  var tl = document.querySelector('.timeline'); if (!tl) return;
  var steps = all(':scope > li', tl);
  if (reduce) { steps.forEach(function (s) { s.classList.add('on'); }); return; }
  var t = false;
  function run() {
    t = false;
    var vh = window.innerHeight, r = tl.getBoundingClientRect(), line = vh * .6;
    tl.style.setProperty('--p', clamp((line - r.top) / r.height).toFixed(4));
    steps.forEach(function (s) { s.classList.toggle('on', s.getBoundingClientRect().top < line); });
  }
  window.addEventListener('scroll', function () { if (!t) { t = true; requestAnimationFrame(run); } }, { passive: true });
  window.addEventListener('resize', run);
  run();
}

/* ======================================================
   PORTFOLIO: pulsanti per gruppo (a colori, bianco e nero, video, dallo studio); a schermo intero
   la foto si ingrandisce dalla miniatura, il video parte da solo
   ====================================================== */
function portfolio() {
  var bar = document.querySelector('.filters'), works = all('.work');
  if (bar) {
    var btns = all('button', bar), thumb = document.createElement('span'), tok = 0;
    thumb.className = 'seg-thumb'; bar.insertBefore(thumb, bar.firstChild); bar.classList.add('has-thumb');
    var atEnd = function () { bar.classList.toggle('at-end', bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 4); };
    bar.addEventListener('scroll', atEnd, { passive: true }); window.addEventListener('resize', atEnd); atEnd();
    var moveThumb = function (bt, instant) {
      if (instant) thumb.style.transition = 'none';
      thumb.style.width = bt.offsetWidth + 'px';
      thumb.style.transform = 'translateX(' + bt.offsetLeft + 'px)';
      if (instant) { void thumb.offsetWidth; thumb.style.transition = ''; }
    };
    var active = function () { return bar.querySelector('[aria-pressed="true"]') || btns[0]; };
    moveThumb(active(), true);
    window.addEventListener('resize', function () { moveThumb(active(), true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moveThumb(active(), true); });

    var apply = function (f, animate) {
      var my = ++tok;
      var match = function (w) { return w.getAttribute('data-cat') === f; };
      var out = works.filter(function (w) { return !w.hidden && !match(w); });
      var inn = works.filter(function (w) { return w.hidden && match(w); });
      var keep = works.filter(function (w) { return !w.hidden && match(w); });
      if (!animate || !canAnimate) { works.forEach(function (w) { w.hidden = !match(w); }); return; }
      Promise.all(out.map(function (w) {
        return w.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.95)' }], { duration: 160, easing: 'ease-in' }).finished;
      })).then(function () {
        if (my !== tok) return;
        var first = keep.map(function (w) { return w.getBoundingClientRect(); });
        out.forEach(function (w) { w.hidden = true; });
        inn.forEach(function (w) { w.hidden = false; });
        keep.forEach(function (w, i) {
          var a = first[i], b2 = w.getBoundingClientRect(), dx = a.left - b2.left, dy = a.top - b2.top;
          if (dx || dy) w.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 400, easing: EASE });
        });
        inn.forEach(function (w, i) {
          w.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }],
            { duration: 400, delay: Math.min(i, 6) * 40, easing: EASE, fill: 'backwards' });
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
    /* gruppo già scelto dall'indirizzo, es. portfolio.html#bn; senza, il primo (a colori) */
    var pre = location.hash && bar.querySelector('[data-f="' + location.hash.slice(1) + '"]');
    if (pre) { btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === pre)); }); moveThumb(pre, true); }
    apply(active().getAttribute('data-f'), false);
  }

  works.forEach(function (w) { var bt = w.querySelector('button'); if (bt) bt.addEventListener('click', function () { openLb(w); }); });

  function openLb(w) {
    var list = works.filter(function (x) { return !x.hidden; }), i = list.indexOf(w), last = document.activeElement;
    var lb = document.createElement('div');
    lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Foto e video a schermo intero');
    lb.innerHTML = '<figure><img alt=""><video controls playsinline preload="auto" hidden></video><figcaption><span></span><p class="lb-desc"></p><small></small></figcaption></figure><button class="lb-x" type="button" aria-label="Chiudi">✕</button><button class="lb-p" type="button" aria-label="Precedente">←</button><button class="lb-n" type="button" aria-label="Successivo">→</button>';
    var im = lb.querySelector('img'), vd = lb.querySelector('video'), cap = lb.querySelector('figcaption span'), sub = lb.querySelector('figcaption small');
    function media() { return vd.hidden ? im : vd; }
    function fill(n) {
      i = (n + list.length) % list.length;
      var it = list[i], src = it.querySelector('img'), fc = it.querySelector('figcaption'), v = it.getAttribute('data-video');
      vd.pause();
      if (v) {
        im.hidden = true; vd.hidden = false;
        vd.poster = src.getAttribute('src'); vd.src = v; vd.setAttribute('aria-label', fc.querySelector('b').textContent);
        var p = vd.play(); if (p && p.catch) p.catch(function () {});
      } else {
        vd.hidden = true; vd.removeAttribute('src'); vd.load(); im.hidden = false;
        im.src = src.getAttribute('src'); im.alt = src.alt;
      }
      cap.textContent = fc.querySelector('b').textContent;
      var s2 = fc.querySelector('span'); sub.textContent = s2 ? s2.textContent : '';
      // descrizione provvisoria, uguale per tutti finché non se ne scrive una propria in data-desc
      lb.querySelector('.lb-desc').textContent = it.getAttribute('data-desc') || (v ? "Una seduta in studio vista da vicino, dalla prima linea all'ultima sfumatura. Attiva l'audio per viverla come se fossi lì." : "Un lavoro nato in studio da un'idea del cliente e disegnato su misura. Ogni linea e ogni sfumatura sono pensate per durare nel tempo.");
    }
    function zoomFrom(el, reverse) {
      if (!canAnimate) return null;
      var m = media(), a = el.querySelector('img').getBoundingClientRect(), z = m.getBoundingClientRect();
      if (!z.width || !a.width) return null;
      var from = 'translate(' + (a.left + a.width / 2 - z.left - z.width / 2) + 'px,' + (a.top + a.height / 2 - z.top - z.height / 2) + 'px) scale(' + (a.width / z.width) + ')';
      var k = [{ transform: from }, { transform: 'none' }];
      return m.animate(reverse ? k.reverse() : k, { duration: reverse ? 250 : 380, easing: EASE, fill: 'forwards' });
    }
    function show(n, dir) {
      fill(n);
      if (canAnimate) media().animate([{ opacity: 0, transform: 'translateX(' + (dir * 30) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: EASE });
    }
    function key(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(i - 1, -1);
      else if (e.key === 'ArrowRight') show(i + 1, 1);
      else if (e.key === 'Tab') {
        var f = all('button, video:not([hidden])', lb), a = f.indexOf(document.activeElement);
        e.preventDefault(); f[(a + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    }
    function close() {
      document.removeEventListener('keydown', key);
      vd.pause();
      var end = function () { lb.remove(); document.body.style.overflow = ''; if (last && last.focus) last.focus(); };
      var anim = vd.hidden ? zoomFrom(list[i], true) : null;
      lb.classList.add('out');
      if (anim) anim.finished.then(end, end); else setTimeout(end, 250);
    }
    lb.querySelector('.lb-x').addEventListener('click', close);
    lb.querySelector('.lb-p').addEventListener('click', function () { show(i - 1, -1); });
    lb.querySelector('.lb-n').addEventListener('click', function () { show(i + 1, 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.tagName === 'FIGURE') close(); });
    var sx = 0;
    lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) { var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); });
    document.addEventListener('keydown', key);
    fill(i);
    document.body.appendChild(lb); document.body.style.overflow = 'hidden';
    lb.querySelector('.lb-x').focus();
    var go = function () { zoomFrom(w, false); };
    if (!vd.hidden) return;
    if (im.complete && im.naturalWidth) go(); else im.addEventListener('load', go, { once: true });
  }
}


/* ======================================================
   FAQ: risposte che si aprono e si chiudono morbide
   ====================================================== */
/* VIDEO DELLA HOME: ne suona uno alla volta */
function clips() {
  var vs = all('.clips video');
  vs.forEach(function (v) {
    v.addEventListener('play', function () { vs.forEach(function (o) { if (o !== v) o.pause(); }); });
  });
}

function faq() {
  all('.faq details').forEach(function (d) {
    var s = d.querySelector('summary'), c = d.querySelector('.ans');
    if (!s || !c || !canAnimate) return;
    var anim = null;
    s.addEventListener('click', function (e) {
      e.preventDefault();
      if (anim) anim.cancel();
      if (d.open) {
        anim = c.animate([{ height: c.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 220, easing: EASE });
        anim.onfinish = function () { d.open = false; anim = null; };
      } else {
        d.open = true;
        anim = c.animate([{ height: '0px', opacity: 0 }, { height: c.offsetHeight + 'px', opacity: 1 }], { duration: 300, easing: EASE });
        anim.onfinish = function () { anim = null; };
      }
    });
  });
}

/* ======================================================
   MODULO DEI CONTATTI
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
    thanks('Richiesta inviata', 'Grazie! Abbiamo ricevuto il tuo messaggio: ti rispondiamo entro due giorni lavorativi.');
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

navbar();
reveal();
timeline();
portfolio();
clips();
faq();
bookingForm();
var y = document.getElementById('y'); if (y) y.textContent = new Date().getFullYear();
proteggi();

/* ======================================================
   FOTO E VIDEO PROTETTI: si guardano ma non si scaricano facilmente
   (niente menu del tasto destro, niente trascinamento, niente «Scarica» nei video,
   niente salvataggio con la pressione lunga sul telefono). Nessun sito può impedirlo
   del tutto: è un deterrente.
   ====================================================== */
function proteggi() {
  function media(el) { return el && el.closest && el.closest('img, video, picture, canvas, .face, .clip, .work, .lb, .lb3d, .sc-col, .hero'); }
  document.addEventListener('contextmenu', function (e) { if (media(e.target)) e.preventDefault(); });
  document.addEventListener('dragstart', function (e) { if (media(e.target)) e.preventDefault(); });
  function blocca(v) {
    if (v.tagName !== 'VIDEO' || v.dataset.protetto) return;
    v.dataset.protetto = '1';
    v.setAttribute('controlsList', 'nodownload noremoteplayback noplaybackrate');
    v.disablePictureInPicture = true; v.setAttribute('disablepictureinpicture', '');
    v.disableRemotePlayback = true; v.setAttribute('disableremoteplayback', '');
  }
  all('video').forEach(blocca);
  // anche i video creati dopo (schermo intero, nastro): «loadstart» arriva prima che si veda il lettore
  document.addEventListener('loadstart', function (e) { blocca(e.target); }, true);
  document.addEventListener('play', function (e) { blocca(e.target); }, true);
  if ('MutationObserver' in window) new MutationObserver(function (ms) {
    ms.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) { if (n.nodeType !== 1) return; if (n.tagName === 'VIDEO') blocca(n); else all('video', n).forEach(blocca); }); });
  }).observe(document.body, { childList: true, subtree: true });
}
})();
