// Génère le site statique (GitHub Pages) depuis les modèles ci-dessous.
// Nom de l'app et adresse : _build/site.json (seul endroit à modifier).
// Textes légaux : lus dans mobile/src/data/legal.ts (+ traduction anglaise mobile/src/i18n/extra/legal.ts), jamais recopiés à la main.
// Lancer depuis n'importe où : node site/_build/build.js   (après python3 site/_build/export_odbl.py pour la page donnees/)
// Ne modifie rien dans mobile/ : lecture seule.
'use strict';
const fs = require('fs'), path = require('path');
const HERE = __dirname, SITE = path.resolve(HERE, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(HERE, 'site.json'), 'utf8'));
const P = (k) => path.resolve(HERE, CFG[k]);
const ts = require(P('typescript'));

const load = (f) => {
  const js = ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, () => ({}));
  return m.exports;
};
const L = load(P('legal_ts'));
const EN = { ...load(P('legal_en_ts')).extra.en, ...load(path.resolve(path.dirname(P('legal_en_ts')), 'accord1711.ts')).extra.en }; // + accord Mes traitements (17 nov. 2026)
const LIBS = JSON.parse(fs.readFileSync(P('licenses_json'), 'utf8'));

const NAME = CFG.name;
const BASE = CFG.base_url.endsWith('/') ? CFG.base_url : CFG.base_url + '/';
if (!/^https:\/\/[^\s"'<>]+\/$/.test(BASE)) throw new Error('base_url invalide : ' + BASE);
const BASE_PATH = new URL(BASE).pathname; // « /scan-app-site/ » (pour la page 404 seulement)
const EDITOR = L.LEGAL.editor.trim();
const EMAIL = L.safeEmail(L.LEGAL.email.trim());
if (!EDITOR || !EMAIL) throw new Error('LEGAL.editor / LEGAL.email vides dans legal.ts');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = {
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const date = (k, lang) => { const [y, m, d] = k.split('-').map(Number); return `${d} ${MONTHS[lang][m - 1]} ${y}`; };
const brandHtml = () => { const m = NAME.match(/^(.*?)([.!]?)$/); return `${esc(m[1])}<span>${esc(m[2])}</span>`; };
const mail = () => `<a href="mailto:${esc(EMAIL)}">${esc(EMAIL)}</a>`;
const ext = (u, label) => `<a href="${esc(u)}" rel="noopener">${esc(label || u.replace(/^https:\/\//, '').replace(/\/$/, ''))}</a>`;
const mo = (b) => (b / 1048576).toFixed(1).replace('.', ',') + ' Mo';

/* ---------- squelette commun ---------- */
// dir : dossier de la page (« » pour la racine). Liens relatifs, sauf la 404 (servie à n'importe quelle adresse).
function page({ dir, lang, title, desc, body, other, comment, abs }) {
  const depth = dir ? dir.split('/').length : 0;
  const r = abs ? BASE_PATH : '../'.repeat(depth);
  const href = (d) => (d ? `${r}${d}/` : (r || './'));
  const T = lang === 'en'
    ? { home: 'Home', privacy: ['Privacy', 'privacy'], legal: 'Legal notice (FR)', sources: 'Sources (FR)', support: 'Support', data: 'Open data (FR)' }
    : { home: 'Accueil', privacy: ['Confidentialité', 'confidentialite'], legal: 'Mentions légales', sources: 'Sources et licences', support: 'Support', data: 'Données ouvertes' };
  const nav = [[T.privacy[0], T.privacy[1]], [T.legal, 'mentions-legales'], [T.sources, 'sources'], [T.data, 'donnees'], [T.support, 'support']]
    .map(([t, d]) => `<a href="${href(d)}">${esc(t)}</a>`).join('\n');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="referrer" content="no-referrer">
<link rel="stylesheet" href="${r}style.css">
<link rel="icon" href="${r}favicon.svg" type="image/svg+xml">
${abs ? '' : `<link rel="canonical" href="${BASE}${dir ? dir + '/' : ''}">\n`}</head>
<body>
${comment ? `<!--\n${comment}\n-->\n` : ''}<header class="top"><div class="wrap">
<a class="brand" href="${href('')}" aria-label="${esc(NAME)} : ${esc(T.home)}">${brandHtml()}</a>
${other ? `<a class="lang" href="${href(other[1])}" hreflang="${other[2]}" lang="${other[2]}">${esc(other[0])}</a>` : ''}
</div></header>
<main><div class="wrap">
${body}
</div></main>
<footer class="bottom"><div class="wrap">
<nav aria-label="${lang === 'en' ? 'Site' : 'Pages du site'}">
${nav}
</nav>
<p>${esc(NAME)} &#183; ${esc(EDITOR)} &#183; ${mail()}</p>
</div></footer>
</body>
</html>
`;
}

const out = [];
const write = (rel, html) => {
  const f = path.join(SITE, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html, 'utf8');
  out.push([rel, Buffer.byteLength(html)]);
};

/* ---------- note interne : à faire avant d'activer la publicité (docs/legal-et-argent/README monétisation.md) ---------- */
const ADS_TODO = `NOTE INTERNE (non affichée) : à mettre à jour AVANT d'activer la publicité (docs/legal-et-argent/README monétisation.md).
La publicité n'existe pas encore : rien n'est écrit ici à son sujet, volontairement.
Le jour où AdMob est activé, modifier d'abord mobile/src/data/legal.ts (puis relancer ce générateur) :
- « En bref » : retirer « Aucune publicité » ; dire que la version gratuite affiche des publicités (sauf achat « sans pub »).
- Nouvelle section « Publicité » : régie Google AdMob (Google Ireland Limited) ; données reçues par Google :
  identifiant publicitaire (IDFA sur iPhone si l'utilisateur l'autorise via ATT, AAID sur Android), adresse IP,
  informations sur l'appareil, interactions avec la publicité ; aucune donnée du profil ni de santé n'est transmise ;
  catégories bloquées (santé et compléments, alcool, jeux d'argent, rencontres, politique).
- Consentement : formulaire Google UMP (TCF, obligatoire dans l'EEE, au Royaume-Uni et en Suisse) ; sur iPhone,
  fenêtre ATT d'Apple ; sans accord : publicités non personnalisées ; comment retirer son accord dans l'app.
- Bases légales : consentement (art. 6.1.a RGPD et ePrivacy) pour la pub personnalisée ; intérêt légitime ou
  consentement selon le TCF pour la pub non personnalisée.
- Transferts hors UE : Google LLC (États-Unis), Data Privacy Framework / clauses contractuelles types.
- Achat « sans pub » : paiement traité par Apple ou Google ; l'éditeur ne reçoit aucune donnée de paiement.
- Durées de conservation côté Google (renvoyer vers sa politique).
- Mentions légales : retirer « aucune publicité » (ABOUT) ; ajouter statut professionnel, numéro KvK ou SIREN, adresse.
- Hors site : étiquettes de confidentialité de l'App Store, « Sécurité des données » du Play Store, app-ads.txt.`;

/* ---------- politique de confidentialité (même rendu que mobile/scripts/legal/html.js) ---------- */
function privacy(lang) {
  const tr = (s) => {
    if (lang === 'fr') return s;
    if (EN[s] === undefined) throw new Error('traduction anglaise manquante : ' + s);
    return EN[s];
  };
  const W = lang === 'fr'
    ? { title: `Politique de confidentialité de ${NAME}`, upd: 'Dernière mise à jour', ver: 'version', when: 'Quand', what: 'Ce qui est envoyé', who: 'Opéré par', svc: 'Service', editor: 'Éditeur', contact: 'Contact', note: "Ce texte est celui affiché dans l'application (Profil › Réglages › Confidentialité)." }
    : { title: `${NAME} privacy policy`, upd: 'Last updated', ver: 'version', when: 'When', what: 'What is sent', who: 'Operated by', svc: 'Service', editor: 'Publisher', contact: 'Contact', note: 'This is the same text as in the app (Profile › Settings › Privacy).' };
  const sections = L.PRIVACY.map((s, i) => {
    let h = `<h2>${i + 1}. ${esc(tr(s.t))}</h2>\n` + s.p.map((p) => `<p>${esc(tr(p))}</p>`).join('\n');
    if (s.contact) h += `\n<p><strong>${esc(W.editor)}</strong> : ${esc(EDITOR)}<br><strong>${esc(W.contact)}</strong> : ${mail()}</p>`;
    if (s.svc) h += `\n<table class="stack">\n<thead><tr><th>${esc(W.svc)}</th><th>${esc(W.when)}</th><th>${esc(W.what)}</th><th>${esc(W.who)}</th></tr></thead>\n<tbody>\n`
      + s.svc.map((v) => `<tr><td>${esc(tr(v.name))}</td><td>${esc(tr(v.when))}</td><td>${esc(tr(v.what))}</td><td>${esc(tr(v.who))}</td></tr>`).join('\n') + '\n</tbody>\n</table>';
    return `<section>\n${h}\n</section>`;
  }).join('\n');
  const body = `<h1>${esc(W.title)}</h1>
<p class="meta">${esc(W.upd)} : ${esc(date(L.PRIVACY_DATE, lang))} &#183; ${esc(W.ver)} ${esc(L.PRIVACY_VERSION)}</p>
<div class="card accent">
<h2>${esc(tr('En bref'))}</h2>
${L.PRIVACY_BRIEF.map((p) => `<p>${esc(tr(p))}</p>`).join('\n')}
</div>
${sections}
<p class="small">${esc(W.note)}</p>`;
  return page({
    dir: lang === 'fr' ? 'confidentialite' : 'privacy', lang, title: W.title, body, comment: ADS_TODO,
    desc: lang === 'fr' ? `Comment ${NAME} traite vos données : pas de serveur, pas de compte.` : `How ${NAME} handles your data: no server, no account.`,
    other: lang === 'fr' ? ['English', 'privacy', 'en'] : ['Français', 'confidentialite', 'fr'],
  });
}

/* ---------- accueil ---------- */
function home() {
  const body = `<h1>${esc(CFG.tagline_fr)}</h1>
<p class="lead">${esc(NAME)} est une application gratuite pour iPhone et Android. Scannez le code-barres d'un complément alimentaire : vous voyez sa note, ce que contient l'étiquette et les alertes utiles.</p>
<div class="card">
<h2>Ce que fait l'app</h2>
<ul class="plain">
<li><strong>Une note de 15 à 98</strong>, calculée seulement sur l'étiquette : jamais d'après une marque ou un paiement. Le détail est affiché sous chaque note.</li>
<li><strong>Des alertes</strong> : allergènes, surdosage, interactions connues avec des familles de médicaments, rappels officiels de produits.</li>
<li><strong>Des repères</strong> : doses de référence, classements par catégorie, magasins proches.</li>
</ul>
</div>
<div class="card">
<h2>Sans compte, sans serveur</h2>
<p>L'app est gratuite et ne demande aucun compte. Ce que vous saisissez (profil, placard, traitements, allergies) reste sur votre téléphone : l'éditeur n'y a jamais accès.</p>
<p><a href="confidentialite/">Lire la politique de confidentialité</a></p>
</div>
<div class="card">
<h2>Bientôt disponible</h2>
<p>${esc(NAME)} arrive bientôt sur l'App Store et sur Google Play.</p>
<p><span class="soon">App Store : bientôt</span> <span class="soon">Google Play : bientôt</span></p>
</div>
<div class="card">
<p><strong>${esc(L.DISCLAIMER_TITLE)}</strong> ${esc(L.DISCLAIMER_SHORT)} ${esc(L.ADULTS_ONLY)}</p>
</div>
<ul class="pills">
<li><a href="confidentialite/">Confidentialité</a></li>
<li><a href="mentions-legales/">Mentions légales et CGU</a></li>
<li><a href="sources/">Sources et licences</a></li>
<li><a href="donnees/">Données ouvertes</a></li>
<li><a href="support/">Support</a></li>
</ul>
<div class="card" lang="en">
<h2>In English</h2>
<p>${esc(NAME)} is a free app that scores dietary supplements from their label. No account, no server: your data stays on your phone. Coming soon to the App Store and Google Play.</p>
<p><a href="privacy/">Privacy policy</a> &#183; Support: ${mail()}</p>
</div>`;
  return page({ dir: '', lang: 'fr', title: `${NAME} : compléments alimentaires, la note de l'étiquette`, desc: `${NAME} : ${CFG.tagline_fr} Gratuit, sans compte.`, body, other: ['English', 'privacy', 'en'] });
}

/* ---------- mentions légales, avertissement, méthode, CGU ---------- */
function mentions() {
  const body = `<h1>Mentions légales et conditions d'utilisation</h1>
<p class="meta">Dernière mise à jour des conditions : ${esc(date(L.TERMS_DATE, 'fr'))}</p>
<section>
<h2>Éditeur</h2>
<p><strong>Éditeur de l'application et du site</strong> : ${esc(EDITOR)}, particulier.<br>
<strong>Contact</strong> : ${mail()}</p>
</section>
<section>
<h2>Hébergement</h2>
<p><strong>Ce site</strong> est hébergé par GitHub Pages : GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis (${ext('https://github.com')}).</p>
${L.ABOUT.map((p) => `<p>${esc(p)}</p>`).join('\n')}
</section>
<section>
<h2>${esc(L.LEGAL_TITLES.avertissement)}</h2>
${L.DISCLAIMER_FULL.map((p) => `<p>${esc(p)}</p>`).join('\n')}
<p><strong>${esc(L.ADULTS_ONLY)}</strong></p>
</section>
<section>
<h2>Comment nous notons</h2>
${L.METHOD.map((p) => `<p>${esc(p)}</p>`).join('\n')}
</section>
<section>
<h2>Conditions d'utilisation</h2>
${L.TERMS.map((s) => `<h3>${esc(s.t)}</h3>\n${s.p.map((p) => `<p>${esc(p)}</p>`).join('\n')}`).join('\n')}
<p class="small">L'adresse de contact : ${mail()}. Dernière mise à jour : ${esc(date(L.TERMS_DATE, 'fr'))}.</p>
</section>
<p class="small">Voir aussi : <a href="../confidentialite/">Confidentialité</a> &#183; <a href="../sources/">Sources et licences</a>.</p>`;
  return page({ dir: 'mentions-legales', lang: 'fr', title: `Mentions légales et CGU de ${NAME}`, desc: `Éditeur, hébergeur, avertissement médical et conditions d'utilisation de ${NAME}.`, body, comment: ADS_TODO });
}

/* ---------- sources et licences + ODbL ---------- */
function sources() {
  const row = (s) => `<li><strong>${esc(s.b)}</strong><br>${esc(s.t)}${L.safeUrl(s.u) ? `<br>${ext(s.u)}` : ''}</li>`;
  const lic = [...new Set(LIBS.map((x) => x.l))].join(', ');
  const body = `<h1>${esc(L.LEGAL_TITLES.sources)}</h1>
<p class="lead">D'où viennent les données affichées par ${esc(NAME)}, et sous quelle licence.</p>
<section>
<h2>Données</h2>
<ul class="plain">
${L.SOURCES.map(row).join('\n')}
</ul>
</section>
<section class="accent" id="odbl">
<h2>Copie de la base (ODbL)</h2>
<p>${esc(L.ODBL_COPY)}</p>
<p>Comme le demande l'Open Database License, la base de produits dérivée d'Open Food Facts (avec les étiquettes du NIH DSLD et de l'USDA FoodData Central, du domaine public, et les prix collaboratifs Open Prices) est publiée sous <strong>ODbL 1.0</strong>, au format CSV. Les prix relevés sur les sites des boutiques n'en font pas partie.</p>
<p><a href="../donnees/">Télécharger la base et lire la licence</a> &#183; ${ext('https://opendatacommons.org/licenses/odbl/1-0/', 'texte officiel de l\'ODbL 1.0')}</p>
</section>
<section>
<h2>À savoir</h2>
<ul class="plain">
${L.NOTICES.map(row).join('\n')}
</ul>
</section>
<section>
<h2>Polices</h2>
<p>${esc(L.FONTS_NOTICE)}</p>
<details><summary>Texte de la licence (anglais)</summary><pre lang="en">${esc(L.OFL_TEXT)}</pre></details>
</section>
<section>
<h2>Logiciels libres</h2>
<p>${LIBS.length} bibliothèques open source. Licence : ${esc(lic)}.</p>
<details><summary>Liste des bibliothèques</summary>
<ul class="plain" style="margin-top:10px">
${LIBS.map((x) => `<li><strong>${esc(x.n)} ${esc(x.v)}</strong><br><span class="small">${esc([x.l, x.c].filter(Boolean).join(' · '))}${L.safeUrl(x.u) ? ` · ${ext(x.u)}` : ''}</span></li>`).join('\n')}
</ul>
</details>
<details><summary>Texte de la licence MIT (anglais)</summary><pre lang="en">${esc(L.MIT_TEXT)}</pre></details>
<p class="small" style="margin-top:10px">Dépendances directes de l'app. Chaque bibliothèque garde sa propre licence.</p>
</section>`;
  return page({ dir: 'sources', lang: 'fr', title: `Sources et licences de ${NAME}`, desc: `Origine des données de ${NAME} et licences (ODbL, domaine public, Licence Ouverte).`, body });
}

/* ---------- données ouvertes (lit donnees/manifest.json produit par export_odbl.py) ---------- */
function donnees() {
  const mf = path.join(SITE, 'donnees', 'manifest.json');
  if (!fs.existsSync(mf)) throw new Error('lancer d\'abord : python3 _build/export_odbl.py');
  const M = JSON.parse(fs.readFileSync(mf, 'utf8'));
  for (const f of M.files) if (!fs.existsSync(path.join(SITE, 'donnees', f.file))) throw new Error('fichier manquant : ' + f.file);
  const nb = (n) => n.toLocaleString('fr-FR').replace(/ | /g, ' ');
  const body = `<h1>Base de produits ouverte</h1>
<p class="lead">La base de produits utilisée par ${esc(NAME)}, en téléchargement libre et gratuit sous Open Database License (ODbL) 1.0.</p>
<section>
<h2>Fichiers</h2>
<p class="small">Export du ${esc(date(M.date, 'fr'))}. CSV en UTF-8, séparateur virgule, compressé en gzip (s'ouvre avec la plupart des tableurs après décompression).</p>
<ul class="plain">
${M.files.map((f) => `<li><a href="${esc(f.file)}" download>${esc(f.file)}</a><br><span class="small">${nb(f.rows)} lignes &#183; ${mo(f.bytes)}</span></li>`).join('\n')}
<li><a href="LISEZMOI.txt">LISEZMOI.txt</a><br><span class="small">Licence, attribution et description des colonnes.</span></li>
</ul>
</section>
<section>
<h2>Licence</h2>
<p>La base est mise à disposition sous la licence <strong>Open Database License (ODbL) 1.0</strong> : ${ext('https://opendatacommons.org/licenses/odbl/1-0/')}. Les contenus individuels (valeurs, textes) sont sous Database Contents License (DbCL) 1.0 : ${ext('https://opendatacommons.org/licenses/dbcl/1-0/')}.</p>
<p>En résumé (seul le texte officiel fait foi), vous pouvez copier, distribuer, utiliser et modifier la base, et créer des œuvres à partir d'elle, à condition de :</p>
<ul>
<li><strong>citer la source</strong> (attribution ci-dessous) ;</li>
<li><strong>partager à l'identique</strong> : une version modifiée de la base utilisée publiquement doit aussi être proposée sous ODbL ;</li>
<li><strong>garder l'accès ouvert</strong> : si vous la diffusez avec des protections techniques, proposez aussi une version sans protection.</li>
</ul>
</section>
<section>
<h2>Attribution</h2>
<p>© les contributeurs d'Open Food Facts, ${ext('https://world.openfoodfacts.org')}, ODbL 1.0.<br>
Prix collaboratifs : Open Prices (Open Food Facts), ${ext('https://prices.openfoodfacts.org')}, ODbL 1.0.<br>
Étiquettes américaines : Dietary Supplement Label Database (DSLD), Office of Dietary Supplements, National Institutes of Health, ${ext('https://dsld.od.nih.gov')}, domaine public.<br>
Aliments de marque (États-Unis) : USDA FoodData Central, ${ext('https://fdc.nal.usda.gov')}, domaine public (CC0 1.0).</p>
<p>La colonne « sources » de chaque produit indique sa base d'origine.</p>
</section>
<section>
<h2>Ce qui n'est pas inclus</h2>
<p>Les prix relevés sur les sites des boutiques (autres conditions d'utilisation), les notes calculées par ${esc(NAME)} et les photos.</p>
<p class="small">Données fournies sans garantie d'exactitude ni d'exhaustivité. Une erreur ? Écrivez à ${mail()} avec le code-barres du produit.</p>
</section>`;
  return page({ dir: 'donnees', lang: 'fr', title: `Base de produits ouverte (ODbL) de ${NAME}`, desc: `Téléchargez la base de produits de ${NAME} sous licence ODbL 1.0.`, body });
}

/* ---------- support ---------- */
function support() {
  const q = (t, ...p) => `<section>\n<h2>${esc(t)}</h2>\n${p.map((x) => `<p>${x}</p>`).join('\n')}\n</section>`;
  const body = `<h1>Support</h1>
<div class="card accent">
<p>Une question, un problème, une erreur dans une fiche ? Écrivez à ${mail()}.</p>
<p class="small" lang="en">Questions in English are welcome at the same address.</p>
</div>
${q('Faut-il un compte ? Est-ce payant ?', `Non. ${esc(NAME)} est gratuit et ne demande aucun compte.`)}
${q('Comment supprimer mes données ?',
    `Vos données sont seulement sur votre téléphone. Pour les effacer : dans l'app, Profil › « Tout effacer ». Vous pouvez aussi désinstaller l'app : tout ce qu'elle a enregistré sur le téléphone disparaît.`,
    `Si la sauvegarde de votre téléphone (iCloud ou Google) est activée, une copie peut s'y trouver : elle est gérée par Apple ou Google, sous votre compte.`,
    `L'éditeur ne détient aucune de vos données : il n'a rien à effacer de son côté. <a href="../confidentialite/">Politique de confidentialité</a>.`)}
${q('Signaler une erreur de note ou de donnée',
    `Écrivez à ${mail()} en indiquant le <strong>code-barres</strong> du produit (les chiffres sous les barres), son nom et ce qui vous semble faux. Une photo de l'étiquette aide beaucoup.`,
    `La note dépend seulement de l'étiquette. Une note basse peut venir d'une fiche incomplète : une donnée manquante rapporte 0 point. Les marques peuvent aussi demander une correction.`,
    `Beaucoup de fiches viennent d'Open Food Facts, une base collaborative : vous pouvez aussi y corriger le produit (${ext('https://world.openfoodfacts.org')}).`)}
${q('Un produit est introuvable',
    `Si un code-barres n'est pas dans la base de l'app, elle le cherche sur Open Food Facts. S'il n'y est pas non plus, vous pouvez l'y ajouter : il sera dans une prochaine mise à jour de la base.`)}
${q('Un avis médical ?',
    `Non. ${esc(L.DISCLAIMER_SHORT)} <a href="../mentions-legales/">Avertissement médical complet</a>.`)}`;
  return page({ dir: 'support', lang: 'fr', title: `Support de ${NAME}`, desc: `Contact et questions fréquentes sur ${NAME}.`, body });
}

/* ---------- 404 (servie à n'importe quelle adresse : liens absolus) ---------- */
function notFound() {
  const body = `<h1>Page introuvable</h1>
<p class="lead">Cette page n'existe pas, ou a changé d'adresse.</p>
<p><a href="${BASE_PATH}">Retour à l'accueil</a></p>
<p class="small" lang="en">Page not found. <a href="${BASE_PATH}">Home</a></p>`;
  return page({ dir: '', lang: 'fr', title: `Page introuvable · ${NAME}`, desc: 'Page introuvable.', body, abs: true });
}

/* ---------- génération ---------- */
fs.copyFileSync(path.join(HERE, 'style.css'), path.join(SITE, 'style.css'));
out.push(['style.css', fs.statSync(path.join(SITE, 'style.css')).size]);
write('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#8c3b2e"/><circle cx="32" cy="32" r="9" fill="#f4f4f3"/></svg>\n`);
write('index.html', home());
write('confidentialite/index.html', privacy('fr'));
write('privacy/index.html', privacy('en'));
write('mentions-legales/index.html', mentions());
write('sources/index.html', sources());
write('donnees/index.html', donnees());
write('support/index.html', support());
write('404.html', notFound());
write('.nojekyll', '');
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${BASE}sitemap.xml\n`);
const PAGES = ['', 'confidentialite/', 'privacy/', 'mentions-legales/', 'sources/', 'donnees/', 'support/'];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PAGES.map((p) => `<url><loc>${BASE}${p}</loc></url>`).join('\n')}\n</urlset>\n`);
// app-ads.txt : jamais écrasé s'il contient déjà une vraie ligne (identifiant AdMob ajouté à la main)
const ads = path.join(SITE, 'app-ads.txt');
if (!fs.existsSync(ads) || !/pub-\d{16}/.test(fs.readFileSync(ads, 'utf8'))) {
  write('app-ads.txt', '# À compléter avec l\'identifiant AdMob (google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0)\n');
}
if (!fs.existsSync(path.join(SITE, 'updates', '.gitkeep'))) write('updates/.gitkeep', '');

/* ---------- vérifications : liens relatifs, ressources externes, e-mail ---------- */
let bad = 0;
const htmlFiles = out.map((x) => x[0]).filter((f) => f.endsWith('.html'));
for (const rel of htmlFiles) {
  const html = fs.readFileSync(path.join(SITE, rel), 'utf8');
  if (!/<meta charset="utf-8">/.test(html) || !/name="viewport"/.test(html) || !/<html lang="(fr|en)">/.test(html)) { console.error('en-tête incomplet :', rel); bad++; }
  if (/<script|<iframe|@import|fonts\.googleapis|cdn\./i.test(html)) { console.error('ressource externe ou script :', rel); bad++; }
  const mails = html.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || [];
  for (const m of mails) if (m !== EMAIL) { console.error('adresse e-mail inattendue :', m, rel); bad++; }
  for (const [, u] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https:|mailto:)/.test(u)) continue;
    if (/^http:/.test(u)) { console.error('lien http :', u, rel); bad++; continue; }
    let target;
    if (u.startsWith('/')) {
      if (!u.startsWith(BASE_PATH)) { console.error('lien absolu hors du site :', u, rel); bad++; continue; }
      target = path.join(SITE, u.slice(BASE_PATH.length));
    } else target = path.join(SITE, path.dirname(rel), u.split('#')[0]);
    if (u.endsWith('/') || u === './' || fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) { console.error('lien cassé :', u, 'dans', rel); bad++; }
  }
}
for (const [f, n] of out) console.log(`${f.padEnd(30)} ${String(n).padStart(7)} octets`);
if (bad) { console.error(bad + ' problème(s)'); process.exit(1); }
console.log(`OK : ${htmlFiles.length} pages, adresse ${BASE}`);
