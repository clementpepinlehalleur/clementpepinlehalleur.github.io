#!/usr/bin/env python3
"""Export ODbL de la base de produits dérivée utilisée par l'app (obligation de l'art. 4.6 de l'ODbL).

Entrée  : mobile/assets/data/catalog.db (table p, celle de l'app, lue seulement)
          + data/out/catalog.sqlite (table product_sources : d'où vient chaque produit).
Sortie  : site/donnees/
          produits.csv.gz          un produit par code-barres (Open Food Facts, NIH DSLD, USDA FoodData Central)
          prix-open-prices.csv.gz  prix collaboratifs Open Prices (ODbL) seulement
          LISEZMOI.txt             licence (résumé ODbL, attribution)
          manifest.json            tailles et nombres de lignes (lu par build.js pour la page donnees/)

Exclu volontairement :
- les prix relevés sur les sites des boutiques (colonnes price/cur/store/pdate/purl quand elles ne viennent pas
  d'Open Prices) : autres conditions, à garder hors de la base ODbL (audit légal §2.5) ;
- le lieu de fabrication quand il vient de la fiche d'une marque (site de la marque, pas Open Food Facts) ;
- la colonne s (clé de recherche normalisée, sans intérêt) ;
- tout produit dont la source n'est pas connue.

Relancer après chaque nouvelle base : python3 _build/export_odbl.py   (puis node _build/build.js)
"""
import csv, gzip, io, json, os, sqlite3, sys
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, "site.json"), encoding="utf-8"))
P = lambda k: os.path.normpath(os.path.join(HERE, CFG[k]))
OUT = os.path.normpath(os.path.join(HERE, "..", "donnees"))
MAX = 50 * 1024 * 1024  # GitHub refuse les fichiers de plus de 100 Mo et avertit au-delà de 50 Mo
LABEL = {"openfoodfacts": "Open Food Facts (ODbL 1.0)", "dsld": "NIH DSLD (domaine public)", "usda_fdc": "USDA FoodData Central (CC0 1.0)"}
OPEN_PRICES = "https://prices.openfoodfacts.org/"

COLS = ["gtin", "name", "brand", "cat", "quantity", "serving_size", "dose_g", "dose_n", "dose_u", "dose_src",
        "kcal_100g", "protein_100g", "sugars_100g", "carbs_100g", "kcal_serving", "protein_serving", "sugars_serving", "carbs_serving",
        "additives_n", "bio", "ingredients_text", "origin"]


def fmt(v):
    if v is None:
        return ""
    if isinstance(v, float):
        return ("%.4f" % v).rstrip("0").rstrip(".")
    return str(v)


class Writer:
    """CSV gzip découpé en parties si un fichier dépasse MAX (produits.csv.gz, puis produits-2.csv.gz…)."""
    def __init__(self, stem, header):
        self.stem, self.header, self.files, self.rows = stem, header, [], 0
        self._open()

    def _open(self):
        n = len(self.files) + 1
        name = f"{self.stem}.csv.gz" if n == 1 else f"{self.stem}-{n}.csv.gz"
        self.files.append({"file": name, "rows": 0})
        self.raw = open(os.path.join(OUT, name), "wb")
        # mtime=0 : même contenu → même fichier (pas de faux changement dans git)
        self.gz = gzip.GzipFile(filename="", fileobj=self.raw, mode="wb", compresslevel=9, mtime=0)
        self.txt = io.TextIOWrapper(self.gz, encoding="utf-8", newline="")
        self.w = csv.writer(self.txt, lineterminator="\n")
        self.w.writerow(self.header)

    def row(self, r):
        self.w.writerow(r)
        self.files[-1]["rows"] += 1
        self.rows += 1
        if self.files[-1]["rows"] % 5000 == 0:
            self.txt.flush()
            if self.raw.tell() > MAX * 0.95:
                self.close_one(); self._open()

    def close_one(self):
        self.txt.close()  # ferme aussi gz et raw
        f = self.files[-1]
        f["bytes"] = os.path.getsize(os.path.join(OUT, f["file"]))

    def close(self):
        self.close_one()
        return self.files


def main():
    db_path, src_path = P("catalog_db"), P("catalog_sources_db")
    for f in (db_path, src_path):
        if not os.path.exists(f):
            sys.exit("introuvable : " + f)
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):  # anciens exports
        if f.endswith(".csv.gz"):
            os.remove(os.path.join(OUT, f))

    sdb = sqlite3.connect(f"file:{src_path}?mode=ro", uri=True)
    SRC = {}
    for g, s in sdb.execute("select gtin, source from product_sources"):
        SRC.setdefault(g, set()).add(s)
    # lieu de fabrication : seulement s'il vient d'Open Food Facts (origin.json garde la source à côté du pays)
    origin_ok = {}
    ofile = os.path.normpath(os.path.join(os.path.dirname(src_path), "origin.json"))
    if os.path.exists(ofile):
        for g, v in json.load(open(ofile, encoding="utf-8")).items():
            origin_ok[g] = bool(v) and len(v) > 1 and "Open Food Facts" in str(v[1])

    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    have = {r[1] for r in db.execute("pragma table_info(p)")}
    missing = [c for c in COLS if c not in have]
    if missing:
        sys.exit("colonnes absentes de la table p : " + ", ".join(missing))

    prod = Writer("produits", COLS + ["sources"])
    prices = Writer("prix-open-prices", ["gtin", "price", "currency", "store", "date", "url"])
    stats = {"sans_source": 0, "origine_retiree": 0, "prix_boutiques_exclus": 0, "par_source": {}}
    q = "select " + ", ".join(COLS) + ", price, cur, store, pdate, purl from p order by gtin"
    for r in db.execute(q):
        g = r[0]
        srcs = SRC.get(g)
        if not srcs or not srcs <= set(LABEL):
            stats["sans_source"] += 1
            continue
        r = list(r)
        i = COLS.index("origin")
        if r[i] and not origin_ok.get(g, False):
            r[i] = None
            stats["origine_retiree"] += 1
        key = "+".join(sorted(srcs))
        stats["par_source"][key] = stats["par_source"].get(key, 0) + 1
        prod.row([fmt(v) for v in r[:len(COLS)]] + [" | ".join(LABEL[s] for s in sorted(srcs))])
        price, cur, store, pdate, purl = r[len(COLS):]
        if price is not None:
            if (purl or "").startswith(OPEN_PRICES):
                prices.row([g, fmt(price), cur or "", store or "", pdate or "", purl])
            else:
                stats["prix_boutiques_exclus"] += 1
    files = prod.close() + prices.close()

    today = date.today().isoformat()
    name = CFG["name"]
    lis = f"""Base de produits dérivée de {name} — export du {today}
==========================================================

Fichiers (CSV, UTF-8, séparateur virgule, compressés en gzip) :
{chr(10).join(f"  - {f['file']} : {f['rows']} lignes, {f['bytes']} octets" for f in files)}

LICENCE : Open Database License (ODbL) 1.0
Texte officiel : https://opendatacommons.org/licenses/odbl/1-0/
Les contenus individuels de la base (valeurs, textes) sont sous Database Contents License (DbCL) 1.0 :
https://opendatacommons.org/licenses/dbcl/1-0/

En résumé (ce résumé n'a pas de valeur juridique ; seul le texte officiel fait foi), vous pouvez :
  - copier, distribuer et utiliser la base ;
  - créer des œuvres à partir de la base ;
  - modifier, transformer et construire à partir de la base ;
à condition de :
  - citer la source (attribution ci-dessous) ;
  - partager à l'identique : toute version modifiée de la base utilisée publiquement doit aussi être
    proposée sous ODbL ;
  - garder l'accès ouvert : si vous diffusez la base avec des mesures techniques de protection (DRM),
    proposez aussi une version sans ces mesures.

ATTRIBUTION (à reproduire) :
  © les contributeurs d'Open Food Facts — https://world.openfoodfacts.org — ODbL 1.0.
  Prix collaboratifs : Open Prices (Open Food Facts) — https://prices.openfoodfacts.org — ODbL 1.0.
  Étiquettes américaines : Dietary Supplement Label Database (DSLD), Office of Dietary Supplements,
  National Institutes of Health (États-Unis) — https://dsld.od.nih.gov — domaine public.
  Aliments de marque (États-Unis) : USDA FoodData Central — https://fdc.nal.usda.gov — domaine public (CC0 1.0).
  Base dérivée assemblée par {name}.

La colonne « sources » indique d'où vient chaque produit. Les produits venant seulement du DSLD ou de
FoodData Central sont dans le domaine public ; ils sont publiés ici avec le reste, sous ODbL, comme
une seule base.

COLONNES de produits.csv.gz :
  gtin              code-barres sur 14 chiffres (zéros à gauche)
  name, brand       nom et marque
  cat               catégorie attribuée par {name} (whey, creatine, magnesium…)
  quantity          contenance indiquée
  serving_size      portion indiquée
  dose_g / dose_n / dose_u   dose par prise retenue par {name} (grammes, ou nombre d'unités + unité)
  dose_src          origine de la dose : etiquette, photo (lue sur la photo de l'étiquette), texte,
                    unite (produit à l'unité), habituelle (valeur type choisie par {name}, pas l'étiquette)
  kcal_100g, protein_100g, sugars_100g, carbs_100g        pour 100 g
  kcal_serving, protein_serving, sugars_serving, carbs_serving  par portion
  additives_n       nombre d'additifs
  bio               1 si un label bio est indiqué
  ingredients_text  liste des ingrédients (coupée à 700 caractères)
  origin            pays de fabrication (code ISO), seulement s'il vient d'Open Food Facts
  sources           bases d'origine du produit

COLONNES de prix-open-prices.csv.gz : gtin, price, currency, store, date, url (page Open Prices).

NON INCLUS : les prix relevés sur les sites des boutiques (autres conditions d'utilisation), les notes
calculées par {name} (œuvres produites, art. 4.3 de l'ODbL), les photos.

Données fournies sans garantie d'exactitude ni d'exhaustivité. Signaler une erreur : voir la page
Support du site.
"""
    open(os.path.join(OUT, "LISEZMOI.txt"), "w", encoding="utf-8").write(lis)
    json.dump({"date": today, "files": files, "stats": stats}, open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    for f in files:
        print(f"{f['file']:28s} {f['rows']:7d} lignes  {f['bytes'] / 1048576:6.2f} Mo")
        assert f["bytes"] < MAX, "fichier trop gros : " + f["file"]
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
