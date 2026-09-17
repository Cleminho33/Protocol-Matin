import SwiftUI

/// Les petites scènes animées autour de l'anneau, une par moment de la routine.
/// Même nom que dans l'éditeur de l'espace parent (champ « Animation »).
enum TypeScene: String {
    case reveil, repas, habits, dents, coiffure, rangement, chaussures, jeu, bain, pyjama, histoire, etoiles
}

struct SceneEtape: View {
    let type: TypeScene
    /// 1 = temps fort (début d'étape, dernière minute), 0.25 = discret
    let force: Double

    var body: some View {
        TimelineView(.animation) { tl in
            Canvas { ctx, taille in
                Scenes.dessiner(type, &ctx, taille, tl.date.timeIntervalSinceReferenceDate, force)
            }
        }
        .allowsHitTesting(false)
    }
}

enum Scenes {

    // MARK: - Outils

    /// Nombre pseudo-aléatoire stable entre 0 et 1
    static func alea(_ i: Int, _ k: Int) -> Double {
        let x = sin(Double(i * 127 + k * 311) * 12.9898) * 43758.5453
        return x - floor(x)
    }

    /// Avancement 0…1 d'un cycle qui se répète
    static func cycle(_ t: Double, periode: Double, phase: Double) -> Double {
        let v = t / periode + phase
        return v - floor(v)
    }

    /// Apparition puis disparition en douceur sur un cycle
    static func fondu(_ p: Double) -> Double {
        max(0, min(1, p / 0.12) * min(1, (1 - p) / 0.2))
    }

    static func nombre(_ maxi: Int, _ force: Double) -> Int {
        max(1, Int((Double(maxi) * force).rounded()))
    }

    static func emoji(_ ctx: inout GraphicsContext, _ e: String, _ p: CGPoint, _ taille: Double,
                      opacite: Double = 1, rotation: Double = 0, echelle: Double = 1) {
        guard opacite > 0.01 else { return }
        var g = ctx
        g.opacity = opacite
        g.translateBy(x: p.x, y: p.y)
        if rotation != 0 { g.rotate(by: .degrees(rotation)) }
        if echelle != 1 { g.scaleBy(x: echelle, y: echelle) }
        g.draw(Text(e).font(.system(size: taille)), at: .zero)
    }

    static func point(_ c: CGPoint, _ dx: Double, _ dy: Double) -> CGPoint {
        CGPoint(x: Double(c.x) + dx, y: Double(c.y) + dy)
    }

    // MARK: - Aiguillage

    static func dessiner(_ type: TypeScene, _ ctx: inout GraphicsContext, _ taille: CGSize, _ t: Double, _ f: Double) {
        let c = CGPoint(x: taille.width / 2, y: taille.height / 2)
        let r = Double(min(taille.width, taille.height)) * 0.28   // rayon de l'anneau
        switch type {
        case .reveil: reveil(&ctx, c, r, t, f)
        case .repas: repas(&ctx, c, r, t, f)
        case .habits: habits(&ctx, c, r, t, f)
        case .dents:
            bulles(&ctx, c, r, t, f, maxi: 16, teinte: Color(hex: "#9BE7FF"))
            etincelles(&ctx, c, r, t, f, maxi: 5)
        case .coiffure: coiffure(&ctx, c, r, t, f)
        case .rangement: rangement(&ctx, c, r, t, f)
        case .chaussures: chaussures(&ctx, c, r, t, f)
        case .jeu: ballons(&ctx, c, r, t, f)
        case .bain:
            bulles(&ctx, c, r, t, f, maxi: 18, teinte: Color(hex: "#FFFFFF"))
            canard(&ctx, c, r, t, f)
        case .pyjama: nuit(&ctx, c, r, t, f)
        case .histoire: histoire(&ctx, c, r, t, f)
        case .etoiles: etincelles(&ctx, c, r, t, f, maxi: 16)
        }
    }

    // MARK: - Réveil : rayons de soleil et petits cœurs (câlins)

    static func reveil(_ ctx: inout GraphicsContext, _ c: CGPoint, _ r: Double, _ t: Double, _ f: Double) {
        var g = ctx
        g.opacity = 0.25 + 0.55 * f
        let rayons = 14
        for i in 0..<rayons {
            let a = (t * 12 + Double(i) * 360 / Double(rayons)) * .pi / 180
            let longueur = r * (0.22 + 0.12 * sin(t * 2.5 + Double(i)))
            var p = Path()
            p.move(to: point(c, cos(a) * r * 1.14, sin(a) * r * 1.14))
            p.addLine(to: point(c, cos(a) * (r * 1.14 + longueur), sin(a) * (r * 1.14 + longueur)))
            g.stroke(p, with: .color(Config.or), style: StrokeStyle(lineWidth: 14, lineCap: .round))
        }
        let coeurs = ["💛", "❤️", "🧡"]
        for i in 0..<nombre(7, f) {
            let p = cycle(t, periode: 3.5, phase: alea(i, 1))
            let x = (alea(i, 2) - 0.5) * r * 1.4 + sin(p * 6 + Double(i)) * 25
            emoji(&ctx, coeurs[i % coeurs.count], point(c, x, -p * r * 1.8), 46 + p * 22, opacite: fondu(p))
        }
    }

    // MARK: - Repas : vapeur du bol et aliments qui sautent

    static func repas(_ ctx: inout GraphicsContext, _ c: CGPoint, _ r: Double, _ t: Double, _ f: Double) {
        for i in 0..<nombre(9, f) {
            let p = cycle(t, periode: 3.4, phase: alea(i, 1))
            let x = Double(c.x) + (alea(i, 2) - 0.5) * r * 0.7 + sin(p * 6 + Double(i)) * 22
            let y = Double(c.y) - r * 0.25 - p * r * 1.5
            let s = 40 + p * 90
            ctx.fill(Path(ellipseIn: CGRect(x: x - s / 2, y: y - s / 2, width: s, height: s * 0.8)),
                     with: .color(.white.opacity(fondu(p) * 0.28)))
        }
        let aliments = ["🥐", "🍓", "🥛", "🍞", "🍌", "🧃"]
        for i in 0..<nombre(5, f) {
            let p = cycle(t, periode: 4.2, phase: alea(i, 3))
            let sens = alea(i, 4) < 0.5 ? -1.0 : 1.0
            let portee = r * (0.9 + alea(i, 5) * 0.7)
            let dx = sens * p * portee
            let dy = -r * 0.15 - 3.6 * r * p * (1 - p) + p * r * 0.6
            emoji(&ctx, aliments[i % aliments.count], point(c, dx, dy), 64,
                  opacite: fondu(p), rotation: sens * p * 300)
        }
    }

    // MARK: - Habillage : les vêtements volent vers le centre

    static func habits(_ ctx: inout GraphicsContext, _ c: CGPoint, _ r: Double, _ t: Double, _ f: Double) {
        let vetements = ["👕", "👗", "🧦", "👖", "🧢", "🧥"]
        for i in 0..<nombre(6, f) {
            let p = cycle(t, periode: 3.6, phase: alea(i, 1))
            let a = alea(i, 2) * 2 * .pi
            let depart = point(c, cos(a) * r * 1.9, sin(a) * r * 1.9)
            let e = p * p * (3 - 2 * p)
            let courbe = sin(p * .pi) * r * 0.5
            let x = Double(depart.x) + (Double(c.x) - Double(depart.x)) * e - sin(a) * courbe
            let y = Double(depart.y) + (Double(c.y) - Double(depart.y)) * e + cos(a) * courbe
            let o = min(1, p / 0.1) * (p > 0.8 ? (1 - p) / 0.2 : 1)
            emoji(&ctx, vetements[i % vetements.count], CGPoint(x: x, y: y), 76,
                  opacite: o, rotation: (1 - p) * 360, echelle: 1 - p * 0.6)
        }
    }

    // MARK: - Dents et bain : bulles

    static func bulles(_ ctx: inout GraphicsContext, _ c: CGPoint, _ r: Double, _ t: Double, _ f: Double,
                       maxi: Int, teinte: Color) {
        for i in 0..<nombre(maxi, f) {
            let p = cycle(t, periode: 3 + alea(i, 1) * 2, phase: alea(i, 2))
            let x = Double(c.x) + (alea(i, 3) - 0.5) * r * 2.6 + sin(p * 8 + Double(i)) * 18
            let y = Double(c.y) + r * 1.2 - p * r * 3
            let s = 24 + alea(i, 4) * 40 + p * 20
            let o = fondu(p)
            let rect = CGRect(x: x - s / 2, y: y - s / 2, width: s, height: s)
            ctx.fill(Path(ellipseIn: rect), with: .color(teinte.opacity(0.18 * o)))
            ctx.stroke(Path(ellipseIn: rect), with: .color(.white.opacity(0.75 * o)), lineWidth: 3)
            let reflet = CGRect(x: x - s * 0.25, y: y - s * 0.3, width: s * 0.2, height: s * 0.14)
            ctx.fill(Path(ellipseIn: reflet), with: .color(.white.opacity(0.8 * o)))
        }
    }

    static func canard(_ ctx: inout GraphicsContext, _ c: CGPoint, _ r: Double, _ t: Double, _ f: Double) {
        let x = sin(t * 0.6) * r * 1.2
        let y = r * 1.25 + sin(t * 2.2) * 10
        emoji(&ctx, "🦆", point(c, x, y), 80, opacite: 0.5 + 0.5 * f, rotation: sin(t * 2.2) * 8)
    }

    // MARK: - Coiffure : rubans en orbite et paillettes

    static func coiffure(_ ctx: inout GraphicsContext, _ c: CGPoint, _ r: Double, _ t: Double, _ f: Double) {
        for i in 0..<3 {
            let a = (t * 35 + Double(i) * 120) * .pi / 180
            emoji(&ctx, "🎀", point(c, cos(a) * r * 1.2, sin(a) * r * 1.2), 60,
                  opacite: 0.45 + 0.55 * f, rotation: sin(t * 2 + Double(i)) * 15)
        }
        etincelles(&ctx, c, r, t, f, maxi: 14)
    }

    static func etincelles(_ ctx: inout GraphicsContext, _ c: CGPoint, _ r: Double, _ t: Double, _ f: Double, maxi: Int) {
        for i in 0..<nombre(maxi, f) {
            let periode = 1.8 + alea(i, 1)
            let p = cycle(t, periode: periode, phase: alea(i, 2))
            let tour = floor(t / periode + alea(i, 2))
            let a = alea(i, 3) * 2 * .pi + tour * 1.3
            let d = r * (1.05 + alea(i, 4) * 0.6)
            let o = sin(p * .pi)
            emoji(&ctx, "✨", point(c, cos(a) * d, sin(a) * d), 34 + alea(i, 5) * 24,
                  opacite: o, echelle: 0.6 + 0.4 * o)
        }
    }

    // MARK: - Rangement : les jouets tombent dans le panier

    static func rangement(_ ctx: inout GraphicsContext, _ c: CGPoint, _ r: Double, _ t: Double, _ f: Double) {
        let jouets = ["🧸", "🧦", "🥣", "🚗", "🧩", "📚", "💡"]
        for i in 0..<nombre(6, f) {
            let p = cycle(t, periode: 2.8, phase: alea(i, 1))
            let x0 = (alea(i, 2) - 0.5) * r * 1.6
            let haut = -r * 1.7
            let bas = r * 0.25
            var dx = 0.0
            var dy = 0.0
            if p < 0.7 {
                let q = p / 0.7
                dy = haut + (bas - haut) * q * q
                dx = x0 * (1 - q)
            } else {
                let q = (p - 0.7) / 0.3
                dy = bas - sin(q * .pi) * 30
            }
            let o = min(1, p / 0.08) * (p > 0.85 ? (1 - p) / 0.15 : 1)
            emoji(&ctx, jouets[i % jouets.count], point(c, dx, dy), 64,
                  opacite: o, rotation: p < 0.7 ? p * 200 : 0, echelle: p > 0.7 ? 0.8 : 1)
        }
    }

    // MARK: - Chaussures : des traces de pas qui partent vers la porte

    static func chaussures(_ ctx: inout GraphicsContext, _ c: CGPoint, _ r: Double, _ t: Double, _ f: Double) {
        let pas = 12
        let periode = 5.0
        let q = cycle(t, periode: periode, phase: 0)
        for i in 0..<pas {
            let apparition = Double(i) / Double(pas) * 0.8
            guard q >= apparition else { continue }
            let age = (q - apparition) * periode
            let o = max(0, 1 - age / 2.5) * (0.4 + 0.6 * f)
            let dx = -r * 1.6 + Double(i) * (r * 3.2 / Double(pas - 1))
            let dy = r * 1.15 + (i % 2 == 0 ? -22.0 : 22.0)
            emoji(&ctx, "👣", point(c, dx, dy), 50, opacite: o, rotation: 90)
        }
        for i in 0..<2 {
            let rebond = abs(sin(t * 4 + Double(i) * 1.6)) * 40 * f
            let dx = (i == 0 ? -1.0 : 1.0) * r * 1.25
            emoji(&ctx, "👟", point(c, dx, -r * 0.9 - rebond), 70, opacite: 0.4 + 0.6 * f)
        }
    }

    // MARK: - Temps libre : ballons

    static func ballons(_ ctx: inout GraphicsContext, _ c: CGPoint, _ r: Double, _ t: Double, _ f: Double) {
        let couleurs = ["#FF6B9D", "#54A0FF", "#FFD93D", "#10AC84", "#A55EEA", "#FF9F43"].map { Color(hex: $0) }
        for i in 0..<nombre(9, f) {
            let p = cycle(t, periode: 5 + alea(i, 1) * 2, phase: alea(i, 2))
            let x = Double(c.x) + (alea(i, 3) - 0.5) * r * 3.2 + sin(p * 5 + Double(i)) * 30
            let y = Double(c.y) + r * 1.6 - p * r * 3.6
            let largeur = 58.0
            let hauteur = 70.0
            var g = ctx
            g.opacity = fondu(p)
            var fil = Path()
            fil.move(to: CGPoint(x: x, y: y + hauteur / 2))
            fil.addQuadCurve(to: CGPoint(x: x + sin(t * 3 + Double(i)) * 10, y: y + hauteur / 2 + 70),
                             control: CGPoint(x: x - 14, y: y + hauteur / 2 + 35))
            g.stroke(fil, with: .color(.white.opacity(0.6)), lineWidth: 2)
            g.fill(Path(ellipseIn: CGRect(x: x - largeur / 2, y: y - hauteur / 2, width: largeur, height: hauteur)),
                   with: .color(couleurs[i % couleurs.count]))
            g.fill(Path(ellipseIn: CGRect(x: x - largeur * 0.25, y: y - hauteur * 0.3, width: largeur * 0.22, height: hauteur * 0.18)),
                   with: .color(.white.opacity(0.5)))
        }
    }

    // MARK: - Pyjama : lune et étoiles

    static func nuit(_ ctx: inout GraphicsContext, _ c: CGPoint, _ r: Double, _ t: Double, _ f: Double) {
        let a = t * 0.35
        emoji(&ctx, "🌙", point(c, cos(a) * r * 1.3, sin(a) * r * 1.3), 80, opacite: 0.5 + 0.5 * f)
        for i in 0..<nombre(14, f) {
            let p = cycle(t, periode: 2.4 + alea(i, 1), phase: alea(i, 2))
            let angle = alea(i, 3) * 2 * .pi
            let d = r * (1.1 + alea(i, 4) * 0.6)
            emoji(&ctx, "⭐", point(c, cos(angle) * d, sin(angle) * d), 28 + alea(i, 5) * 20,
                  opacite: sin(p * .pi) * 0.9)
        }
    }

    // MARK: - Histoire : la magie sort du livre

    static func histoire(_ ctx: inout GraphicsContext, _ c: CGPoint, _ r: Double, _ t: Double, _ f: Double) {
        let magie = ["✨", "🐉", "🧚", "🏰", "⭐", "🦄"]
        for i in 0..<nombre(7, f) {
            let p = cycle(t, periode: 4, phase: alea(i, 1))
            let angle = (-90 + (alea(i, 2) - 0.5) * 120) * .pi / 180
            let d = r * 0.2 + p * r * 1.6
            emoji(&ctx, magie[i % magie.count], point(c, cos(angle) * d, sin(angle) * d), 40 + p * 34,
                  opacite: fondu(p), rotation: sin(p * 6) * 15)
        }
    }
}

// MARK: - Fond des écrans calmes et fêtes

struct PluieDecor: View {
    let particules: [String]

    var body: some View {
        if particules.isEmpty {
            Color.clear
        } else {
            TimelineView(.animation) { tl in
                Canvas { ctx, taille in
                    let t = tl.date.timeIntervalSinceReferenceDate
                    for i in 0..<16 {
                        let p = Scenes.cycle(t, periode: 12 + Scenes.alea(i, 1) * 9, phase: Scenes.alea(i, 2))
                        let x = Scenes.alea(i, 3) * Double(taille.width) + sin(p * 6 + Double(i)) * 50
                        let y = -60 + p * (Double(taille.height) + 120)
                        Scenes.emoji(&ctx, particules[i % particules.count], CGPoint(x: x, y: y),
                                     36 + Scenes.alea(i, 4) * 36,
                                     opacite: 0.35 + Scenes.alea(i, 5) * 0.3, rotation: p * 300)
                    }
                }
            }
            .allowsHitTesting(false)
            .ignoresSafeArea()
        }
    }
}

struct CielEtoile: View {
    var body: some View {
        TimelineView(.animation) { tl in
            Canvas { ctx, taille in
                let t = tl.date.timeIntervalSinceReferenceDate
                for i in 0..<50 {
                    let x = Scenes.alea(i, 1) * Double(taille.width)
                    let y = Scenes.alea(i, 2) * Double(taille.height)
                    let o = 0.2 + 0.8 * (0.5 + 0.5 * sin(t * (0.8 + Scenes.alea(i, 3)) + Double(i)))
                    let s = 3 + Scenes.alea(i, 4) * 4
                    ctx.fill(Path(ellipseIn: CGRect(x: x, y: y, width: s, height: s)), with: .color(.white.opacity(o)))
                }
            }
        }
        .allowsHitTesting(false)
        .ignoresSafeArea()
    }
}

struct Confettis: View {
    var body: some View {
        TimelineView(.animation) { tl in
            Canvas { ctx, taille in
                let t = tl.date.timeIntervalSinceReferenceDate
                let couleurs = ["#FF6B9D", "#54A0FF", "#FFD93D", "#10AC84", "#A55EEA", "#FF9F43"].map { Color(hex: $0) }
                for i in 0..<70 {
                    let p = Scenes.cycle(t, periode: 4 + Scenes.alea(i, 1) * 3, phase: Scenes.alea(i, 2))
                    let x = Scenes.alea(i, 3) * Double(taille.width) + sin(p * 9 + Double(i)) * 30
                    let y = -40 + p * (Double(taille.height) + 80)
                    var g = ctx
                    g.translateBy(x: x, y: y)
                    g.rotate(by: .degrees(p * 720 * (Scenes.alea(i, 4) < 0.5 ? -1 : 1)))
                    g.fill(Path(CGRect(x: -9, y: -5, width: 18, height: 10)), with: .color(couleurs[i % couleurs.count]))
                }
            }
        }
        .allowsHitTesting(false)
        .ignoresSafeArea()
    }
}

/// Sundae (ou les filles). Le chat regarde vers la droite, dans le sens de la route.
struct Mascotte: View {
    let emoji: String
    var marche = false
    var saute = false
    var miroir = true

    var body: some View {
        let texte = emoji.isEmpty ? "👧👧" : emoji
        TimelineView(.animation) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            let dy = marche ? -abs(sin(t * 7.5)) * 12 : (saute ? -abs(sin(t * 3.5)) * 120 : 0)
            let rotation = marche ? sin(t * 7.5) * 4 : 0
            Text(texte)
                .scaleEffect(x: (miroir && !emoji.isEmpty) ? -1 : 1, y: 1)
                .rotationEffect(.degrees(rotation))
                .offset(y: dy)
        }
    }
}

struct SundaeDort: View {
    let emoji: String

    var body: some View {
        TimelineView(.animation) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            let q = Scenes.cycle(t, periode: 3, phase: 0)
            let souffle = 0.5 + 0.5 * sin(t * 2.1)
            ZStack(alignment: .topTrailing) {
                Text(emoji)
                    .font(.system(size: 130))
                    .scaleEffect(x: -(1 + 0.03 * souffle), y: 1 - 0.06 * souffle, anchor: .bottom)
                Text("💤")
                    .font(.system(size: 54))
                    .offset(x: 30 + q * 40, y: -20 - q * 80)
                    .opacity(sin(q * .pi))
            }
        }
    }
}
