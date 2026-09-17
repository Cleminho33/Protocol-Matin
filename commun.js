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
  var JOURS_ECOLE_DEFAUT = { "1": true, "2": true, "3": true, "4": true, "5": true };

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function cleJour(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function lireLocal(cle, defaut) {
    try { var b = localStorage.getItem(cle); return b ? JSON.parse(b) : defaut; } catch (e) { return defaut; }
  }
  function ecrireLocal(cle, v) {
    try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) {}
  }
  function sansEmoji(t) {
    try { return t.replace(new RegExp("\\p{Extended_Pictographic}|\\uFE0F|\\u200D", "gu"), "").trim(); }
    catch (e) { return t; }
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
      enLigne: enLigne,
      code: code
    };
  }

  // ---------- Lectures pratiques ----------
  function reglages(stock) {
    var r = stock.lire("reglages") || {};
    var jours = {}, k;
    for (k in JOURS_ECOLE_DEFAUT) jours[k] = JOURS_ECOLE_DEFAUT[k];
    if (r.joursEcole) for (k in r.joursEcole) jours[k] = !!r.joursEcole[k];
    return { joursEcole: jours, vacances: r.vacances !== false };
  }
  function total(stock, nom) {
    var notes = stock.lire("notes") || {}, t = 0;
    for (var jour in notes) if (notes[jour] && notes[jour][nom]) t += notes[jour][nom];
    return t;
  }
  function rappelsDuJour(stock, d) {
    var out = [];
    [stock.lire("rappels/hebdo/" + d.getDay()), stock.lire("rappels/dates/" + cleJour(d))].forEach(function (o) {
      if (!o) return;
      Object.keys(o).sort().forEach(function (k) { if (o[k]) out.push(o[k]); });
    });
    return out;
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

    // Renvoie null si c'est un jour d'école, sinon la raison
    function raisonSansEcole(d, regl) {
      var j = d.getDay();
      if (!regl.joursEcole[j]) return "pas-ecole";
      if (!regl.vacances || !cache) return null;
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

    return { charger: charger, raisonSansEcole: raisonSansEcole, prochaines: prochaines };
  })();

  return {
    DB_URL: DB_URL, FILLES: FILLES, JOURS: JOURS,
    pad: pad, cleJour: cleJour, sansEmoji: sansEmoji,
    creerStock: creerStock, reglages: reglages, total: total, rappelsDuJour: rappelsDuJour,
    Calendrier: Calendrier
  };
})();
