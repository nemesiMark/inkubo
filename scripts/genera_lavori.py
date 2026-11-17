#!/usr/bin/env python3
"""Genera i lavori di portfolio.html (da data/lavori.json: foto e video divisi in gruppi
con data-cat: tatuaggi a colori, bianco e nero, video, dallo studio), la ruota 3D della home in index.html (da data/ruota.json, un elenco a sé),
la sezione Video della home (data/video.json) e le altre immagini delle pagine
(data/immagini.json: ogni <img data-slot="…"> prende foto e testo alternativo).
Sono i file che il cliente modifica dall'area riservata.

I video NON stanno nel repository: sono allegati alla release «video» di GitHub e la
pubblicazione (.github/workflows/pubblica.yml) li scarica in video/ prima di eseguire questo
script. Nei file data/*.json il campo «video» è il percorso sul sito (video/nome.mp4) e
«foto» è la sua copertina (un normale JPEG in images/lavori/).

Uso:  python3 scripts/genera_lavori.py           (scrive i file)
      python3 scripts/genera_lavori.py --check   (esce con errore se i file non sono aggiornati)

Tocca solo il testo fra i segnaposto <!-- lavori:inizio --> / <!-- lavori:fine --> e
<!-- video:inizio --> / <!-- video:fine -->.
"""
import html, json, os, re, sys

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INIZIO, FINE = "<!-- lavori:inizio -->", "<!-- lavori:fine -->"
VIDEO_VALIDO = re.compile(r"^video/[a-z0-9][a-z0-9._-]{0,120}\.(mp4|webm)$")
# gruppi del portfolio (i pulsanti in cima a portfolio.html): le foto hanno «tipo», i video sono sempre «video».
# Stessi valori in area-riservata.html e nel Worker.
TIPI_FOTO = ("colori", "bn", "studio")

def att(t): return html.escape(t, quote=True)
def txt(t): return html.escape(t, quote=False)

def carica(nome="lavori.json"):
    # foto e video, nell'ordine scelto dal cliente
    with open(os.path.join(RADICE, "data", nome), encoding="utf-8") as f:
        dati = json.load(f)
    voci = []
    for n, l in enumerate(dati, 1):
        foto = str(l.get("foto") or "").strip().lstrip("/")
        titolo = str(l.get("titolo") or "").strip()
        video = str(l.get("video") or "").strip().lstrip("/")
        if not foto or not titolo:
            print(f"avviso: {nome} n. {n} saltato (manca la foto o il titolo)", file=sys.stderr)
            continue
        if not os.path.exists(os.path.join(RADICE, foto)):
            print(f"avviso: {nome} n. {n} saltato, la foto {foto} non esiste", file=sys.stderr)
            continue
        if video and not VIDEO_VALIDO.match(video):
            print(f"avviso: {nome} n. {n} saltato, video non valido: {video}", file=sys.stderr)
            continue
        if video and not os.path.exists(os.path.join(RADICE, video)):
            # in locale di solito i video mancano: li scarica la pubblicazione
            print(f"nota: {video} non è in questa cartella (lo scarica la pubblicazione)", file=sys.stderr)
        tipo = "video" if video else str(l.get("tipo") or "").strip()
        if tipo not in TIPI_FOTO and tipo != "video":
            tipo = "colori"  # foto senza gruppo: va fra i tatuaggi a colori
        voci.append(dict(foto=foto, titolo=titolo, video=video, tipo=tipo, alt=f"{titolo}, Rain Ink Tattoo"))
    return voci

def portfolio(lavori):
    righe = []
    for l in lavori:
        if l["video"]:
            righe.append(
                f'                    <figure class="work rv is-video" data-cat="video" data-video="{att(l["video"])}"><button type="button" aria-label="Guarda il video {att(l["titolo"])}">'
                f'<span class="ph"><img src="{att(l["foto"])}" alt="{att(l["alt"])}" width="800" height="1000" loading="lazy"><span class="play" aria-hidden="true"></span></span></button>'
                f'<figcaption><b>{txt(l["titolo"])}</b><span>Video</span></figcaption></figure>')
        else:
            righe.append(
                f'                    <figure class="work rv" data-cat="{l["tipo"]}"><button type="button" aria-label="Apri {att(l["titolo"])} a schermo intero">'
                f'<span class="ph"><img src="{att(l["foto"])}" alt="{att(l["alt"])}" width="800" height="1000" loading="lazy"></span></button>'
                f'<figcaption><b>{txt(l["titolo"])}</b></figcaption></figure>')
    return righe

def video_home(lista):
    return [
        f'                    <figure class="clip"><video src="{att(v["video"])}" poster="{att(v["foto"])}" controls playsinline preload="none"'
        f' aria-label="{att(v["titolo"])}"></video><figcaption>{txt(v["titolo"])}</figcaption></figure>'
        for v in lista if v["video"]]

def carica_ruota():
    # ruota 3D della home: data/ruota.json, nell'ordine scelto dal cliente (solo foto e titolo)
    with open(os.path.join(RADICE, "data", "ruota.json"), encoding="utf-8") as f:
        dati = json.load(f)
    ruota = []
    for n, r in enumerate(dati, 1):
        foto = str(r.get("foto") or "").strip().lstrip("/")
        titolo = str(r.get("titolo") or "").strip()
        if not foto or not titolo or not os.path.exists(os.path.join(RADICE, foto)):
            print(f"avviso: foto n. {n} della ruota saltata (manca la foto o il titolo)", file=sys.stderr)
            continue
        ruota.append(dict(foto=foto, titolo=titolo))
    return ruota

def home(ruota):
    return [
        f'                        <figure class="face" data-name="{att(r["titolo"])}" data-title="">'
        f'<img src="{att(r["foto"])}" alt="{att(r["titolo"] + ", tatuaggio di Rain Ink")}" width="800" height="1000" draggable="false"></figure>'
        for r in ruota]

def immagini(controlla):
    # ogni voce di data/immagini.json aggiorna src e alt dell'<img data-slot="id"> nella sua pagina
    percorso = os.path.join(RADICE, "data", "immagini.json")
    if not os.path.exists(percorso):
        return True
    with open(percorso, encoding="utf-8") as f:
        voci = json.load(f)
    pagine, ok = {}, True
    for v in voci:
        foto = str(v.get("foto") or "").strip().lstrip("/")
        if not foto or not os.path.exists(os.path.join(RADICE, foto)):
            print(f"avviso: immagine {v.get('id')} saltata, la foto {foto} non esiste", file=sys.stderr)
            continue
        nome = v["pagina"]
        if nome not in pagine:
            with open(os.path.join(RADICE, nome), encoding="utf-8") as f:
                pagine[nome] = [f.read(), None]
            pagine[nome][1] = pagine[nome][0]
        s = pagine[nome][0]
        segno = f'<img data-slot="{v["id"]}" '
        a = s.find(segno)
        if a < 0:
            print(f"avviso: in {nome} manca l'immagine {v['id']}", file=sys.stderr)
            continue
        b = s.index(">", a)
        tag = s[a:b]
        tag = re.sub(r' src="[^"]*"', f' src="{att(foto)}"', tag, count=1)
        tag = re.sub(r' alt="[^"]*"', f' alt="{att(str(v.get("alt") or "").strip())}"', tag, count=1)
        pagine[nome][0] = s[:a] + tag + s[b:]
    for nome, (nuovo, prima) in pagine.items():
        if nuovo == prima:
            continue
        if controlla:
            print(f"{nome} non è aggiornato: esegui python3 scripts/genera_lavori.py", file=sys.stderr)
            ok = False
            continue
        with open(os.path.join(RADICE, nome), "w", encoding="utf-8") as f:
            f.write(nuovo)
        print(f"{nome} aggiornato (immagini)")
    return ok

def sostituisci(nome, righe, controlla, segni=(INIZIO, FINE)):
    percorso = os.path.join(RADICE, nome)
    with open(percorso, encoding="utf-8") as f:
        s = f.read()
    a, b = s.index(segni[0]) + len(segni[0]), s.index(segni[1])
    rientro = s[s.rfind("\n", 0, b) + 1:b]
    nuovo = s[:a] + "\n" + "\n".join(righe) + "\n" + rientro + s[b:]
    if nuovo == s:
        return True
    if controlla:
        print(f"{nome} non è aggiornato: esegui python3 scripts/genera_lavori.py", file=sys.stderr)
        return False
    with open(percorso, "w", encoding="utf-8") as f:
        f.write(nuovo)
    print(f"{nome} aggiornato")
    return True

if __name__ == "__main__":
    controlla = "--check" in sys.argv
    lavori = carica()
    ok = sostituisci("portfolio.html", portfolio(lavori), controlla) & sostituisci("index.html", home(carica_ruota()), controlla)
    ok = sostituisci("index.html", video_home(carica("video.json")), controlla, ("<!-- video:inizio -->", "<!-- video:fine -->")) & ok
    ok = immagini(controlla) & ok
    sys.exit(0 if ok else 1)
