/**
 * Rain Ink Tattoo — servizio dell'area riservata (Cloudflare Worker).
 *
 * Fa da ponte fra la pagina area-riservata.html e il repository GitHub del sito:
 * controlla la password, poi legge e salva data/lavori.json (portfolio: foto e video),
 * data/ruota.json (ruota dei lavori della home), data/video.json (sezione Video della home),
 * data/immagini.json (le altre immagini delle pagine) e le foto in images/lavori/
 * con un solo commit per ogni salvataggio. GitHub Actions ripubblica il sito da solo.
 *
 * I VIDEO non passano dal repository (sarebbero troppo pesanti): POST /video li allega
 * alla release «video» del repository, che il Worker crea da solo la prima volta; la
 * pubblicazione li scarica in video/. Nei file JSON il video è «video/nome.mp4» e la sua
 * copertina è una normale foto. I video che nessun elenco usa più vengono cancellati.
 *
 * Impostazioni del Worker (Cloudflare → Workers → questo Worker → Settings → Variables):
 *   Secret  ADMIN_PASSWORD   password dell'area riservata (scelta col cliente)
 *   Secret  SESSION_SECRET   stringa casuale lunga, serve a firmare l'accesso
 *   Secret  GITHUB_TOKEN     token "fine-grained" solo per il repository inkubo,
 *                            permesso Contents: Read and write (vale anche per le release)
 *   Text    REPO             nemesiMark/inkubo
 *   Text    BRANCH           main
 *   Text    ORIGINS          https://nemesimark.github.io  (più indirizzi separati da virgola)
 * Per il cambio password dall'area riservata (Settings → Bindings → KV namespace):
 *   KV      DATI             un namespace KV (es. «rainink-area-riservata»). Lì si salva
 *                            l'impronta della password nuova (PBKDF2, mai la password in
 *                            chiaro). Finché nessuno la cambia vale ADMIN_PASSWORD.
 * Nessuna chiave è scritta in questo file.
 */

const FILE_LAVORI = "data/lavori.json";
const FILE_VIDEO = "data/video.json";
const MAX_VIDEO_HOME = 30;
const RELEASE_VIDEO = "video";
const MAX_VIDEO_BYTES = 95 * 1024 * 1024;  // Cloudflare (piano gratuito) accetta richieste fino a 100 MB
const VIDEO_VALIDO = /^video\/[a-z0-9][a-z0-9._-]{0,120}\.(mp4|webm)$/;
const FILE_IMMAGINI = "data/immagini.json";
const FILE_RUOTA = "data/ruota.json";
const MAX_RUOTA = 30;
const CARTELLA_FOTO = "images/lavori/";
const MAX_FOTO_BYTES = 4 * 1024 * 1024;   // dopo il ridimensionamento nel browser sono ~0,3–0,6 MB
const MAX_FOTO_PER_SALVATAGGIO = 12;
const MAX_LAVORI = 300;
const DURATA_ACCESSO_S = 30 * 24 * 3600;  // 30 giorni
const PW_ITERAZIONI = 100000;              // massimo consentito da Cloudflare per PBKDF2
const PW_MIN = 8, PW_MAX = 128;
const FOTO_VALIDA = /^images\/(lavori|flash|home|studio|piercing)\/[a-z0-9][a-z0-9._-]{0,120}\.(jpe?g|png|webp|svg)$/;

export default {
  async fetch(request, env) {
    const cors = intestazioniCors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname === "/login") return await login(request, env, cors);
      if (!(await accessoValido(request, env))) return json({ errore: "Accesso scaduto, entra di nuovo" }, 401, cors);
      if (request.method === "GET" && url.pathname === "/lavori") return await leggiLavori(env, cors);
      if (request.method === "POST" && url.pathname === "/salva") return await salva(request, env, cors);
      if (request.method === "POST" && url.pathname === "/video") return await caricaVideo(request, env, cors, url);
      if (request.method === "POST" && url.pathname === "/password") return await cambiaPassword(request, env, cors);
      return json({ errore: "Indirizzo non valido" }, 404, cors);
    } catch (e) {
      const stato = e && e.stato ? e.stato : 500;
      return json({ errore: e && e.utente ? e.message : "Errore del servizio, riprova tra poco" }, stato, cors);
    }
  },
};

/* ---------- accesso ---------- */

async function login(request, env, cors) {
  const corpo = await request.json().catch(() => ({}));
  const pw = await passwordSalvata(env);
  if (!(await passwordGiusta(corpo.password, pw, env))) {
    await new Promise((r) => setTimeout(r, 1200)); // rallenta i tentativi a raffica
    return json({ errore: "Password non corretta" }, 401, cors);
  }
  return json(await nuovoAccesso(env, pw ? pw.versione : 0), 200, cors);
}

async function nuovoAccesso(env, versione) {
  const scade = Math.floor(Date.now() / 1000) + DURATA_ACCESSO_S;
  const dati = b64url(new TextEncoder().encode(JSON.stringify({ scade, v: versione })));
  return { token: dati + "." + (await firma(dati, env)), scade };
}

/* password: se è stata cambiata dall'area riservata sta nel KV DATI (impronta PBKDF2),
   altrimenti vale ADMIN_PASSWORD. «versione» cresce a ogni cambio: gli accessi vecchi
   (altri telefoni o computer) non valgono più. */
async function passwordSalvata(env) {
  if (!env.DATI) return null;
  return await env.DATI.get("password", "json");
}

async function passwordGiusta(tentativo, pw, env) {
  if (typeof tentativo !== "string" || !tentativo) return false;
  if (pw) return await ugualiCostante(await impronta(tentativo, pw.sale, pw.iterazioni), pw.impronta);
  return !!env.ADMIN_PASSWORD && (await ugualiCostante(tentativo, env.ADMIN_PASSWORD));
}

async function impronta(password, sale, iterazioni) {
  const chiave = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bit = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: daB64url(sale), iterations: iterazioni }, chiave, 256);
  return b64url(new Uint8Array(bit));
}

async function cambiaPassword(request, env, cors) {
  if (!env.DATI) throw errore("Cambio password non ancora attivo: manca il collegamento DATI su Cloudflare", 501);
  const corpo = await request.json().catch(() => ({}));
  const pw = await passwordSalvata(env);
  if (!(await passwordGiusta(corpo.attuale, pw, env))) {
    await new Promise((r) => setTimeout(r, 1200));
    throw errore("La password attuale non è corretta", 403);
  }
  const nuova = corpo.nuova;
  if (typeof nuova !== "string" || nuova.length < PW_MIN) throw errore(`La password nuova deve avere almeno ${PW_MIN} caratteri`, 400);
  if (nuova.length > PW_MAX) throw errore("La password nuova è troppo lunga", 400);
  if (nuova === corpo.attuale) throw errore("La password nuova è uguale a quella attuale", 400);
  const sale = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const versione = (pw ? pw.versione : 0) + 1;
  await env.DATI.put("password", JSON.stringify({ sale, iterazioni: PW_ITERAZIONI, impronta: await impronta(nuova, sale, PW_ITERAZIONI), versione, cambiata: new Date().toISOString() }));
  return json(await nuovoAccesso(env, versione), 200, cors);
}

async function accessoValido(request, env) {
  const h = request.headers.get("Authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [dati, sig] = token.split(".");
  if (!dati || !sig || !env.SESSION_SECRET) return false;
  if (!(await ugualiCostante(sig, await firma(dati, env)))) return false;
  try {
    const { scade, v } = JSON.parse(new TextDecoder().decode(daB64url(dati)));
    if (!(typeof scade === "number" && scade > Date.now() / 1000)) return false;
    const pw = await passwordSalvata(env);
    return (v || 0) === (pw ? pw.versione : 0);
  } catch { return false; }
}

async function firma(testo, env) {
  const chiave = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", chiave, new TextEncoder().encode(testo))));
}

// confronto a tempo costante: si confrontano le impronte SHA-256, sempre della stessa lunghezza
async function ugualiCostante(a, b) {
  const [x, y] = await Promise.all([a, b].map(async (s) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))));
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/* ---------- lettura ---------- */

async function leggiLavori(env, cors) {
  const { lavori, immagini, ruota, video } = await statoAttuale(env);
  return json({ lavori, immagini, ruota, video }, 200, cors);
}

async function statoAttuale(env) {
  const ref = await gh(env, `git/ref/heads/${env.BRANCH}`);
  const sha = ref.object.sha;
  const [lavori, immagini, ruota, video] = await Promise.all([leggiJson(env, FILE_LAVORI, sha),
    leggiJson(env, FILE_IMMAGINI, sha).catch(() => []), leggiJson(env, FILE_RUOTA, sha).catch(() => []),
    leggiJson(env, FILE_VIDEO, sha).catch(() => [])]);
  const lista = (x) => Array.isArray(x) ? x : [];
  return { sha, lavori: lista(lavori), immagini: lista(immagini), ruota: lista(ruota), video: lista(video) };
}

async function leggiJson(env, percorso, sha) {
  const file = await gh(env, `contents/${percorso}?ref=${sha}`);
  return JSON.parse(new TextDecoder().decode(daB64(file.content.replace(/\n/g, ""))));
}

/* ---------- salvataggio ---------- */

/**
 * Corpo: { lavori: [ {foto, titolo, video?} ], immagini: [ {id, foto, alt} ] (facoltativo),
 *         ruota: [ {foto, titolo} ] (facoltativo: la ruota della home, indipendente dal portfolio),
 *         video: [ {foto, titolo, video} ] (facoltativo: la sezione Video della home),
 *         nuoveFoto: { "nuova:ID": "base64…" }, messaggio }
 * Nel campo foto di una foto nuova c'è "nuova:ID": qui diventa il percorso vero della foto caricata.
 * Delle immagini delle pagine si cambiano solo foto e testo alternativo: quali sono, in che
 * pagina e con che descrizione lo decide data/immagini.json sul sito.
 * Nel campo video c'è il percorso restituito da POST /video (il video è già nella release).
 * Le foto di images/lavori/ e i video della release che non sono più usati da nessuna parte
 * vengono cancellati.
 */
async function salva(request, env, cors) {
  const corpo = await request.json().catch(() => null);
  if (!corpo || !Array.isArray(corpo.lavori)) throw errore("Dati non validi", 400);
  if (corpo.lavori.length > MAX_LAVORI) throw errore("Troppi lavori", 400);
  const nuove = corpo.nuoveFoto && typeof corpo.nuoveFoto === "object" ? corpo.nuoveFoto : {};
  if (Object.keys(nuove).length > MAX_FOTO_PER_SALVATAGGIO) throw errore("Troppe foto in una volta", 400);

  // foto nuove: controllo e nome definitivo
  const blobFoto = [];
  const percorsi = {};
  for (const [id, b64] of Object.entries(nuove)) {
    if (!/^nuova:[a-z0-9]{6,32}$/.test(id) || typeof b64 !== "string") throw errore("Foto non valida", 400);
    const byte = daB64(b64);
    if (byte.length > MAX_FOTO_BYTES) throw errore("Foto troppo grande", 413);
    const est = tipoImmagine(byte);
    if (!est) throw errore("Formato della foto non supportato", 415);
    percorsi[id] = null;
    blobFoto.push({ id, b64, est });
  }

  // elenco: ogni campo controllato, testi ripuliti (per ora niente stili: foto e video insieme)
  const lavori = corpo.lavori.map((l, i) => {
    const titolo = pulisci(l && l.titolo, 80);
    const foto = String((l && l.foto) || ""), video = String((l && l.video) || "");
    if (!titolo) throw errore(`Manca il titolo del lavoro n. ${i + 1}`, 400);
    if (!(foto in percorsi) && !FOTO_VALIDA.test(foto)) throw errore(`Foto non valida nel lavoro n. ${i + 1}`, 400);
    if (video && !VIDEO_VALIDO.test(video)) throw errore(`Video non valido nel lavoro n. ${i + 1}`, 400);
    return video ? { foto, titolo, video } : { foto, titolo };
  });

  // sezione Video della home: elenco a sé, ogni voce ha video, copertina e titolo
  let videoHome = null;
  if (Array.isArray(corpo.video)) {
    if (corpo.video.length > MAX_VIDEO_HOME) throw errore("Troppi video nella home", 400);
    videoHome = corpo.video.map((v, i) => {
      const titolo = pulisci(v && v.titolo, 80);
      const foto = String((v && v.foto) || ""), video = String((v && v.video) || "");
      if (!titolo) throw errore(`Manca il titolo del video n. ${i + 1}`, 400);
      if (!(foto in percorsi) && !FOTO_VALIDA.test(foto)) throw errore(`Copertina non valida nel video n. ${i + 1}`, 400);
      if (!VIDEO_VALIDO.test(video)) throw errore(`Video non valido (n. ${i + 1})`, 400);
      return { foto, titolo, video };
    });
  }

  // ogni video usato deve essere davvero nella release
  const release = await releaseVideo(env, false);
  const allegati = release ? await allegatiVideo(env, release.id) : [];
  const nomiAllegati = new Set(allegati.map((a) => a.name));
  for (const x of [...lavori, ...(videoHome || [])])
    if (x.video && !nomiAllegati.has(x.video.slice(6))) throw errore(`Il video «${x.titolo}» non è stato caricato, riprova`, 400);

  // ruota della home: elenco a sé, solo foto e titolo
  let ruota = null;
  if (Array.isArray(corpo.ruota)) {
    if (corpo.ruota.length > MAX_RUOTA) throw errore("Troppe foto nella ruota", 400);
    ruota = corpo.ruota.map((r, i) => {
      const titolo = pulisci(r && r.titolo, 80), foto = String((r && r.foto) || "");
      if (!titolo) throw errore(`Manca il titolo della foto n. ${i + 1} della ruota`, 400);
      if (!(foto in percorsi) && !FOTO_VALIDA.test(foto)) throw errore(`Foto non valida nella ruota (n. ${i + 1})`, 400);
      return { foto, titolo };
    });
  }

  // immagini delle pagine: id → foto e testo alternativo scelti
  const scelte = {};
  if (Array.isArray(corpo.immagini)) for (const im of corpo.immagini) {
    if (!im || typeof im.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(im.id)) throw errore("Immagine non valida", 400);
    const foto = String(im.foto || "");
    if (!(foto in percorsi) && !FOTO_VALIDA.test(foto)) throw errore("Foto non valida", 400);
    scelte[im.id] = { foto, alt: pulisci(im.alt, 160) };
  }

  const giorno = new Date().toISOString().slice(0, 10);
  for (const f of blobFoto) {
    const lavoro = lavori.find((l) => l.foto === f.id) || (ruota || []).find((r) => r.foto === f.id) || (videoHome || []).find((v) => v.foto === f.id);
    const slot = Object.entries(scelte).find(([, v]) => v.foto === f.id);
    if (!lavoro && !slot) continue; // foto caricata ma non usata: si ignora
    const nome = `${giorno}-${slug(lavoro ? lavoro.titolo : slot[0])}-${casuale(6)}.${f.est}`;
    percorsi[f.id] = CARTELLA_FOTO + nome;
    for (const l of [...lavori, ...(ruota || []), ...(videoHome || [])]) if (l.foto === f.id) l.foto = percorsi[f.id];
    for (const v of Object.values(scelte)) if (v.foto === f.id) v.foto = percorsi[f.id];
  }

  // fino a 3 tentativi se nel frattempo il ramo è cambiato
  for (let tentativo = 0; tentativo < 3; tentativo++) {
    const { sha, lavori: prima, immagini: immPrima, ruota: ruotaPrima, video: videoPrima } = await statoAttuale(env);
    const immagini = immPrima.map((v) => scelte[v.id] ? { ...v, foto: scelte[v.id].foto, alt: scelte[v.id].alt || v.alt } : v);
    const ruotaNuova = ruota || ruotaPrima;
    const videoNuovo = videoHome || videoPrima;
    const usate = new Set([...lavori, ...immagini, ...ruotaNuova, ...videoNuovo].map((x) => x.foto));
    const daCancellare = [...new Set([...prima, ...immPrima, ...ruotaPrima, ...videoPrima].map((l) => l && l.foto).filter((p) =>
      typeof p === "string" && p.startsWith(CARTELLA_FOTO) && FOTO_VALIDA.test(p) && !usate.has(p)))];

    const commit = await gh(env, `git/commits/${sha}`);
    const albero = [];
    for (const f of blobFoto) {
      if (!percorsi[f.id]) continue;
      const blob = await gh(env, "git/blobs", "POST", { content: f.b64, encoding: "base64" });
      albero.push({ path: percorsi[f.id], mode: "100644", type: "blob", sha: blob.sha });
    }
    albero.push({ path: FILE_LAVORI, mode: "100644", type: "blob", content: JSON.stringify(lavori, null, 2) + "\n" });
    if (immPrima.length && JSON.stringify(immagini) !== JSON.stringify(immPrima))
      albero.push({ path: FILE_IMMAGINI, mode: "100644", type: "blob", content: JSON.stringify(immagini, null, 2) + "\n" });
    if (ruota && JSON.stringify(ruota) !== JSON.stringify(ruotaPrima))
      albero.push({ path: FILE_RUOTA, mode: "100644", type: "blob", content: JSON.stringify(ruota, null, 2) + "\n" });
    if (videoHome && JSON.stringify(videoHome) !== JSON.stringify(videoPrima))
      albero.push({ path: FILE_VIDEO, mode: "100644", type: "blob", content: JSON.stringify(videoHome, null, 2) + "\n" });
    for (const p of daCancellare) albero.push({ path: p, mode: "100644", type: "blob", sha: null });

    const nuovoAlbero = await gh(env, "git/trees", "POST", { base_tree: commit.tree.sha, tree: albero });
    const messaggio = pulisci(corpo.messaggio, 100) || "Area riservata: aggiornati i lavori del portfolio";
    const nuovoCommit = await gh(env, "git/commits", "POST", { message: messaggio, tree: nuovoAlbero.sha, parents: [sha] });
    try {
      await gh(env, `git/refs/heads/${env.BRANCH}`, "PATCH", { sha: nuovoCommit.sha, force: false });
      // video della release che nessun elenco usa più (al massimo 10 per volta). Quelli caricati da
      // meno di 6 ore si lasciano: potrebbero essere in attesa di conferma in un'altra finestra
      const videoUsati = new Set([...lavori, ...videoNuovo].map((x) => x.video).filter(Boolean).map((v) => v.slice(6)));
      const vecchio = Date.now() - 6 * 3600 * 1000;
      for (const a of allegati.filter((a) => !videoUsati.has(a.name) && Date.parse(a.created_at) < vecchio).slice(0, 10))
        await gh(env, `releases/assets/${a.id}`, "DELETE").catch(() => {});
      return json({ lavori, immagini, ruota: ruotaNuova, video: videoNuovo, commit: nuovoCommit.sha }, 200, cors);
    } catch (e) {
      if (e.stato !== 422) throw e; // 422: il ramo è andato avanti, si riprova sul nuovo stato
    }
  }
  throw errore("Il sito è stato modificato nello stesso momento, riprova", 409);
}

/* ---------- video ---------- */

/**
 * POST /video?nome=Titolo  — corpo: il file video così com'è (Content-Type video/mp4 o video/webm).
 * Il file passa dritto a GitHub senza essere letto qui (il Worker non ha il tempo di elaborarlo):
 * diventa un allegato della release «video». Risponde { video: "video/nome.mp4" }.
 */
async function caricaVideo(request, env, cors, url) {
  const tipo = (request.headers.get("Content-Type") || "").split(";")[0].trim();
  const est = tipo === "video/mp4" ? "mp4" : tipo === "video/webm" ? "webm" : null;
  if (!est) throw errore("Formato del video non supportato (serve MP4 o WebM)", 415);
  const lunghezza = Number(request.headers.get("Content-Length") || 0);
  if (!lunghezza || !request.body) throw errore("Video vuoto", 400);
  if (lunghezza > MAX_VIDEO_BYTES) throw errore("Video troppo pesante", 413);
  const release = await releaseVideo(env, true);
  const nome = `${new Date().toISOString().slice(0, 10)}-${slug(pulisci(url.searchParams.get("nome"), 80) || "video")}-${casuale(6)}.${est}`;
  const { readable, writable } = new FixedLengthStream(lunghezza);
  request.body.pipeTo(writable).catch(() => {});
  const r = await fetch(`https://uploads.github.com/repos/${env.REPO}/releases/${release.id}/assets?name=${encodeURIComponent(nome)}`, {
    method: "POST",
    headers: { ...intestazioniGh(env), "Content-Type": tipo, "Content-Length": String(lunghezza) },
    body: readable,
  });
  if (!r.ok) throw errore(`Caricamento del video non riuscito (GitHub ${r.status})`, 502);
  return json({ video: "video/" + nome }, 200, cors);
}

// la release che contiene i video; se manca e «crea» è vero la crea (insieme al tag «video»)
async function releaseVideo(env, crea) {
  try { return await gh(env, `releases/tags/${RELEASE_VIDEO}`); } catch (e) { if (e.stato !== 404) throw e; }
  if (!crea) return null;
  return await gh(env, "releases", "POST", { tag_name: RELEASE_VIDEO, target_commitish: env.BRANCH, name: "Video del sito",
    body: "Video del sito, caricati dall'area riservata. Non cancellare: la pubblicazione li scarica da qui." });
}

async function allegatiVideo(env, id) {
  const tutti = [];
  for (let pagina = 1; pagina <= 5; pagina++) {
    const parte = await gh(env, `releases/${id}/assets?per_page=100&page=${pagina}`);
    tutti.push(...parte);
    if (parte.length < 100) break;
  }
  return tutti;
}

/* ---------- GitHub ---------- */

function intestazioniGh(env) {
  return {
    "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "rainink-area-riservata",
  };
}

async function gh(env, percorso, metodo = "GET", corpo) {
  const r = await fetch(`https://api.github.com/repos/${env.REPO}/${percorso}`, {
    method: metodo,
    headers: { ...intestazioniGh(env), ...(corpo ? { "Content-Type": "application/json" } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!r.ok) { const e = new Error(`GitHub ${r.status}`); e.stato = r.status; throw e; }
  return r.status === 204 ? null : r.json();
}

/* ---------- utilità ---------- */

function intestazioniCors(request, env) {
  const ammessi = String(env.ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const origine = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ammessi.includes(origine) ? origine : (ammessi[0] || "null"),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(dati, stato, cors) {
  return new Response(JSON.stringify(dati), { status: stato, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

function errore(messaggio, stato) { const e = new Error(messaggio); e.stato = stato; e.utente = true; return e; }

function pulisci(v, max) {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function slug(t) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "lavoro";
}

function casuale(n) {
  const a = "abcdefghijklmnopqrstuvwxyz0123456789", b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (x) => a[x % a.length]).join("");
}

function tipoImmagine(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null;
}

function daB64(s) { const t = atob(s); const u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; }
function b64url(u) { let t = ""; for (const x of u) t += String.fromCharCode(x); return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function daB64url(s) { return daB64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); }
