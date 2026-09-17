// Partagé entre l'écran du matin (index.html) et l'espace parent (parent.html)
var MATIN = (function () {
  "use strict";

  // ✏️ Adresse de la base Firebase (Realtime Database). Vide = mode local, sans synchronisation.
  var DB_URL = "https://protocol-matin-default-rtdb.europe-west1.firebasedatabase.app";

  var FILLES = [
    { nom: "Lou",  couleur: "#FF6B9D" },
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
      { debut: "07:30", titre: "Petit déjeuner", emoji: "🥣", couleur: "#EE5A52",
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
  // pour que l'app ajoutée à l'écran d'accueil de l'iPad le garde.
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
    Lou:  { cheveux: "chatain", coiffure: "queue", accessoire: "" },
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
  var CHEVEUX = { blond: "#E6B656", chatain: "#8B5A2B", brun: "#4A2E1C", roux: "#C65A2E", noir: "#262020" };
  var CHEVEUX_NOMS = { blond: "Blonds", chatain: "Châtains", brun: "Bruns", roux: "Roux", noir: "Noirs" };
  var COIFFURES = { longs: "Longs", carre: "Carré", courts: "Courts", queue: "Queue-de-cheval", couettes: "Couettes" };
  var ACCESSOIRES = { "": "Aucun", lunettes: "Lunettes", noeud: "Nœud", serretete: "Serre-tête", taches: "Taches de rousseur" };

  // Ce que porte et tient l'avatar à l'étape i : il évolue au fil de la routine
  function etatAvatar(r, i) {
    var etat = { tenue: "ecole", bataille: false, chaussures: false, cartable: false, pose: "bas", objet: "", expression: "sourire", scene: "etoiles" };
    if (!r || !r.etapes || !r.etapes.length) return etat;
    i = Math.max(0, Math.min(i, r.etapes.length - 1));
    for (var k = 0; k <= i; k++) {
      var e = r.etapes[k], sc = sceneDe(e);
      if (sc === "reveil") { etat.tenue = "pyjama"; etat.bataille = true; }
      if (sc === "habits") etat.tenue = "ecole";
      if (sc === "bain") etat.tenue = "bain";
      if (sc === "pyjama") etat.tenue = "pyjama";
      if (sc === "coiffure" || /coiff|cheveu/i.test(e.titre || "")) etat.bataille = false;
      if (sc === "chaussures") { etat.chaussures = true; etat.cartable = r.finEmoji === "🚌"; }
    }
    var sc2 = sceneDe(r.etapes[i]);
    etat.scene = sc2;
    var poses = {
      reveil: ["tenir", "🧸"], repas: ["tenir", "🥣"], dents: ["bouche", "🪥"], coiffure: ["tete", "🪮"],
      rangement: ["tenir", "🧺"], jeu: ["ballon", "🎈"], bain: ["tenir", "🦆"], pyjama: ["tenir", "🧸"],
      histoire: ["tenir", "📖"], habits: ["bas", ""], chaussures: ["bas", ""], etoiles: ["bas", ""]
    };
    etat.pose = poses[sc2][0];
    etat.objet = poses[sc2][1];
    if (sc2 === "reveil") etat.expression = "sommeil";
    return etat;
  }

  function avatarSVG(nom, apparence, etat) {
    apparence = apparence || {};
    etat = etat || {};
    var fille = FILLES.filter(function (f) { return f.nom === nom; })[0] || FILLES[0];
    var ch = CHEVEUX[apparence.cheveux] || CHEVEUX.chatain;
    var coiffure = apparence.coiffure || "longs";
    var acc = apparence.accessoire || "";
    var tc = fille.couleur;
    var peau = "#FFD7B5", peauOmbre = "#F0B993", encre = "#2D2D3A", bouche = "#8E3B46";
    var tenue = etat.tenue || "ecole", pose = etat.pose || "bas";
    var s = ['<svg viewBox="0 0 160 240" xmlns="http://www.w3.org/2000/svg" class="avatar-svg">'];

    s.push('<ellipse cx="80" cy="232" rx="42" ry="6" fill="rgba(0,0,0,.28)"/>');

    // Cheveux de derrière
    if (coiffure === "longs") s.push('<path d="M44 74 Q40 38 80 36 Q120 38 116 74 L122 142 Q100 152 80 147 Q60 152 38 142 Z" fill="' + ch + '"/>');
    if (coiffure === "carre") s.push('<path d="M44 74 Q40 38 80 36 Q120 38 116 74 L119 110 Q80 120 41 110 Z" fill="' + ch + '"/>');
    if (coiffure === "courts") s.push('<path d="M46 74 Q44 38 80 38 Q116 38 114 74 L112 94 Q80 98 48 94 Z" fill="' + ch + '"/>');
    if (coiffure === "queue") {
      s.push('<path d="M46 74 Q44 38 80 38 Q116 38 114 74 L112 94 Q80 98 48 94 Z" fill="' + ch + '"/>');
      s.push('<path d="M110 52 Q146 52 140 100 Q136 130 118 136 Q128 104 108 74 Z" fill="' + ch + '" class="queue"/>');
    }
    if (coiffure === "couettes") {
      s.push('<path d="M46 74 Q44 38 80 38 Q116 38 114 74 L112 94 Q80 98 48 94 Z" fill="' + ch + '"/>');
      s.push('<ellipse cx="34" cy="100" rx="13" ry="24" fill="' + ch + '" class="couette"/>');
      s.push('<ellipse cx="126" cy="100" rx="13" ry="24" fill="' + ch + '" class="couette"/>');
    }

    // Cartable (derrière le corps)
    if (etat.cartable) s.push('<rect x="44" y="118" width="72" height="58" rx="12" fill="#D35400"/><rect x="50" y="150" width="60" height="16" rx="5" fill="#E67E22"/>');

    // Jambes
    if (tenue === "pyjama") {
      s.push('<rect x="62" y="170" width="16" height="52" rx="7" fill="' + tc + '"/><rect x="82" y="170" width="16" height="52" rx="7" fill="' + tc + '"/>');
    } else {
      s.push('<rect x="64" y="176" width="12" height="46" rx="5" fill="' + peau + '"/><rect x="84" y="176" width="12" height="46" rx="5" fill="' + peau + '"/>');
      if (tenue === "ecole") s.push('<rect x="63" y="208" width="14" height="14" rx="4" fill="#FFFFFF"/><rect x="83" y="208" width="14" height="14" rx="4" fill="#FFFFFF"/>');
    }

    // Pieds : baskets, chaussons ou pieds nus
    if (etat.chaussures) {
      s.push('<path d="M54 226 Q54 214 70 216 Q80 217 82 226 Z" fill="#FFFFFF" stroke="' + tc + '" stroke-width="3"/>');
      s.push('<path d="M78 226 Q80 217 90 216 Q106 214 106 226 Z" fill="#FFFFFF" stroke="' + tc + '" stroke-width="3"/>');
    } else if (tenue === "pyjama") {
      s.push('<ellipse cx="69" cy="224" rx="14" ry="7" fill="#FFC9DE"/><ellipse cx="91" cy="224" rx="14" ry="7" fill="#FFC9DE"/>');
    } else {
      s.push('<ellipse cx="70" cy="224" rx="9" ry="5" fill="' + (tenue === "ecole" ? "#FFFFFF" : peau) + '"/><ellipse cx="90" cy="224" rx="9" ry="5" fill="' + (tenue === "ecole" ? "#FFFFFF" : peau) + '"/>');
    }

    // Corps
    var manche = tc;
    if (tenue === "pyjama") {
      s.push('<rect x="52" y="114" width="56" height="66" rx="18" fill="' + tc + '"/>');
      s.push('<g fill="#FFFFFF" opacity=".55"><circle cx="66" cy="134" r="3"/><circle cx="92" cy="128" r="3"/><circle cx="80" cy="152" r="3"/><circle cx="96" cy="164" r="3"/><circle cx="64" cy="166" r="3"/></g>');
    } else if (tenue === "bain") {
      manche = peau;
      s.push('<path d="M50 122 Q80 114 110 122 L112 184 Q80 192 48 184 Z" fill="#FFFFFF"/>');
      s.push('<path d="M50 140 Q80 134 110 140 M49 160 Q80 154 111 160" stroke="' + tc + '" stroke-width="4" fill="none"/>');
    } else {
      s.push('<path d="M58 116 Q80 108 102 116 L116 186 Q80 196 44 186 Z" fill="' + tc + '"/>');
      s.push('<path d="M68 116 L80 130 L92 116 Z" fill="#FFFFFF"/>');
    }
    if (etat.cartable) {
      s.push('<path d="M64 118 L68 168" stroke="#A04000" stroke-width="6" stroke-linecap="round"/><path d="M96 118 L92 168" stroke="#A04000" stroke-width="6" stroke-linecap="round"/>');
    }

    // Bras et objet tenu
    function bras(x1, y1, x2, y2, classe) {
      return '<g' + (classe ? ' class="' + classe + '"' : '') + '><path d="M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + '" stroke="' + manche +
             '" stroke-width="13" stroke-linecap="round"/><circle cx="' + x2 + '" cy="' + y2 + '" r="7" fill="' + peau + '"/></g>';
    }
    function objet(e, x, y, taille, classe) {
      return e ? '<text x="' + x + '" y="' + y + '" font-size="' + taille + '" text-anchor="middle" dominant-baseline="central"' +
                 (classe ? ' class="' + classe + '"' : '') + '>' + e + '</text>' : "";
    }
    var gauche = bras(58, 122, 46, 168), droite = "", devant = "";
    if (pose === "tenir") {
      gauche = bras(58, 122, 70, 156);
      droite = bras(102, 122, 90, 156);
      devant = objet(etat.objet, 80, 160, 34, "objet-tenu");
    } else if (pose === "bouche") {
      droite = bras(102, 122, 96, 104, "frotte") + objet(etat.objet, 99, 99, 26, "frotte");
    } else if (pose === "tete") {
      droite = bras(102, 122, 118, 78, "coiffe") + objet(etat.objet, 124, 64, 28, "coiffe");
    } else if (pose === "ballon") {
      droite = bras(102, 122, 120, 98) + '<path d="M120 98 Q128 70 134 42" stroke="#FFFFFF" stroke-width="1.5" fill="none"/>' + objet(etat.objet, 136, 26, 36, "flotte");
    } else if (pose === "coucou") {
      droite = bras(102, 122, 126, 82, "coucou");
    } else {
      droite = bras(102, 122, 114, 168);
    }

    // Tête
    s.push('<circle cx="46" cy="80" r="7" fill="' + peauOmbre + '"/><circle cx="114" cy="80" r="7" fill="' + peauOmbre + '"/>');
    s.push('<circle cx="80" cy="78" r="34" fill="' + peau + '"/>');

    // Frange : en bataille au réveil, bien coiffée ensuite
    if (etat.bataille) {
      s.push('<path d="M46 72 Q48 40 80 40 Q112 40 114 72 Q106 58 98 64 Q92 52 82 60 Q72 50 66 62 Q56 56 46 72 Z" fill="' + ch + '"/>');
      s.push('<path d="M66 46 L60 26 L74 40 L80 20 L88 40 L102 28 L96 48 Z" fill="' + ch + '"/>');
    } else {
      s.push('<path d="M46 74 Q46 40 80 40 Q114 40 114 74 Q100 56 80 58 Q62 56 46 74 Z" fill="' + ch + '"/>');
      if (coiffure === "couettes") s.push('<circle cx="42" cy="78" r="5" fill="' + tc + '"/><circle cx="118" cy="78" r="5" fill="' + tc + '"/>');
      if (coiffure === "queue") s.push('<circle cx="112" cy="56" r="5" fill="' + tc + '"/>');
    }

    // Visage
    if (etat.expression === "sommeil") {
      s.push('<path d="M61 83 Q67 88 73 83 M87 83 Q93 88 99 83" stroke="' + encre + '" stroke-width="3" fill="none" stroke-linecap="round"/>');
    } else {
      s.push('<ellipse cx="67" cy="82" rx="4.2" ry="5.2" fill="' + encre + '"/><ellipse cx="93" cy="82" rx="4.2" ry="5.2" fill="' + encre + '"/>');
      s.push('<circle cx="68.6" cy="80" r="1.6" fill="#FFFFFF"/><circle cx="94.6" cy="80" r="1.6" fill="#FFFFFF"/>');
    }
    s.push('<circle cx="59" cy="94" r="5" fill="#FF8FA8" opacity=".55"/><circle cx="101" cy="94" r="5" fill="#FF8FA8" opacity=".55"/>');
    if (acc === "taches") s.push('<g fill="#C98358"><circle cx="62" cy="90" r="1.4"/><circle cx="57" cy="93" r="1.4"/><circle cx="64" cy="95" r="1.4"/><circle cx="98" cy="90" r="1.4"/><circle cx="103" cy="93" r="1.4"/><circle cx="96" cy="95" r="1.4"/></g>');
    if (etat.expression === "sommeil") s.push('<ellipse cx="80" cy="101" rx="5" ry="6" fill="' + bouche + '"/>');
    else if (etat.expression === "rire") s.push('<path d="M70 96 Q80 112 90 96 Z" fill="' + bouche + '"/>');
    else s.push('<path d="M73 97 Q80 104 87 97" stroke="' + bouche + '" stroke-width="3" fill="none" stroke-linecap="round"/>');
    if (pose === "bouche") s.push('<g fill="#FFFFFF" class="mousse"><circle cx="89" cy="104" r="3.5"/><circle cx="84" cy="108" r="2.5"/><circle cx="93" cy="109" r="2"/></g>');

    // Accessoires
    if (acc === "lunettes") s.push('<g fill="none" stroke="' + encre + '" stroke-width="3"><circle cx="67" cy="82" r="10"/><circle cx="93" cy="82" r="10"/><path d="M77 81 H83"/></g>');
    if (acc === "serretete" && !etat.bataille) s.push('<path d="M49 62 Q80 30 111 62" fill="none" stroke="' + tc + '" stroke-width="7" stroke-linecap="round"/>');
    if (acc === "noeud" && !etat.bataille) s.push('<g transform="translate(104 46)"><path d="M0 0 L-15 -10 L-15 10 Z M0 0 L15 -10 L15 10 Z" fill="' + tc + '"/><circle r="4.5" fill="' + tc + '"/></g>');
    if (etat.expression === "sommeil") s.push(objet("💤", 124, 40, 22, "zzz-avatar"));

    s.push(gauche, droite, devant);
    s.push('</svg>');
    return s.join("");
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
  function total(stock, nom) {
    var notes = stock.lire("notes") || {}, t = 0;
    for (var cle in notes) if (notes[cle] && notes[cle][nom]) t += notes[cle][nom];
    return t;
  }
  function totalTous(stock) {
    return FILLES.reduce(function (s, f) { return s + total(stock, f.nom); }, 0);
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
    else if (md <= "09-21") particules = ["🌻", "🐝", "☀️"];
    else particules = ["🍂", "🍁", "🍂"];
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
    sceneDe: sceneDe, etatAvatar: etatAvatar, avatarSVG: avatarSVG,
    CHEVEUX: CHEVEUX, CHEVEUX_NOMS: CHEVEUX_NOMS, COIFFURES: COIFFURES, ACCESSOIRES: ACCESSOIRES,
    routines: routines, normaliserRoutine: normaliserRoutine, programme: programme,
    cleNote: cleNote, total: total, totalTous: totalTous, cagnotte: cagnotte,
    rappelsDuJour: rappelsDuJour, decorDuJour: decorDuJour,
    Calendrier: Calendrier
  };
})();
