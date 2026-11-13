/* Rain Ink Tattoo — prima schermata della home.
   Fondo bianco; inchiostro nero che scende e si gonfia come nell'acqua (simulazione di
   fluidi in tempo reale, WebGL). Dove l'inchiostro passa compare, grande al centro, il
   nome dello studio; dopo qualche secondo il nome è comunque tutto visibile.
   Passando col mouse (o col dito) si smuove l'inchiostro.
   I contorni del nome e del logo si accendono in rosso come un'insegna al neon, che respira
   e ogni tanto sfarfalla. Quando il mouse resta fermo entrano da soli, ogni tanto, sbuffi
   d'inchiostro, soprattutto dai lati.
   Senza WebGL o con «riduci movimento» si vede subito il logo fermo. */
(function () {
'use strict';
var hero = document.querySelector('.hero-smoke');
if (!hero) return;
var cv = hero.querySelector('canvas.smoke');
var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
var dead = false;
function fallback() { dead = true; if (cv) cv.remove(); hero.classList.remove('smoke-on'); hero.classList.add('smoke-off'); }
if (reduce || !cv) return fallback();

/* ---------- regolazioni ---------- */
var SIM_RES = 128;            // griglia del movimento dell'acqua
var DYE_RES = innerWidth < 700 ? 512 : 1024;   // definizione dell'inchiostro
var CURL = 28;                // volute: più alto = più riccioli
var PRESSURE = .8, ITER = 20;
var VEL_FADE = .25;           // quanto in fretta l'acqua si calma
var INK_FADE = .5;            // quanto in fretta l'inchiostro si schiarisce all'inizio
var INK_FADE_END = 1.1;       // ...e dopo che il nome è comparso (il fondo torna bianco)
var NEON = 1;                 // forza del neon rosso sui contorni (0 = spento)
var NEON_ON = .25;             // secondi: quando si accende il neon (subito, prima dell'inchiostro)
var NEON_W = 2.2;             // spessore del filo del neon, in pixel
var IDLE = 1.8;               // secondi di mouse fermo dopo cui partono gli sbuffi automatici
var PUFF_GAP = [0.45, 1.2];    // pausa tra uno sbuffo e l'altro (secondi, minimo e massimo)
var LOGO_Y = .44;             // altezza del centro del nome (0 = in alto, 1 = in basso)
var START_FILL = 3.6, END_FILL = 5;  // secondi: da qui il nome finisce di comparire tutto

var opts = { alpha: false, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
var gl = cv.getContext('webgl2', opts), gl2 = !!gl;
if (!gl) gl = cv.getContext('webgl', opts) || cv.getContext('experimental-webgl', opts);
if (!gl) return fallback();

var texType, linear;
if (gl2) { gl.getExtension('EXT_color_buffer_float'); texType = gl.HALF_FLOAT; linear = true; }
else {
  var hf = gl.getExtension('OES_texture_half_float');
  linear = !!gl.getExtension('OES_texture_half_float_linear');
  texType = hf && hf.HALF_FLOAT_OES;
}
if (!texType) return fallback();
var IFMT = gl2 ? gl.RGBA16F : gl.RGBA, FILTER = linear ? gl.LINEAR : gl.NEAREST;

/* ---------- programmi ---------- */
var VS = 'precision highp float;attribute vec2 aPosition;varying vec2 vUv,vL,vR,vT,vB;uniform vec2 texelSize;' +
  'void main(){vUv=aPosition*.5+.5;vL=vUv-vec2(texelSize.x,0.);vR=vUv+vec2(texelSize.x,0.);vT=vUv+vec2(0.,texelSize.y);vB=vUv-vec2(0.,texelSize.y);gl_Position=vec4(aPosition,0.,1.);}';
var H = 'precision mediump float;precision mediump sampler2D;varying vec2 vUv,vL,vR,vT,vB;';
var FS = {
  clear: H + 'uniform sampler2D uTexture;uniform float value;void main(){gl_FragColor=value*texture2D(uTexture,vUv);}',
  splat: H + 'uniform sampler2D uTarget;uniform float aspectRatio,radius;uniform vec3 color;uniform vec2 point;' +
    'void main(){vec2 p=vUv-point;p.x*=aspectRatio;vec3 s=exp(-dot(p,p)/radius)*color;gl_FragColor=vec4(texture2D(uTarget,vUv).xyz+s,1.);}',
  advect: H + 'uniform sampler2D uVelocity,uSource;uniform highp vec2 texelSize;uniform float dt,dissipation;' +
    'void main(){vec2 c=vUv-dt*texture2D(uVelocity,vUv).xy*texelSize;gl_FragColor=texture2D(uSource,c)/(1.+dissipation*dt);}',
  divergence: H + 'uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).x,R=texture2D(uVelocity,vR).x,T=texture2D(uVelocity,vT).y,B=texture2D(uVelocity,vB).y;' +
    'vec2 C=texture2D(uVelocity,vUv).xy;if(vL.x<0.)L=-C.x;if(vR.x>1.)R=-C.x;if(vT.y>1.)T=-C.y;if(vB.y<0.)B=-C.y;gl_FragColor=vec4(.5*(R-L+T-B),0.,0.,1.);}',
  curl: H + 'uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).y,R=texture2D(uVelocity,vR).y,T=texture2D(uVelocity,vT).x,B=texture2D(uVelocity,vB).x;gl_FragColor=vec4(.5*(R-L-T+B),0.,0.,1.);}',
  vorticity: H + 'uniform sampler2D uVelocity,uCurl;uniform float curl,dt;void main(){float L=texture2D(uCurl,vL).x,R=texture2D(uCurl,vR).x,T=texture2D(uCurl,vT).x,B=texture2D(uCurl,vB).x,C=texture2D(uCurl,vUv).x;' +
    'vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+.0001;f*=curl*C;f.y*=-1.;vec2 v=texture2D(uVelocity,vUv).xy+f*dt;gl_FragColor=vec4(clamp(v,-1000.,1000.),0.,1.);}',
  pressure: H + 'uniform sampler2D uPressure,uDivergence;void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x;' +
    'gl_FragColor=vec4((L+R+B+T-texture2D(uDivergence,vUv).x)*.25,0.,0.,1.);}',
  gradient: H + 'uniform sampler2D uPressure,uVelocity;void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x;' +
    'vec2 v=texture2D(uVelocity,vUv).xy-vec2(R-L,T-B);gl_FragColor=vec4(v,0.,1.);}',
  /* il nome si «sviluppa» dove l'inchiostro è passato e non si cancella più */
  reveal: H + 'uniform sampler2D uPrev,uDye;uniform float fill;void main(){float d=texture2D(uDye,vUv).r;' +
    'float r=max(texture2D(uPrev,vUv).r,smoothstep(.06,.4,d));gl_FragColor=vec4(max(r,fill),0.,0.,1.);}',
  /* neon: uRing = filo sottile intorno a ogni lettera e al logo, uGlow = alone sfumato */
  display: H + 'uniform sampler2D uDye,uReveal,uLogo,uRing,uGlow;uniform float neon,topFade,logoOn;void main(){float d=texture2D(uDye,vUv).r;float r=texture2D(uReveal,vUv).r;vec4 lg=texture2D(uLogo,vUv);' +
    'vec3 col=mix(vec3(1.),lg.rgb,lg.a*max(r,logoOn));float ink=(1.-exp(-d*2.4))*(1.-smoothstep(1.-topFade*1.8,1.-topFade*.8,vUv.y));' +
    'vec3 inkCol=mix(vec3(.36,.36,.38),vec3(.035,.03,.028),smoothstep(.12,.85,ink));' +
    'vec3 c=mix(col,inkCol,smoothstep(0.,1.,ink));' +
    'float rg=texture2D(uRing,vUv).a,gw=texture2D(uGlow,vUv).a,n=neon;vec3 red=vec3(1.,.12,.07);' +
    'c=mix(c,red,clamp(gw*1.5,0.,1.)*.5*n);c+=red*gw*n*.55*ink;c=mix(c,vec3(1.,.2,.13),clamp(rg*1.15,0.,1.)*n);' +
    'gl_FragColor=vec4(min(c,vec3(1.)),1.);}'
};

function shader(type, src) {
  var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
var P = {};
try {
  var vs = shader(gl.VERTEX_SHADER, VS);
  Object.keys(FS).forEach(function (k) {
    var p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, FS[k]));
    gl.bindAttribLocation(p, 0, 'aPosition'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    P[k] = { p: p, u: u };
  });
} catch (e) { return fallback(); }
function use(k) { gl.useProgram(P[k].p); return P[k].u; }

/* rettangolo che copre lo schermo */
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(0);
function blit(t) {
  if (t) { gl.viewport(0, 0, t.w, t.h); gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); }
  else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

/* ---------- superfici di calcolo ---------- */
function target(w, h) {
  gl.activeTexture(gl.TEXTURE0);
  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, FILTER);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, FILTER);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, IFMT, w, h, 0, gl.RGBA, texType, null);
  var fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo');
  gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  return { fbo: fbo, w: w, h: h, tx: 1 / w, ty: 1 / h, attach: function (id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; } };
}
function pair(w, h) {
  var a = target(w, h), b = target(w, h);
  return { w: w, h: h, tx: 1 / w, ty: 1 / h, read: function () { return a; }, write: function () { return b; }, swap: function () { var t = a; a = b; b = t; } };
}
function res(r) {
  var ar = gl.drawingBufferWidth / gl.drawingBufferHeight; if (ar < 1) ar = 1 / ar;
  var lo = Math.round(r), hi = Math.round(r * ar);
  return gl.drawingBufferWidth > gl.drawingBufferHeight ? { w: hi, h: lo } : { w: lo, h: hi };
}

var vel, dye, rev, divg, curl, pres;
var logoTex = gl.createTexture(), ringTex = gl.createTexture(), glowTex = gl.createTexture();
var logoImg = new Image(), logoReady = false;
/* finché il logo non è pronto le sue texture sono trasparenti (mai nere) */
[logoTex, ringTex, glowTex].forEach(function (t) {
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
});
function upload(tex, c) {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); }
  finally { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); }
}
logoImg.src = hero.getAttribute('data-logo');

function drawLogo() {
  var W = cv.width, Hh = cv.height, c = document.createElement('canvas');
  c.width = W; c.height = Hh;
  var g = c.getContext('2d');
  /* larghezza del nome e altezza del suo centro: devono restare uguali a --lw e --ly in css/style.css */
  var lw = W * (W / Hh < 1 ? .74 : W / Hh < 1.4 ? .6 : .44), lh = lw * logoImg.naturalHeight / logoImg.naturalWidth;
  var lx = (W - lw) / 2, ly = Hh * LOGO_Y - lh / 2;
  g.drawImage(logoImg, lx, ly, lw, lh);
  upload(logoTex, c);

  /* filo del neon: il logo «allargato» in tutte le direzioni, meno il logo stesso */
  var px = W / Math.max(1, cv.clientWidth), k = Math.max(1.5, NEON_W * px), gap = 1.2 * px;
  var ring = document.createElement('canvas'); ring.width = W; ring.height = Hh;
  var rg = ring.getContext('2d');
  for (var a = 0; a < 24; a++) {
    var an = a / 24 * Math.PI * 2;
    rg.drawImage(logoImg, lx + Math.cos(an) * (k + gap), ly + Math.sin(an) * (k + gap), lw, lh);
  }
  rg.globalCompositeOperation = 'destination-out';
  for (a = 0; a < 16; a++) {
    an = a / 16 * Math.PI * 2;
    rg.drawImage(logoImg, lx + Math.cos(an) * gap, ly + Math.sin(an) * gap, lw, lh);
  }
  rg.drawImage(logoImg, lx, ly, lw, lh);
  upload(ringTex, ring);

  /* alone: il filo sfumato (con l'ombra, che funziona in tutti i browser) */
  var glow = document.createElement('canvas'); glow.width = W; glow.height = Hh;
  var gg = glow.getContext('2d');
  gg.shadowColor = '#fff'; gg.shadowOffsetX = W;
  gg.shadowBlur = 16 * px; gg.drawImage(ring, -W, 0);
  gg.shadowBlur = 6 * px; gg.drawImage(ring, -W, 0);
  upload(glowTex, glow);
}
function loadLogo() { try { drawLogo(); logoReady = true; } catch (e) { fallback(); } }

var lastW = 0;
var topFade = 0;   // parte alta (in frazione dell'altezza) dove l'inchiostro sfuma, sotto la barra del menu
function barFade() {
  var bar = document.querySelector('header'), h = bar ? bar.offsetHeight : 90;
  topFade = Math.min(.3, (h + 10) / Math.max(1, cv.clientHeight));
}
function setup() {
  barFade();
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr);
  lastW = cv.clientWidth;
  var s = res(SIM_RES), d = res(DYE_RES);
  vel = pair(s.w, s.h); pres = pair(s.w, s.h); divg = target(s.w, s.h); curl = target(s.w, s.h);
  dye = pair(d.w, d.h); rev = pair(d.w, d.h);
  if (logoReady) drawLogo();
}
try { setup(); } catch (e) { return fallback(); }

/* ---------- versare l'inchiostro ---------- */
function splat(x, y, vx, vy, ink, radius) {
  var u = use('splat');
  gl.uniform2f(u.texelSize, vel.tx, vel.ty);
  gl.uniform1i(u.uTarget, vel.read().attach(0));
  gl.uniform1f(u.aspectRatio, cv.width / cv.height);
  gl.uniform2f(u.point, x, y);
  gl.uniform3f(u.color, vx, vy, 0);
  gl.uniform1f(u.radius, radius);
  blit(vel.write()); vel.swap();
  if (ink > 0) {
    gl.uniform1i(u.uTarget, dye.read().attach(0));
    gl.uniform3f(u.color, ink, 0, 0);
    gl.uniform1f(u.radius, radius * .8);
    blit(dye.write()); dye.swap();
  }
}

/* ---------- un passo della simulazione ---------- */
var fill = 0, inkFade = INK_FADE;
function step(dt) {
  var u;
  gl.disable(gl.BLEND);
  u = use('curl'); gl.uniform2f(u.texelSize, vel.tx, vel.ty); gl.uniform1i(u.uVelocity, vel.read().attach(0)); blit(curl);
  u = use('vorticity'); gl.uniform2f(u.texelSize, vel.tx, vel.ty); gl.uniform1i(u.uVelocity, vel.read().attach(0)); gl.uniform1i(u.uCurl, curl.attach(1));
  gl.uniform1f(u.curl, CURL); gl.uniform1f(u.dt, dt); blit(vel.write()); vel.swap();
  u = use('divergence'); gl.uniform2f(u.texelSize, vel.tx, vel.ty); gl.uniform1i(u.uVelocity, vel.read().attach(0)); blit(divg);
  u = use('clear'); gl.uniform1i(u.uTexture, pres.read().attach(0)); gl.uniform1f(u.value, PRESSURE); blit(pres.write()); pres.swap();
  u = use('pressure'); gl.uniform2f(u.texelSize, vel.tx, vel.ty); gl.uniform1i(u.uDivergence, divg.attach(0));
  for (var i = 0; i < ITER; i++) { gl.uniform1i(u.uPressure, pres.read().attach(1)); blit(pres.write()); pres.swap(); }
  u = use('gradient'); gl.uniform2f(u.texelSize, vel.tx, vel.ty); gl.uniform1i(u.uPressure, pres.read().attach(0)); gl.uniform1i(u.uVelocity, vel.read().attach(1)); blit(vel.write()); vel.swap();
  u = use('advect'); gl.uniform2f(u.texelSize, vel.tx, vel.ty);
  var v = vel.read().attach(0);
  gl.uniform1i(u.uVelocity, v); gl.uniform1i(u.uSource, v); gl.uniform1f(u.dt, dt); gl.uniform1f(u.dissipation, VEL_FADE);
  blit(vel.write()); vel.swap();
  gl.uniform1i(u.uVelocity, vel.read().attach(0)); gl.uniform1i(u.uSource, dye.read().attach(1)); gl.uniform1f(u.dissipation, inkFade);
  blit(dye.write()); dye.swap();
  u = use('reveal'); gl.uniform2f(u.texelSize, dye.tx, dye.ty); gl.uniform1i(u.uPrev, rev.read().attach(0)); gl.uniform1i(u.uDye, dye.read().attach(1)); gl.uniform1f(u.fill, fill);
  blit(rev.write()); rev.swap();
}
function render() {
  var u = use('display');
  gl.uniform2f(u.texelSize, dye.tx, dye.ty);
  gl.uniform1i(u.uDye, dye.read().attach(0)); gl.uniform1i(u.uReveal, rev.read().attach(1));
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, logoTex); gl.uniform1i(u.uLogo, 2);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, ringTex); gl.uniform1i(u.uRing, 3);
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, glowTex); gl.uniform1i(u.uGlow, 4);
  gl.uniform1f(u.neon, neonLevel);
  gl.uniform1f(u.topFade, topFade);
  gl.uniform1f(u.logoOn, logoOn);
  blit(null);
}

/* ---------- la coreografia dell'apertura ----------
   tre gocce cadono dall'alto, poi due correnti attraversano il centro (dove c'è il nome)
   in versi opposti; dove passano il nome compare. */
function rnd(a, b) { return a + Math.random() * (b - a); }
var drops = [
  { t0: .1, t1: 1.1, x: .44, w: .7 },
  { t0: .35, t1: 1.3, x: .6, w: 1.1 },
  { t0: .7, t1: 1.6, x: .3, w: .9 }
];
var sweeps = [
  { t0: .9, t1: 2.7, y: .61, from: -.06, to: 1.06, ph: 0 },
  { t0: 1.3, t1: 3.1, y: .51, from: 1.06, to: -.06, ph: 2 }
];
function choreo(t, dt) {
  drops.forEach(function (d) {
    if (t < d.t0 || t > d.t1) return;
    var k = (t - d.t0) / (d.t1 - d.t0);
    splat(d.x + Math.sin(t * 7 * d.w) * .01, .99, rnd(-18, 18) * dt * 10, -70 * (1 - k * .5) * dt * 10, 16 * dt, .0035);
  });
  sweeps.forEach(function (s) {
    if (t < s.t0 || t > s.t1) return;
    var k = (t - s.t0) / (s.t1 - s.t0), e = k * k * (3 - 2 * k);
    var x = s.from + (s.to - s.from) * e, y = s.y + Math.sin(k * 9 + s.ph) * .06;
    var dir = s.to > s.from ? 1 : -1;
    splat(x, y, dir * rnd(60, 110) * dt * 10, rnd(-70, 70) * dt * 10, 13 * dt, .006);
  });
  /* mouse fermo: ogni tanto parte da solo uno sbuffo d'inchiostro, quasi sempre dai lati */
  if (t > 5.5 && t - lastMove > IDLE && t >= nextPuff) {
    puffs.push(newPuff(t));
    if (Math.random() < .3) puffs.push(newPuff(t));   // a volte due insieme
    nextPuff = t + rnd(PUFF_GAP[0], PUFF_GAP[1]);
  }
  for (var i = puffs.length - 1; i >= 0; i--) {
    var p = puffs[i], k = (t - p.t0) / p.dur;
    if (k > 1) { puffs.splice(i, 1); continue; }
    var w = Math.sin(t * p.wob + p.ph);
    var vx = (p.vx + p.sx * w) * (1 - k * .6), vy = (p.vy + p.sy * w) * (1 - k * .6);
    p.x += vx * dt * .0016; p.y += vy * dt * .0016 * cv.width / cv.height;
    splat(p.x, p.y, vx * dt * 10, vy * dt * 10, p.ink * dt * (1 - k * .5), p.rad);
  }
}
var puffs = [], nextPuff = 0, lastMove = -99;
function newPuff(t) {
  /* da ogni lato a turno: sinistra, destra, alto, basso (in alto e in basso, se lo sbuffo
     parte al centro, è più leggero per non coprire il nome) */
  var side = Math.floor(Math.random() * 4), p = { t0: t, dur: rnd(.8, 1.5), wob: rnd(4, 8), ph: rnd(0, 6), ink: rnd(10, 15), rad: rnd(.0028, .005) };
  if (side < 2) {                      // dal bordo sinistro o destro, verso l'interno
    var left = side === 0;
    p.x = left ? -.01 : 1.01; p.y = rnd(.06, .94);
    p.vx = (left ? 1 : -1) * rnd(45, 80); p.vy = rnd(-25, 25); p.sx = 10; p.sy = 40;
  } else {                             // dal bordo in alto o in basso, verso l'interno
    var top = side === 2;
    p.x = rnd(.03, .97); p.y = top ? 1.01 : -.01;
    p.vx = rnd(-18, 18); p.vy = (top ? -1 : 1) * rnd(50, 80); p.sx = 40; p.sy = 10;
    if (p.x > .3 && p.x < .7) { p.ink *= .55; p.vy *= .75; }
  }
  return p;
}

/* insegna al neon: si accende quando esce il nome (con lo sfarfallio dell'accensione),
   poi respira piano e ogni tanto sfarfalla */
var neonLevel = 0, logoOn = 0, flickAt = NEON_ON, nextFlick = NEON_ON;
function neonAt(t) {
  if (t >= nextFlick) { flickAt = t; nextFlick = t + rnd(2.5, 6.5); }
  var on = Math.min(1, Math.max(0, (t - NEON_ON) / .4));
  var f = t - flickAt, dip = 1;
  if (f >= 0 && f < .42) dip = (f < .05 || (f > .11 && f < .15) || (f > .27 && f < .3)) ? .12 : (f < .2 ? .7 : 1);
  return NEON * on * dip * (.8 + .2 * Math.sin(t * 2.4));
}

/* ---------- mouse e dito: si smuove l'inchiostro ---------- */
var px = null, py = null;
hero.addEventListener('pointermove', function (e) {
  if (t0 !== null) lastMove = (performance.now() - t0) / 1000;
  var r = cv.getBoundingClientRect();
  var x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
  if (px !== null) {
    var dx = x - px, dy = y - py, sp = Math.hypot(dx, dy);
    if (sp > .0005) splat(x, y, dx * 5000, dy * 5000, Math.min(.5, .1 + sp * 12), .0028);
  }
  px = x; py = y;
});
hero.addEventListener('pointerleave', function () { px = py = null; });

/* ---------- ciclo ---------- */
var t0 = null, last = 0;
function frame(now) {
  if (dead) return;
  requestAnimationFrame(frame);
  if (!logoReady) return;
  if (window.scrollY > hero.offsetHeight) { last = now; return; }   // fuori schermo: pausa
  if (t0 === null) { t0 = now; last = now; hero.classList.add('smoke-on'); }
  var dt = Math.min((now - last) / 1000, 1 / 60), t = (now - t0) / 1000;
  last = now;
  if (Math.abs(cv.clientWidth - lastW) > 1) { try { setup(); fill = t > 2 ? 1 : fill; } catch (e) { return fallback(); } }
  fill = Math.max(fill, Math.min(1, Math.max(0, (t - START_FILL) / (END_FILL - START_FILL))));
  inkFade = INK_FADE + (INK_FADE_END - INK_FADE) * Math.min(1, Math.max(0, (t - END_FILL) / 2.5));
  neonLevel = neonAt(t);
  logoOn = Math.min(1, Math.max(0, (t - NEON_ON) / .4));   // il nero dentro le lettere compare insieme al neon
  if (dt > 0) { choreo(t, dt); step(dt); }
  render();
}
logoImg.onload = loadLogo;
logoImg.onerror = fallback;
if (logoImg.complete && logoImg.naturalWidth) loadLogo();
requestAnimationFrame(frame);
})();
