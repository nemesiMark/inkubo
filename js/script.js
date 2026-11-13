/* INKUBO Tattoo Studio — script del sito */
(function () {
'use strict';
var R = document.documentElement;
var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
var canDraw = !!(window.requestAnimationFrame && document.createElement('canvas').getContext);
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

/* Prima schermata: scorrendo il testo sale e sfuma, il disegno scende e rimpicciolisce */
function heroOut() {
  var hero = document.querySelector('.hero');
  if (!hero || reduce) return;
  onScrollFns.push(function () {
    if (!hero.classList.contains('px-done')) return;
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
   PIXEL: strumenti per l'apertura della home
   ====================================================== */
function cellOf(el) { var v = parseFloat(getComputedStyle(el).getPropertyValue('--cell')); return v > 0 ? v : 8; }
function canvas(w, hh) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(hh)); return c; }
function loaded(img) {
  return new Promise(function (ok) {
    if (img.complete && img.naturalWidth) return ok(true);
    if (img.loading === 'lazy') img.loading = 'eager';
    img.addEventListener('load', function () { ok(true); }, { once: true });
    img.addEventListener('error', function () { ok(false); }, { once: true });
  });
}

/* Mosaico: il disegno viene ridotto a metà, a un quarto… (ogni quadretto è la media dei pixel
   che copre) e poi ingrandito senza sfumature. */
function Mosaic(img, area, dest, maxBlock) {
  this.area = area;
  this.levels = {};
  var base = canvas(area.w, area.h), g = base.getContext('2d');
  g.imageSmoothingEnabled = true;
  try { g.drawImage(img, dest.x - area.x, dest.y - area.y, dest.w, dest.h); } catch (e) {}
  var prev = base, bl = 1;
  this.levels[1] = base;
  while (bl < maxBlock) {
    bl *= 2;
    var c = canvas(prev.width / 2, prev.height / 2), cg = c.getContext('2d');
    cg.imageSmoothingEnabled = true;
    cg.imageSmoothingQuality = 'high';
    cg.drawImage(prev, 0, 0, c.width, c.height);
    this.levels[bl] = prev = c;
  }
}
Mosaic.prototype.draw = function (ctx, block, k) {
  var c = this.levels[block] || this.levels[1], a = this.area;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, 0, 0, c.width, c.height, Math.round(a.x * k), Math.round(a.y * k), Math.round(c.width * block * k), Math.round(c.height * block * k));
};
function blocksFor(cell) { var out = [], v = cell * 2; while (v >= 2) { out.push(v); v /= 2; } return out; }

/* ======================================================
   HOME: LA PRIMA SCHERMATA SI COMPONE A PIXEL
   Un velo a celle copre la schermata; le celle si aprono una alla volta: prima il
   fondo a onda dal disegno, poi ogni elemento da sinistra a destra all'ora scritta in
   data-px (ms) per data-px-d ms; le celle appena aperte lampeggiano in nero o rosso.
   Il disegno compare a quadrettoni e diventa nitido.
   ====================================================== */
function heroIntro() {
  var hero = document.querySelector('.hero[data-pixel]');
  var unpre = function () { R.classList.remove('px-pre'); if (hero) hero.classList.add('px-done'); };
  if (!hero || reduce || !canDraw) return unpre();
  var art = hero.querySelector('.hero-art img');
  var waits = [];
  /* i caratteri vanno chiesti esplicitamente: fonts.ready da solo può risolversi prima che inizino a caricarsi */
  if (document.fonts && document.fonts.load) {
    waits.push(Promise.all(['800 1em "Inter Tight"', '400 1em Inter', '500 1em Inter'].map(function (f) { return document.fonts.load(f).catch(function () {}); }))
      .then(function () { return document.fonts.ready; }));
  }
  if (art) waits.push(loaded(art));
  var started = false;
  var start = function () { if (started) return; started = true; try { runHero(hero, art); } catch (e) { unpre(); } };
  Promise.all(waits).then(start, start);
  setTimeout(start, 1200);
}

function runHero(hero, art) {
  var cell = cellOf(hero), k = Math.min(window.devicePixelRatio || 1, 2);
  var W = hero.clientWidth, H = hero.clientHeight;
  var cv = document.createElement('canvas');
  cv.className = 'px-cover'; cv.setAttribute('aria-hidden', 'true');
  cv.width = Math.round(W * k); cv.height = Math.round(H * k);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  hero.appendChild(cv);
  hero.classList.add('px-run');
  var ctx = cv.getContext('2d');
  var hs = getComputedStyle(hero), bg = hs.backgroundColor;
  var ink = hs.getPropertyValue('--ink').trim() || '#1d1d1f', red = hs.getPropertyValue('--red').trim() || '#c4372a';
  var cols = Math.ceil(W / cell), rows = Math.ceil(H / cell), N = cols * rows;
  var T = new Float32Array(N), kind = new Uint8Array(N), tone = new Uint8Array(N);
  var hr = hero.getBoundingClientRect();
  var rel = function (el) { var r = el.getBoundingClientRect(); return { x: r.left - hr.left, y: r.top - hr.top, w: r.width, h: r.height }; };
  var rnd = Math.random;

  /* fondo: si apre a onda partendo dal disegno */
  var ac = art ? rel(art) : { x: W * .7, y: H * .4, w: 0, h: 0 };
  var ox = ac.x + ac.w / 2, oy = ac.y + ac.h / 2;
  var md = Math.max(Math.hypot(ox, oy), Math.hypot(W - ox, oy), Math.hypot(ox, H - oy), Math.hypot(W - ox, H - oy));
  for (var i = 0; i < N; i++) {
    var cx = (i % cols + .5) * cell, cy = ((i / cols | 0) + .5) * cell;
    T[i] = 70 + Math.hypot(cx - ox, cy - oy) / md * 1000 + rnd() * 330;
    tone[i] = rnd() < .22 ? 2 : 1;
  }

  /* elementi di testo e pulsanti */
  var end = 0;
  all('[data-px]', hero).forEach(function (el) {
    if (el === art) return;
    var t0 = +el.getAttribute('data-px') || 0, d = +el.getAttribute('data-px-d') || 700, r = rel(el);
    var pad = 6, x0 = Math.max(0, Math.floor((r.x - pad) / cell)), x1 = Math.min(cols - 1, Math.floor((r.x + r.w + pad) / cell));
    var y0 = Math.max(0, Math.floor((r.y - pad) / cell)), y1 = Math.min(rows - 1, Math.floor((r.y + r.h + pad) / cell));
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var j = y * cols + x, p = (x - x0) / Math.max(1, x1 - x0);
      T[j] = t0 + p * d * .6 + rnd() * d * .4; kind[j] = 1;
    }
    end = Math.max(end, t0 + d);
  });

  /* disegno */
  var mos = null, aStart = 0, aDur = 0, blocks = blocksFor(cell), area = null, artCells = [];
  if (art) {
    aStart = +art.getAttribute('data-px') || 130; aDur = +art.getAttribute('data-px-d') || 2100;
    var ax0 = Math.max(0, Math.floor(ac.x / cell)), ay0 = Math.max(0, Math.floor(ac.y / cell));
    var ax1 = Math.min(cols, Math.ceil((ac.x + ac.w) / cell)), ay1 = Math.min(rows, Math.ceil((ac.y + ac.h) / cell));
    if ((ax1 - ax0) % 2) { if (ax1 < cols) ax1++; else ax0--; }
    if ((ay1 - ay0) % 2) { if (ay1 < rows) ay1++; else ay0--; }
    area = { x: ax0 * cell, y: ay0 * cell, w: (ax1 - ax0) * cell, h: (ay1 - ay0) * cell };
    mos = new Mosaic(art, area, { x: ac.x, y: ac.y, w: ac.w, h: ac.h }, blocks[0]);
    for (var yy = ay0; yy < ay1; yy++) for (var xx = ax0; xx < ax1; xx++) {
      var q = yy * cols + xx;
      kind[q] = 2; T[q] = aStart + rnd() * aDur * .4; artCells.push(q);
    }
    end = Math.max(end, aStart + aDur);
  }
  for (i = 0; i < N; i++) if (kind[i] === 0) end = Math.max(end, T[i]);
  end += 150;

  var FL = 150, t0 = null, dead = false, cd = cell * k;
  var rx = function (c) { return Math.round((c % cols) * cd); }, ry = function (c) { return Math.round((c / cols | 0) * cd); };
  var cw = function (c) { return Math.round((c % cols + 1) * cd) - rx(c); }, ch = function (c) { return Math.round(((c / cols | 0) + 1) * cd) - ry(c); };

  function finish() {
    if (dead) return; dead = true;
    window.removeEventListener('resize', onResize);
    hero.classList.remove('px-run');
    hero.classList.add('px-done');
    cv.remove();
    R.classList.remove('px-pre');
    requestRun();
  }
  var w0 = window.innerWidth;
  function onResize() { if (Math.abs(window.innerWidth - w0) > 2) finish(); }
  window.addEventListener('resize', onResize);
  /* se la schermata cambia misura mentre si compone, si mostra tutto subito */
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function () { if (Math.abs(hero.clientHeight - H) > 2 || Math.abs(hero.clientWidth - W) > 2) { ro.disconnect(); finish(); } });
    ro.observe(hero);
  }

  function frame(now) {
    if (dead) return;
    if (t0 === null) t0 = now;
    var t = now - t0, j, fl1 = [], fl2 = [], fl0 = [];
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.globalAlpha = 1; ctx.fillStyle = bg; ctx.beginPath();
    for (j = 0; j < N; j++) {
      var tj = T[j];
      if (tj > t) ctx.rect(rx(j), ry(j), cw(j), ch(j));
      else if (t - tj < FL && kind[j] !== 2) (kind[j] === 0 ? fl0 : tone[j] === 2 ? fl2 : fl1).push(j);
    }
    ctx.fill();
    if (mos && t >= aStart && t < aStart + aDur) {
      var p = (t - aStart) / aDur, bl;
      if (p < .45) bl = blocks[0];
      else bl = blocks[Math.min(blocks.length - 1, 1 + Math.floor((p - .45) / .55 * (blocks.length - 1)))];
      ctx.save();
      if (p < .42) {
        ctx.beginPath();
        for (var n = 0; n < artCells.length; n++) { j = artCells[n]; if (T[j] <= t) ctx.rect(rx(j), ry(j), cw(j), ch(j)); }
        ctx.clip();
      }
      mos.draw(ctx, bl, k);
      ctx.restore();
    } else if (mos && t >= aStart + aDur && hero.classList.contains('px-run')) {
      hero.classList.remove('px-run');
    }
    var flash = function (list, color, a) {
      for (var m = 0; m < list.length; m++) {
        j = list[m];
        ctx.globalAlpha = a * (1 - (t - T[j]) / FL);
        ctx.fillStyle = color;
        ctx.fillRect(rx(j), ry(j), cw(j), ch(j));
      }
    };
    flash(fl0, ink, .14); flash(fl1, ink, .85); flash(fl2, red, .95);
    ctx.globalAlpha = 1;
    if (R.classList.contains('px-pre')) R.classList.remove('px-pre');
    if (t >= end) return finish();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
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
    thanks('Richiesta inviata', 'Grazie! Leggeremo la tua idea e ti risponderemo entro due giorni lavorativi per fissare la consulenza.');
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
        msg.textContent = 'Non è stato possibile inviare la richiesta. Riprova tra poco oppure scrivici su Instagram o WhatsApp.';
        msg.hidden = false; sb.disabled = false; sb.textContent = sbText;
      });
  });
}

heroIntro();
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
