# Site de l'app (GitHub Pages)

Site statique de l'app : présentation, politique de confidentialité (fr et en), mentions légales et CGU, sources et licences, base de produits ouverte (ODbL), support.

Adresse prévue : **https://clementpepinlehalleur.github.io/scan-app-site/**

Rien n'est encore publié : pas de dépôt GitHub, pas de `git push`.

## Ce qu'il y a dans le dossier

| Chemin | Contenu |
|---|---|
| `index.html` | Accueil : ce que fait l'app, gratuite, sans compte, données sur le téléphone, « bientôt sur l'App Store et Google Play » |
| `confidentialite/` · `privacy/` | Politique de confidentialité en français et en anglais : le même texte que dans l'app |
| `mentions-legales/` | Éditeur, contact, hébergeur, avertissement médical, « Comment nous notons », conditions d'utilisation |
| `sources/` | Sources et licences (comme l'écran de l'app) + section ODbL |
| `donnees/` | La base de produits sous ODbL : `produits.csv.gz`, `prix-open-prices.csv.gz`, `LISEZMOI.txt` (licence), `manifest.json` |
| `support/` | E-mail et questions fréquentes |
| `app-ads.txt` | À compléter avec l'identifiant AdMob (voir plus bas) |
| `updates/` | Réservé aux mises à jour de la base de produits (format préparé à part). Vide pour l'instant (`.gitkeep`) |
| `404.html`, `.nojekyll`, `robots.txt`, `sitemap.xml`, `style.css`, `favicon.svg` | Fichiers techniques |
| `_build/` | Le générateur : `site.json` (réglages), `build.js` (pages), `export_odbl.py` (base ODbL), `style.css` (modèle) |

Aucun JavaScript, aucune police ni ressource externe, aucun traceur. Mode sombre automatique.

## Publier (la première fois)

1. Sur GitHub, connecté au compte **clementpepinlehalleur** : **New repository** › nom **`scan-app-site`** › **Public** › sans README › **Create**.
2. Dans un terminal :
   ```
   cd /root/app/site
   git init -b main
   git add .
   git commit -m "Site de l'app"
   git remote add origin https://github.com/clementpepinlehalleur/scan-app-site.git
   git push -u origin main
   ```
3. Sur GitHub, dans le dépôt : **Settings › Pages** › « Build and deployment » › Source : **Deploy from a branch** › Branch : **main**, dossier **/ (root)** › **Save**.
4. Une à deux minutes plus tard, le site est en ligne à l'adresse ci-dessus. Vérifier chaque page.
5. Mettre ensuite les liens dans l'app (`LEGAL_URLS` dans `mobile/src/data/legal.ts`) et dans les consoles Apple et Google (URL de confidentialité, URL d'assistance).

Remarque : le dossier `_build/` est publié lui aussi (il ne contient rien de secret). Pour le cacher, on peut le sortir du dépôt.

## Mettre à jour les pages

Les textes légaux ne sont **jamais recopiés à la main** : ils sont lus dans l'app (`mobile/src/data/legal.ts`, et la traduction anglaise dans `mobile/src/i18n/extra/legal.ts`). Après un changement de ces textes, ou une nouvelle base de produits :

```
cd /root/app/site
python3 _build/export_odbl.py     # refait donnees/ depuis mobile/assets/data/catalog.db
node _build/build.js              # refait toutes les pages et vérifie les liens
```

`build.js` s'arrête avec un message si un lien est cassé, s'il manque une traduction anglaise, ou si une adresse e-mail autre que celle de contact apparaît. Puis `git add . && git commit -m "…" && git push`.

## Changer le nom de l'app ou l'adresse du site

Tout est dans **`_build/site.json`** :
- `name` : le nom affiché (« scan. ») ;
- `base_url` : l'adresse du site (sert à la page 404, au plan du site et aux liens « canonical ») ;
- `tagline_fr` / `tagline_en` : la phrase d'accroche de l'accueil.

Puis relancer `node _build/build.js`. Les pages utilisent des liens relatifs : elles marchent sous n'importe quelle adresse.

Attention : les textes légaux de l'app contiennent aussi le nom « scan. » : il faut les changer dans `legal.ts` (et ses traductions) en même temps. L'éditeur et l'e-mail viennent de `LEGAL` dans `legal.ts`.

Si le dépôt change de nom, l'adresse change aussi : `https://clementpepinlehalleur.github.io/<nouveau-nom>/`.

## Brancher un nom de domaine (plus tard)

1. Acheter le domaine (par exemple chez un registraire européen).
2. Chez le registraire, ajouter les enregistrements DNS :
   - pour `www.mondomaine.com` : un **CNAME** vers `clementpepinlehalleur.github.io` ;
   - pour `mondomaine.com` sans « www » : quatre enregistrements **A** vers `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (adresses publiées par GitHub, à revérifier dans leur documentation).
3. Dans le dépôt : **Settings › Pages › Custom domain** › saisir le domaine › **Save** (GitHub crée un fichier `CNAME` à la racine ; on peut aussi le créer soi-même, avec seulement le domaine sur une ligne). Cocher **Enforce HTTPS** dès que possible.
4. Mettre la nouvelle adresse dans `_build/site.json` (`base_url`, par exemple `https://mondomaine.com/`), relancer `node _build/build.js`, publier.
5. Mettre à jour `LEGAL_URLS` dans l'app et les consoles des stores. L'ancienne adresse github.io redirige vers le domaine.

## Identifiant AdMob (`app-ads.txt`)

AdMob demande un fichier `app-ads.txt` à la racine du **site du développeur** indiqué dans les fiches App Store et Google Play, pour prouver que l'app est bien la vôtre. L'identifiant éditeur AdMob n'existe pas encore, donc le fichier ne contient qu'une ligne de commentaire.

Quand le compte AdMob existe (AdMob › Apps › app-ads.txt, ou Paramètres › Informations sur le compte) :
1. Remplacer le contenu de `app-ads.txt` par **une seule ligne** :
   ```
   google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0
   ```
   (avec votre vrai numéro à 16 chiffres à la place de `1234567890123456`).
2. Publier. `build.js` ne touche plus jamais ce fichier dès qu'il contient un vrai identifiant.
3. Dans les deux consoles, l'adresse « site web du développeur » doit être la **racine** du site.

⚠️ AdMob et Google Play cherchent `app-ads.txt` à la racine du **domaine** : `https://clementpepinlehalleur.github.io/app-ads.txt`, pas `…/scan-app-site/app-ads.txt`. Avec l'adresse github.io sous-dossier, il faudra donc soit **un nom de domaine** (solution simple, le fichier est alors à la racine), soit un second dépôt nommé exactement **`clementpepinlehalleur.github.io`** contenant ce fichier. À régler avant d'activer la pub.

Avant d'activer la pub, il faut aussi mettre à jour la politique de confidentialité et les mentions légales : la liste est écrite en commentaire (invisible) dans `confidentialite/index.html` et `mentions-legales/index.html`, et dans `build.js` (`ADS_TODO`).

## Base ODbL (`donnees/`)

`export_odbl.py` lit `mobile/assets/data/catalog.db` (table `p`) et, pour savoir d'où vient chaque produit, `data/out/catalog.sqlite` (table `product_sources`). Il écrit :
- `produits.csv.gz` : tous les produits (Open Food Facts, NIH DSLD, USDA FoodData Central), avec une colonne `sources` ;
- `prix-open-prices.csv.gz` : seulement les prix Open Prices (ODbL) ;
- **sans** les prix relevés sur les sites des boutiques (autres conditions, voir l'audit légal §2.5), **sans** le lieu de fabrication quand il vient du site d'une marque, sans les notes calculées.

Un fichier ne dépasse jamais 50 Mo (au-delà, découpage automatique en `produits-2.csv.gz`…).

## Mises à jour de la base (`updates/`)

Dossier réservé aux mises à jour de la base de produits téléchargées par l'app. Le format est préparé à part ; pour l'instant le dossier est vide.
