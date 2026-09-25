// Lou et Alba, dessinées et animées.
// Les mains visent des positions précises (bras à coude calculé), et les objets sont dessinés
// et tenus par le bon bout. Repère du dessin : 220 × 260, fille centrée en x = 110, pieds à y = 238.
var AVATARS = (function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var PEAU = "#FFD7B5", PEAU_OMBRE = "#F0B993", ENCRE = "#2D2D3A", BOUCHE = "#8E3B46";
  var CHEVEUX = { blond: "#E6B656", blondChatain: "#B98A4E", chatain: "#8B5A2B", brun: "#4A2E1C", roux: "#C65A2E", noir: "#262020",
                  rose: "#FF6FA5", bleu: "#5FD0FF", violet: "#B78BFF", vert: "#6BE38A", turquoise: "#3FC7B4",
                  rouge: "#E5484D", blanc: "#EDEDF5" };
  // Les manches suivent le haut : peau quand il n'y en a pas, couleur quand le vêtement en a
  var MANCHES = { debardeur: "peau", topPaillettes: "peau", maillotBain: "peau", tutu: "peau", sirene: "peau",
                  princesse: "peau", robeEtoilee: "peau", maillotFoot: "#E5484D", pullRaye: "#FF6FA5",
                  chemisier: "#FFF2F8", sweatCapuche: "#6D7BA8", hautArcEnCiel: "#FF5FA2", tshirtCoeur: "#FFFFFF",
                  teeShirt: "#FFFFFF", survetement: "#2F3A56", manteau: "#8A4F6D", kimono: "#F4EDE4",
                  pullNoel: "#D7263D", jeanCoeur: "#FFFFFF", salopette: "#FFFFFF", robePois: "#4A73B8" };
  // Les bas qui couvrent les jambes, et de quelle couleur
  var PANTALONS = { jeanSimple: "#3E63A0", jupeJean: "", legging: "#2F3A56", pantalonLarge: "#8A6FB8",
                    pantalonEtoiles: "#2B2D64", salopette: "#4A73B8", survetement: "#2F3A56" };
  var BRAS1 = 30, BRAS2 = 30, JAMBE1 = 31, JAMBE2 = 31;
  var compteurSvg = 0; // identifiants uniques des dégradés de cheveux

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
  function dessinerTalkie(g, couleur) {
    el("rect", { x: 3, y: -30, width: 3.5, height: 15, rx: 1.75, fill: "#2F3A56" }, g);
    el("rect", { x: -8, y: -16, width: 16, height: 30, rx: 3.5, fill: "#3A4666", stroke: "#222B44", "stroke-width": 1.5 }, g);
    el("rect", { x: -5, y: -12, width: 10, height: 8, rx: 1.5, fill: "#7CD5FF" }, g);
    el("circle", { cx: -2.5, cy: 2, r: 2.2, fill: "#B9B9C8" }, g);
    el("circle", { cx: 2.5, cy: 2, r: 2.2, fill: "#B9B9C8" }, g);
    el("rect", { x: -5, y: 7, width: 10, height: 4, rx: 2, fill: couleur }, g);
    var ondes = el("g", { fill: "none", stroke: "#FFD93D", "stroke-width": 3, "stroke-linecap": "round" }, g);
    el("path", { d: "M12 -30 q8 8 0 16" }, ondes);
    el("path", { d: "M19 -34 q13 12 0 24" }, ondes);
    el("path", { d: "M26 -38 q18 16 0 32" }, ondes);
    return ondes;
  }
  function dessinerCartes(g) {
    [[-17, 5, -20, "#E5484D"], [0, 0, 0, "#4A73B8"], [17, 5, 20, "#FFC93D"]].forEach(function (q) {
      var c = el("g", { transform: "translate(" + q[0] + " " + q[1] + ") rotate(" + q[2] + ")" }, g);
      el("rect", { x: -11, y: -16, width: 22, height: 32, rx: 3, fill: "#FFFFFF", stroke: "#D8D8E8", "stroke-width": 1.5 }, c);
      el("rect", { x: -8, y: -13, width: 16, height: 17, rx: 2, fill: q[3] }, c);
      el("circle", { cy: -4.5, r: 4.5, fill: "#FFFFFF", opacity: .85 }, c);
      el("rect", { x: -8, y: 7, width: 16, height: 3, rx: 1.5, fill: "#E8E8F0" }, c);
    });
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
  // ---------- Objets de la boutique : achetés avec les étoiles, portés par l'avatar ----------
  // Chaque objet se dessine dans le groupe de son emplacement et peut rendre une fonction d'animation.
  var TIGRE = { base: "#806B55", fonce: "#30251B", clair: "#AE9679", oreille: "#E3AFA6" };
  var DEGRADES = {
    pointes: ["0", "#@", "0.5", "#@", "1", "#FF5FA2"],
    cheveuxArcEnCiel: ["0", "#FF5FA2", "0.25", "#FFB03B", "0.5", "#6BE38A", "0.75", "#5FD0FF", "1", "#B78BFF"]
  };
  // Les oreilles qui viennent avec un déguisement porté dans le dos
  var OREILLES = { sundae: "oreillesChat", lapin: "oreillesLapin", renard: "oreillesRenard", panda: "oreillesPanda",
                   dinosaure: "capucheDino", ailesAnge: "aureole" };

  function etoileD(r) {
    var d = "";
    for (var i = 0; i < 10; i++) {
      var a = (Math.PI / 5) * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
      d += (i ? "L" : "M") + (Math.cos(a) * rr).toFixed(1) + " " + (Math.sin(a) * rr).toFixed(1) + " ";
    }
    return d + "Z";
  }
  function coeurD(r) {
    return "M0 " + (-r * .3) + " C " + (-r) + " " + (-r * 1.5) + ", " + (-r * 1.7) + " " + (r * .25) + ", 0 " + (r * 1.2) +
           " C " + (r * 1.7) + " " + (r * .25) + ", " + r + " " + (-r * 1.5) + ", 0 " + (-r * .3) + " Z";
  }
  function fleurette(parent, x, y, petale, coeur, taille) {
    var f = el("g", { transform: "translate(" + x + " " + y + ") scale(" + (taille || 1) + ")" }, parent);
    [0, 72, 144, 216, 288].forEach(function (a) {
      el("ellipse", { rx: 3, ry: 5, fill: petale, transform: "rotate(" + a + ") translate(0 -4.5)" }, f);
    });
    el("circle", { r: 2.2, fill: coeur }, f);
    return f;
  }
  function oreillesPointues(g, o) {
    [[o.x || 88, -1], [220 - (o.x || 88), 1]].forEach(function (p) {
      var x = p[0], s = p[1];
      el("path", { d: "M" + x + " " + o.bas + " L" + (x + s * o.dx) + " " + o.haut + " L" + (x + s * o.large) + " " + (o.bas - 8) + " Z",
                   fill: o.base, stroke: o.bord, "stroke-width": 2, "stroke-linejoin": "round" }, g);
      if (o.dedans) el("path", { d: "M" + (x + s * (o.dx * .5)) + " " + (o.bas - 5) + " L" + (x + s * (o.dx * .8)) + " " + (o.haut + 9) +
                                 " L" + (x + s * (o.large * .7)) + " " + (o.bas - 10) + " Z", fill: o.dedans }, g);
    });
  }
  function visageMasque(g, base, bord) {
    return el("ellipse", { cx: 110, cy: 80, rx: 32, ry: 29, fill: base, stroke: bord, "stroke-width": 2 }, g);
  }
  function yeuxMasque(g, y, r, couleur) {
    [97, 123].forEach(function (x) {
      el("ellipse", { cx: x, cy: y, rx: r, ry: r * 1.1, fill: couleur || "#2D2D3A" }, g);
      el("circle", { cx: x + r * .35, cy: y - r * .4, r: r * .38, fill: "#FFFFFF" }, g);
    });
  }

  // ---------- Sur la tête (suit les mouvements de la tête) ----------
  function objetTete(id, g, tc) {
    var b, x, s;
    if (id === "barrette") {
      b = el("g", { transform: "translate(84 50) rotate(-18)" }, g);
      el("rect", { x: -13, y: -3, width: 26, height: 6, rx: 3, fill: "#FF6FA5" }, b);
      el("path", { d: coeurD(7), fill: "#FF3D85", transform: "translate(0 -7)" }, b);
      return null;
    }
    if (id === "fleur") { fleurette(g, 86, 48, "#FF9ECF", "#FFD93D", 1.8); return null; }
    if (id === "couronneFleurs") {
      b = el("g", {}, g);
      el("path", { d: "M78 56 Q110 34 142 56", fill: "none", stroke: "#7FD6A0", "stroke-width": 5, "stroke-linecap": "round" }, b);
      [[80, 55, "#FF9ECF"], [94, 44, "#FFD3E8"], [110, 40, "#FFF0A8"], [126, 44, "#C9B6FF"], [140, 55, "#FF9ECF"]].forEach(function (p) {
        fleurette(b, p[0], p[1], p[2], "#FFD93D", 1.1);
      });
      return null;
    }
    if (id === "serreTete") {
      b = el("g", {}, g);
      el("path", { d: "M79 62 Q110 30 141 62", fill: "none", stroke: "#FF6FA5", "stroke-width": 8, "stroke-linecap": "round" }, b);
      [[88, 48], [110, 38], [132, 48]].forEach(function (p) { el("circle", { cx: p[0], cy: p[1], r: 2.6, fill: "#FFFFFF" }, b); });
      return null;
    }
    if (id === "grosNoeud") {
      b = el("g", { transform: "translate(88 46) rotate(12)" }, g);
      el("path", { d: "M0 0 C -26 -18, -30 14, 0 3 Z", fill: "#FF3D85" }, b);
      el("path", { d: "M0 0 C 26 -18, 30 14, 0 3 Z", fill: "#FF6FA5" }, b);
      el("circle", { r: 5.5, fill: "#FF1F6E" }, b);
      return null;
    }
    if (id === "bandeau") {
      b = el("g", {}, g);
      el("path", { d: "M77 66 Q110 46 143 66", fill: "none", stroke: tc, "stroke-width": 10, "stroke-linecap": "round" }, b);
      el("path", { d: "M77 66 Q110 46 143 66", fill: "none", stroke: "#FFFFFF", "stroke-width": 3, "stroke-dasharray": "6 8" }, b);
      return null;
    }
    if (id === "couronne") {
      b = el("g", {}, g);
      el("path", { d: "M80 46 L86 20 L98 36 L110 14 L122 36 L134 20 L140 46 Z", fill: "#FFD93D", stroke: "#D9A400", "stroke-width": 3, "stroke-linejoin": "round" }, b);
      el("rect", { x: 80, y: 43, width: 60, height: 8, rx: 4, fill: "#FFC93D", stroke: "#D9A400", "stroke-width": 2 }, b);
      [[86, 22, "#FF6FA5"], [110, 17, "#7CD5FF"], [134, 22, "#FF6FA5"]].forEach(function (p) { el("circle", { cx: p[0], cy: p[1], r: 4, fill: p[2] }, b); });
      return null;
    }
    if (id === "casquette") {
      b = el("g", {}, g);
      el("path", { d: "M74 62 Q74 22 110 22 Q146 22 146 62 Q110 70 74 62 Z", fill: tc }, b);
      el("path", { d: "M145 54 Q180 54 178 68 Q158 72 142 64 Z", fill: "#2F3A56" }, b);
      el("path", { d: "M74 60 Q110 68 146 60", stroke: "#2F3A56", "stroke-width": 4, fill: "none" }, b);
      el("circle", { cx: 110, cy: 24, r: 5, fill: "#FFFFFF" }, b);
      return null;
    }
    if (id === "chapeauPaille") {
      b = el("g", {}, g);
      el("ellipse", { cx: 110, cy: 56, rx: 52, ry: 12, fill: "#E9C46A" }, b);
      el("path", { d: "M84 56 Q86 24 110 24 Q134 24 136 56 Z", fill: "#F2D08A" }, b);
      el("path", { d: "M84 50 Q110 58 136 50", stroke: "#FF6FA5", "stroke-width": 6, fill: "none" }, b);
      return null;
    }
    if (id === "bonnet") {
      b = el("g", {}, g);
      el("path", { d: "M76 60 Q78 22 110 22 Q142 22 144 60 Z", fill: tc }, b);
      el("rect", { x: 74, y: 56, width: 72, height: 12, rx: 6, fill: "#FFFFFF" }, b);
      el("circle", { cx: 110, cy: 18, r: 9, fill: "#FFFFFF" }, b);
      return null;
    }
    if (id === "chapeauSorciere") {
      b = el("g", {}, g);
      el("ellipse", { cx: 110, cy: 54, rx: 50, ry: 11, fill: "#3B2A63" }, b);
      el("path", { d: "M92 54 Q104 12 124 2 Q126 30 128 54 Z", fill: "#4B3680" }, b);
      el("path", { d: "M90 50 Q110 58 130 50", stroke: "#FFD93D", "stroke-width": 6, fill: "none" }, b);
      el("path", { d: etoileD(5), fill: "#FFD93D", transform: "translate(110 50)" }, b);
      return null;
    }
    if (id === "bonnetNoel") {
      b = el("g", {}, g);
      el("path", { d: "M78 58 Q80 20 112 20 Q142 20 150 34 Q140 46 150 56 Z", fill: "#D7263D" }, b);
      el("rect", { x: 74, y: 52, width: 74, height: 13, rx: 6.5, fill: "#FFFFFF" }, b);
      el("circle", { cx: 152, cy: 30, r: 9, fill: "#FFFFFF" }, b);
      return null;
    }
    if (id === "boisRenne") {
      b = el("g", { stroke: "#8A5E38", "stroke-width": 6, fill: "none", "stroke-linecap": "round" }, g);
      el("path", { d: "M88 50 Q80 28 84 12 M84 26 Q72 20 68 8 M84 16 Q74 8 62 6" }, b);
      el("path", { d: "M132 50 Q140 28 136 12 M136 26 Q148 20 152 8 M136 16 Q146 8 158 6" }, b);
      return null;
    }
    if (id === "couronneAnniv") {
      b = el("g", {}, g);
      el("path", { d: "M82 50 L92 24 L110 42 L128 24 L138 50 Z", fill: "#FF6FA5", stroke: "#FF1F6E", "stroke-width": 2.5, "stroke-linejoin": "round" }, b);
      [[92, 26, "#FFD93D"], [128, 26, "#7CD5FF"]].forEach(function (p) { el("circle", { cx: p[0], cy: p[1], r: 3.5, fill: p[2] }, b); });
      return null;
    }
    if (id === "aureole") {
      el("ellipse", { cx: 110, cy: 26, rx: 22, ry: 7, fill: "none", stroke: "#FFD93D", "stroke-width": 5 }, g);
      el("ellipse", { cx: 110, cy: 26, rx: 22, ry: 7, fill: "none", stroke: "rgba(255,255,255,.55)", "stroke-width": 2 }, g);
      return null;
    }
    if (id === "oreillesChat") {
      oreillesPointues(g, { x: 88, bas: 52, haut: 22, dx: 6, large: 24, base: TIGRE.base, bord: TIGRE.fonce, dedans: TIGRE.oreille });
      return null;
    }
    if (id === "oreillesLapin") {
      b = el("g", {}, g);
      [[92, -1], [128, 1]].forEach(function (p) {
        x = p[0]; s = p[1];
        el("ellipse", { rx: 10, ry: 30, fill: "#FFFFFF", stroke: "#E3D8D0", "stroke-width": 2,
                        transform: "translate(" + x + " 24) rotate(" + (s * 12) + ")" }, b);
        el("ellipse", { rx: 5, ry: 21, fill: "#FFB9CE", transform: "translate(" + x + " 26) rotate(" + (s * 12) + ")" }, b);
      });
      return null;
    }
    if (id === "oreillesRenard") {
      oreillesPointues(g, { x: 86, bas: 54, haut: 16, dx: 8, large: 26, base: "#E2712C", bord: "#B4521A", dedans: "#FFE9D6" });
      return null;
    }
    if (id === "oreillesPanda") {
      b = el("g", {}, g);
      el("circle", { cx: 84, cy: 44, r: 14, fill: "#2D2D3A" }, b);
      el("circle", { cx: 136, cy: 44, r: 14, fill: "#2D2D3A" }, b);
      el("ellipse", { cx: 95, cy: 82, rx: 14, ry: 16, fill: "#2D2D3A", transform: "rotate(-18 95 82)" }, b);
      el("ellipse", { cx: 125, cy: 82, rx: 14, ry: 16, fill: "#2D2D3A", transform: "rotate(18 125 82)" }, b);
      yeuxMasque(b, 82, 5, "#FFFFFF");
      el("path", { d: "M104 94 L116 94 L110 99 Z", fill: "#2D2D3A" }, b);
      return null;
    }
    if (id === "capucheDino") {
      b = el("g", {}, g);
      el("path", { d: "M74 78 Q70 34 110 30 Q150 34 146 78 Q110 66 74 78 Z", fill: "#5FBF7A", stroke: "#3E9660", "stroke-width": 2 }, b);
      el("path", { d: "M96 34 L102 18 L110 32 L118 16 L126 34 Z", fill: "#FFD93D", stroke: "#E0A800", "stroke-width": 2, "stroke-linejoin": "round" }, b);
      el("path", { d: "M78 70 Q110 58 142 70", stroke: "#3E9660", "stroke-width": 3, fill: "none" }, b);
      return null;
    }
    return null;
  }

  // ---------- Sur le visage (dessiné par-dessus tout le reste de la tête) ----------
  function objetVisage(id, g, tc) {
    var l, p, e;
    if (id === "soleil" || id === "lunettesPlage") {
      var teinte = id === "soleil" ? "#2B2B3D" : "#2F7BBF";
      l = el("g", {}, g);
      el("path", { d: "M87 79 H63 M133 79 H157", stroke: teinte, "stroke-width": 3, "stroke-linecap": "round" }, l);
      el("rect", { x: 85, y: 72, width: 24, height: 17, rx: 8, fill: teinte }, l);
      el("rect", { x: 111, y: 72, width: 24, height: 17, rx: 8, fill: teinte }, l);
      el("path", { d: "M109 77 H111", stroke: teinte, "stroke-width": 4 }, l);
      el("path", { d: "M89 75 L95 83 M115 75 L121 83", stroke: "rgba(255,255,255,.45)", "stroke-width": 2.5, "stroke-linecap": "round" }, l);
      return null;
    }
    if (id === "lunettesRondes") {
      l = el("g", { fill: "none", stroke: "#4A3B2A", "stroke-width": 3 }, g);
      el("circle", { cx: 97, cy: 82, r: 11 }, l); el("circle", { cx: 123, cy: 82, r: 11 }, l);
      el("path", { d: "M108 82 H112 M86 79 L70 76 M134 79 L150 76" }, l);
      return null;
    }
    if (id === "lunettesCoeur") {
      l = el("g", {}, g);
      el("path", { d: "M86 79 L70 76 M134 79 L150 76", stroke: "#FF3D85", "stroke-width": 3, fill: "none" }, l);
      [97, 123].forEach(function (x) {
        el("path", { d: coeurD(11), fill: "rgba(255,111,165,.5)", stroke: "#FF3D85", "stroke-width": 2.5, transform: "translate(" + x + " 78)" }, l);
      });
      el("path", { d: "M108 80 H112", stroke: "#FF3D85", "stroke-width": 3 }, l);
      return null;
    }
    if (id === "pikachu") {
      p = el("g", {}, g);
      oreillesPointues(p, { x: 92, bas: 54, haut: 12, dx: 10, large: 26, base: "#F5D142", bord: "#C9A21F" });
      [[92, -1], [128, 1]].forEach(function (q) {
        el("path", { d: "M" + (q[0] + q[1] * 10) + " 12 L" + (q[0] + q[1] * 20) + " 21 L" + (q[0] + q[1] * 16) + " 24 Z", fill: "#2D2D3A" }, p);
      });
      visageMasque(p, "#F5D142", "#C9A21F");
      el("circle", { cx: 88, cy: 88, r: 7.5, fill: "#E5484D" }, p);
      el("circle", { cx: 132, cy: 88, r: 7.5, fill: "#E5484D" }, p);
      yeuxMasque(p, 76, 5.5);
      el("circle", { cx: 110, cy: 88, r: 2.6, fill: "#2D2D3A" }, p);
      el("path", { d: "M103 94 Q110 100 117 94", stroke: "#2D2D3A", "stroke-width": 2.5, fill: "none", "stroke-linecap": "round" }, p);
      return null;
    }
    if (id === "evoli") {
      e = el("g", {}, g);
      oreillesPointues(e, { x: 92, bas: 56, haut: 14, dx: 4, large: 28, base: "#B07C50", bord: "#8A5E38", dedans: "#3D2B1F" });
      visageMasque(e, "#B07C50", "#8A5E38");
      el("path", { d: "M84 92 Q110 112 136 92 Q126 106 110 107 Q94 106 84 92 Z", fill: "#EFD9B4" }, e);
      yeuxMasque(e, 76, 5.5);
      el("path", { d: "M106 88 L114 88 L110 92 Z", fill: "#3D2B1F" }, e);
      el("path", { d: "M104 95 Q110 99 116 95", stroke: "#3D2B1F", "stroke-width": 2.2, fill: "none", "stroke-linecap": "round" }, e);
      return null;
    }
    if (id === "salameche") {
      e = el("g", {}, g);
      el("path", { d: "M110 14 Q102 26 110 34 Q118 26 110 14 Z", fill: "#FFB03B" }, e);
      el("path", { d: "M104 4 Q88 26 110 36 Q132 26 116 4 Q114 20 110 22 Q106 20 104 4 Z", fill: "#FF8A2B" }, e);
      el("path", { d: "M108 16 Q100 28 110 34 Q120 28 112 16 Z", fill: "#FFD93D" }, e);
      visageMasque(e, "#F28B3C", "#C96A22");
      el("ellipse", { cx: 110, cy: 96, rx: 17, ry: 11, fill: "#FFE2B8" }, e);
      yeuxMasque(e, 76, 5.2);
      el("path", { d: "M104 92 h3 M113 92 h3", stroke: "#8A5E38", "stroke-width": 2, "stroke-linecap": "round" }, e);
      el("path", { d: "M102 99 Q110 105 118 99", stroke: "#8A5E38", "stroke-width": 2.2, fill: "none", "stroke-linecap": "round" }, e);
      return null;
    }
    if (id === "carapuce") {
      e = el("g", {}, g);
      visageMasque(e, "#7EC8E3", "#4A9CBF");
      el("ellipse", { cx: 110, cy: 95, rx: 19, ry: 12, fill: "#FFF0CE" }, e);
      yeuxMasque(e, 76, 5.8);
      el("path", { d: "M100 92 Q110 100 120 92", stroke: "#4A6B7A", "stroke-width": 2.4, fill: "none", "stroke-linecap": "round" }, e);
      el("path", { d: "M92 84 q4 4 8 0 M120 84 q4 4 8 0", stroke: "rgba(255,255,255,.5)", "stroke-width": 2, fill: "none" }, e);
      return null;
    }
    if (id === "bulbizarre") {
      e = el("g", {}, g);
      el("ellipse", { cx: 110, cy: 34, rx: 22, ry: 17, fill: "#7BC47F", stroke: "#4F9A58", "stroke-width": 2 }, e);
      el("path", { d: "M96 28 Q110 18 124 28", stroke: "#4F9A58", "stroke-width": 2.5, fill: "none" }, e);
      visageMasque(e, "#8FD08B", "#4F9A58");
      [[88, 68], [132, 68], [86, 92], [134, 92]].forEach(function (q) {
        el("ellipse", { cx: q[0], cy: q[1], rx: 7, ry: 5, fill: "#5FA36A", opacity: .65 }, e);
      });
      yeuxMasque(e, 78, 5.5, "#C0392B");
      el("path", { d: "M99 94 Q110 102 121 94", stroke: "#3E6B45", "stroke-width": 2.4, fill: "none", "stroke-linecap": "round" }, e);
      return null;
    }
    if (id === "rondoudou") {
      e = el("g", {}, g);
      el("path", { d: "M96 40 Q86 20 104 16 Q118 14 114 30 Q112 40 104 42 Z", fill: "#F7A8C4", stroke: "#DE7CA0", "stroke-width": 2 }, e);
      oreillesPointues(e, { x: 84, bas: 56, haut: 30, dx: 2, large: 22, base: "#F7A8C4", bord: "#DE7CA0", dedans: "#FFD9E6" });
      visageMasque(e, "#F9BCD2", "#DE7CA0");
      yeuxMasque(e, 78, 7, "#4A7BC8");
      el("circle", { cx: 88, cy: 92, r: 6, fill: "#FF9EBE", opacity: .7 }, e);
      el("circle", { cx: 132, cy: 92, r: 6, fill: "#FF9EBE", opacity: .7 }, e);
      el("path", { d: "M104 96 Q110 102 116 96", stroke: "#C2557C", "stroke-width": 2.4, fill: "none", "stroke-linecap": "round" }, e);
      return null;
    }
    return null;
  }

  // ---------- Sur les joues ----------
  function objetJoues(id, g, tc) {
    if (id === "taches") {
      var t = el("g", { fill: "#C98358" }, g);
      [[92, 90], [87, 93], [94, 95], [128, 90], [133, 93], [126, 95]].forEach(function (p) { el("circle", { cx: p[0], cy: p[1], r: 1.4 }, t); });
      return null;
    }
    if (id === "etoileJoue") {
      el("path", { d: etoileD(6), fill: "#FFD93D", stroke: "#E0A800", "stroke-width": 1, transform: "translate(132 92)" }, g);
      return null;
    }
    if (id === "paillettesJoues") {
      var p = el("g", { fill: "#FFD93D" }, g);
      [[88, 90, 2.6], [93, 96, 1.8], [84, 97, 2], [130, 89, 2.4], [136, 95, 1.8], [126, 96, 2]].forEach(function (q) {
        el("path", { d: etoileD(q[2]), transform: "translate(" + q[0] + " " + q[1] + ")" }, p);
      });
      return null;
    }
    if (id === "coeurJoue") {
      el("path", { d: coeurD(5.5), fill: "#FF3D85", transform: "translate(134 98)" }, g);
      return null;
    }
    if (id === "maquillagePapillon") {
      var pa = el("g", {}, g);
      [[-1, "#7CD5FF"], [1, "#B78BFF"]].forEach(function (c) {
        var s2 = c[0];
        el("path", { d: "M" + (110 + s2 * 6) + " 84 q" + (s2 * 16) + " -12 " + (s2 * 22) + " 2 q" + (-s2 * 8) + " 6 " + (-s2 * 22) + " -2 Z", fill: c[1], opacity: .85 }, pa);
        el("path", { d: "M" + (110 + s2 * 6) + " 88 q" + (s2 * 13) + " 2 " + (s2 * 17) + " 12 q" + (-s2 * 10) + " 2 " + (-s2 * 17) + " -12 Z", fill: c[1], opacity: .65 }, pa);
      });
      el("path", { d: etoileD(3), fill: "#FFD93D", transform: "translate(124 86)" }, pa);
      el("path", { d: etoileD(3), fill: "#FFD93D", transform: "translate(96 86)" }, pa);
      return null;
    }
    if (id === "maquillageLicorne") {
      var li = el("g", {}, g);
      el("path", { d: "M104 50 L110 22 L116 50 Z", fill: "#FFD93D", stroke: "#E0A800", "stroke-width": 1.4 }, li);
      el("path", { d: "M106 44 L114 40 M106 38 L113 34 M107 32 L112 29", stroke: "#E0A800", "stroke-width": 1.2 }, li);
      [["#FF6FA5", 0], ["#FFB03B", 4], ["#6BE38A", 8], ["#5FD0FF", 12]].forEach(function (c) {
        el("path", { d: "M" + (86 + c[1]) + " 90 q4 -9 12 -12", stroke: c[0], "stroke-width": 2.4, fill: "none", "stroke-linecap": "round" }, li);
        el("path", { d: "M" + (134 - c[1]) + " 90 q-4 -9 -12 -12", stroke: c[0], "stroke-width": 2.4, fill: "none", "stroke-linecap": "round" }, li);
      });
      return null;
    }
    if (id === "maquillageChat") {
      var m = el("g", {}, g);
      el("path", { d: "M105 88 L115 88 L110 92 Z", fill: "#2D2D3A" }, m);
      el("path", { d: "M100 90 L78 86 M100 94 L80 95 M120 90 L142 86 M120 94 L140 95",
                   stroke: "#2D2D3A", "stroke-width": 2, "stroke-linecap": "round" }, m);
      el("path", { d: "M97 72 Q97 66 101 64 M123 72 Q123 66 119 64", stroke: "#2D2D3A", "stroke-width": 2, fill: "none", "stroke-linecap": "round" }, m);
      return null;
    }
    return null;
  }

  // ---------- Dans les cheveux (la mèche ; les dégradés sont gérés à la création) ----------
  function objetCheveux(id, g, tc, ch) {
    if (id === "meche") {
      var m = el("g", {}, g);
      [["#FF5FA2", 0], ["#FFB03B", 5], ["#5FD0FF", 10]].forEach(function (c) {
        el("path", { d: "M" + (82 + c[1]) + " 62 Q" + (78 + c[1]) + " 44 " + (94 + c[1]) + " 41", stroke: c[0], "stroke-width": 4.5,
                     fill: "none", "stroke-linecap": "round" }, m);
      });
      return null;
    }
    return null;
  }

  // ---------- Autour du cou (suit le buste) ----------
  function objetCou(id, g, tc) {
    var c;
    if (id === "collier") {
      c = el("g", {}, g);
      el("path", { d: "M96 116 Q110 132 124 116", stroke: "#FFD93D", "stroke-width": 2.5, fill: "none" }, c);
      el("path", { d: etoileD(7), fill: "#FFD93D", stroke: "#D9A400", "stroke-width": 1.5, transform: "translate(110 131)" }, c);
      return null;
    }
    if (id === "collierCoeur") {
      c = el("g", {}, g);
      el("path", { d: "M96 116 Q110 130 124 116", stroke: "#E8E8F0", "stroke-width": 2.5, fill: "none" }, c);
      el("path", { d: coeurD(6), fill: "#FF3D85", stroke: "#C2154F", "stroke-width": 1.2, transform: "translate(110 129)" }, c);
      return null;
    }
    if (id === "medaille") {
      c = el("g", {}, g);
      el("path", { d: "M100 112 L110 134 L120 112", stroke: "#4A73B8", "stroke-width": 5, fill: "none" }, c);
      el("circle", { cx: 110, cy: 140, r: 9, fill: "#FFD93D", stroke: "#D9A400", "stroke-width": 2 }, c);
      el("path", { d: etoileD(5), fill: "#D9A400", transform: "translate(110 140)" }, c);
      return null;
    }
    if (id === "echarpe") {
      c = el("g", {}, g);
      el("path", { d: "M86 118 Q110 136 134 118 Q136 128 128 132 Q110 142 92 132 Q84 128 86 118 Z", fill: "#E5484D" }, c);
      el("path", { d: "M120 130 L128 166 L116 166 L112 132 Z", fill: "#E5484D" }, c);
      el("path", { d: "M113 140 h14 M114 150 h14", stroke: "#FFFFFF", "stroke-width": 3, opacity: .8 }, c);
      el("path", { d: "M90 124 q10 8 20 10 q10 -2 20 -10", stroke: "#FFFFFF", "stroke-width": 3, fill: "none", opacity: .8 }, c);
      return null;
    }
    return null;
  }

  // ---------- Le haut (buste seul, quand elle ne porte pas de tenue complète) ----------
  function objetHaut(id, g, tc) {
    var b, i;
    function corps(fond, largeur) {
      var w = largeur || 54;
      return el("rect", { x: 110 - w / 2, y: 113, width: w, height: w < 50 ? 48 : 46, rx: w < 50 ? 10 : 16, fill: fond }, g);
    }
    function col(couleur) { el("path", { d: "M99 114 L110 127 L121 114 Z", fill: couleur }, g); }
    function bretelles(couleur) {
      el("path", { d: "M96 116 L100 130 M124 116 L120 130", stroke: couleur, "stroke-width": 6, "stroke-linecap": "round" }, g);
    }
    if (id === "teeShirt") { corps("#FFFFFF"); col(tc); return null; }
    if (id === "tshirtCoeur") {
      corps("#FFFFFF"); col("#FF8FC5");
      el("path", { d: coeurD(13), fill: "#FF3D85", transform: "translate(110 138)" }, g);
      return null;
    }
    if (id === "pullRaye") {
      corps("#FF6FA5");
      b = el("g", { fill: "#FFFFFF", opacity: .85 }, g);
      [122, 132, 142, 152].forEach(function (y) { el("rect", { x: 83, y: y, width: 54, height: 5 }, b); });
      el("path", { d: "M97 114 Q110 122 123 114", stroke: "#E04E85", "stroke-width": 3, fill: "none" }, g);
      return null;
    }
    if (id === "debardeur") {
      corps("#7CD5FF", 44); bretelles("#7CD5FF");
      el("path", { d: etoileD(9), fill: "#FFFFFF", transform: "translate(110 140)" }, g);
      return null;
    }
    if (id === "chemisier") {
      corps("#FFF2F8"); col("#F4C9DE");
      [[95, 132], [124, 128], [102, 150], [126, 148]].forEach(function (q) { fleurette(g, q[0], q[1], "#FF8FC5", "#FFD93D", .85); });
      el("path", { d: "M110 118 V158", stroke: "#F4C9DE", "stroke-width": 2 }, g);
      [130, 142, 152].forEach(function (y) { el("circle", { cx: 110, cy: y, r: 2.2, fill: "#F4C9DE" }, g); });
      return null;
    }
    if (id === "sweatCapuche") {
      corps("#6D7BA8");
      el("path", { d: "M92 114 Q110 134 128 114 Q130 124 120 128 Q110 134 100 128 Q90 124 92 114 Z", fill: "#8593C0" }, g);
      el("path", { d: "M104 126 V142 M116 126 V142", stroke: "#F4F4F8", "stroke-width": 2.4, "stroke-linecap": "round" }, g);
      el("path", { d: "M94 146 h32 v10 h-32 Z", fill: "#5C6890", opacity: .8 }, g);
      return null;
    }
    if (id === "hautArcEnCiel") {
      corps("#FF5FA2"); col("#FFFFFF");
      [["#FFB03B", 124], ["#6BE38A", 132], ["#5FD0FF", 140]].forEach(function (q) {
        el("rect", { x: 83, y: q[1], width: 54, height: 8, fill: q[0] }, g);
      });
      return null;
    }
    if (id === "topPaillettes") {
      corps("#B78BFF", 44); bretelles("#B78BFF");
      b = el("g", { fill: "#FFD93D" }, g);
      [[100, 126, 3], [118, 130, 2.4], [108, 140, 3.4], [122, 148, 2.6], [96, 148, 2.8], [110, 154, 2.2]].forEach(function (q) {
        el("path", { d: etoileD(q[2]), transform: "translate(" + q[0] + " " + q[1] + ")" }, b);
      });
      return null;
    }
    if (id === "maillotFoot") {
      corps("#E5484D"); col("#FFFFFF");
      b = el("g", { fill: "#FFFFFF", opacity: .9 }, g);
      [90, 106, 122].forEach(function (x) { el("rect", { x: x, y: 116, width: 6, height: 42 }, b); });
      el("text", { x: 110, y: 150, "font-size": 20, "font-weight": 800, "text-anchor": "middle", fill: "#FFFFFF" }, g).textContent = "9";
      return null;
    }
    return null;
  }

  // ---------- Le bas (jupe, pantalon, short) ----------
  function objetBas(id, g, tc) {
    var b;
    function jupe(fond) {
      return el("path", { d: "M86 150 Q110 144 134 150 L148 190 Q110 199 72 190 Z", fill: fond }, g);
    }
    function culotte(fond, hauteur, largeur) {
      var w = largeur || 52;
      return el("rect", { x: 110 - w / 2, y: 150, width: w, height: hauteur || 32, rx: 9, fill: fond }, g);
    }
    function ceinture(couleur) {
      el("rect", { x: 84, y: 148, width: 52, height: 7, rx: 3, fill: couleur }, g);
      el("circle", { cx: 110, cy: 151.5, r: 2.6, fill: "#FFD93D" }, g);
    }
    if (id === "jeanSimple") { culotte("#3E63A0"); ceinture("#2C4A7A"); return null; }
    if (id === "short") {
      culotte("#5C87CE", 26);
      el("path", { d: "M110 160 V176", stroke: "#3E63A0", "stroke-width": 2.5 }, g);
      ceinture("#2C4A7A");
      return null;
    }
    if (id === "legging") {
      culotte("#2F3A56", 30, 48);
      el("path", { d: "M88 158 h44", stroke: "#4A5578", "stroke-width": 2 }, g);
      return null;
    }
    if (id === "pantalonLarge") {
      culotte("#8A6FB8", 36, 56);
      el("path", { d: "M110 160 V186", stroke: "#75599F", "stroke-width": 2.5 }, g);
      ceinture("#6E5296");
      return null;
    }
    if (id === "pantalonEtoiles") {
      culotte("#2B2D64", 34, 54);
      b = el("g", { fill: "#FFD93D" }, g);
      [[94, 162, 3], [122, 166, 2.6], [106, 174, 3.2], [128, 178, 2.4], [92, 178, 2.6]].forEach(function (q) {
        el("path", { d: etoileD(q[2]), transform: "translate(" + q[0] + " " + q[1] + ")" }, b);
      });
      return null;
    }
    if (id === "jupePlissee") {
      jupe("#B78BFF");
      b = el("g", { stroke: "#9A72E0", "stroke-width": 2, fill: "none" }, g);
      [92, 102, 112, 122, 132].forEach(function (x) { el("path", { d: "M" + x + " 152 L" + (x + (x - 112) * 0.28).toFixed(1) + " 192" }, b); });
      ceinture("#9A72E0");
      return null;
    }
    if (id === "jupeJean") {
      jupe("#4A73B8");
      el("path", { d: "M74 188 Q110 196 146 188", stroke: "#FFD93D", "stroke-width": 2, fill: "none", "stroke-dasharray": "4 4" }, g);
      el("path", { d: "M92 162 h16 v12 h-16 Z M122 164 h14 v12 h-14 Z", fill: "none", stroke: "#FFD93D", "stroke-width": 1.6, "stroke-dasharray": "3 3" }, g);
      ceinture("#2C4A7A");
      return null;
    }
    if (id === "jupeTutu") {
      b = el("g", {}, g);
      el("path", { d: "M84 152 Q110 146 136 152 L158 188 Q110 200 62 188 Z", fill: "#FFC7E4" }, b);
      el("path", { d: "M86 152 Q110 146 134 152 L150 182 Q110 193 70 182 Z", fill: "#FFE3F1", opacity: .92 }, b);
      el("path", { d: "M84 158 Q110 152 136 158", stroke: "#FF8FC5", "stroke-width": 3, fill: "none" }, b);
      ceinture("#FF8FC5");
      return null;
    }
    return null;
  }

  // ---------- Les chaussettes (à la place de la socquette blanche) ----------
  function objetChaussettes(id, f, tc) {
    if (!id) return;
    var fx = f.fx, s = f.sens, g = el("g", {}, f.g), i;
    function bas(fond) { el("ellipse", { cx: fx + s * 2, cy: 242, rx: 10, ry: 5, fill: fond }, g); }
    if (id === "chaussettes") {
      bas("#FFFFFF");
      [-2.6, 0.8].forEach(function (dy, i) {
        el("rect", { x: fx + s * 2 - 7, y: 242 + dy, width: 14, height: 1.6, rx: .8, fill: i ? "#FF6FA5" : tc }, g);
      });
    } else if (id === "chaussettesCoeurs") {
      bas("#FFE3F1");
      el("path", { d: coeurD(4), fill: "#FF3D85", transform: "translate(" + (fx + s * 2) + " 241)" }, g);
    } else if (id === "chaussettesHautes") {
      el("rect", { x: fx - 7, y: 216, width: 14, height: 26, rx: 4, fill: "#FFFFFF" }, g);
      el("ellipse", { cx: fx + s * 2, cy: 242, rx: 10, ry: 5, fill: "#FFFFFF" }, g);
      [220, 226].forEach(function (y) { el("rect", { x: fx - 7, y: y, width: 14, height: 2.4, fill: "#FF6FA5" }, g); });
    } else if (id === "chaussettesEtoiles") {
      bas("#5FD0FF");
      el("path", { d: etoileD(3.4), fill: "#FFD93D", transform: "translate(" + (fx + s * 2) + " 241)" }, g);
    } else return;
    f.rayures = g;
  }

  // ---------- La tenue (remplace la robe) ----------
  function objetTenue(id, g, tc) {
    var r, jupe;
    function robe(fond, bord) {
      var n = el("path", { d: "M88 116 Q110 108 132 116 L146 188 Q110 198 74 188 Z", fill: fond }, g);
      if (bord) n.setAttribute("stroke", bord), n.setAttribute("stroke-width", 2);
      return n;
    }
    function col(couleur) { el("path", { d: "M98 116 L110 130 L122 116 Z", fill: couleur }, g); }
    if (id === "robeFleurs") {
      robe("#FFF2F8", "#F4C9DE"); col(tc);
      [[95, 140, "#FF8FC5"], [122, 134, "#FFC93D"], [110, 158, "#7CD5FF"], [132, 166, "#FF8FC5"], [88, 168, "#FFC93D"], [110, 180, "#FF8FC5"]].forEach(function (p) {
        fleurette(g, p[0], p[1], p[2], "#FFFFFF", .9);
      });
      el("path", { d: "M74 188 Q110 198 146 188", stroke: "#F4C9DE", "stroke-width": 3, fill: "none" }, g);
      return null;
    }
    if (id === "robePois") {
      robe("#4A73B8"); col("#FFFFFF");
      r = el("g", { fill: "#FFFFFF", opacity: .85 }, g);
      [[94, 132], [120, 128], [106, 148], [130, 152], [88, 158], [114, 168], [136, 174], [94, 178]].forEach(function (p) {
        el("circle", { cx: p[0], cy: p[1], r: 4, fill: "#FFFFFF" }, r);
      });
      return null;
    }
    if (id === "robeEtoilee") {
      robe("#2B2D64"); col("#7CD5FF");
      r = el("g", { fill: "#FFD93D" }, g);
      [[94, 134, 4], [118, 130, 3], [106, 150, 4.5], [132, 156, 3.4], [86, 162, 3], [116, 172, 4], [138, 178, 3], [96, 180, 3.4]].forEach(function (p) {
        el("path", { d: etoileD(p[2]), transform: "translate(" + p[0] + " " + p[1] + ")" }, r);
      });
      el("path", { d: "M74 188 Q110 198 146 188", stroke: "#7CD5FF", "stroke-width": 3, fill: "none" }, g);
      return null;
    }
    if (id === "salopette") {
      el("rect", { x: 84, y: 150, width: 52, height: 36, rx: 10, fill: "#4A73B8" }, g);
      el("rect", { x: 92, y: 126, width: 36, height: 34, rx: 6, fill: "#4A73B8" }, g);
      el("path", { d: "M94 128 L98 116 M126 128 L122 116", stroke: "#4A73B8", "stroke-width": 7, "stroke-linecap": "round" }, g);
      el("circle", { cx: 97, cy: 130, r: 3, fill: "#FFD93D" }, g);
      el("circle", { cx: 123, cy: 130, r: 3, fill: "#FFD93D" }, g);
      el("rect", { x: 100, y: 136, width: 20, height: 16, rx: 3, fill: "#5C87CE" }, g);
      el("path", { d: "M86 168 Q110 176 134 168", stroke: "#FFD93D", "stroke-width": 2, fill: "none", "stroke-dasharray": "4 4" }, g);
      return null;
    }
    if (id === "jeanCoeur") {
      el("rect", { x: 84, y: 148, width: 52, height: 38, rx: 10, fill: "#3E63A0" }, g);
      el("rect", { x: 84, y: 114, width: 52, height: 42, rx: 14, fill: "#FFFFFF" }, g);
      el("path", { d: coeurD(13), fill: "#FF3D85", transform: "translate(110 138)" }, g);
      el("rect", { x: 84, y: 146, width: 52, height: 7, rx: 3, fill: "#2C4A7A" }, g);
      el("circle", { cx: 110, cy: 149.5, r: 3, fill: "#FFD93D" }, g);
      return null;
    }
    if (id === "survetement") {
      el("rect", { x: 82, y: 114, width: 56, height: 46, rx: 16, fill: "#2F3A56" }, g);
      el("rect", { x: 84, y: 152, width: 52, height: 34, rx: 10, fill: "#2F3A56" }, g);
      el("path", { d: "M92 118 L92 186 M128 118 L128 186", stroke: tc, "stroke-width": 4 }, g);
      el("path", { d: "M98 116 L110 128 L122 116 Z", fill: "#1E263A" }, g);
      el("path", { d: "M104 136 h12 M104 144 h12", stroke: tc, "stroke-width": 3, "stroke-linecap": "round" }, g);
      return null;
    }
    if (id === "manteau") {
      el("path", { d: "M86 116 Q110 108 134 116 L142 186 Q110 194 78 186 Z", fill: "#8A4F6D" }, g);
      el("path", { d: "M110 112 V190", stroke: "#6E3C56", "stroke-width": 3 }, g);
      [128, 146, 164].forEach(function (y) { el("circle", { cx: 110, cy: y, r: 3.4, fill: "#FFD93D" }, g); });
      el("path", { d: "M86 116 Q110 134 134 116 Q136 126 126 130 Q110 140 94 130 Q84 126 86 116 Z", fill: "#B97390" }, g);
      el("path", { d: "M78 186 Q110 194 142 186", stroke: "#6E3C56", "stroke-width": 3, fill: "none" }, g);
      return null;
    }
    if (id === "kimono") {
      el("path", { d: "M86 116 Q110 110 134 116 L142 186 Q110 194 78 186 Z", fill: "#F4EDE4" }, g);
      el("path", { d: "M100 114 L110 150 L120 114 Z", fill: "#D7263D" }, g);
      el("path", { d: "M110 150 L94 186 M110 150 L126 186", stroke: "#D7263D", "stroke-width": 3, fill: "none" }, g);
      el("rect", { x: 80, y: 152, width: 60, height: 12, rx: 3, fill: "#D7263D" }, g);
      [[94, 130], [124, 136], [102, 172], [130, 176]].forEach(function (p) { fleurette(g, p[0], p[1], "#FF8FC5", "#FFD93D", .9); });
      return null;
    }
    if (id === "tutu") {
      el("rect", { x: 88, y: 114, width: 44, height: 56, rx: 16, fill: tc }, g);
      el("path", { d: "M98 116 L110 128 L122 116 Z", fill: "#FFFFFF", opacity: .6 }, g);
      jupe = el("g", {}, g);
      el("path", { d: "M84 162 Q110 154 136 162 L158 186 Q110 200 62 186 Z", fill: "#FFC7E4" }, jupe);
      el("path", { d: "M86 160 Q110 152 134 160 L150 178 Q110 190 70 178 Z", fill: "#FFE3F1", opacity: .9 }, jupe);
      el("path", { d: "M84 166 Q110 160 136 166", stroke: "#FF8FC5", "stroke-width": 3, fill: "none" }, jupe);
      return null;
    }
    if (id === "princesse") {
      el("path", { d: "M52 196 Q70 150 92 140 L128 140 Q150 150 168 196 Q110 208 52 196 Z", fill: "#C9B6FF", opacity: .85 }, g);
      robe("#B49BFF"); col("#FFFFFF");
      el("path", { d: "M86 150 Q110 160 134 150", stroke: "#FFD93D", "stroke-width": 4, fill: "none" }, g);
      el("path", { d: "M74 188 Q110 198 146 188", stroke: "#FFD93D", "stroke-width": 3, fill: "none" }, g);
      [[96, 168], [124, 172], [110, 184]].forEach(function (p) {
        el("path", { d: etoileD(4), fill: "#FFFFFF", transform: "translate(" + p[0] + " " + p[1] + ")" }, g);
      });
      return null;
    }
    if (id === "pullNoel") {
      el("rect", { x: 82, y: 114, width: 56, height: 48, rx: 16, fill: "#D7263D" }, g);
      el("rect", { x: 84, y: 156, width: 52, height: 30, rx: 10, fill: "#2B5F3A" }, g);
      el("path", { d: "M110 122 L98 146 H122 Z M110 132 L94 156 H126 Z", fill: "#2B5F3A" }, g);
      el("rect", { x: 107, y: 154, width: 6, height: 6, fill: "#8A5E38" }, g);
      el("path", { d: "M84 140 h52", stroke: "#FFFFFF", "stroke-width": 2, "stroke-dasharray": "3 5", opacity: .7 }, g);
      return null;
    }
    if (id === "maillotBain") {
      el("rect", { x: 88, y: 114, width: 44, height: 54, rx: 18, fill: "#FF6FA5" }, g);
      el("path", { d: "M88 130 Q110 140 132 130", stroke: "#FFFFFF", "stroke-width": 4, fill: "none" }, g);
      el("path", { d: "M88 148 Q110 158 132 148", stroke: "#FFD93D", "stroke-width": 4, fill: "none" }, g);
      el("path", { d: "M98 114 Q110 124 122 114", stroke: "#FF3D85", "stroke-width": 3, fill: "none" }, g);
      return null;
    }
    if (id === "sirene") {
      var q = el("g", {}, g);
      el("rect", { x: 88, y: 114, width: 44, height: 50, rx: 16, fill: "#FF8FC5" }, q);
      el("path", { d: "M92 128 q9 8 18 0 q9 8 18 0", stroke: "#FFFFFF", "stroke-width": 2.5, fill: "none", opacity: .8 }, q);
      el("path", { d: "M92 156 Q110 150 128 156 L134 206 Q110 214 86 206 Z", fill: "#3FC7B4" }, q);
      el("path", { d: "M86 206 Q110 196 134 206 Q150 236 126 244 Q110 234 94 244 Q70 236 86 206 Z", fill: "#2FAF9E" }, q);
      el("path", { d: "M96 178 q7 6 14 0 q7 6 14 0 M92 192 q9 6 18 0 q9 6 18 0", stroke: "#2A9487", "stroke-width": 2.2, fill: "none" }, q);
      el("path", { d: "M110 214 L100 240 M110 214 L120 240", stroke: "#2A9487", "stroke-width": 2.2, fill: "none" }, q);
      return null;
    }
    return null;
  }

  // ---------- Dans le dos (derrière tout le corps, suit le buste) ----------
  function objetDos(id, g, tc) {
    var a, gauche, droite, c, tissu, q, queue;
    function paireAiles(dessus, dessous, bordA, bordB, y) {
      a = el("g", { transform: "translate(110 " + (y || 142) + ")" }, g);
      gauche = el("g", {}, a); droite = el("g", {}, a);
      [[gauche, -1], [droite, 1]].forEach(function (p) {
        var s = p[1];
        el("path", { d: "M0 -10 C " + (s * 72) + " -74, " + (s * 96) + " -18, " + (s * 20) + " 4 Z", fill: dessus, opacity: .85, stroke: bordA, "stroke-width": 2 }, p[0]);
        el("path", { d: "M0 0 C " + (s * 62) + " 8, " + (s * 66) + " 72, " + (s * 14) + " 28 Z", fill: dessous, opacity: .85, stroke: bordB, "stroke-width": 2 }, p[0]);
      });
      return function (t) {
        var v = Math.sin(t * 3.4) * 0.16;
        gauche.setAttribute("transform", "scale(" + (1 - v).toFixed(3) + " 1)");
        droite.setAttribute("transform", "scale(" + (1 + v).toFixed(3) + " 1)");
      };
    }
    function queueSimple(o) {
      q = el("g", { transform: "translate(134 184)" }, g);
      queue = el("g", {}, q);
      el("path", { d: o.d, stroke: o.base, "stroke-width": o.large, fill: "none", "stroke-linecap": "round" }, queue);
      if (o.rayures) el("path", { d: o.rayures, stroke: o.fonce, "stroke-width": 4.5, "stroke-linecap": "round" }, queue);
      if (o.bout) el("circle", { cx: o.bx, cy: o.by, r: o.br || 7, fill: o.bout }, queue);
      return function (t) { queue.setAttribute("transform", "rotate(" + (Math.sin(t * 1.9) * 9).toFixed(1) + " 0 0)"); };
    }
    if (id === "ailes") return paireAiles("#CDEBFF", "#E3D6FF", "#8FD0F5", "#B7A6F0");
    if (id === "ailesAnge") return paireAiles("#FFFFFF", "#F2F2FA", "#D8D8E8", "#D8D8E8");
    if (id === "ailesPapillon") return paireAiles("#FF9ECF", "#FFC97A", "#E06BA8", "#E0A44A");
    if (id === "ailesDragon") {
      a = el("g", { transform: "translate(110 140)" }, g);
      gauche = el("g", {}, a); droite = el("g", {}, a);
      [[gauche, -1], [droite, 1]].forEach(function (p) {
        var s = p[1];
        el("path", { d: "M0 -12 L" + (s * 78) + " -52 L" + (s * 66) + " -16 L" + (s * 84) + " 4 L" + (s * 52) + " 2 L" + (s * 58) + " 30 L" + (s * 18) + " 6 Z",
                     fill: "#6B5BC4", stroke: "#4A3D92", "stroke-width": 2, "stroke-linejoin": "round" }, p[0]);
      });
      return function (t) {
        var v = Math.sin(t * 2.8) * 0.18;
        gauche.setAttribute("transform", "scale(" + (1 - v).toFixed(3) + " 1)");
        droite.setAttribute("transform", "scale(" + (1 + v).toFixed(3) + " 1)");
      };
    }
    if (id === "cape") {
      c = el("g", { transform: "translate(110 124)" }, g);
      tissu = el("g", {}, c);
      el("path", { d: "M-26 -4 Q0 8 26 -4 L58 82 Q44 74 30 84 Q15 74 0 84 Q-15 74 -30 84 Q-44 74 -58 82 Z", fill: "#D7263D" }, tissu);
      el("path", { d: "M-18 -2 Q0 6 18 -2 L32 46 Q0 56 -32 46 Z", fill: "#F05A6A", opacity: .5 }, tissu);
      el("path", { d: "M-28 -6 Q0 8 28 -6", stroke: "#FFD93D", "stroke-width": 5, fill: "none", "stroke-linecap": "round" }, c);
      return function (t) { tissu.setAttribute("transform", "rotate(" + (Math.sin(t * 2.2) * 4).toFixed(1) + " 0 0)"); };
    }
    if (id === "capeVampire") {
      c = el("g", { transform: "translate(110 122)" }, g);
      tissu = el("g", {}, c);
      el("path", { d: "M-26 -4 Q0 8 26 -4 L56 84 Q42 72 28 84 Q14 72 0 84 Q-14 72 -28 84 Q-42 72 -56 84 Z", fill: "#1E1633" }, tissu);
      el("path", { d: "M-18 -2 Q0 6 18 -2 L30 48 Q0 58 -30 48 Z", fill: "#7A1533", opacity: .85 }, tissu);
      el("path", { d: "M-30 -10 Q-26 -22 -12 -18 Q0 -8 12 -18 Q26 -22 30 -10 Q0 4 -30 -10 Z", fill: "#1E1633" }, c);
      el("circle", { cx: 0, cy: -4, r: 4, fill: "#E5484D" }, c);
      return function (t) { tissu.setAttribute("transform", "rotate(" + (Math.sin(t * 2.2) * 4).toFixed(1) + " 0 0)"); };
    }
    if (id === "sundae") return queueSimple({ d: "M0 6 Q42 10 52 -20 Q58 -44 44 -56", large: 14, base: TIGRE.base, fonce: TIGRE.fonce,
      rayures: "M20 8 L24 0 M38 2 L44 -6 M50 -18 L59 -21 M52 -40 L60 -44", bout: TIGRE.clair, bx: 44, by: -56 });
    if (id === "renard") return queueSimple({ d: "M0 8 Q44 14 54 -16 Q60 -40 46 -52", large: 17, base: "#E2712C",
      bout: "#FFF3E6", bx: 46, by: -52, br: 9 });
    if (id === "lapin") {
      q = el("g", { transform: "translate(152 180)" }, g);
      queue = el("g", {}, q);
      el("circle", { r: 13, fill: "#FFFFFF", stroke: "#E3D8D0", "stroke-width": 2 }, queue);
      el("circle", { cx: -4, cy: -4, r: 5, fill: "#FFFFFF" }, queue);
      return function (t) { queue.setAttribute("transform", "translate(0 " + (Math.sin(t * 6) * 2).toFixed(1) + ")"); };
    }
    if (id === "panda") {
      q = el("g", { transform: "translate(134 186)" }, g);
      queue = el("g", {}, q);
      el("circle", { r: 11, fill: "#2D2D3A" }, queue);
      return function (t) { queue.setAttribute("transform", "rotate(" + (Math.sin(t * 2.4) * 10).toFixed(1) + " -10 0)"); };
    }
    if (id === "dinosaure") {
      q = el("g", { transform: "translate(132 190)" }, g);
      queue = el("g", {}, q);
      el("path", { d: "M0 0 Q36 6 54 -22", stroke: "#5FBF7A", "stroke-width": 18, fill: "none", "stroke-linecap": "round" }, queue);
      el("path", { d: "M10 -8 L14 -20 L22 -8 Z M26 -12 L30 -24 L38 -13 Z M42 -22 L44 -34 L52 -24 Z",
                   fill: "#FFD93D", stroke: "#E0A800", "stroke-width": 1.5, "stroke-linejoin": "round" }, queue);
      return function (t) { queue.setAttribute("transform", "rotate(" + (Math.sin(t * 2.1) * 8).toFixed(1) + " 0 0)"); };
    }
    if (id === "sacDos") {
      c = el("g", {}, g);
      el("rect", { x: 52, y: 126, width: 40, height: 48, rx: 12, fill: "#FF6FA5" }, c);
      el("rect", { x: 57, y: 146, width: 30, height: 18, rx: 6, fill: "#FF3D85" }, c);
      el("path", { d: "M66 126 Q76 112 92 118", stroke: "#FF3D85", "stroke-width": 6, fill: "none" }, c);
      el("path", { d: etoileD(6), fill: "#FFD93D", transform: "translate(72 136)" }, c);
      return null;
    }
    if (id === "bouee") {
      c = el("g", {}, g);
      el("ellipse", { cx: 110, cy: 170, rx: 52, ry: 26, fill: "#FFD93D", stroke: "#E0A800", "stroke-width": 2 }, c);
      el("ellipse", { cx: 110, cy: 170, rx: 30, ry: 13, fill: "#F8FBFF" }, c);
      el("path", { d: "M64 158 q10 -8 20 0 M136 158 q10 -8 20 0", stroke: "#E0A800", "stroke-width": 3, fill: "none" }, c);
      el("circle", { cx: 60, cy: 152, r: 9, fill: "#FFD93D" }, c);
      el("path", { d: "M52 150 l-8 3 l8 3 Z", fill: "#E8792B" }, c);
      el("circle", { cx: 57, cy: 149, r: 1.6, fill: "#2D2D3A" }, c);
      return null;
    }
    return null;
  }

  // ---------- Autour d'elle ----------
  function objetEffet(id, g, tc) {
    var e, n, i;
    if (id === "ballonsEffet") {
      var lot = [[62, 70, "#FF6FA5"], [160, 62, "#FFD93D"], [52, 140, "#7CD5FF"], [168, 132, "#B78BFF"]].map(function (q) {
        var b = el("g", { transform: "translate(" + q[0] + " " + q[1] + ")" }, g);
        el("path", { d: "M0 14 q4 18 -2 34", stroke: "#FFFFFF", "stroke-width": 1.2, fill: "none", opacity: .7 }, b);
        el("ellipse", { rx: 12, ry: 14, fill: q[2] }, b);
        el("ellipse", { cx: -4, cy: -5, rx: 3, ry: 4, fill: "rgba(255,255,255,.55)" }, b);
        el("path", { d: "M-3 13 L3 13 L0 18 Z", fill: q[2] }, b);
        return { n: b, x: q[0], y: q[1] };
      });
      return function (t) {
        lot.forEach(function (b, i) {
          var dy = Math.sin(t * 1.3 + i * 1.7) * 7;
          b.n.setAttribute("transform", "translate(" + b.x + " " + (b.y + dy).toFixed(1) + ") rotate(" + (Math.sin(t + i) * 5).toFixed(1) + ")");
        });
      };
    }
    if (id === "papillonVole") {
      e = el("g", {}, g);
      n = el("g", {}, e);
      el("path", { d: "M0 0 C -14 -14, -20 4, 0 4 Z", fill: "#FF9ECF" }, n);
      el("path", { d: "M0 0 C 14 -14, 20 4, 0 4 Z", fill: "#FFC97A" }, n);
      el("ellipse", { rx: 2, ry: 5, cy: 2, fill: "#4A3B2A" }, n);
      return function (t) {
        var c = (t / 5) % 1, x = 110 + Math.cos(c * Math.PI * 2) * 62, y = 96 + Math.sin(c * Math.PI * 4) * 34;
        e.setAttribute("transform", "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ")");
        n.setAttribute("transform", "scale(" + (0.6 + Math.abs(Math.sin(t * 9)) * 0.5).toFixed(2) + " 1)");
      };
    }
    if (id === "etoilesEffet" || id === "paillettes") {
      var grosses = id === "paillettes";
      var points = [];
      e = el("g", { fill: grosses ? "#FFD93D" : "#FFFFFF" }, g);
      for (i = 0; i < (grosses ? 14 : 8); i++) {
        points.push({ n: el("path", { d: etoileD(grosses ? 4.5 : 3.4) }, e), x: 30 + Math.random() * 160, d: Math.random() * 3, v: 26 + Math.random() * 22 });
      }
      return function (t) {
        points.forEach(function (p) {
          var y = ((t + p.d) * p.v) % 250;
          p.n.setAttribute("transform", "translate(" + p.x.toFixed(1) + " " + y.toFixed(1) + ") rotate(" + ((t * 90 + p.d * 60) % 360).toFixed(0) + ")");
          p.n.setAttribute("opacity", (0.25 + 0.75 * Math.abs(Math.sin((t + p.d) * 2))).toFixed(2));
        });
      };
    }
    if (id === "arcEnCiel") {
      e = el("g", {}, g);
      ["#FF5FA2", "#FFB03B", "#FFE96B", "#6BE38A", "#5FD0FF", "#B78BFF"].forEach(function (couleur, k) {
        el("path", { d: "M" + (16 + k * 9) + " 244 A " + (94 - k * 9) + " " + (94 - k * 9) + " 0 0 1 " + (204 - k * 9) + " 244",
                     stroke: couleur, "stroke-width": 8, fill: "none", opacity: .5 }, e);
      });
      return null;
    }
    return null;
  }

  // ---------- Aux pieds (ajouté dans le groupe de chaque pied) ----------
  function objetPieds(id, f, tc) {
    if (!id) return;
    var fx = f.fx, s = f.sens, g;
    if (id === "baskets") {
      var brille = el("g", { fill: "#FFD93D", stroke: "#E0A800", "stroke-width": .8 }, f.basket);
      [[fx + s * 8, 240, 3], [fx - s * 2, 237, 2.2], [fx + s * 1, 243, 2.6]].forEach(function (q) {
        el("path", { d: etoileD(q[2]), transform: "translate(" + q[0] + " " + q[1] + ")" }, brille);
      });
      return;
    }
    g = el("g", {}, f.g);
    f.chaussure = g;
    if (id === "ballerines") {
      el("path", { d: "M" + (fx + s * 15) + " 248 Q" + (fx + s * 16) + " 235 " + fx + " 236 Q" + (fx - s * 10) + " 237 " + (fx - s * 11) + " 248 Z", fill: "#FFB3C7" }, g);
      el("path", { d: "M" + (fx - s * 11) + " 246 H" + (fx + s * 15), stroke: "#F58BAE", "stroke-width": 2.5 }, g);
      el("path", { d: "M" + (fx + s * 2) + " 235 l" + (-s * 6) + " -6 M" + (fx + s * 2) + " 235 l" + (s * 6) + " -6", stroke: "#F58BAE", "stroke-width": 2, fill: "none" }, g);
      el("circle", { cx: fx + s * 2, cy: 235, r: 2.6, fill: "#FF6FA5" }, g);
      return;
    }
    if (id === "bottesPluie") {
      el("path", { d: "M" + (fx - s * 8) + " 214 H" + (fx + s * 8) + " V238 L" + (fx + s * 18) + " 241 V249 H" + (fx - s * 9) + " Z",
                   fill: "#FFD93D", stroke: "#E0A800", "stroke-width": 2, "stroke-linejoin": "round" }, g);
      el("path", { d: "M" + (fx - s * 9) + " 245 H" + (fx + s * 18), stroke: "#E0A800", "stroke-width": 3 }, g);
      el("path", { d: "M" + (fx - s * 8) + " 218 H" + (fx + s * 8), stroke: "#FFFFFF", "stroke-width": 3 }, g);
      return;
    }
    if (id === "basketsMontantes") {
      el("path", { d: "M" + (fx - s * 8) + " 224 H" + (fx + s * 8) + " V238 L" + (fx + s * 17) + " 241 V249 H" + (fx - s * 9) + " Z",
                   fill: "#E5484D", stroke: "#B32B31", "stroke-width": 2, "stroke-linejoin": "round" }, g);
      el("path", { d: "M" + (fx - s * 9) + " 245 H" + (fx + s * 17), stroke: "#FFFFFF", "stroke-width": 4 }, g);
      el("path", { d: "M" + (fx - s * 6) + " 228 l" + (s * 12) + " 4 M" + (fx - s * 6) + " 234 l" + (s * 12) + " 4",
                   stroke: "#FFFFFF", "stroke-width": 2, "stroke-linecap": "round" }, g);
      return;
    }
    if (id === "bottesCowboy") {
      el("path", { d: "M" + (fx - s * 8) + " 212 H" + (fx + s * 8) + " V236 L" + (fx + s * 19) + " 240 V246 H" + (fx + s * 2) + " V243 H" + (fx - s * 9) + " Z",
                   fill: "#A6703C", stroke: "#7A5029", "stroke-width": 2, "stroke-linejoin": "round" }, g);
      el("path", { d: "M" + (fx - s * 8) + " 220 H" + (fx + s * 8), stroke: "#7A5029", "stroke-width": 2 }, g);
      el("path", { d: etoileD(4), fill: "#FFD93D", transform: "translate(" + fx + " 228)" }, g);
      return;
    }
  }

  // ---------- Le compagnon qui la suit ----------
  function objetCompagnon(id, g) {
    if (id !== "sundaeAmi") return null;
    g.innerHTML = chat("marche", "tigre");
    var dedans = g.firstChild;
    if (dedans && dedans.setAttribute) {
      dedans.setAttribute("x", 146); dedans.setAttribute("y", 196);
      dedans.setAttribute("width", 74); dedans.setAttribute("height", 60);
    }
    return null;
  }

  function creer(conteneur, fille, apparence) {
    apparence = apparence || {};
    var tc = fille.couleur;
    var ch = CHEVEUX[apparence.cheveux] || CHEVEUX.chatain;
    var coiffure = apparence.coiffure || "longs";
    var acc = apparence.accessoire || "";
    var clair = "rgba(255,255,255,.35)";

    var svg = el("svg", { viewBox: "0 0 220 260", "class": "avatar-svg", preserveAspectRatio: "xMidYMid meet" });
    var R = {};

    // Couleur de cheveux achetée en boutique : un dégradé du haut vers les pointes
    var degrade = DEGRADES[(apparence.objets || {}).cheveux];
    if (degrade) {
      var idDegrade = "cheveux" + (++compteurSvg);
      var lg = el("linearGradient", { id: idDegrade, gradientUnits: "userSpaceOnUse", x1: 110, y1: 34, x2: 110, y2: 152 }, el("defs", {}, svg));
      for (var iD = 0; iD < degrade.length; iD += 2) el("stop", { offset: degrade[iD], "stop-color": degrade[iD + 1].replace("#@", ch) }, lg);
      ch = "url(#" + idDegrade + ")";
    }

    // Décor derrière
    R.litReveil = dessinerLitReveil(svg, tc);
    R.chambre = dessinerChambre(svg, tc);
    el("ellipse", { cx: 110, cy: 246, rx: 46, ry: 6, fill: "rgba(0,0,0,.28)" }, svg);

    R.tout = el("g", {}, svg);
    R.dos = el("g", {}, R.tout); // objets de boutique portés dans le dos : ailes, cape, queue

    // Cheveux de derrière (suivent la tête). Les cinq premières sont réglées par les parents, les autres s'achètent
    R.cheveuxArriere = el("g", {}, R.tout);
    var courts = "M76 74 Q74 38 110 38 Q146 38 144 74 L142 94 Q110 98 78 94 Z";
    var longs = "M74 74 Q70 38 110 36 Q150 38 146 74 L152 142 Q130 152 110 147 Q90 152 68 142 Z";
    function cheveux(d, classe) { return el("path", { d: d, fill: ch, "class": classe || "" }, R.cheveuxArriere); }
    function boule(x, y, r, classe) { return el("circle", { cx: x, cy: y, r: r, fill: ch, "class": classe || "" }, R.cheveuxArriere); }
    function elastique(x, y) { return el("circle", { cx: x, cy: y, r: 5, fill: tc }, R.cheveuxArriere); }
    function natte(x0, y0, x1, y1, sens, classe) {
      var g = el("g", { "class": classe || "" }, R.cheveuxArriere), n = 5, i, u, x, y;
      for (i = 0; i <= n; i++) {
        u = i / n; x = x0 + (x1 - x0) * u; y = y0 + (y1 - y0) * u;
        el("ellipse", { cx: x, cy: y, rx: 10 - u * 3.5, ry: 8 - u * 2.5, fill: ch,
                        transform: "rotate(" + (sens * (i % 2 ? 24 : -24)) + " " + x + " " + y + ")" }, g);
      }
      el("path", { d: "M" + (x1 - 5) + " " + (y1 + 3) + " L" + x1 + " " + (y1 + 18) + " L" + (x1 + 5) + " " + (y1 + 3) + " Z", fill: ch }, g);
      el("circle", { cx: x1, cy: y1 + 2, r: 4, fill: tc }, g);
      return g;
    }
    if (coiffure === "longs") cheveux(longs);
    if (coiffure === "carre") cheveux("M74 74 Q70 38 110 36 Q150 38 146 74 L149 110 Q110 120 71 110 Z");
    if (coiffure === "courts") cheveux(courts);
    if (coiffure === "queue") { cheveux(courts); cheveux("M140 52 Q176 52 170 100 Q166 130 148 136 Q158 104 138 74 Z", "queue"); }
    if (coiffure === "couettes") {
      cheveux(courts);
      el("ellipse", { cx: 64, cy: 100, rx: 13, ry: 24, fill: ch, "class": "couette" }, R.cheveuxArriere);
      el("ellipse", { cx: 156, cy: 100, rx: 13, ry: 24, fill: ch, "class": "couette" }, R.cheveuxArriere);
    }
    if (coiffure === "ondules") cheveux("M74 74 Q70 38 110 36 Q150 38 146 74 L154 134 Q146 150 134 138 Q122 152 110 140 Q98 152 86 138 Q74 150 66 134 Z");
    if (coiffure === "boucles") {
      cheveux("M72 76 Q64 34 110 32 Q156 34 148 76 L150 120 Q110 136 70 120 Z");
      [[64, 66, 12], [60, 92, 12], [64, 116, 12], [78, 132, 12], [96, 140, 12], [110, 142, 12], [124, 140, 12],
       [142, 132, 12], [156, 116, 12], [160, 92, 12], [156, 66, 12], [78, 44, 13], [110, 34, 13], [142, 44, 13]].forEach(function (q) {
        boule(q[0], q[1], q[2]);
      });
    }
    if (coiffure === "tresse") { cheveux(courts); natte(148, 68, 168, 138, 1, "queue"); }
    if (coiffure === "nattes") { cheveux(courts); natte(72, 72, 56, 140, -1, "couette"); natte(148, 72, 164, 140, 1, "couette"); }
    if (coiffure === "chignon") {
      cheveux(courts);
      boule(110, 30, 22);
      el("path", { d: "M98 30 Q110 18 122 30 Q110 42 98 30", fill: "none", stroke: "rgba(0,0,0,.18)", "stroke-width": 3 }, R.cheveuxArriere);
      elastique(110, 52);
    }
    if (coiffure === "macarons") {
      cheveux(courts);
      [66, 154].forEach(function (x) {
        boule(x, 54, 17);
        el("path", { d: "M" + (x - 9) + " 54 Q" + x + " 44 " + (x + 9) + " 54", fill: "none", stroke: "rgba(0,0,0,.18)", "stroke-width": 3 }, R.cheveuxArriere);
        elastique(x + (x < 110 ? 15 : -15), 66);
      });
    }
    if (coiffure === "couettesHautes") {
      cheveux(courts);
      el("ellipse", { cx: 68, cy: 30, rx: 15, ry: 19, fill: ch, "class": "couette", transform: "rotate(-28 68 30)" }, R.cheveuxArriere);
      el("ellipse", { cx: 152, cy: 30, rx: 15, ry: 19, fill: ch, "class": "couette", transform: "rotate(28 152 30)" }, R.cheveuxArriere);
      el("path", { d: "M84 48 Q76 38 70 30 M136 48 Q144 38 150 30", stroke: ch, "stroke-width": 9, fill: "none", "stroke-linecap": "round" }, R.cheveuxArriere);
      elastique(86, 48); elastique(134, 48);
    }
    if (coiffure === "demiQueue") {
      cheveux(longs);
      el("path", { d: "M90 46 Q110 8 130 46 Q110 38 90 46 Z", fill: ch, "class": "queue" }, R.cheveuxArriere);
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
    el("rect", { x: 100, y: 94, width: 20, height: 12, rx: 6, fill: BOUCHE }, R.bouches.dents);
    el("path", { d: "M102 95.5 H118 V100 Q110 102.5 102 100 Z", fill: "#FFFFFF" }, R.bouches.dents);
    el("path", { d: "M107 95.5 V100.6 M113 95.5 V100.6", stroke: "#E8D6D6", "stroke-width": .7 }, R.bouches.dents);
    R.mousse = el("g", { fill: "#FFFFFF" }, R.tete);
    [[97, 104, 4], [103, 109, 3.2], [118, 109, 3], [123, 104, 3.5], [110, 111, 2.5]].forEach(function (c) { el("circle", { cx: c[0], cy: c[1], r: c[2] }, R.mousse); });
    R.frangeSage = el("path", { d: "M76 74 Q76 40 110 40 Q144 40 144 74 Q130 56 110 58 Q92 56 76 74 Z", fill: ch }, R.tete);
    R.frangeBataille = el("g", {}, R.tete);
    el("path", { d: "M76 72 Q78 40 110 40 Q142 40 144 72 Q136 58 128 64 Q122 52 112 60 Q102 50 96 62 Q86 56 76 72 Z", fill: ch }, R.frangeBataille);
    el("path", { d: "M96 46 L90 24 L104 40 L110 18 L118 40 L134 26 L126 48 Z", fill: ch }, R.frangeBataille);
    R.attaches = el("g", {}, R.tete);
    if (coiffure === "couettes") { el("circle", { cx: 72, cy: 78, r: 5, fill: tc }, R.attaches); el("circle", { cx: 148, cy: 78, r: 5, fill: tc }, R.attaches); }
    if (coiffure === "queue") el("circle", { cx: 142, cy: 56, r: 5, fill: tc }, R.attaches);
    if (coiffure === "demiQueue") el("circle", { cx: 110, cy: 46, r: 5.5, fill: tc }, R.attaches);
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
    // Le torse en peau : c'est ce qu'on voit si elle choisit de ne pas mettre de haut
    el("rect", { x: 88, y: 112, width: 44, height: 72, rx: 18, fill: PEAU }, R.buste);
    el("path", { d: "M99 116 Q110 122 121 116", stroke: PEAU_OMBRE, "stroke-width": 1.6, fill: "none", opacity: .5 }, R.buste);
    // Maillot de corps sous les vêtements : jamais de trou pendant l'habillage
    R.maillot = el("g", {}, R.buste);
    el("rect", { x: 86, y: 114, width: 48, height: 68, rx: 20, fill: "#F4F4F8" }, R.maillot);
    el("path", { d: "M100 116 Q110 124 120 116", stroke: "#DADAE6", "stroke-width": 2, fill: "none" }, R.maillot);
    R.robe = el("g", {}, R.buste);
    el("path", { d: "M88 116 Q110 108 132 116 L146 188 Q110 198 74 188 Z", fill: tc }, R.robe);
    el("path", { d: "M98 116 L110 130 L122 116 Z", fill: "#FFFFFF" }, R.robe);
    el("path", { d: "M76 176 Q110 186 144 176", stroke: clair, "stroke-width": 3, fill: "none" }, R.robe);
    R.tenue = el("g", {}, R.buste); // tenue complète achetée en boutique, à la place de la robe
    R.bas = el("g", {}, R.buste);   // jupe ou pantalon, sous le haut
    R.haut = el("g", {}, R.buste);
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
    R.talkie = el("g", {}, svg); R.ondes = dessinerTalkie(R.talkie, tc);
    R.cartes = el("g", {}, svg); dessinerCartes(R.cartes);
    R.zzz = el("text", { x: 150, y: 40, "font-size": 22, "text-anchor": "middle" }, svg); R.zzz.textContent = "💤";
    R.scratch = el("text", { "font-size": 19, "font-weight": 800, "text-anchor": "middle", fill: "#FFD93D", stroke: ENCRE, "stroke-width": 4, "paint-order": "stroke" }, svg);
    R.scratch.textContent = "scratch !";

    // ---------- Ce qu'elle porte de la boutique ----------
    var objets = apparence.objets || {}, animesBoutique = [];
    function poser(id, dessin, groupe) {
      if (!id) return;
      var f = dessin(id, groupe, tc, ch);
      if (f) animesBoutique.push(f);
    }
    poser(objets.dos, objetDos, R.dos);
    poser(objets.cheveux, objetCheveux, R.tete);
    poser(objets.tete, objetTete, R.tete);
    if (OREILLES[objets.dos]) objetTete(OREILLES[objets.dos], R.tete, tc);
    poser(objets.joues, objetJoues, R.tete);
    poser(objets.visage, objetVisage, R.tete); // le masque passe devant le reste du visage
    poser(objets.cou, objetCou, R.buste);
    // Une tenue complète remplace le haut et le bas ; « robeSimple » est la robe de tous les jours
    R.robeDefaut = objets.tenue === "robeSimple";
    R.tenuePortee = R.robeDefaut ? "" : (objets.tenue || "");
    R.hautPorte = objets.tenue ? "" : (objets.haut || "");
    R.basPorte = objets.tenue ? "" : (objets.bas || "");
    poser(R.tenuePortee, objetTenue, R.tenue);
    poser(R.basPorte, objetBas, R.bas);
    poser(R.hautPorte, objetHaut, R.haut);
    var surLeBuste = R.robeDefaut ? "robeSimple" : (R.tenuePortee || R.hautPorte);
    R.maillotVisible = !!surLeBuste;
    R.manche = !surLeBuste ? PEAU : MANCHES[surLeBuste] === "peau" ? PEAU : (MANCHES[surLeBuste] || tc);
    R.pantalonCouleur = PANTALONS[R.tenuePortee || R.basPorte] || "";
    R.pieds.forEach(function (f) { objetChaussettes(objets.chaussettes, f, tc); objetPieds(objets.pieds, f, tc); });
    if (objets.compagnon) objetCompagnon(objets.compagnon, el("g", {}, svg));
    if (objets.effet) {
      var groupeEffet = el("g", {});
      if (objets.effet === "arcEnCiel") svg.insertBefore(groupeEffet, svg.firstChild); // derrière elle
      else svg.appendChild(groupeEffet);
      poser(objets.effet, objetEffet, groupeEffet);
    }

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
          tempsLibre();
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

      // Le temps libre change de jeu toutes les 16 secondes. Les deux filles partagent la même horloge,
      // donc elles jouent au même jeu en même temps et peuvent se répondre.
      function tempsLibre() {
        var jeux = [jouer, talkie, lecture, cartes, danse];
        jeux[Math.floor(t / 16) % jeux.length]();
      }

      function talkie() {
        var jeParle = (cycle(t, 7) < 0.5) === (sens > 0);
        var mainCentre = jeParle ? pt(130, 106) : pt(134, 92);
        var autre = pt(84, 168 + Math.sin(t * 2) * 2);
        P.mains = sens > 0 ? [autre, mainCentre] : [pt(220 - mainCentre.x, mainCentre.y), pt(220 - autre.x, autre.y)];
        P.objets.talkie = { main: sens > 0 ? 1 : 0, r: jeParle ? 12 : -8, ondes: jeParle ? 1 : 0 };
        P.bouche = jeParle ? (cycle(t, 0.45) < 0.5 ? "ouverte" : "sourire") : "sourire";
        P.tete = jeParle ? 2 : -7;
        P.yeux = "joie";
      }

      function lecture() {
        c = cycle(t, 7);
        var tourne = c > 0.84 ? (c - 0.84) / 0.16 : 0;
        var mainD = tourne ? trajet([[0, pt(128, 152)], [0.5, pt(142, 122)], [1, pt(128, 152)]], tourne) : pt(128, 152);
        P.mains = [pt(92, 152), mainD];
        P.objets.livre = { x: 110, y: 150 };
        P.tete = 14;
        P.bouche = "sourire";
        P.dy = Math.sin(t * 1.6);
      }

      function cartes() {
        c = cycle(t + (sens > 0 ? 0 : 2.5), 6);
        var montre = c > 0.5 && c < 0.82;
        var mainCentre = montre ? pt(142, 98) : pt(126, 142);
        var autre = pt(92, 152);
        P.mains = sens > 0 ? [autre, mainCentre] : [pt(220 - mainCentre.x, mainCentre.y), pt(220 - autre.x, autre.y)];
        P.objets.cartes = { main: sens > 0 ? 1 : 0, r: montre ? -14 : 10 };
        P.yeux = montre ? "joie" : "ouverts";
        P.bouche = montre ? "grand" : "sourire";
        P.tete = montre ? -5 : 7;
      }

      function danse() {
        var h = Math.sin(t * 2.6);
        P.saut = Math.abs(Math.sin(t * 2.6)) * 8;
        P.lean = h * 7;
        P.tete = -h * 6;
        P.mains = [pt(72 + h * 8, 94 - h * 12), pt(148 + h * 8, 94 + h * 12)];
        P.yeux = "joie";
        P.bouche = "grand";
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
      R.dos.setAttribute("transform", buste);
      animesBoutique.forEach(function (anime) { anime(t, P); });

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
        f.basket.setAttribute("display", P.chaussures && !f.chaussure ? "inline" : "none");
        if (f.chaussure) f.chaussure.setAttribute("display", P.chaussures ? "inline" : "none");
        f.chaussons.setAttribute("display", !P.chaussures && P.pyjama > 0.5 ? "inline" : "none");
        var socquettes = !P.chaussures && P.pyjama <= 0.5;
        f.chaussettes.setAttribute("display", socquettes && !f.rayures ? "inline" : "none");
        if (f.rayures) f.rayures.setAttribute("display", socquettes ? "inline" : "none");
        f.g.setAttribute("transform", "translate(0 " + P.leve[n].toFixed(1) + ")");
        f.scratch.setAttribute("transform", "rotate(" + (-f.sens * 65 * P.scratch[n]).toFixed(1) + " " + (f.fx - f.sens * 9) + " 239)");
      });

      // Vêtements
      R.hautPyjama.setAttribute("transform", "translate(0 " + P.hautPyjamaY.toFixed(1) + ")");
      voir(R.hautPyjama, P.objets.hautVole !== undefined ? 1 - P.objets.hautVole : clamp(P.pyjama, 0, 1));
      var glisse = "translate(0 " + P.robeY.toFixed(1) + ")";
      [R.robe, R.tenue, R.bas, R.haut].forEach(function (n) { n.setAttribute("transform", glisse); });
      voir(R.robe, R.robeDefaut ? P.robeO : 0);
      voir(R.tenue, R.tenuePortee ? P.robeO : 0);
      voir(R.bas, R.basPorte ? P.robeO : 0);
      voir(R.haut, R.hautPorte ? P.robeO : 0);
      voir(R.maillot, R.maillotVisible ? 1 : 0);
      var habillee = P.pyjama < 0.5;
      if (R.pantalonCouleur && habillee) voir(R.jambesPyjama, P.robeO);
      R.pantalon.forEach(function (j) { j.setAttribute("stroke", R.pantalonCouleur && habillee ? R.pantalonCouleur : tc); });

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
        R.bras[n].haut.setAttribute("stroke", P.pyjama < 0.5 ? R.manche : tc);
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
      R.talkie.setAttribute("display", O.talkie ? "inline" : "none");
      if (O.talkie) { place(R.talkie, O.talkie.x, O.talkie.y, O.talkie.r, .95); voir(R.ondes, O.talkie.ondes); }
      R.cartes.setAttribute("display", O.cartes ? "inline" : "none");
      if (O.cartes) place(R.cartes, O.cartes.x, O.cartes.y, O.cartes.r, .8);
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


  // =====================================================================
  // Sundae, le chat de la maison : tigré brun, « M » sur le front, grands yeux vert-jaune,
  // museau et menton blancs, nez rose. Dessiné de profil, tourné vers la gauche (comme l'emoji 🐈).
  // pose : "marche" (pattes animées) ou "dort" (en boule, yeux fermés). pelage : "tigre" ou "noir".
  // =====================================================================
  function chat(pose, pelage) {
    var noir = pelage === "noir";
    var C = noir
      ? { base: "#2B2A30", fonce: "#141418", clair: "#3A3940", blanc: "#3A3940", oeil: "#E8D14A", nez: "#6B4B55", oreille: "#5A4650" }
      : { base: "#806B55", fonce: "#30251B", clair: "#AE9679", blanc: "#F6F0E8", oeil: "#C9C64F", nez: "#D98E8A", oreille: "#E3AFA6" };
    var rayure = ' stroke="' + C.fonce + '" stroke-width="3.2" stroke-linecap="round" fill="none"';
    function tete(cx, cy, dort) {
      var h = '';
      h += '<path d="M' + (cx - 17) + ' ' + (cy - 8) + ' L' + (cx - 15) + ' ' + (cy - 29) + ' L' + (cx - 3) + ' ' + (cy - 17) + ' Z" fill="' + C.base + '"/>';
      h += '<path d="M' + (cx + 17) + ' ' + (cy - 8) + ' L' + (cx + 15) + ' ' + (cy - 29) + ' L' + (cx + 3) + ' ' + (cy - 17) + ' Z" fill="' + C.base + '"/>';
      h += '<path d="M' + (cx - 14) + ' ' + (cy - 12) + ' L' + (cx - 13) + ' ' + (cy - 24) + ' L' + (cx - 6) + ' ' + (cy - 17) + ' Z" fill="' + C.oreille + '"/>';
      h += '<path d="M' + (cx + 14) + ' ' + (cy - 12) + ' L' + (cx + 13) + ' ' + (cy - 24) + ' L' + (cx + 6) + ' ' + (cy - 17) + ' Z" fill="' + C.oreille + '"/>';
      h += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="20" ry="18" fill="' + C.base + '"/>';
      // le « M » du front et les rayures des joues
      h += '<path d="M' + (cx - 7) + ' ' + (cy - 9) + ' L' + (cx - 4) + ' ' + (cy - 16) + ' L' + cx + ' ' + (cy - 10) + ' L' + (cx + 4) + ' ' + (cy - 16) + ' L' + (cx + 7) + ' ' + (cy - 9) + '"' + rayure.replace("3.2", "2.2") + '/>';
      h += '<path d="M' + cx + ' ' + (cy - 17) + ' V' + (cy - 11) + '"' + rayure.replace("3.2", "2") + '/>';
      h += '<path d="M' + (cx - 19) + ' ' + (cy + 1) + ' h6 M' + (cx - 19) + ' ' + (cy + 5) + ' h5 M' + (cx + 19) + ' ' + (cy + 1) + ' h-6 M' + (cx + 19) + ' ' + (cy + 5) + ' h-5"' + rayure.replace("3.2", "1.8") + '/>';
      // museau et menton blancs
      h += '<ellipse cx="' + cx + '" cy="' + (cy + 9) + '" rx="9" ry="6.5" fill="' + C.blanc + '"/>';
      h += '<ellipse cx="' + cx + '" cy="' + (cy + 14) + '" rx="5.5" ry="3.5" fill="' + C.blanc + '"/>';
      if (dort) {
        h += '<path d="M' + (cx - 11) + ' ' + (cy - 1) + ' q4 4 8 0 M' + (cx + 3) + ' ' + (cy - 1) + ' q4 4 8 0" stroke="' + C.fonce + '" stroke-width="2" stroke-linecap="round" fill="none"/>';
      } else {
        [cx - 8, cx + 8].forEach(function (x) {
          h += '<ellipse cx="' + x + '" cy="' + (cy - 1) + '" rx="5.6" ry="6" fill="' + C.oeil + '" stroke="' + C.fonce + '" stroke-width="1"/>';
          h += '<ellipse cx="' + x + '" cy="' + (cy - 1) + '" rx="1.9" ry="4.6" fill="#15110D"/>';
          h += '<circle cx="' + (x + 1.8) + '" cy="' + (cy - 3.2) + '" r="1.3" fill="#FFFFFF"/>';
        });
      }
      h += '<path d="M' + (cx - 3) + ' ' + (cy + 6) + ' H' + (cx + 3) + ' L' + cx + ' ' + (cy + 9) + ' Z" fill="' + C.nez + '"/>';
      h += '<path d="M' + cx + ' ' + (cy + 9) + ' q-2.5 3 -5 1 M' + cx + ' ' + (cy + 9) + ' q2.5 3 5 1" stroke="' + C.fonce + '" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
      h += '<path d="M' + (cx - 7) + ' ' + (cy + 9) + ' l-13 -2 M' + (cx - 7) + ' ' + (cy + 11) + ' l-13 2 M' + (cx + 7) + ' ' + (cy + 9) + ' l13 -2 M' + (cx + 7) + ' ' + (cy + 11) + ' l13 2" stroke="#FFFFFF" stroke-width="0.9" opacity=".8"/>';
      return h;
    }
    function patte(x, y, classe) {
      return '<g class="' + classe + '"><rect x="' + x + '" y="' + y + '" width="9" height="24" rx="4.5" fill="' + C.base + '"/>' +
             '<path d="M' + (x + 1) + ' ' + (y + 8) + ' h7 M' + (x + 1) + ' ' + (y + 14) + ' h7"' + rayure.replace("3.2", "2") + '/>' +
             '<ellipse cx="' + (x + 4.5) + '" cy="' + (y + 23) + '" rx="5.5" ry="3" fill="' + C.clair + '"/></g>';
    }
    var h = '<svg class="chat-svg ' + pose + '" viewBox="0 0 124 100" aria-hidden="true">';
    if (pose === "dort") {
      h += '<path d="M104 80 Q120 62 104 52" stroke="' + C.base + '" stroke-width="10" stroke-linecap="round" fill="none"/>';
      h += '<ellipse cx="68" cy="72" rx="44" ry="21" fill="' + C.base + '"/>';
      h += '<path d="M60 54 q-4 9 0 18 M72 52 q-4 10 0 20 M84 54 q-4 9 0 18 M96 58 q-3 7 0 14"' + rayure + '/>';
      h += '<path d="M28 88 Q70 100 110 84" stroke="' + C.base + '" stroke-width="10" stroke-linecap="round" fill="none"/>';
      h += '<path d="M48 93 l0 -6 M64 95 l0 -6 M80 94 l0 -6 M96 90 l0 -6"' + rayure.replace("3.2", "2.4") + '/>';
      h += '<ellipse cx="40" cy="86" rx="9" ry="5" fill="' + C.clair + '"/>';
      h += tete(34, 66, true);
    } else {
      h += '<path d="M94 52 Q110 44 108 26 Q107 16 114 12" stroke="' + C.base + '" stroke-width="9" stroke-linecap="round" fill="none"/>';
      h += '<path d="M94 52 Q110 44 108 26 Q107 16 114 12" stroke="' + C.fonce + '" stroke-width="9" stroke-dasharray="4 6" fill="none"/>';
      h += patte(80, 60, "pb") + patte(40, 60, "pa");
      h += '<ellipse cx="66" cy="56" rx="32" ry="16" fill="' + C.base + '"/>';
      h += '<path d="M56 42 q-3 8 0 15 M67 41 q-3 9 0 17 M78 42 q-3 8 0 15 M88 46 q-2 6 0 11"' + rayure + '/>';
      h += patte(86, 62, "pa") + patte(46, 62, "pb");
      h += tete(36, 38, false);
    }
    return h + '</svg>';
  }

  return { creer: creer, creerParent: creerParent, chat: chat };
})();
