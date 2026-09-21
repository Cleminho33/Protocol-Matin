// Lou et Alba, dessinées et animées.
// Les mains visent des positions précises (bras à coude calculé), et les objets sont dessinés
// et tenus par le bon bout. Repère du dessin : 220 × 260, fille centrée en x = 110, pieds à y = 238.
var AVATARS = (function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var PEAU = "#FFD7B5", PEAU_OMBRE = "#F0B993", ENCRE = "#2D2D3A", BOUCHE = "#8E3B46";
  var CHEVEUX = { blond: "#E6B656", blondChatain: "#B98A4E", chatain: "#8B5A2B", brun: "#4A2E1C", roux: "#C65A2E", noir: "#262020" };
  var BRAS1 = 30, BRAS2 = 30, JAMBE1 = 31, JAMBE2 = 31;

  // ---------- Outils ----------
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function douce(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function entre(t, a, b) { return douce((t - a) / (b - a)); }
  function cycle(t, periode) { var v = t / periode; return v - Math.floor(v); }
  function pt(x, y) { return { x: x, y: y }; }
  function vers(a, b, t) { return pt(mix(a.x, b.x, t), mix(a.y, b.y, t)); }
  function tourne(p, degres, cx, cy) {
    var a = degres * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), x = p.x - cx, y = p.y - cy;
    return pt(cx + x * c - y * s, cy + x * s + y * c);
  }
  // Suite de valeurs clés [[t, valeur], …] avec t de 0 à 1 ; valeurs nombres ou objets {x, y, …}
  function trajet(cles, t) {
    if (t <= cles[0][0]) return cles[0][1];
    for (var i = 1; i < cles.length; i++) {
      if (t <= cles[i][0]) {
        var u = douce((t - cles[i - 1][0]) / (cles[i][0] - cles[i - 1][0]));
        var a = cles[i - 1][1], b = cles[i][1];
        if (typeof a === "number") return mix(a, b, u);
        var o = {};
        for (var k in a) o[k] = mix(a[k], b[k], u);
        return o;
      }
    }
    return cles[cles.length - 1][1];
  }
  // Membre à deux segments : articulation (coude/genou) calculée, pliée vers l'extérieur
  function membre(depart, cible, l1, l2, dehors) {
    var dx = cible.x - depart.x, dy = cible.y - depart.y, d = Math.sqrt(dx * dx + dy * dy), m = l1 + l2 - 0.5;
    if (d > m) { cible = pt(depart.x + dx / d * m, depart.y + dy / d * m); d = m; }
    d = Math.max(d, 2);
    var a = Math.atan2(cible.y - depart.y, cible.x - depart.x);
    var b = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    var c1 = pt(depart.x + Math.cos(a + b) * l1, depart.y + Math.sin(a + b) * l1);
    var c2 = pt(depart.x + Math.cos(a - b) * l1, depart.y + Math.sin(a - b) * l1);
    var milieu = (c1.x - c2.x) * dehors > 0 ? c1 : c2;
    return { milieu: milieu, bout: cible };
  }
  function trace(p0, p1, p2) {
    return "M" + p0.x.toFixed(1) + " " + p0.y.toFixed(1) + " L" + p1.x.toFixed(1) + " " + p1.y.toFixed(1) +
           (p2 ? " L" + p2.x.toFixed(1) + " " + p2.y.toFixed(1) : "");
  }
  function place(n, x, y, rot, echelle) {
    n.setAttribute("transform", "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ")" +
      (rot ? " rotate(" + rot.toFixed(1) + ")" : "") + (echelle && echelle !== 1 ? " scale(" + echelle.toFixed(3) + ")" : ""));
  }
  function voir(n, o) { n.setAttribute("opacity", clamp(o, 0, 1).toFixed(2)); }

  // ---------- Objets dessinés (point de prise en 0,0) ----------
  function dessinerTartine(g) {
    // tenue par le bord droit, la tartine part vers la gauche
    var corps = el("g", { "class": "mange" }, g);
    el("rect", { x: -34, y: -12, width: 32, height: 24, rx: 5, fill: "#D9A05B" }, corps);
    el("rect", { x: -32, y: -10, width: 28, height: 20, rx: 4, fill: "#F2C98A" }, corps);
    el("path", { d: "M-31 -8 Q-24 -11 -17 -7 Q-10 -11 -5 -8 L-5 6 Q-12 9 -18 5 Q-25 9 -31 6 Z", fill: "#5A3218" }, corps);
    el("circle", { cx: 0, cy: 0, r: 7, fill: PEAU }, g);  // les doigts par-dessus
    return corps;
  }
  function dessinerVerre(g) {
    // tenu par la droite : l'origine (0,0) est au point de prise, le verre part vers la gauche
    g = el("g", { transform: "translate(-9 -2)" }, g);
    el("path", { d: "M-10 -16 L10 -16 L8 16 Q0 19 -8 16 Z", fill: "rgba(220,240,255,.35)", stroke: "#FFFFFF", "stroke-width": 2 }, g);
    var jus = el("rect", { x: -9, y: -14, width: 18, height: 29, fill: "#FF9F1A" }, g);
    var clip = el("clipPath", { id: "verre" + Math.random().toString(36).slice(2) }, g);
    el("path", { d: "M-10 -16 L10 -16 L8 16 Q0 19 -8 16 Z" }, clip);
    jus.setAttribute("clip-path", "url(#" + clip.id + ")");
    el("circle", { cx: 9, cy: 2, r: 7, fill: PEAU }, g);
    return jus;
  }
  function dessinerBrosseDents(g, couleur) {
    // manche dans la main, tête vers la gauche, poils vers le haut
    el("rect", { x: -40, y: -3, width: 42, height: 6, rx: 3, fill: couleur }, g);
    el("rect", { x: -46, y: -4, width: 13, height: 7, rx: 3, fill: "#FFFFFF" }, g);
    el("rect", { x: -45, y: -10, width: 11, height: 6, rx: 1.5, fill: "#7FD6FF" }, g);
    el("path", { d: "M-45 -10 Q-42 -15 -39 -10 Q-37 -14 -34 -10 Z", fill: "#FFFFFF" }, g);
    el("circle", { cx: 0, cy: 0, r: 7, fill: PEAU }, g);
  }
  function dessinerBrosseCheveux(g) {
    // manche dans la main, brosse vers la gauche, poils vers le bas-gauche
    el("rect", { x: -20, y: -3.5, width: 22, height: 7, rx: 3.5, fill: "#8E5CC4" }, g);
    el("ellipse", { cx: -30, cy: 0, rx: 13, ry: 10, fill: "#B084E0" }, g);
    var poils = el("g", { fill: "#FFFFFF" }, g);
    [[-36, -4], [-30, -5], [-24, -4], [-37, 2], [-31, 2], [-25, 2], [-31, 7]].forEach(function (p) {
      el("circle", { cx: p[0], cy: p[1], r: 1.4 }, poils);
    });
    el("circle", { cx: 0, cy: 0, r: 7, fill: PEAU }, g);
  }
  function dessinerPyjamaPlie(g, couleur) {
    el("rect", { x: -18, y: -9, width: 36, height: 18, rx: 5, fill: couleur }, g);
    el("path", { d: "M-18 -2 H18", stroke: "rgba(255,255,255,.5)", "stroke-width": 2 }, g);
    el("circle", { cx: -8, cy: 4, r: 2, fill: "#FFFFFF", opacity: .6 }, g);
    el("circle", { cx: 7, cy: -5, r: 2, fill: "#FFFFFF", opacity: .6 }, g);
  }
  function dessinerLivre(g) {
    el("path", { d: "M0 -16 Q-14 -20 -28 -15 L-28 14 Q-14 9 0 13 Z", fill: "#FFFFFF", stroke: "#C9C9D6", "stroke-width": 1.5 }, g);
    el("path", { d: "M0 -16 Q14 -20 28 -15 L28 14 Q14 9 0 13 Z", fill: "#FFFFFF", stroke: "#C9C9D6", "stroke-width": 1.5 }, g);
    el("path", { d: "M-22 -8 H-6 M-22 -2 H-6 M-22 4 H-9 M6 -8 H22 M6 -2 H22 M6 4 H18", stroke: "#B8B8C8", "stroke-width": 1.5 }, g);
  }
  function dessinerCartable(g) {
    el("rect", { x: 74, y: 118, width: 72, height: 60, rx: 12, fill: "#D35400" }, g);
    el("rect", { x: 80, y: 150, width: 60, height: 18, rx: 5, fill: "#E67E22" }, g);
  }
  function dessinerLitReveil(g, couleur) {
    var arriere = el("g", {}, g);
    el("rect", { x: 48, y: 92, width: 124, height: 110, rx: 16, fill: "#B9835A" }, arriere);
    el("rect", { x: 56, y: 100, width: 108, height: 94, rx: 12, fill: "#C99670" }, arriere);
    el("ellipse", { cx: 110, cy: 150, rx: 54, ry: 20, fill: "#FFFFFF" }, arriere);
    return arriere;
  }
  function dessinerCouverture(g, couleur) {
    var c = el("g", {}, g);
    el("rect", { x: 22, y: 172, width: 176, height: 84, rx: 20, fill: couleur }, c);
    el("rect", { x: 22, y: 172, width: 176, height: 16, rx: 8, fill: "#FFFFFF", opacity: .85 }, c);
    el("path", { d: "M40 206 H180 M40 226 H180", stroke: "rgba(255,255,255,.35)", "stroke-width": 4 }, c);
    return c;
  }
  function dessinerTable(g) {
    var t = el("g", {}, g);
    el("rect", { x: 14, y: 182, width: 192, height: 70, rx: 6, fill: "#C0874F" }, t);
    el("rect", { x: 10, y: 176, width: 200, height: 16, rx: 5, fill: "#FFFFFF" }, t);
    el("path", { d: "M10 192 H210", stroke: "#FF6B6B", "stroke-width": 3, "stroke-dasharray": "8 6" }, t);
    el("ellipse", { cx: 74, cy: 180, rx: 28, ry: 6, fill: "#F4F4F8", stroke: "#DADAE6", "stroke-width": 1.5 }, t);
    return t;
  }
  function dessinerChambre(g, couleur) {
    var c = el("g", {}, g);
    // lit à gauche
    el("rect", { x: -4, y: 150, width: 12, height: 100, rx: 4, fill: "#B9835A" }, c);
    el("rect", { x: 0, y: 190, width: 88, height: 40, rx: 8, fill: "#FFFFFF" }, c);
    el("rect", { x: 34, y: 194, width: 56, height: 38, rx: 8, fill: "#9FB4FF" }, c);
    el("ellipse", { cx: 26, cy: 188, rx: 20, ry: 9, fill: "#FFFFFF", stroke: "#E0E0EA", "stroke-width": 1.5 }, c);
    // table de nuit et veilleuse à droite
    el("rect", { x: 166, y: 196, width: 46, height: 52, rx: 6, fill: "#C0874F" }, c);
    var halo = el("circle", { cx: 186, cy: 166, r: 30, fill: "#FFE680", opacity: .55 }, c);
    el("rect", { x: 180, y: 180, width: 12, height: 16, rx: 3, fill: "#FFFFFF" }, c);
    var abat = el("path", { d: "M172 182 Q186 150 200 182 Z", fill: "#FFE680" }, c);
    el("circle", { cx: 186, cy: 190, r: 3, fill: "#FF6B6B" }, c);
    return { groupe: c, halo: halo, abat: abat };
  }

  // =====================================================================
  // Une fille
  // =====================================================================
  function creer(conteneur, fille, apparence) {
    apparence = apparence || {};
    var tc = fille.couleur;
    var ch = CHEVEUX[apparence.cheveux] || CHEVEUX.chatain;
    var coiffure = apparence.coiffure || "longs";
    var acc = apparence.accessoire || "";
    var clair = "rgba(255,255,255,.35)";

    var svg = el("svg", { viewBox: "0 0 220 260", "class": "avatar-svg", preserveAspectRatio: "xMidYMid meet" });
    var R = {};

    // Décor derrière
    R.litReveil = dessinerLitReveil(svg, tc);
    R.chambre = dessinerChambre(svg, tc);
    el("ellipse", { cx: 110, cy: 246, rx: 46, ry: 6, fill: "rgba(0,0,0,.28)" }, svg);

    R.tout = el("g", {}, svg);

    // Cheveux de derrière (suivent la tête)
    R.cheveuxArriere = el("g", {}, R.tout);
    var courts = "M76 74 Q74 38 110 38 Q146 38 144 74 L142 94 Q110 98 78 94 Z";
    if (coiffure === "longs") el("path", { d: "M74 74 Q70 38 110 36 Q150 38 146 74 L152 142 Q130 152 110 147 Q90 152 68 142 Z", fill: ch }, R.cheveuxArriere);
    if (coiffure === "carre") el("path", { d: "M74 74 Q70 38 110 36 Q150 38 146 74 L149 110 Q110 120 71 110 Z", fill: ch }, R.cheveuxArriere);
    if (coiffure === "courts") el("path", { d: courts, fill: ch }, R.cheveuxArriere);
    if (coiffure === "queue") {
      el("path", { d: courts, fill: ch }, R.cheveuxArriere);
      el("path", { d: "M140 52 Q176 52 170 100 Q166 130 148 136 Q158 104 138 74 Z", fill: ch, "class": "queue" }, R.cheveuxArriere);
    }
    if (coiffure === "couettes") {
      el("path", { d: courts, fill: ch }, R.cheveuxArriere);
      el("ellipse", { cx: 64, cy: 100, rx: 13, ry: 24, fill: ch, "class": "couette" }, R.cheveuxArriere);
      el("ellipse", { cx: 156, cy: 100, rx: 13, ry: 24, fill: ch, "class": "couette" }, R.cheveuxArriere);
    }

    R.cartable = el("g", {}, R.tout);
    dessinerCartable(R.cartable);

    // Jambes (calculées à chaque image) et pieds
    R.jambesPeau = [el("path", { stroke: PEAU, "stroke-width": 12, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" }, R.tout),
                    el("path", { stroke: PEAU, "stroke-width": 12, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" }, R.tout)];
    R.jambesPyjama = el("g", {}, R.tout);
    R.pantalon = [el("path", { stroke: tc, "stroke-width": 16, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" }, R.jambesPyjama),
                  el("path", { stroke: tc, "stroke-width": 16, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" }, R.jambesPyjama)];
    R.piedsArriere = el("g", {}, R.tout);
    R.pieds = [98, 122].map(function (fx, n) {
      var sens = n === 0 ? -1 : 1;
      var g = el("g", {}, R.piedsArriere);
      var chaussons = el("ellipse", { cx: fx + sens * 3, cy: 242, rx: 14, ry: 7, fill: "#FFC9DE" }, g);
      var chaussettes = el("ellipse", { cx: fx + sens * 2, cy: 242, rx: 10, ry: 5, fill: "#FFFFFF" }, g);
      var basket = el("g", {}, g);
      el("path", { d: "M" + (fx + sens * 17) + " 248 Q" + (fx + sens * 17) + " 232 " + fx + " 234 Q" + (fx - sens * 11) + " 235 " + (fx - sens * 12) + " 248 Z",
                   fill: "#FFFFFF", stroke: tc, "stroke-width": 3 }, basket);
      el("rect", { x: fx - 13, y: 246, width: 30, height: 4, rx: 2, fill: "#D0D0DC", transform: sens < 0 ? "translate(-4 0)" : "" }, basket);
      var scratch = el("g", {}, basket);
      el("rect", { x: fx - 9, y: 236, width: 18, height: 6, rx: 2.5, fill: tc }, scratch);
      el("rect", { x: fx - 7, y: 237.5, width: 14, height: 3, rx: 1.5, fill: "rgba(255,255,255,.45)" }, scratch);
      return { g: g, fx: fx, sens: sens, chaussons: chaussons, chaussettes: chaussettes, basket: basket, scratch: scratch };
    });

    // Tête
    R.tete = el("g", {}, R.tout);
    el("circle", { cx: 76, cy: 80, r: 7, fill: PEAU_OMBRE }, R.tete);
    el("circle", { cx: 144, cy: 80, r: 7, fill: PEAU_OMBRE }, R.tete);
    el("rect", { x: 103, y: 104, width: 14, height: 16, fill: PEAU }, R.tete);
    el("circle", { cx: 110, cy: 78, r: 34, fill: PEAU }, R.tete);
    R.yeuxOuverts = el("g", {}, R.tete);
    el("ellipse", { cx: 97, cy: 82, rx: 4.2, ry: 5.2, fill: ENCRE }, R.yeuxOuverts);
    el("ellipse", { cx: 123, cy: 82, rx: 4.2, ry: 5.2, fill: ENCRE }, R.yeuxOuverts);
    el("circle", { cx: 98.6, cy: 80, r: 1.6, fill: "#FFFFFF" }, R.yeuxOuverts);
    el("circle", { cx: 124.6, cy: 80, r: 1.6, fill: "#FFFFFF" }, R.yeuxOuverts);
    R.yeuxFermes = el("path", { d: "M91 83 Q97 88 103 83 M117 83 Q123 88 129 83", stroke: ENCRE, "stroke-width": 3, fill: "none", "stroke-linecap": "round" }, R.tete);
    R.yeuxJoie = el("path", { d: "M91 85 Q97 78 103 85 M117 85 Q123 78 129 85", stroke: ENCRE, "stroke-width": 3, fill: "none", "stroke-linecap": "round" }, R.tete);
    el("circle", { cx: 89, cy: 95, r: 5, fill: "#FF8FA8", opacity: .55 }, R.tete);
    el("circle", { cx: 131, cy: 95, r: 5, fill: "#FF8FA8", opacity: .55 }, R.tete);
    if (acc === "taches") {
      var taches = el("g", { fill: "#C98358" }, R.tete);
      [[92, 90], [87, 93], [94, 95], [128, 90], [133, 93], [126, 95]].forEach(function (p) { el("circle", { cx: p[0], cy: p[1], r: 1.4 }, taches); });
    }
    R.bouches = {
      sourire: el("path", { d: "M103 97 Q110 104 117 97", stroke: BOUCHE, "stroke-width": 3, fill: "none", "stroke-linecap": "round" }, R.tete),
      grand: el("path", { d: "M100 96 Q110 113 120 96 Z", fill: BOUCHE }, R.tete),
      ouverte: el("ellipse", { cx: 110, cy: 101, rx: 5, ry: 6, fill: BOUCHE }, R.tete),
      baille: el("ellipse", { cx: 110, cy: 103, rx: 7, ry: 10, fill: BOUCHE }, R.tete),
      mache: el("ellipse", { cx: 110, cy: 100, rx: 6, ry: 2.5, fill: BOUCHE }, R.tete),
      dents: el("g", {}, R.tete)
    };
    el("rect", { x: 97, y: 93, width: 26, height: 16, rx: 7, fill: BOUCHE }, R.bouches.dents);
    el("rect", { x: 100, y: 94.5, width: 20, height: 4.5, rx: 1.5, fill: "#FFFFFF" }, R.bouches.dents);
    el("rect", { x: 101, y: 103, width: 18, height: 4, rx: 1.5, fill: "#FFFFFF" }, R.bouches.dents);
    el("path", { d: "M105 94.5 V99 M110 94.5 V99 M115 94.5 V99 M106 103 V107 M114 103 V107", stroke: "#E8D6D6", "stroke-width": .8 }, R.bouches.dents);
    R.mousse = el("g", { fill: "#FFFFFF" }, R.tete);
    [[97, 104, 4], [103, 109, 3.2], [118, 109, 3], [123, 104, 3.5], [110, 111, 2.5]].forEach(function (c) { el("circle", { cx: c[0], cy: c[1], r: c[2] }, R.mousse); });
    R.frangeSage = el("path", { d: "M76 74 Q76 40 110 40 Q144 40 144 74 Q130 56 110 58 Q92 56 76 74 Z", fill: ch }, R.tete);
    R.frangeBataille = el("g", {}, R.tete);
    el("path", { d: "M76 72 Q78 40 110 40 Q142 40 144 72 Q136 58 128 64 Q122 52 112 60 Q102 50 96 62 Q86 56 76 72 Z", fill: ch }, R.frangeBataille);
    el("path", { d: "M96 46 L90 24 L104 40 L110 18 L118 40 L134 26 L126 48 Z", fill: ch }, R.frangeBataille);
    R.attaches = el("g", {}, R.tete);
    if (coiffure === "couettes") { el("circle", { cx: 72, cy: 78, r: 5, fill: tc }, R.attaches); el("circle", { cx: 148, cy: 78, r: 5, fill: tc }, R.attaches); }
    if (coiffure === "queue") el("circle", { cx: 142, cy: 56, r: 5, fill: tc }, R.attaches);
    if (acc === "lunettes") {
      var lun = el("g", { fill: "none", stroke: ENCRE, "stroke-width": 3 }, R.tete);
      el("circle", { cx: 97, cy: 82, r: 10 }, lun); el("circle", { cx: 123, cy: 82, r: 10 }, lun); el("path", { d: "M107 81 H113" }, lun);
    }
    R.accessoire = el("g", {}, R.tete);
    if (acc === "serretete") el("path", { d: "M79 62 Q110 30 141 62", fill: "none", stroke: tc, "stroke-width": 7, "stroke-linecap": "round" }, R.accessoire);
    if (acc === "noeud") {
      var noeud = el("g", { transform: "translate(134 46)" }, R.accessoire);
      el("path", { d: "M0 0 L-15 -10 L-15 10 Z M0 0 L15 -10 L15 10 Z", fill: tc }, noeud);
      el("circle", { r: 4.5, fill: tc }, noeud);
    }

    // Vêtements (dessinés après la tête : le haut du pyjama passe par-dessus)
    R.buste = el("g", {}, R.tout);
    // Maillot de corps (toujours là, sous les vêtements) : jamais de trou ni de buste nu pendant l'habillage
    el("rect", { x: 86, y: 114, width: 48, height: 68, rx: 20, fill: "#F4F4F8" }, R.buste);
    el("path", { d: "M100 116 Q110 124 120 116", stroke: "#DADAE6", "stroke-width": 2, fill: "none" }, R.buste);
    R.robe = el("g", {}, R.buste);
    el("path", { d: "M88 116 Q110 108 132 116 L146 188 Q110 198 74 188 Z", fill: tc }, R.robe);
    el("path", { d: "M98 116 L110 130 L122 116 Z", fill: "#FFFFFF" }, R.robe);
    el("path", { d: "M76 176 Q110 186 144 176", stroke: clair, "stroke-width": 3, fill: "none" }, R.robe);
    R.hautPyjama = el("g", {}, R.buste);
    el("rect", { x: 82, y: 114, width: 56, height: 66, rx: 18, fill: tc }, R.hautPyjama);
    var pois = el("g", { fill: "#FFFFFF", opacity: .55 }, R.hautPyjama);
    [[96, 134], [122, 128], [110, 152], [126, 164], [94, 166]].forEach(function (p) { el("circle", { cx: p[0], cy: p[1], r: 3 }, pois); });
    R.bretelles = el("path", { d: "M94 118 L98 170 M126 118 L122 170", stroke: "#A04000", "stroke-width": 6, "stroke-linecap": "round" }, R.buste);

    // Assise en tailleur pour les chaussures : les pieds passent devant la robe
    R.piedsAvant = el("g", {}, R.tout);

    // Bras (calculés à chaque image)
    function brasTrait(largeur, couleur) {
      return el("path", { stroke: couleur, "stroke-width": largeur, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" }, R.tout);
    }
    R.bras = [0, 1].map(function () { return { haut: brasTrait(13, tc), bas: brasTrait(12, PEAU), main: el("circle", { r: 7, fill: PEAU }, R.tout) }; });

    // Décor devant
    R.couverture = dessinerCouverture(svg, "#FFB3C7");
    R.table = dessinerTable(svg);

    // Objets
    R.tartine = el("g", {}, svg); R.tartineCorps = dessinerTartine(R.tartine);
    R.verre = el("g", {}, svg); R.jus = dessinerVerre(R.verre);
    R.brosseDents = el("g", {}, svg); dessinerBrosseDents(R.brosseDents, tc);
    R.brosseCheveux = el("g", {}, svg); dessinerBrosseCheveux(R.brosseCheveux);
    R.pyjamaPlie = el("g", {}, svg); dessinerPyjamaPlie(R.pyjamaPlie, tc);
    R.livre = el("g", {}, svg); dessinerLivre(R.livre);
    R.zzz = el("text", { x: 150, y: 40, "font-size": 22, "text-anchor": "middle" }, svg); R.zzz.textContent = "💤";
    R.scratch = el("text", { "font-size": 19, "font-weight": 800, "text-anchor": "middle", fill: "#FFD93D", stroke: ENCRE, "stroke-width": 4, "paint-order": "stroke" }, svg);
    R.scratch.textContent = "scratch !";

    conteneur.appendChild(svg);

    // ---------- Mise à jour d'une image ----------
    // etat : {tenue, bataille, chaussures, cartable, calin}
    // activite : reveil, repas, habits, dents, coiffure, dentsCoiffure, rangement, chaussures, jeu, pyjama, histoire, bain, coucou, fin, etoiles
    // t : secondes (horloge commune), p : avancement de l'étape (0 à 1), sens : +1 si le centre de l'écran est à droite
    function maj(etat, activite, t, p, sens) {
      etat = etat || {};
      sens = sens || 1;
      var P = {
        dy: Math.sin(t * 2) * 1.2, lean: 0, tete: 0, saut: 0,
        mains: [pt(84, 172 + Math.sin(t * 2) * 2), pt(136, 172 - Math.sin(t * 2) * 2)],
        yeux: (t % 4.3) < 0.13 ? "fermes" : "ouverts", bouche: "sourire",
        pyjama: etat.tenue === "pyjama" ? 1 : 0,
        hautPyjamaY: 0, robeY: 0, robeO: etat.tenue === "pyjama" ? 0 : 1,
        bataille: etat.bataille ? 1 : 0, mousse: 0,
        chaussures: !!etat.chaussures, cartable: !!etat.cartable,
        litReveil: 0, couverture: 0, table: 0, chambre: 0, lampe: 1,
        objets: {}, zzz: 0, scratchTexte: null, scratch: [0, 0], leve: [0, 0]
      };
      var c, u;

      switch (activite) {
        case "reveil":
          if (etat.calin && p >= 0.5) { calin(); break; }
          P.litReveil = 1; P.couverture = 1; P.chaussures = false;
          c = cycle(t, 5.5);
          P.yeux = "fermes";
          P.zzz = c < 0.32 ? 1 : 0;
          P.tete = trajet([[0, 9], [0.32, 9], [0.42, -5], [0.6, -5], [0.7, 0], [0.9, 0], [1, 9]], c);
          P.dy = trajet([[0, 6], [0.32, 6], [0.45, -6], [0.6, -6], [0.72, 2], [1, 6]], c);
          P.mains = [
            trajet([[0, pt(92, 168)], [0.32, pt(92, 168)], [0.44, pt(64, 42)], [0.6, pt(64, 42)], [0.7, pt(99, 84)], [0.86, pt(99, 84)], [1, pt(92, 168)]], c),
            trajet([[0, pt(128, 168)], [0.32, pt(128, 168)], [0.44, pt(156, 42)], [0.6, pt(156, 42)], [0.7, pt(121, 84)], [0.86, pt(121, 84)], [1, pt(128, 168)]], c)
          ];
          if (c > 0.7 && c < 0.86) { P.mains[0].y += Math.sin(t * 18) * 2; P.mains[1].y -= Math.sin(t * 18) * 2; }
          P.bouche = (c > 0.4 && c < 0.62) ? "baille" : "sourire";
          break;

        case "pyjama":
          c = cycle(t, 5);
          P.yeux = "fermes";
          P.mains = [trajet([[0, pt(84, 172)], [0.3, pt(84, 172)], [0.45, pt(64, 42)], [0.65, pt(64, 42)], [0.8, pt(84, 172)], [1, pt(84, 172)]], c),
                     trajet([[0, pt(136, 172)], [0.3, pt(136, 172)], [0.45, pt(156, 42)], [0.65, pt(156, 42)], [0.8, pt(136, 172)], [1, pt(136, 172)]], c)];
          P.bouche = (c > 0.42 && c < 0.66) ? "baille" : "sourire";
          P.dy = (c > 0.4 && c < 0.66) ? -5 : 0;
          break;

        case "repas":
          P.table = 1;
          c = cycle(t, 7);
          // La tartine part de la main vers la gauche : la main se place à droite de la bouche,
          // à une longueur de tartine (qui raccourcit à mesure qu'on la mange)
          var reste = 1 - 0.65 * clamp(p, 0, 1);
          var assiette = pt(106, 176), boucheTartine = pt(111 + 32 * reste, 106 + 11 * reste);
          var boucheVerre = pt(144, 101);
          P.mains[0] = pt(80, 180);
          P.mains[1] = trajet([[0, pt(140, 180)], [0.07, assiette], [0.17, boucheTartine], [0.42, boucheTartine],
                              [0.52, assiette], [0.57, pt(140, 180)], [0.62, pt(161, 166)], [0.72, boucheVerre],
                              [0.86, boucheVerre], [0.94, pt(161, 166)], [1, pt(140, 180)]], c);
          var mangeTartine = c > 0.19 && c < 0.42;
          if (mangeTartine) { P.mains[1].x += Math.sin(t * 13) * 2; P.mains[1].y += Math.sin(t * 13) * 1; }
          P.bouche = mangeTartine ? (Math.sin(t * 13) > 0 ? "ouverte" : "mache") : (c > 0.72 && c < 0.86 ? "ouverte" : "sourire");
          if (c >= 0.07 && c < 0.52) {
            var leve = trajet([[0.07, 0], [0.17, 19], [0.42, 19], [0.52, 0]], c);
            P.objets.tartine = { main: 1, r: leve, e: reste };
          } else P.objets.tartine = { x: 106, y: 172, r: 0, e: reste };
          if (c >= 0.62 && c < 0.94) {
            var incline = trajet([[0.62, 0], [0.72, -45], [0.86, -45], [0.94, 0]], c);
            P.objets.verre = { main: 1, r: incline, niveau: 1 - 0.8 * clamp(p, 0, 1) };
          } else {
            P.objets.verre = { x: 161, y: 164, r: 0, niveau: 1 - 0.8 * clamp(p, 0, 1) };
          }
          break;

        case "habits":
          c = cycle(t, 6.5);
          var monte = entre(c, 0.06, 0.26), descend = entre(c, 0.36, 0.56), retour = entre(c, 0.9, 1);
          P.pyjama = 1 - entre(c, 0.26, 0.36) + retour;
          P.hautPyjamaY = c > 0.88 ? 0 : -140 * monte;
          P.robeY = -140 * (1 - descend);
          P.robeO = (c > 0.3 ? 1 : 0) * (1 - retour);
          if (c < 0.06) P.mains = [vers(pt(84, 172), pt(94, 176), entre(c, 0, 0.06)), vers(pt(136, 172), pt(126, 176), entre(c, 0, 0.06))];
          else if (c < 0.3) P.mains = [pt(94, 176 - 140 * monte), pt(126, 176 - 140 * monte)];
          else if (c < 0.36) P.mains = [vers(pt(94, 36), pt(92, -10), entre(c, 0.3, 0.36)), vers(pt(126, 36), pt(128, -10), entre(c, 0.3, 0.36))];
          else if (c < 0.58) P.mains = [pt(90, 118 - 140 * (1 - descend)), pt(130, 118 - 140 * (1 - descend))];
          else {
            P.mains = [pt(88, 170), pt(132, 170)];
            P.yeux = "joie"; P.bouche = "grand";
            P.dy = -Math.abs(Math.sin((c - 0.58) * 18)) * 5;
          }
          if (c >= 0.26 && c < 0.36) P.objets.hautVole = entre(c, 0.26, 0.36);
          break;

        case "dents":
        case "dentsCoiffure":
          if (activite === "dentsCoiffure" && p >= 0.55) { coiffer((p - 0.55) / 0.45); break; }
          brosserDents(activite === "dentsCoiffure" ? p / 0.55 : p);
          break;

        case "coiffure":
          coiffer(p);
          break;

        case "rangement":
          P.chambre = 1;
          c = cycle(t, 9);
          P.lean = trajet([[0, 0], [0.06, -18], [0.2, -18], [0.3, 0], [0.4, -20], [0.56, -20], [0.64, 0], [0.7, 20], [0.82, 20], [0.9, 0], [1, 0]], c);
          P.dy = trajet([[0, 0], [0.06, 18], [0.2, 18], [0.3, 0], [0.4, 8], [0.56, 8], [0.64, 0], [0.7, 8], [0.82, 8], [0.9, 0], [1, 0]], c);
          var surLit = pt(66, 196), oreiller = pt(34, 180);
          P.mains = [
            trajet([[0, pt(84, 172)], [0.06, pt(58, 196)], [0.2, pt(58, 196)], [0.3, pt(98, 150)], [0.4, pt(26, 178)], [0.56, pt(26, 178)], [0.64, pt(84, 172)], [1, pt(84, 172)]], c),
            trajet([[0, pt(136, 172)], [0.06, pt(76, 196)], [0.2, pt(76, 196)], [0.3, pt(122, 150)], [0.4, pt(76, 166)], [0.56, pt(76, 166)], [0.64, pt(136, 172)], [0.72, pt(186, 188)], [0.82, pt(186, 188)], [0.9, pt(136, 172)], [1, pt(136, 172)]], c)
          ];
          if (c > 0.44 && c < 0.56) { P.mains[0].y += Math.abs(Math.sin(t * 10)) * -5; P.mains[1].y += Math.abs(Math.sin(t * 10)) * -5; }
          var pyj;
          if (c < 0.06) pyj = surLit;
          else if (c < 0.3) pyj = vers(P.mains[0], P.mains[1], 0.5);
          else if (c < 0.4) pyj = vers(pt(110, 150), oreiller, entre(c, 0.3, 0.4));
          else pyj = oreiller;
          P.objets.pyjamaPlie = { x: pyj.x, y: pyj.y - 4, r: c < 0.06 ? -8 : 0, o: 1 - entre(c, 0.93, 0.99) };
          P.lampe = 1 - entre(c, 0.76, 0.79) + entre(c, 0.94, 1);
          break;

        case "chaussures":
          P.chaussures = true; P.piedsDevant = true;
          c = cycle(t, 3.4);
          P.dy = 44;
          var pied = c < 0.5 ? 1 : 0;
          var cc = c < 0.5 ? c / 0.5 : (c - 0.5) / 0.5;
          var ouvre = trajet([[0, 0], [0.12, 1], [0.34, 1], [0.46, 0], [1, 0]], cc);
          P.scratch[pied] = ouvre;
          var f = R.pieds[pied];
          P.leve[pied] = -22 * trajet([[0, 0], [0.06, 1], [0.6, 1], [0.7, 0], [1, 0]], cc);
          var pivot = pt(f.fx - f.sens * 9, 239 + P.leve[pied]), bout = tourne(pt(f.fx + f.sens * 9, 239), -f.sens * 65 * ouvre, pivot.x, pivot.y);
          var mainQuiTire = pied === 1 ? 1 : 0;
          P.mains[mainQuiTire] = pt(bout.x + f.sens * 3, bout.y - 3);
          P.mains[1 - mainQuiTire] = pt(f.fx - f.sens * 6, 236 + P.leve[pied]);
          P.tete = pied === 1 ? 6 : -6;
          if (cc > 0.44 && cc < 0.7) P.scratchTexte = { x: f.fx + f.sens * 26, y: 214 - (cc - 0.44) * 30, o: 1 - entre(cc, 0.6, 0.7) };
          break;

        case "jeu":
          jouer();
          break;

        case "histoire":
          P.litReveil = 1; P.couverture = 1; P.chaussures = false;
          P.mains = [pt(92, 152), pt(128, 152)];
          P.objets.livre = { x: 110, y: 150 };
          P.tete = Math.sin(t * 0.9) * 5 + 4;
          P.yeux = "ouverts";
          break;

        case "bain":
          c = cycle(t, 0.7);
          P.mains = [pt(120 + Math.sin(t * 9) * 6, 140), pt(100 - Math.sin(t * 9) * 6, 146)];
          P.lean = Math.sin(t * 4) * 5;
          P.yeux = "joie"; P.bouche = "grand";
          break;

        case "coucou":
          P.saut = Math.abs(Math.sin(t * 5.5)) * 16;
          P.yeux = "joie"; P.bouche = "grand";
          if (sens > 0) P.mains = [pt(84, 168), pt(162 + Math.sin(t * 12) * 10, 50)];
          else P.mains = [pt(58 + Math.sin(t * 12) * 10, 50), pt(136, 168)];
          break;

        case "fin":
          P.cartable = true; P.chaussures = true;
          P.yeux = "joie"; P.bouche = "grand";
          if (sens > 0) P.mains = [pt(84, 170), pt(160 + Math.sin(t * 9) * 10, 52)];
          else P.mains = [pt(60 + Math.sin(t * 9) * 10, 52), pt(136, 170)];
          break;

        default:
          P.mains[1] = pt(136 + Math.sin(t * 1.5) * 4, 170);
      }

      function calin() {
        c = cycle(t, 2.6);
        P.yeux = "joie"; P.bouche = "grand";
        P.lean = sens * 7;
        u = trajet([[0, 0], [0.3, 0], [0.5, 1], [0.85, 1], [1, 0]], c);
        P.mains = [vers(pt(52, 104), pt(128, 128), u), vers(pt(168, 104), pt(92, 128), u)];
        P.dy = -3 * u;
        P.saut = u < 0.05 ? Math.abs(Math.sin(t * 8)) * 3 : 0;
      }

      function brosserDents(pd) {
        P.bouche = "dents";
        P.mousse = clamp(pd * 4, 0, 1);
        var va = Math.sin(t * 16);
        // la tête de la brosse est à 40 unités à gauche de la main : main à droite de la bouche
        P.mains = [pt(92, 170), pt(150 + va * 4, 103 + Math.sin(t * 32) * 1.2)];
        P.objets.brosseDents = { main: 1, r: 0 };
        P.tete = Math.sin(t * 2.5) * 2;
      }

      function coiffer(pc) {
        c = cycle(t, 1.7);
        var descente = c < 0.7 ? douce(c / 0.7) : 1 - douce((c - 0.7) / 0.3);
        P.dy = -6;
        // la brosse (tête à 30 unités à gauche de la main) descend le long des cheveux, du haut du crâne vers l'épaule
        var teteBrosse = trajet([[0, pt(118, 44)], [0.35, pt(147, 66)], [1, pt(154, 120)]], descente);
        P.mains = [pt(86, 166), pt(teteBrosse.x + 28, teteBrosse.y + 10)];
        P.objets.brosseCheveux = { main: 1, r: 20 };
        P.tete = -7;
        P.yeux = "joie";
        if (etat.bataille) P.bataille = 1 - clamp(pc * 1.6, 0, 1);
      }

      function jouer() {
        // on se lance le ballon : aller de 0 à 0,4, on tient, retour de 0,5 à 0,9
        c = cycle(t + (sens > 0 ? 0 : 1.2), 2.4);
        P.yeux = "joie"; P.bouche = "grand";
        var lance = pt(162, 94), repos = pt(144, 152), attrape = pt(158, 112), elan = pt(142, 142);
        var mainCentre = trajet([[0, lance], [0.12, repos], [0.8, repos], [0.9, attrape], [0.97, elan], [1, lance]], c);
        var autre = trajet([[0, pt(84, 164)], [0.8, pt(84, 164)], [0.9, pt(148, 120)], [0.97, pt(96, 150)], [1, pt(84, 164)]], c);
        P.saut = c < 0.1 ? Math.sin(c / 0.1 * Math.PI) * 10 : 0;
        if (sens > 0) P.mains = [autre, mainCentre];
        else P.mains = [pt(220 - mainCentre.x, mainCentre.y), pt(220 - autre.x, autre.y)];
      }

      appliquer(P, t);
    }

    function appliquer(P, t) {
      // Décors
      R.litReveil.setAttribute("display", P.litReveil ? "inline" : "none");
      R.couverture.setAttribute("display", P.couverture ? "inline" : "none");
      R.table.setAttribute("display", P.table ? "inline" : "none");
      R.chambre.groupe.setAttribute("display", P.chambre ? "inline" : "none");
      voir(R.chambre.halo, 0.55 * P.lampe);
      R.chambre.abat.setAttribute("fill", P.lampe > 0.5 ? "#FFE680" : "#D8D2B8");

      R.tout.setAttribute("transform", "translate(0 " + (-P.saut).toFixed(1) + ")");
      var buste = "translate(0 " + P.dy.toFixed(1) + ") rotate(" + P.lean.toFixed(1) + " 110 176)";
      var teteT = buste + " rotate(" + P.tete.toFixed(1) + " 110 114)";
      R.tete.setAttribute("transform", teteT);
      R.cheveuxArriere.setAttribute("transform", teteT);
      R.buste.setAttribute("transform", buste);
      R.cartable.setAttribute("transform", buste);
      R.cartable.setAttribute("display", P.cartable ? "inline" : "none");
      R.bretelles.setAttribute("display", P.cartable ? "inline" : "none");

      function monde(x, y) { var q = tourne(pt(x, y), P.lean, 110, 176); return pt(q.x, q.y + P.dy); }

      // Jambes : hanches suivent le buste, pieds au sol
      [0, 1].forEach(function (n) {
        var hanche = monde(n === 0 ? 100 : 120, 176), pied = pt(n === 0 ? 98 : 122, 238 + P.leve[n]);
        var j = membre(hanche, pied, JAMBE1, JAMBE2, n === 0 ? -1 : 1);
        var d = trace(hanche, j.milieu, j.bout);
        R.jambesPeau[n].setAttribute("d", d);
        R.pantalon[n].setAttribute("d", d);
      });
      voir(R.jambesPyjama, P.pyjama);

      // Pieds
      var parentPieds = P.piedsDevant ? R.piedsAvant : R.piedsArriere;
      R.pieds.forEach(function (f, n) {
        if (f.g.parentNode !== parentPieds) parentPieds.appendChild(f.g);
        f.basket.setAttribute("display", P.chaussures ? "inline" : "none");
        f.chaussons.setAttribute("display", !P.chaussures && P.pyjama > 0.5 ? "inline" : "none");
        f.chaussettes.setAttribute("display", !P.chaussures && P.pyjama <= 0.5 ? "inline" : "none");
        f.g.setAttribute("transform", "translate(0 " + P.leve[n].toFixed(1) + ")");
        f.scratch.setAttribute("transform", "rotate(" + (-f.sens * 65 * P.scratch[n]).toFixed(1) + " " + (f.fx - f.sens * 9) + " 239)");
      });

      // Vêtements
      R.hautPyjama.setAttribute("transform", "translate(0 " + P.hautPyjamaY.toFixed(1) + ")");
      voir(R.hautPyjama, P.objets.hautVole !== undefined ? 1 - P.objets.hautVole : clamp(P.pyjama, 0, 1));
      R.robe.setAttribute("transform", "translate(0 " + P.robeY.toFixed(1) + ")");
      voir(R.robe, P.robeO);

      // Visage
      R.yeuxOuverts.setAttribute("display", P.yeux === "ouverts" ? "inline" : "none");
      R.yeuxFermes.setAttribute("display", P.yeux === "fermes" ? "inline" : "none");
      R.yeuxJoie.setAttribute("display", P.yeux === "joie" ? "inline" : "none");
      for (var b in R.bouches) R.bouches[b].setAttribute("display", P.bouche === b ? "inline" : "none");
      voir(R.mousse, P.bouche === "dents" ? P.mousse : 0);
      voir(R.frangeBataille, P.bataille);
      voir(R.frangeSage, 1 - P.bataille);
      voir(R.accessoire, 1 - P.bataille);

      // Bras
      var couleurHaut = (P.pyjama > 0.5 || P.robeO > 0.5) ? tc : PEAU;
      var couleurBas = P.pyjama > 0.5 ? tc : PEAU;
      var mainsReelles = [];
      [0, 1].forEach(function (n) {
        var epaule = monde(n === 0 ? 88 : 132, 122);
        var bras = membre(epaule, P.mains[n], BRAS1, BRAS2, n === 0 ? -1 : 1);
        R.bras[n].haut.setAttribute("d", trace(epaule, bras.milieu));
        R.bras[n].bas.setAttribute("d", trace(bras.milieu, bras.bout));
        R.bras[n].haut.setAttribute("stroke", couleurHaut);
        R.bras[n].bas.setAttribute("stroke", couleurBas);
        R.bras[n].main.setAttribute("cx", bras.bout.x.toFixed(1));
        R.bras[n].main.setAttribute("cy", bras.bout.y.toFixed(1));
        mainsReelles[n] = bras.bout;
      });

      // Objets : ceux qui sont tenus ({main: n}) se posent exactement dans la main dessinée
      var O = P.objets;
      for (var nomObjet in O) {
        var ob = O[nomObjet];
        if (ob && ob.main !== undefined) { ob.x = mainsReelles[ob.main].x; ob.y = mainsReelles[ob.main].y; }
      }
      R.tartine.setAttribute("display", O.tartine ? "inline" : "none");
      if (O.tartine) { place(R.tartine, O.tartine.x, O.tartine.y, O.tartine.r, 0.95); R.tartineCorps.setAttribute("transform", "scale(" + O.tartine.e.toFixed(3) + " 1)"); }
      R.verre.setAttribute("display", O.verre ? "inline" : "none");
      if (O.verre) {
        place(R.verre, O.verre.x, O.verre.y, O.verre.r, 1.3);
        var h = 29 * clamp(O.verre.niveau, 0.05, 1);
        R.jus.setAttribute("y", (15 - h).toFixed(1));
        R.jus.setAttribute("height", h.toFixed(1));
      }
      R.brosseDents.setAttribute("display", O.brosseDents ? "inline" : "none");
      if (O.brosseDents) place(R.brosseDents, O.brosseDents.x, O.brosseDents.y, O.brosseDents.r);
      R.brosseCheveux.setAttribute("display", O.brosseCheveux ? "inline" : "none");
      if (O.brosseCheveux) place(R.brosseCheveux, O.brosseCheveux.x, O.brosseCheveux.y, O.brosseCheveux.r);
      R.pyjamaPlie.setAttribute("display", O.pyjamaPlie ? "inline" : "none");
      if (O.pyjamaPlie) { place(R.pyjamaPlie, O.pyjamaPlie.x, O.pyjamaPlie.y, O.pyjamaPlie.r); voir(R.pyjamaPlie, O.pyjamaPlie.o); }
      R.livre.setAttribute("display", O.livre ? "inline" : "none");
      if (O.livre) place(R.livre, O.livre.x, O.livre.y, 0);
      voir(R.zzz, P.zzz);
      R.zzz.setAttribute("y", (40 - cycle(t, 1.6) * 10).toFixed(1));
      if (P.scratchTexte) {
        R.scratch.setAttribute("display", "inline");
        R.scratch.setAttribute("x", P.scratchTexte.x.toFixed(1));
        R.scratch.setAttribute("y", P.scratchTexte.y.toFixed(1));
        voir(R.scratch, P.scratchTexte.o);
      } else {
        R.scratch.setAttribute("display", "none");
      }
    }

    return { svg: svg, maj: maj };
  }

  // =====================================================================
  // Papa ou Maman, au centre de l'anneau pour les câlins
  // =====================================================================
  function creerParent(conteneur, qui) {
    var maman = qui === "Maman";
    var svg = el("svg", { viewBox: "0 0 220 220", "class": "parent-svg" });
    var cheveux = maman ? "#6B4226" : "#3E2A1E", haut = maman ? "#E0567A" : "#4A7FC1";
    var coeurs = el("g", {}, svg);
    var listeCoeurs = [0, 1, 2, 3].map(function () {
      return el("path", { d: "M0 6 C0 -2 -12 -5 -12 3 C-12 9 -3 14 0 19 C3 14 12 9 12 3 C12 -5 0 -2 0 6 Z", fill: "#FF5C8A" }, coeurs);
    });
    if (maman) el("path", { d: "M72 64 Q68 22 110 20 Q152 22 148 64 L156 132 Q110 144 64 132 Z", fill: cheveux }, svg);
    el("rect", { x: 74, y: 100, width: 72, height: 110, rx: 26, fill: haut }, svg);
    el("rect", { x: 102, y: 88, width: 16, height: 18, fill: PEAU }, svg);
    el("circle", { cx: 110, cy: 62, r: 34, fill: PEAU }, svg);
    if (maman) el("path", { d: "M76 60 Q78 26 110 26 Q142 26 144 60 Q128 42 110 44 Q92 42 76 60 Z", fill: cheveux }, svg);
    else {
      el("path", { d: "M76 58 Q76 24 110 24 Q144 24 144 58 Q140 40 122 42 Q112 36 100 42 Q84 40 76 58 Z", fill: cheveux }, svg);
      el("path", { d: "M82 74 Q84 100 110 104 Q136 100 138 74 Q128 92 110 92 Q92 92 82 74 Z", fill: cheveux, opacity: .35 }, svg);
    }
    el("path", { d: "M92 66 Q98 60 104 66 M116 66 Q122 60 128 66", stroke: ENCRE, "stroke-width": 3, fill: "none", "stroke-linecap": "round" }, svg);
    el("path", { d: "M98 80 Q110 94 122 80 Z", fill: BOUCHE }, svg);
    el("circle", { cx: 88, cy: 78, r: 5, fill: "#FF8FA8", opacity: .5 }, svg);
    el("circle", { cx: 132, cy: 78, r: 5, fill: "#FF8FA8", opacity: .5 }, svg);
    var bras = [0, 1].map(function () {
      return { trait: el("path", { stroke: haut, "stroke-width": 16, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" }, svg),
               main: el("circle", { r: 9, fill: PEAU }, svg) };
    });
    conteneur.appendChild(svg);

    function maj(t) {
      var c = cycle(t, 2.6);
      var u = trajet([[0, 0], [0.3, 0], [0.5, 1], [0.85, 1], [1, 0]], c);
      var cibles = [vers(pt(28, 70), pt(128, 150), u), vers(pt(192, 70), pt(92, 150), u)];
      [0, 1].forEach(function (n) {
        var epaule = pt(n === 0 ? 80 : 140, 112);
        var m = membre(epaule, cibles[n], 40, 40, n === 0 ? -1 : 1);
        bras[n].trait.setAttribute("d", trace(epaule, m.milieu, m.bout));
        bras[n].main.setAttribute("cx", m.bout.x.toFixed(1));
        bras[n].main.setAttribute("cy", m.bout.y.toFixed(1));
      });
      listeCoeurs.forEach(function (coeur, i) {
        var q = cycle(t + i * 0.55, 2.2);
        place(coeur, 110 + Math.sin(i * 2.1 + q * 4) * 70, 190 - q * 190, 0, 0.8 + q * 0.6);
        voir(coeur, Math.sin(q * Math.PI));
      });
    }
    return { svg: svg, maj: maj };
  }

  return { creer: creer, creerParent: creerParent };
})();
