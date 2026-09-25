// Partagé entre l'écran du matin (index.html) et l'espace parent (parent.html)
var MATIN = (function () {
  "use strict";

  // ✏️ Adresse de la base Firebase (Realtime Database). Vide = mode local, sans synchronisation.
  var DB_URL = "https://protocol-matin-default-rtdb.europe-west1.firebasedatabase.app";

  var FILLES = [
    { nom: "Lou",  couleur: "#4FD1B5" },
    { nom: "Alba", couleur: "#54A0FF" }
  ];
  var JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  var COULEURS = ["#FF9F43", "#EE5A52", "#FF6B9D", "#A55EEA", "#2E86DE", "#00B8C4", "#10AC84", "#F7B731"];

  // ---------- Routines par défaut (modifiables ensuite depuis l'espace parent) ----------
  var ROUTINE_ECOLE = {
    nom: "École", emoji: "🎒",
    jours: { "1": true, "2": true, "3": true, "4": true, "5": true },
    ecole: true,
    fin: "08:08", finEmoji: "🚌", finTitre: "Le bus",
    finVoix: "C'est l'heure du bus ! Bonne journée les filles !",
    finMessage: "Bonne journée les filles !", finSous: "❤️ À ce soir",
    etoiles: true, heureNotes: "08:06",
    etapes: [
      { debut: "07:25", titre: "Réveil + câlins à {parent}", emoji: "🤗", couleur: "#FF9F43",
        voix: "Debout les filles ! C'est l'heure des câlins à {parent} !", rappels: "voix" },
      { debut: "07:33", titre: "Petit déjeuner", emoji: "🥣", couleur: "#EE5A52",
        voix: "À table ! C'est l'heure du petit déjeuner." },
      { debut: "07:45", titre: "On s'habille", emoji: "👕", couleur: "#2E86DE",
        voix: "C'est l'heure de s'habiller !" },
      { debut: "07:50", titre: "Dents + coiffure", emoji: "🪥", couleur: "#10AC84",
        voix: "Brossage des dents et coiffure !", details: ["🪥 Les dents", "🎀 Les cheveux"] },
      { debut: "07:55", titre: "On range !", emoji: "🧺", couleur: "#A55EEA",
        voix: "On range ! Le pyjama, la veilleuse et le petit déjeuner.",
        details: ["👚 Pyjama", "💡 Veilleuse", "🥣 Petit déj"] },
      { debut: "07:58", titre: "Les chaussures", emoji: "👟", couleur: "#00B8C4",
        voix: "Les chaussures ! Vite, avant le temps libre !", rappels: "complet" },
      { debut: "08:00", titre: "Temps libre", emoji: "🎈", couleur: "#F7B731",
        voix: "Bravo les filles ! C'est le temps libre !", alerte: "Plus qu'une minute ! On file au bus !" }
    ]
  };
  var MODELE_SOIR = {
    nom: "Soir", emoji: "🌙",
    jours: { "0": true, "1": true, "2": true, "3": true, "4": true },
    ecole: false,
    fin: "20:20", finEmoji: "🛏️", finTitre: "Le dodo",
    finVoix: "C'est l'heure du dodo ! Bonne nuit les filles !",
    finMessage: "Bonne nuit les filles !", finSous: "🌙 Faites de beaux rêves",
    etoiles: false, heureNotes: "",
    etapes: [
      { debut: "19:30", titre: "Le bain", emoji: "🛁", couleur: "#00B8C4", voix: "C'est l'heure du bain !" },
      { debut: "19:50", titre: "Pyjama", emoji: "👚", couleur: "#A55EEA", voix: "On met le pyjama !" },
      { debut: "20:00", titre: "Les dents", emoji: "🪥", couleur: "#10AC84", voix: "Brossage des dents !" },
      { debut: "20:05", titre: "L'histoire", emoji: "📖", couleur: "#F7B731", voix: "Au lit, c'est l'heure de l'histoire !" }
    ]
  };

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function cleJour(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function sec(hhmm) { var p = String(hhmm || "0:0").split(":"); return (+p[0]) * 3600 + (+p[1]) * 60; }
  function copie(o) { return JSON.parse(JSON.stringify(o)); }
  function enTableau(x) {
    if (!x) return [];
    if (Array.isArray(x)) return x.filter(function (v) { return v != null; });
    return Object.keys(x).sort(function (a, b) { return +a - +b; }).map(function (k) { return x[k]; }).filter(Boolean);
  }
  function lireLocal(cle, defaut) {
    try { var b = localStorage.getItem(cle); return b ? JSON.parse(b) : defaut; } catch (e) { return defaut; }
  }
  function ecrireLocal(cle, v) {
    try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) {}
  }
  function sansEmoji(t) {
    try { return String(t).replace(new RegExp("\\p{Extended_Pictographic}|\\uFE0F|\\u200D", "gu"), "").trim(); }
    catch (e) { return t; }
  }
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // Le code famille arrive par le lien (#famille=…) et reste dans l'adresse,
  // pour que l'app ajoutée à l'écran d'accueil du téléphone le garde.
  function codeFamille() {
    var m = location.hash.match(/famille=([A-Za-z0-9_-]{24,})/);
    if (m) { ecrireLocal("matin.famille", m[1]); return m[1]; }
    return lireLocal("matin.famille", null);
  }

  // ---------- Stockage : copie locale + synchronisation Firebase en direct ----------
  // options.test : lit les vraies données (rappels, réglages) mais n'enregistre rien
  function creerStock(options) {
    options = options || {};
    var test = !!options.test;
    var code = codeFamille();
    var base = DB_URL.replace(/\/$/, "");
    var enLigne = !!(base && code);
    var cleCache = "matin.donnees";
    var arbre = lireLocal(cleCache, null) || {};
    var ecouteurs = [];
    var etat = enLigne ? "connexion" : "local";
    var synchronise = false;
    var version = 0;

    // Reprise des étoiles de la V1 (stockées sous une autre clé)
    var v1 = test ? null : lireLocal("matinDesFilles", null);
    if (!enLigne && v1 && v1.notes && !arbre.notes) arbre.notes = v1.notes;

    function morceaux(chemin) { return String(chemin).split("/").filter(Boolean); }
    function poser(chemin, valeur) {
      var p = morceaux(chemin);
      if (!p.length) { arbre = (valeur && typeof valeur === "object") ? valeur : {}; return; }
      var n = arbre;
      for (var i = 0; i < p.length - 1; i++) {
        if (typeof n[p[i]] !== "object" || n[p[i]] === null) n[p[i]] = {};
        n = n[p[i]];
      }
      if (valeur === null) delete n[p[p.length - 1]];
      else n[p[p.length - 1]] = valeur;
    }
    function lire(chemin) {
      var p = morceaux(chemin || ""), n = arbre;
      for (var i = 0; i < p.length; i++) { if (n == null) return undefined; n = n[p[i]]; }
      return n;
    }
    var testModifie = false;
    function prevenir(chemin) {
      version++;
      if (!testModifie) ecrireLocal(cleCache, arbre);
      ecouteurs.forEach(function (f) { f(chemin); });
    }
    function ecrire(chemin, valeur) {
      if (test) testModifie = true;
      poser(chemin, valeur);
      prevenir(chemin);
      if (!enLigne || test) return Promise.resolve();
      return fetch(base + "/familles/" + code + "/" + chemin + ".json", {
        method: valeur === null ? "DELETE" : "PUT",
        body: valeur === null ? undefined : JSON.stringify(valeur)
      }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); });
    }

    if (enLigne && window.EventSource) {
      var es = new EventSource(base + "/familles/" + code + ".json");
      var recevoir = function (ev, fusion) {
        var msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (!msg || typeof msg.path !== "string") return;
        if (fusion && msg.data) {
          for (var k in msg.data) poser(msg.path.replace(/\/$/, "") + "/" + k, msg.data[k]);
        } else {
          poser(msg.path, msg.data);
        }
        etat = "en ligne";
        if (!synchronise) {
          synchronise = true;
          if (v1 && v1.notes && !arbre.notes) ecrire("notes", v1.notes).catch(function () {});
        }
        prevenir(msg.path);
      };
      es.addEventListener("put", function (ev) { recevoir(ev, false); });
      es.addEventListener("patch", function (ev) { recevoir(ev, true); });
      es.onerror = function () { etat = "hors ligne"; prevenir(""); };
    }

    return {
      lire: lire,
      ecrire: ecrire,
      surChangement: function (f) { ecouteurs.push(f); },
      etat: function () { return etat; },
      synchronise: function () { return !enLigne || synchronise; },
      version: function () { return version; },
      enLigne: enLigne,
      code: code
    };
  }

  // ---------- Réglages ----------
  var AVATARS_DEFAUT = {
    Lou:  { cheveux: "blondChatain", coiffure: "queue", accessoire: "" },
    Alba: { cheveux: "blond", coiffure: "couettes", accessoire: "" }
  };
  function reglages(stock) {
    var r = stock.lire("reglages") || {};
    var avatars = {};
    FILLES.forEach(function (f) {
      var defaut = AVATARS_DEFAUT[f.nom] || { cheveux: "chatain", coiffure: "longs", accessoire: "" };
      var perso = (r.avatars && r.avatars[f.nom]) || {};
      avatars[f.nom] = {
        cheveux: perso.cheveux || defaut.cheveux,
        coiffure: perso.coiffure || defaut.coiffure,
        accessoire: perso.accessoire !== undefined ? perso.accessoire : defaut.accessoire
      };
    });
    return {
      mascotte: r.mascotte === undefined ? "🐈" : r.mascotte,
      decor: r.decor !== false,
      anniversaires: r.anniversaires || {},
      avatars: avatars
    };
  }

  // ---------- Scène animée d'une étape (même logique que l'app Apple TV) ----------
  var SCENES = ["reveil", "repas", "habits", "dents", "coiffure", "rangement", "chaussures", "jeu", "bain", "pyjama", "histoire", "etoiles"];
  function sceneDe(e) {
    if (e.scene && SCENES.indexOf(e.scene) >= 0) return e.scene;
    var t = ((e.titre || "") + " " + (e.emoji || "")).toLowerCase();
    function a(mots) { return mots.some(function (m) { return t.indexOf(m) >= 0; }); }
    if (a(["réveil", "reveil", "câlin", "calin", "🤗", "⏰"])) return "reveil";
    if (a(["déj", "dej", "repas", "goûter", "gouter", "dîner", "diner", "🥣", "🍽", "🥐"])) return "repas";
    if (a(["dent", "🪥"])) return "dents";
    if (a(["coiff", "cheveu", "🎀"])) return "coiffure";
    if (a(["pyjama", "👚"])) return "pyjama";
    if (a(["habill", "👕", "👗"])) return "habits";
    if (a(["rang", "🧺", "🧸"])) return "rangement";
    if (a(["chaussure", "👟", "manteau", "🧥"])) return "chaussures";
    if (a(["libre", "jeu", "jouer", "🎈", "🎨"])) return "jeu";
    if (a(["bain", "douche", "🛁"])) return "bain";
    if (a(["histoire", "lecture", "livre", "📖"])) return "histoire";
    return "etoiles";
  }

  // ---------- Avatars de Lou et Alba ----------
  var CHEVEUX = { blond: "#E6B656", blondChatain: "#B98A4E", chatain: "#8B5A2B", brun: "#4A2E1C", roux: "#C65A2E", noir: "#262020" };
  var CHEVEUX_NOMS = { blond: "Blonds", blondChatain: "Blond châtain", chatain: "Châtains", brun: "Bruns", roux: "Roux", noir: "Noirs" };
  var COIFFURES = { longs: "Longs", carre: "Carré", courts: "Courts", queue: "Queue-de-cheval", couettes: "Couettes" };
  var ACCESSOIRES = { "": "Aucun", lunettes: "Lunettes", noeud: "Nœud", serretete: "Serre-tête", taches: "Taches de rousseur" };

  // Ce que Lou et Alba portent et font à l'étape i.
  // Les étapes déjà passées fixent la tenue ; l'étape en cours est jouée par l'animation.
  function activiteDe(e) {
    var sc = sceneDe(e);
    if (sc === "dents" && /coiff|cheveu/i.test(e.titre || "")) return "dentsCoiffure";
    return sc;
  }
  function etatAvatar(r, i) {
    var etat = { tenue: "ecole", bataille: false, chaussures: false, cartable: false, calin: false, activite: "etoiles" };
    if (!r || !r.etapes || !r.etapes.length) return etat;
    i = Math.max(0, Math.min(i, r.etapes.length - 1));
    function passer(e) {
      var a = activiteDe(e);
      if (a === "reveil") { etat.tenue = "pyjama"; etat.bataille = true; }
      if (a === "habits") etat.tenue = "ecole";
      if (a === "pyjama") etat.tenue = "pyjama";
      if (a === "coiffure" || a === "dentsCoiffure") etat.bataille = false;
      if (a === "chaussures") etat.chaussures = true;
    }
    for (var k = 0; k < i; k++) passer(r.etapes[k]);
    var e = r.etapes[i], a = activiteDe(e);
    if (a === "reveil") { etat.tenue = "pyjama"; etat.bataille = true; }
    if (a === "habits") etat.tenue = "pyjama";
    if (a === "pyjama") etat.tenue = "pyjama";
    etat.activite = a;
    etat.calin = a === "reveil" && /câlin|calin/i.test(e.titre || "");
    return etat;
  }
  // État de fin de routine : tout est fait, cartable sur le dos si c'est le bus
  function etatFinAvatar(r) {
    var etat = etatAvatar(r, r && r.etapes ? r.etapes.length - 1 : 0);
    if (r && r.etapes && r.etapes.length) {
      var a = activiteDe(r.etapes[r.etapes.length - 1]);
      if (a === "habits") etat.tenue = "ecole";
      if (a === "coiffure" || a === "dentsCoiffure") etat.bataille = false;
      if (a === "chaussures") etat.chaussures = true;
    }
    etat.cartable = !!(r && r.finEmoji === "🚌");
    if (etat.cartable) etat.chaussures = true;
    etat.activite = "fin";
    return etat;
  }

  // ---------- Routines ----------
  function normaliserRoutine(r) {
    if (!r || r.supprimee) return null;
    r = copie(r);
    r.jours = r.jours || {};
    r.etapes = enTableau(r.etapes).map(function (e) {
      e.details = enTableau(e.details);
      return e;
    }).filter(function (e) { return e.debut; }).sort(function (a, b) { return sec(a.debut) - sec(b.debut); });
    if (!r.etapes.length || !r.fin) return null;
    r.etapes.forEach(function (e, i) {
      e.d = sec(e.debut);
      e.f = i + 1 < r.etapes.length ? sec(r.etapes[i + 1].debut) : sec(r.fin);
    });
    r.debutS = r.etapes[0].d;
    r.finS = sec(r.fin);
    return r;
  }

  // Liste des routines {id, r}. La routine École d'origine reste présente tant qu'elle n'est pas supprimée.
  function routines(stock) {
    var enregistrees = stock.lire("routines") || {};
    var liste = [];
    if (!enregistrees.ecole) {
      var defaut = copie(ROUTINE_ECOLE);
      // anciens réglages de la version précédente
      var ancien = stock.lire("reglages") || {};
      if (ancien.joursEcole) for (var j in ancien.joursEcole) defaut.jours[j] = !!ancien.joursEcole[j];
      if (ancien.vacances === false) defaut.ecole = false;
      liste.push({ id: "ecole", r: normaliserRoutine(defaut) });
    }
    Object.keys(enregistrees).forEach(function (id) {
      var r = normaliserRoutine(enregistrees[id]);
      if (r) liste.push({ id: id, r: r });
    });
    return liste.sort(function (a, b) { return a.r.debutS - b.r.debutS; });
  }

  // Routines prévues ce jour-là, en tenant compte des vacances pour les routines « école »
  function programme(stock, d, options) {
    options = options || {};
    var raisonVac = options.forcer ? null : Calendrier.raisonVacances(d);
    var out = { routines: [], raison: null };
    routines(stock).forEach(function (x) {
      if (options.routine && x.id !== options.routine) return;
      if (!options.forcer && !x.r.jours[d.getDay()]) return;
      if (x.r.ecole && raisonVac) { out.raison = raisonVac; return; }
      out.routines.push(x);
    });
    return out;
  }

  // ---------- Étoiles ----------
  function cleNote(jour, routineId) { return !routineId || routineId === "ecole" ? jour : jour + "~" + routineId; }
  // Étoiles gagnées = celles des routines, plus le bonus donné à la main dans les réglages (week-end sage, etc.)
  function total(stock, nom) {
    var notes = stock.lire("notes") || {}, t = 0;
    for (var cle in notes) if (notes[cle] && notes[cle][nom]) t += notes[cle][nom];
    return t + bonus(stock, nom);
  }
  function bonus(stock, nom) { return +stock.lire("bonus/" + nom) || 0; }
  function totalTous(stock) {
    return FILLES.reduce(function (s, f) { return s + total(stock, f.nom); }, 0);
  }
  // ---------- Les 3 critères des étoiles : une étoile par critère, affichés aux filles avant et après ----------
  // criteres/<cleNote> = {<prénom>: {heure, repeter, seule}} ; ok/<cleNote>/<prénom> = {ok, sur} (boutons OK de l'écran)
  var CRITERES = [
    { cle: "heure",   emoji: "⏰", texte: "Prête à l'heure", court: "À l'heure" },
    { cle: "repeter", emoji: "👂", texte: "Sans qu'on répète", court: "Sans qu'on répète" },
    { cle: "seule",   emoji: "💪", texte: "Toute seule, avec ses OK", court: "Toute seule" }
  ];
  function criteresDe(stock, cle, nom) {
    var c = stock.lire("criteres/" + cle + "/" + nom);
    if (c) return c;
    // Pas encore de critères cochés : « toute seule » proposé si elle a validé toutes ses étapes avec OK
    var ok = stock.lire("ok/" + cle + "/" + nom);
    return { heure: false, repeter: false, seule: !!(ok && ok.sur && ok.ok >= ok.sur) };
  }
  function compterCriteres(c) {
    return CRITERES.reduce(function (n, k) { return n + (c && c[k.cle] ? 1 : 0); }, 0);
  }

  // ---------- Boutique : un catalogue d'objets dessinés, payés avec les étoiles gagnées ----------
  // boutique/achats/<prénom>/<idArticle> = {cout, le} ; boutique/portes/<prénom>/<emplacement> = idArticle
  // Les étoiles dépensées ne touchent pas aux notes : le bocal commun continue de compter toutes les étoiles gagnées.
  var RAYONS = [
    { cle: "petits", nom: "Petits plus",        emoji: "🌈", sous: "Un ou deux matins" },
    { cle: "grands", nom: "Grands changements", emoji: "✨", sous: "Une semaine d'école" },
    { cle: "coeur",  nom: "Coups de cœur",      emoji: "💎", sous: "Deux semaines, et c'est à toi" },
    { cle: "saison", nom: "Le rayon du moment", emoji: "🎪", sous: "Il ne reste pas toute l'année" }
  ];
  // Un emplacement = un endroit du corps. Une seule chose à la fois par emplacement.
  var EMPLACEMENTS = {
    tenue: "Tenue complète", haut: "Haut", bas: "Bas", pieds: "Chaussures", chaussettes: "Chaussettes",
    coiffure: "Coiffure", cheveux: "Couleur et mèches", tete: "Accessoire de coiffure",
    visage: "Masques et lunettes", joues: "Maquillage", cou: "Collier",
    dos: "Dans le dos", effet: "Autour d'elle", compagnon: "Compagnon"
  };
  // Les rayons de la garde-robe : plusieurs emplacements peuvent tenir dans le même tiroir
  var SECTIONS = [
    { cle: "tenue",       nom: "Tenue complète",       emoji: "\u{1F457}", emplacements: ["tenue"], sous: "Remplace le haut et le bas" },
    { cle: "haut",        nom: "Haut",                 emoji: "\u{1F455}", emplacements: ["haut"], sous: "Sans tenue complète" },
    { cle: "bas",         nom: "Bas",                  emoji: "\u{1F456}", emplacements: ["bas"], sous: "Sans tenue complète" },
    { cle: "pieds",       nom: "Chaussures",           emoji: "\u{1F45F}", emplacements: ["pieds"] },
    { cle: "chaussettes", nom: "Chaussettes",          emoji: "\u{1F9E6}", emplacements: ["chaussettes"] },
    { cle: "coiffure",    nom: "Coiffure",             emoji: "\u{1F487}", emplacements: ["coiffure", "cheveux"] },
    { cle: "tete",        nom: "Accessoires de coiffure", emoji: "\u{1F380}", emplacements: ["tete"] },
    { cle: "visage",      nom: "Maquillage et masques", emoji: "\u{1F484}", emplacements: ["visage", "joues"] },
    { cle: "cou",         nom: "Colliers",             emoji: "\u2B50", emplacements: ["cou"] },
    { cle: "dos",         nom: "Dans le dos",          emoji: "\u{1F9DA}", emplacements: ["dos"] },
    { cle: "effet",       nom: "Derrière elle",        emoji: "\u2728", emplacements: ["effet", "compagnon"] }
  ];
  // Les couleurs de cheveux débloquées par l'article « Cheveux arc-en-ciel »
  var TEINTES = [
    { cle: "", nom: "Sa couleur", couleur: "" },
    { cle: "rose", nom: "Rose", couleur: "#FF6FA5" },
    { cle: "bleu", nom: "Bleu", couleur: "#5FD0FF" },
    { cle: "violet", nom: "Violet", couleur: "#B78BFF" },
    { cle: "vert", nom: "Vert", couleur: "#6BE38A" },
    { cle: "turquoise", nom: "Turquoise", couleur: "#3FC7B4" },
    { cle: "rouge", nom: "Rouge", couleur: "#E5484D" },
    { cle: "blanc", nom: "Blanc", couleur: "#EDEDF5" },
    { cle: "blond", nom: "Blond", couleur: "#E6B656" },
    { cle: "noir", nom: "Noir", couleur: "#262020" }
  ];
  // Retirés du catalogue : mal dessinés, on rend les étoiles
  var RETIRES = { bracelet: 1, montre: 1, baguette: 1, doudou: 1, citrouille: 1, ballons: 1 };
  // Toujours à elles, gratuites : de quoi s'habiller même sans avoir rien acheté
  var BASE = [
    { id: "robeSimple", nom: "Robe de tous les jours", emoji: "\u{1F457}", cout: 0, rayon: "base", emplacement: "tenue" },
    { id: "teeShirt",   nom: "Tee-shirt tout simple",  emoji: "\u{1F455}", cout: 0, rayon: "base", emplacement: "haut" },
    { id: "jeanSimple", nom: "Jean tout simple",       emoji: "\u{1F456}", cout: 0, rayon: "base", emplacement: "bas" }
  ];
  var CATALOGUE = BASE.concat([
    // 🌈 Petits plus : les détails qui se voient quand même
    { id: "barrette",       nom: "Barrette cœur",        emoji: "🎀", cout: 1, rayon: "petits", emplacement: "tete" },
    { id: "serreTete",      nom: "Serre-tête à pois",    emoji: "💖", cout: 2, rayon: "petits", emplacement: "tete" },
    { id: "fleur",          nom: "Fleur dans les cheveux", emoji: "🌸", cout: 2, rayon: "petits", emplacement: "tete" },
    { id: "grosNoeud",      nom: "Gros nœud",            emoji: "🎗️", cout: 2, rayon: "petits", emplacement: "tete" },
    { id: "bandeau",        nom: "Bandeau de sport",     emoji: "🎽", cout: 1, rayon: "petits", emplacement: "tete" },
    { id: "couronneFleurs", nom: "Couronne de fleurs",   emoji: "🌼", cout: 3, rayon: "petits", emplacement: "tete" },
    { id: "soleil",         nom: "Lunettes de soleil",   emoji: "😎", cout: 2, rayon: "petits", emplacement: "visage" },
    { id: "lunettesRondes", nom: "Lunettes rondes",      emoji: "👓", cout: 2, rayon: "petits", emplacement: "visage" },
    { id: "lunettesCoeur",  nom: "Lunettes en cœur",     emoji: "😍", cout: 3, rayon: "petits", emplacement: "visage" },
    { id: "taches",         nom: "Taches de rousseur",   emoji: "🤎", cout: 1, rayon: "petits", emplacement: "joues" },
    { id: "etoileJoue",     nom: "Étoile sur la joue",   emoji: "🌟", cout: 1, rayon: "petits", emplacement: "joues" },
    { id: "coeurJoue",      nom: "Cœur sur la joue",     emoji: "❤️", cout: 1, rayon: "petits", emplacement: "joues" },
    { id: "paillettesJoues", nom: "Paillettes sur les joues", emoji: "💫", cout: 2, rayon: "petits", emplacement: "joues" },
    { id: "collier",        nom: "Collier étoile",       emoji: "⭐", cout: 1, rayon: "petits", emplacement: "cou" },
    { id: "collierCoeur",   nom: "Collier cœur",         emoji: "💝", cout: 2, rayon: "petits", emplacement: "cou" },
    { id: "medaille",       nom: "Médaille du matin",    emoji: "🏅", cout: 3, rayon: "petits", emplacement: "cou" },
    { id: "echarpe",        nom: "Écharpe rayée",        emoji: "🧣", cout: 2, rayon: "petits", emplacement: "cou" },
    { id: "chaussettes",    nom: "Chaussettes à rayures", emoji: "🧦", cout: 1, rayon: "petits", emplacement: "chaussettes" },
    { id: "chaussettesCoeurs", nom: "Chaussettes à cœurs", emoji: "💗", cout: 1, rayon: "petits", emplacement: "chaussettes" },
    { id: "chaussettesHautes", nom: "Chaussettes hautes", emoji: "🥿", cout: 2, rayon: "petits", emplacement: "chaussettes" },
    { id: "chaussettesEtoiles", nom: "Chaussettes à étoiles", emoji: "✨", cout: 2, rayon: "petits", emplacement: "chaussettes" },
    { id: "ballerines",     nom: "Ballerines",           emoji: "👡", cout: 3, rayon: "petits", emplacement: "pieds" },
    { id: "bottesPluie",    nom: "Bottes de pluie",      emoji: "👢", cout: 3, rayon: "petits", emplacement: "pieds" },
    { id: "debardeur",      nom: "Débardeur étoilé",     emoji: "🌟", cout: 3, rayon: "petits", emplacement: "haut" },
    { id: "tshirtCoeur",    nom: "Tee-shirt à cœur",     emoji: "💕", cout: 3, rayon: "petits", emplacement: "haut" },
    { id: "pullRaye",       nom: "Pull rayé",            emoji: "🧶", cout: 3, rayon: "petits", emplacement: "haut" },
    { id: "short",          nom: "Short en jean",        emoji: "🩳", cout: 3, rayon: "petits", emplacement: "bas" },
    { id: "legging",        nom: "Legging noir",         emoji: "🖤", cout: 3, rayon: "petits", emplacement: "bas" },
    { id: "sacDos",         nom: "Petit sac à dos",      emoji: "🎒", cout: 3, rayon: "petits", emplacement: "dos" },
    { id: "papillonVole",   nom: "Un papillon qui vole autour", emoji: "🦋", cout: 3, rayon: "petits", emplacement: "effet" },

    // ✨ Grands changements : on la reconnaît de loin
    { id: "demiQueue",      nom: "Demi-queue",           emoji: "💫", cout: 5, rayon: "grands", emplacement: "coiffure" },
    { id: "tresse",         nom: "Tresse sur le côté",   emoji: "💇‍♀️", cout: 6, rayon: "grands", emplacement: "coiffure" },
    { id: "nattes",         nom: "Deux nattes",          emoji: "👧", cout: 6, rayon: "grands", emplacement: "coiffure" },
    { id: "couettesHautes", nom: "Couettes hautes",      emoji: "👱‍♀️", cout: 6, rayon: "grands", emplacement: "coiffure" },
    { id: "chignon",        nom: "Chignon de danseuse",  emoji: "🩰", cout: 6, rayon: "grands", emplacement: "coiffure" },
    { id: "macarons",       nom: "Deux macarons",        emoji: "🍡", cout: 6, rayon: "grands", emplacement: "coiffure" },
    { id: "ondules",        nom: "Cheveux ondulés",      emoji: "〰️", cout: 6, rayon: "grands", emplacement: "coiffure" },
    { id: "boucles",        nom: "Cheveux bouclés",      emoji: "🌀", cout: 7, rayon: "grands", emplacement: "coiffure" },
    { id: "meche",          nom: "Mèche colorée",        emoji: "🎨", cout: 4, rayon: "grands", emplacement: "cheveux" },
    { id: "pointes",        nom: "Pointes colorées",     emoji: "🖌️", cout: 6, rayon: "grands", emplacement: "cheveux" },
    { id: "cheveuxArcEnCiel", nom: "Cheveux arc-en-ciel", emoji: "🌈", cout: 8, rayon: "grands", emplacement: "cheveux",
      note: "Débloque toutes les couleurs de cheveux" },
    { id: "chemisier",      nom: "Chemisier à fleurs",   emoji: "🌺", cout: 4, rayon: "grands", emplacement: "haut" },
    { id: "sweatCapuche",   nom: "Sweat à capuche",      emoji: "🧥", cout: 4, rayon: "grands", emplacement: "haut" },
    { id: "hautArcEnCiel",  nom: "Tee-shirt arc-en-ciel", emoji: "🌈", cout: 4, rayon: "grands", emplacement: "haut" },
    { id: "maillotFoot",    nom: "Maillot de foot",      emoji: "⚽", cout: 4, rayon: "grands", emplacement: "haut" },
    { id: "topPaillettes",  nom: "Haut à paillettes",    emoji: "✨", cout: 5, rayon: "grands", emplacement: "haut" },
    { id: "jupePlissee",    nom: "Jupe plissée",         emoji: "🟪", cout: 4, rayon: "grands", emplacement: "bas" },
    { id: "jupeJean",       nom: "Jupe en jean",         emoji: "🟦", cout: 4, rayon: "grands", emplacement: "bas" },
    { id: "pantalonLarge",  nom: "Pantalon large",       emoji: "🟫", cout: 4, rayon: "grands", emplacement: "bas" },
    { id: "jupeTutu",       nom: "Jupe tutu",            emoji: "🩰", cout: 5, rayon: "grands", emplacement: "bas" },
    { id: "pantalonEtoiles", nom: "Pantalon étoilé",     emoji: "🌌", cout: 5, rayon: "grands", emplacement: "bas" },
    { id: "robePois",       nom: "Robe à pois",          emoji: "👚", cout: 5, rayon: "grands", emplacement: "tenue" },
    { id: "robeFleurs",     nom: "Robe à fleurs",        emoji: "👗", cout: 6, rayon: "grands", emplacement: "tenue" },
    { id: "salopette",      nom: "Salopette en jean",    emoji: "👖", cout: 6, rayon: "grands", emplacement: "tenue" },
    { id: "jeanCoeur",      nom: "Jean et tee-shirt cœur", emoji: "👕", cout: 6, rayon: "grands", emplacement: "tenue" },
    { id: "survetement",    nom: "Survêtement de sport", emoji: "🏃", cout: 6, rayon: "grands", emplacement: "tenue" },
    { id: "manteau",        nom: "Manteau d'hiver",      emoji: "🧥", cout: 6, rayon: "grands", emplacement: "tenue" },
    { id: "tutu",           nom: "Tutu de danseuse",     emoji: "💃", cout: 7, rayon: "grands", emplacement: "tenue" },
    { id: "kimono",         nom: "Kimono à fleurs",      emoji: "🥋", cout: 7, rayon: "grands", emplacement: "tenue" },
    { id: "robeEtoilee",    nom: "Robe étoilée",         emoji: "🌌", cout: 7, rayon: "grands", emplacement: "tenue" },
    { id: "baskets",        nom: "Baskets à paillettes", emoji: "👟", cout: 5, rayon: "grands", emplacement: "pieds" },
    { id: "basketsMontantes", nom: "Baskets montantes",  emoji: "🥾", cout: 5, rayon: "grands", emplacement: "pieds" },
    { id: "bottesCowboy",   nom: "Bottes de cow-boy",    emoji: "🤠", cout: 6, rayon: "grands", emplacement: "pieds" },
    { id: "casquette",      nom: "Casquette",            emoji: "🧢", cout: 5, rayon: "grands", emplacement: "tete" },
    { id: "chapeauPaille",  nom: "Chapeau de paille",    emoji: "👒", cout: 5, rayon: "grands", emplacement: "tete" },
    { id: "bonnet",         nom: "Bonnet à pompon",      emoji: "🧶", cout: 5, rayon: "grands", emplacement: "tete" },
    { id: "maquillagePapillon", nom: "Maquillage de papillon", emoji: "🦋", cout: 4, rayon: "grands", emplacement: "joues" },
    { id: "maquillageLicorne",  nom: "Maquillage de licorne",  emoji: "🦄", cout: 5, rayon: "grands", emplacement: "joues" },
    { id: "etoilesEffet",   nom: "Des étoiles qui scintillent", emoji: "✨", cout: 7, rayon: "grands", emplacement: "effet" },

    // 💎 Coups de cœur : le truc rare
    { id: "couronne",   nom: "Couronne de princesse", emoji: "👑", cout: 14, rayon: "coeur", emplacement: "tete" },
    { id: "paillettes", nom: "Pluie de paillettes",   emoji: "🎇", cout: 14, rayon: "coeur", emplacement: "effet" },
    { id: "ailes",      nom: "Ailes de fée",          emoji: "🧚", cout: 15, rayon: "coeur", emplacement: "dos" },
    { id: "ailesAnge",  nom: "Ailes d'ange",          emoji: "😇", cout: 15, rayon: "coeur", emplacement: "dos" },
    { id: "lapin",      nom: "Oreilles et queue de lapin", emoji: "🐰", cout: 15, rayon: "coeur", emplacement: "dos" },
    { id: "arcEnCiel",  nom: "Un arc-en-ciel derrière elle", emoji: "🌈", cout: 15, rayon: "coeur", emplacement: "effet" },
    { id: "cape",       nom: "Cape de super-héroïne", emoji: "🦸", cout: 17, rayon: "coeur", emplacement: "dos" },
    { id: "ailesPapillon", nom: "Ailes de papillon",  emoji: "🦋", cout: 17, rayon: "coeur", emplacement: "dos" },
    { id: "renard",     nom: "Oreilles et queue de renard", emoji: "🦊", cout: 17, rayon: "coeur", emplacement: "dos" },
    { id: "panda",      nom: "Oreilles de panda",     emoji: "🐼", cout: 17, rayon: "coeur", emplacement: "dos" },
    { id: "sundae",     nom: "Déguisement de Sundae", emoji: "🐈", cout: 18, rayon: "coeur", emplacement: "dos" },
    { id: "ailesDragon", nom: "Ailes de dragon",      emoji: "🐉", cout: 18, rayon: "coeur", emplacement: "dos" },
    { id: "dinosaure",  nom: "Capuche de dinosaure",  emoji: "🦕", cout: 18, rayon: "coeur", emplacement: "dos" },
    { id: "rondoudou",  nom: "Masque de Rondoudou",   emoji: "🎈", cout: 18, rayon: "coeur", emplacement: "visage" },
    { id: "pikachu",    nom: "Masque de Pikachu",     emoji: "⚡", cout: 20, rayon: "coeur", emplacement: "visage" },
    { id: "evoli",      nom: "Masque d'Évoli",        emoji: "🤎", cout: 20, rayon: "coeur", emplacement: "visage" },
    { id: "salameche",  nom: "Masque de Salamèche",   emoji: "🔥", cout: 20, rayon: "coeur", emplacement: "visage" },
    { id: "carapuce",   nom: "Masque de Carapuce",    emoji: "🐢", cout: 20, rayon: "coeur", emplacement: "visage" },
    { id: "bulbizarre", nom: "Masque de Bulbizarre",  emoji: "🌱", cout: 20, rayon: "coeur", emplacement: "visage" },
    { id: "princesse",  nom: "Robe de princesse",     emoji: "👸", cout: 20, rayon: "coeur", emplacement: "tenue" },
    { id: "sirene",     nom: "Queue de sirène",       emoji: "🧜", cout: 21, rayon: "coeur", emplacement: "tenue" },
    { id: "sundaeAmi",  nom: "Sundae qui te suit",    emoji: "🐾", cout: 21, rayon: "coeur", emplacement: "compagnon" },

    // 🎪 Le rayon du moment : il n'apparaît qu'à sa période
    { id: "maquillageChat",  nom: "Maquillage de chat",  emoji: "🐱", cout: 4,  rayon: "saison", saison: "halloween", emplacement: "joues" },
    { id: "capeVampire",     nom: "Cape de vampire",     emoji: "🧛", cout: 6,  rayon: "saison", saison: "halloween", emplacement: "dos" },
    { id: "chapeauSorciere", nom: "Chapeau de sorcière", emoji: "🧙", cout: 7,  rayon: "saison", saison: "halloween", emplacement: "tete" },
    { id: "bonnetNoel",      nom: "Bonnet de Père Noël", emoji: "🎅", cout: 6,  rayon: "saison", saison: "noel", emplacement: "tete" },
    { id: "boisRenne",       nom: "Bois de renne",       emoji: "🦌", cout: 6,  rayon: "saison", saison: "noel", emplacement: "tete" },
    { id: "pullNoel",        nom: "Pull de Noël",        emoji: "🎄", cout: 7,  rayon: "saison", saison: "noel", emplacement: "tenue" },
    { id: "couronneAnniv",   nom: "Couronne d'anniversaire", emoji: "🎂", cout: 4, rayon: "saison", saison: "anniv", emplacement: "tete" },
    { id: "ballonsEffet",    nom: "Des ballons autour d'elle", emoji: "🎈", cout: 6, rayon: "saison", saison: "anniv", emplacement: "effet" },
    { id: "lunettesPlage",   nom: "Lunettes de plage",   emoji: "🕶️", cout: 4, rayon: "saison", saison: "ete", emplacement: "visage" },
    { id: "bouee",           nom: "Bouée canard",        emoji: "🛟", cout: 6,  rayon: "saison", saison: "ete", emplacement: "dos" },
    { id: "maillotBain",     nom: "Maillot de bain",     emoji: "🩱", cout: 6,  rayon: "saison", saison: "ete", emplacement: "tenue" }
  ]);
  // Des collections à compléter : une jauge dans la boutique, et un cadeau en étoiles quand elle est pleine
  var COLLECTIONS = [
    { cle: "ailes",     nom: "Toutes les ailes",           emoji: "🧚", cadeau: 6,
      articles: ["ailes", "ailesAnge", "ailesPapillon", "ailesDragon"] },
    { cle: "animaux",   nom: "Les déguisements d'animaux", emoji: "🐾", cadeau: 7,
      articles: ["sundae", "lapin", "renard", "panda", "dinosaure"] },
    { cle: "pokemon",   nom: "Les masques Pokémon",        emoji: "⚡", cadeau: 8,
      articles: ["pikachu", "evoli", "salameche", "carapuce", "bulbizarre", "rondoudou"] },
    { cle: "coiffures", nom: "Toutes les coiffures",       emoji: "💇‍♀️", cadeau: 7,
      articles: ["demiQueue", "tresse", "nattes", "couettesHautes", "chignon", "macarons", "ondules", "boucles"] },
    { cle: "tenues",    nom: "Toutes les tenues complètes", emoji: "👗", cadeau: 8,
      articles: ["robePois", "robeFleurs", "salopette", "jeanCoeur", "survetement", "manteau", "tutu", "kimono", "robeEtoilee"] },
    { cle: "hauts",     nom: "Tous les hauts",             emoji: "👕", cadeau: 6,
      articles: ["debardeur", "tshirtCoeur", "pullRaye", "chemisier", "sweatCapuche", "hautArcEnCiel", "maillotFoot", "topPaillettes"] },
    { cle: "bas",       nom: "Tous les bas",               emoji: "👖", cadeau: 5,
      articles: ["short", "legging", "jupePlissee", "jupeJean", "pantalonLarge", "jupeTutu", "pantalonEtoiles"] },
    { cle: "chaussettes", nom: "Toutes les chaussettes",   emoji: "🧦", cadeau: 3,
      articles: ["chaussettes", "chaussettesCoeurs", "chaussettesHautes", "chaussettesEtoiles"] },
    { cle: "pieds",     nom: "Toutes les chaussures",      emoji: "👟", cadeau: 4,
      articles: ["ballerines", "bottesPluie", "baskets", "basketsMontantes", "bottesCowboy"] }
  ];
  // collections/<prénom>/<clé> = le jour où le cadeau a été donné
  function collection(stock, nom, c) {
    var n = 0;
    c.articles.forEach(function (id) { if (possede(stock, nom, id)) n++; });
    return { a: n, sur: c.articles.length, pleine: n >= c.articles.length,
             payee: !!stock.lire("collections/" + nom + "/" + c.cle) };
  }
  function catalogue() { return CATALOGUE.map(function (a) { return a; }); }
  function articleDe(id) {
    for (var i = 0; i < CATALOGUE.length; i++) if (CATALOGUE[i].id === id) return CATALOGUE[i];
    return null;
  }
  // Le rayon du moment : Halloween, Noël, l'anniversaire de la fille, l'été
  function saisonOuverte(saison, d, regl, nom) {
    var md = pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    if (saison === "halloween") return md >= "10-18" && md <= "11-02";
    if (saison === "noel") return md >= "12-01" && md <= "12-31";
    if (saison === "ete") return md >= "07-01" && md <= "08-31";
    if (saison === "anniv") {
      var nais = regl && regl.anniversaires ? regl.anniversaires[nom] : null;
      if (!nais) return false;
      var jour = new Date(d.getFullYear(), +nais.slice(5, 7) - 1, +nais.slice(8, 10));
      return Math.abs(jour - d) <= 7 * 864e5;
    }
    return false;
  }
  // Ce qu'une fille peut voir en rayon aujourd'hui (ce qu'elle possède déjà reste toujours visible)
  function enRayon(stock, nom, d) {
    var regl = reglages(stock);
    d = d || new Date();
    return articles(stock).filter(function (a) {
      if (a.rayon === "base") return false; // déjà à elle, elle la retrouve dans la garde-robe
      return !a.saison || possede(stock, nom, a.id) || saisonOuverte(a.saison, d, regl, nom);
    });
  }
  // Compatibilité : d'anciens articles saisis à la main dans l'espace parent restent achetables
  function articles(stock) {
    var maison = stock.lire("boutique/articles") || {}, out = catalogue();
    Object.keys(maison).forEach(function (id) {
      var a = maison[id];
      if (a && a.nom) out.push({ id: id, nom: a.nom, emoji: a.emoji || "🎁", cout: +a.cout || 1, rayon: "maison", emplacement: "" });
    });
    return out;
  }
  function achats(stock, nom) {
    var a = stock.lire("boutique/achats/" + nom) || {}, out = [];
    Object.keys(a).forEach(function (id) {
      if (!a[id] || RETIRES[id]) return;
      var art = articleDe(id) || { id: id, nom: a[id].nom || "Article", emoji: a[id].emoji || "🎁", emplacement: "", rayon: "maison" };
      out.push({ id: id, nom: art.nom, emoji: art.emoji, emplacement: art.emplacement, rayon: art.rayon,
                 cout: +a[id].cout || art.cout || 0, le: a[id].le });
    });
    return out.sort(function (x, y) { return (x.le || "").localeCompare(y.le || "") || x.cout - y.cout; });
  }
  function estBase(id) { var a = articleDe(id); return !!a && a.rayon === "base"; }
  function possede(stock, nom, id) {
    if (RETIRES[id]) return false;
    if (estBase(id)) return true;
    return !!(stock.lire("boutique/achats/" + nom) || {})[id];
  }
  function depense(stock, nom) {
    return achats(stock, nom).reduce(function (s, a) {
      var art = articleDe(a.id);
      return s + (art ? art.cout : a.cout); // si le prix baisse, la différence lui est rendue
    }, 0);
  }
  function solde(stock, nom) { return total(stock, nom) - depense(stock, nom); }
  // Ce qu'elle porte : {emplacement: idArticle}, nettoyé de ce qui n'est plus acheté
  function portes(stock, nom) {
    var p = stock.lire("boutique/portes/" + nom) || {}, out = {};
    Object.keys(p).forEach(function (e) {
      if (!EMPLACEMENTS[e] || !p[e]) return;
      var art = articleDe(p[e]);
      if (!art || art.emplacement !== e) return;     // un article déplacé de tiroir ne compte plus
      if (possede(stock, nom, p[e])) out[e] = p[e];
    });
    // Une tenue complète prend la place du haut et du bas : jamais les deux en même temps
    if (out.tenue) { delete out.haut; delete out.bas; }
    return out;
  }
  // La couleur de cheveux choisie, une fois « Cheveux arc-en-ciel » débloqué
  function teinte(stock, nom) {
    if (!possede(stock, nom, "cheveuxArcEnCiel")) return "";
    var t = stock.lire("boutique/teinte/" + nom) || "";
    for (var i = 0; i < TEINTES.length; i++) if (TEINTES[i].cle && TEINTES[i].cle === t) return t;
    return "";
  }
  // L'apparence complète passée au dessin : les réglages parents plus les objets portés
  function apparence(stock, nom) {
    var a = copie(reglages(stock).avatars[nom] || {});
    a.objets = portes(stock, nom);
    if (a.objets.coiffure) a.coiffure = a.objets.coiffure;
    // Rien en tenue, rien en haut, rien en bas : elle garde sa robe de tous les jours
    if (!a.objets.tenue && !a.objets.haut && !a.objets.bas) a.objets.tenue = "robeSimple";
    var t = teinte(stock, nom);
    if (t) a.cheveux = t;
    return a;
  }
  // Le prochain objectif en boutique pour une fille : ce qu'elle peut déjà s'offrir, sinon le moins cher pas encore acheté
  function vitrine(stock, nom) {
    var s = solde(stock, nom);
    var neufs = enRayon(stock, nom).filter(function (a) { return !possede(stock, nom, a.id); })
                                   .sort(function (x, y) { return x.cout - y.cout; });
    if (!neufs.length) return null;
    var possibles = neufs.filter(function (a) { return a.cout <= s; });
    if (possibles.length) return { solde: s, article: possibles[possibles.length - 1], manque: 0 };
    return { solde: s, article: neufs[0], manque: neufs[0].cout - s };
  }

  function cagnotte(stock) {
    var c = stock.lire("cagnotte");
    if (!c || !c.objectif) return null;
    var progres = Math.max(0, totalTous(stock) - (c.base || 0));
    return { objectif: +c.objectif, recompense: c.recompense || "", base: c.base || 0,
             progres: progres, pleine: progres >= +c.objectif };
  }

  function rappelsDuJour(stock, d) {
    var out = [];
    [stock.lire("rappels/hebdo/" + d.getDay()), stock.lire("rappels/dates/" + cleJour(d))].forEach(function (o) {
      if (!o) return;
      Object.keys(o).sort().forEach(function (k) { if (o[k]) out.push(o[k]); });
    });
    return out;
  }

  // ---------- Décor du jour : saisons, fêtes, anniversaires ----------
  function decorDuJour(d, regl) {
    var md = pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    var fete = null;
    FILLES.forEach(function (f) {
      var nais = regl.anniversaires[f.nom];
      if (!fete && nais && nais.slice(5) === md) fete = { nom: f.nom, age: d.getFullYear() - (+nais.slice(0, 4)) };
    });
    var particules;
    if (fete) particules = ["🎈", "🎉", "🎂", "✨", "🎁"];
    else if (md >= "10-24" && md <= "10-31") particules = ["🎃", "👻", "🦇", "🍬"];
    else if (md >= "12-01" && md <= "12-25") particules = ["❄️", "⭐", "❄️", "🎄"];
    else if (md >= "12-26" || md <= "03-19") particules = ["❄️", "❄️", "❄️"];
    else if (md <= "06-20") particules = ["🌸", "🌷", "🦋"];
    else if (md <= "09-21") particules = ["🌻", "🎀", "🦋", "💖"];
    else particules = ["🍂", "🎀", "🍁", "💖"];
    return { particules: regl.decor ? particules : [], fete: fete };
  }

  // ---------- Calendrier officiel : vacances zone A (Bordeaux) et jours fériés ----------
  var Calendrier = (function () {
    var CLE = "matin.calendrier";
    var cache = lireLocal(CLE, null);

    function charger() {
      if (cache && Date.now() - cache.le < 3 * 86400000) return;
      var an = new Date().getFullYear();
      var urlVacances = "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records?where=" +
        encodeURIComponent('location="Bordeaux" and end_date>"' + (an - 1) + '-06-01"') + "&order_by=start_date&limit=60";
      Promise.all([
        fetch(urlVacances).then(function (r) { return r.json(); }),
        fetch("https://calendrier.api.gouv.fr/jours-feries/metropole.json").then(function (r) { return r.json(); })
      ]).then(function (res) {
        var vacances = (res[0].results || []).filter(function (v) {
          return v.population !== "Enseignants";
        }).map(function (v) {
          return {
            nom: v.description,
            debut: cleJour(new Date(v.start_date)),
            fin: cleJour(new Date(v.end_date)),
            ete: /Été|été|Ete/.test(v.description)
          };
        });
        cache = { le: Date.now(), vacances: vacances, feries: res[1] || {} };
        ecrireLocal(CLE, cache);
      }).catch(function () {});
    }

    // Renvoie null si ce n'est ni un jour férié ni un jour de vacances, sinon la raison
    function raisonVacances(d) {
      if (!cache) return null;
      var k = cleJour(d);
      if (cache.feries && cache.feries[k]) return "Jour férié : " + cache.feries[k];
      for (var i = 0; i < cache.vacances.length; i++) {
        var v = cache.vacances[i];
        if (v.ete) {
          if (k >= v.debut && k < v.debut.slice(0, 4) + "-09-01") return "Vacances d'été";
        } else if (v.debut === v.fin ? k === v.debut : (k >= v.debut && k < v.fin)) {
          return v.nom;
        }
      }
      return null;
    }

    function prochaines(d) {
      if (!cache) return null;
      var k = cleJour(d);
      for (var i = 0; i < cache.vacances.length; i++) {
        var v = cache.vacances[i];
        if (v.debut >= k || (!v.ete && k < v.fin)) return v;
      }
      return null;
    }

    return { charger: charger, raisonVacances: raisonVacances, prochaines: prochaines };
  })();

  return {
    DB_URL: DB_URL, FILLES: FILLES, JOURS: JOURS, COULEURS: COULEURS,
    ROUTINE_ECOLE: ROUTINE_ECOLE, MODELE_SOIR: MODELE_SOIR,
    pad: pad, sec: sec, copie: copie, cleJour: cleJour, sansEmoji: sansEmoji, esc: esc, enTableau: enTableau,
    creerStock: creerStock, reglages: reglages,
    sceneDe: sceneDe, activiteDe: activiteDe, etatAvatar: etatAvatar, etatFinAvatar: etatFinAvatar,
    CHEVEUX: CHEVEUX, CHEVEUX_NOMS: CHEVEUX_NOMS, COIFFURES: COIFFURES, ACCESSOIRES: ACCESSOIRES,
    routines: routines, normaliserRoutine: normaliserRoutine, programme: programme,
    cleNote: cleNote, total: total, totalTous: totalTous, bonus: bonus, cagnotte: cagnotte,
    articles: articles, achats: achats, depense: depense, solde: solde, vitrine: vitrine,
    RAYONS: RAYONS, EMPLACEMENTS: EMPLACEMENTS, SECTIONS: SECTIONS, TEINTES: TEINTES,
    catalogue: catalogue, articleDe: articleDe, teinte: teinte,
    COLLECTIONS: COLLECTIONS, collection: collection,
    possede: possede, portes: portes, apparence: apparence, enRayon: enRayon, saisonOuverte: saisonOuverte,
    CRITERES: CRITERES, criteresDe: criteresDe, compterCriteres: compterCriteres,
    rappelsDuJour: rappelsDuJour, decorDuJour: decorDuJour,
    Calendrier: Calendrier
  };
})();
