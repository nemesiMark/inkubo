#!/usr/bin/env python3
"""Genera i lavori di portfolio.html (da data/lavori.json), la ruota 3D della home in index.html
(da data/ruota.json, un elenco a sé: cambiare una foto del portfolio non tocca la home) e le
altre immagini delle pagine (data/immagini.json: ogni <img data-slot="…"> prende foto e testo
alternativo). Sono i file che il cliente modifica dall'area riservata.

Uso:  python3 scripts/genera_lavori.py           (scrive i file)
      python3 scripts/genera_lavori.py --check   (esce con errore se i file non sono aggiornati)

Tocca solo il testo fra i segnaposto <!-- lavori:inizio --> e <!-- lavori:fine -->.
"""
import html, json, os, re, sys

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STILI = [  # ordine dei filtri del portfolio; uguale ad area-riservata.html
    ("blackwork", "Blackwork"), ("dotwork", "Dotwork"), ("fine-line", "Fine line"),
    ("tradizionale", "Tradizionale"), ("giapponese", "Giapponese"), ("realistico", "Realistico"),
]
NOMI = dict(STILI)
INIZIO, FINE = "<!-- lavori:inizio -->", "<!-- lavori:fine -->"

def att(t): return html.escape(t, quote=True)
def txt(t): return html.escape(t, quote=False)

def carica():
    with open(os.path.join(RADICE, "data", "lavori.json"), encoding="utf-8") as f:
        dati = json.load(f)
    lavori = []
    for n, l in enumerate(dati, 1):
        foto = str(l.get("foto") or "").strip().lstrip("/")
        titolo = str(l.get("titolo") or "").strip()
        stile = str(l.get("stile") or "").strip()
        zona = str(l.get("zona") or "").strip()
        if not foto or not titolo or stile not in NOMI:
            print(f"avviso: lavoro n. {n} saltato (manca la foto o il titolo, o lo stile non è valido)", file=sys.stderr)
            continue
        if not os.path.exists(os.path.join(RADICE, foto)):
            print(f"avviso: lavoro n. {n} saltato, la foto {foto} non esiste", file=sys.stderr)
            continue
        lavori.append(dict(foto=foto, titolo=titolo, stile=stile, zona=zona, nome=NOMI[stile],
                           alt=f"{titolo}, tatuaggio {NOMI[stile].lower()}"))
    return lavori

def portfolio(lavori):
    righe = []
    for l in lavori:
        sotto = l["nome"] + (" · " + l["zona"] if l["zona"] else "")
        righe.append(
            f'                    <figure class="work rv" data-cat="{l["stile"]}"><button type="button" aria-label="Apri {att(l["titolo"])} a schermo intero">'
            f'<span class="ph"><img src="{att(l["foto"])}" alt="{att(l["alt"])}" width="800" height="1000" loading="lazy"></span></button>'
            f'<figcaption><b>{txt(l["titolo"])}</b><span>{txt(sotto)}</span></figcaption></figure>')
    return righe

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

def sostituisci(nome, righe, controlla):
    percorso = os.path.join(RADICE, nome)
    with open(percorso, encoding="utf-8") as f:
        s = f.read()
    a, b = s.index(INIZIO) + len(INIZIO), s.index(FINE)
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
    ok = immagini(controlla) & ok
    sys.exit(0 if ok else 1)
