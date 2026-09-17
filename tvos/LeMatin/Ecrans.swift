import SwiftUI

// MARK: - Pendant une routine

struct EcranRoutine: View {
    @Environment(Moteur.self) private var moteur
    let routine: Routine

    var body: some View {
        let i = min(moteur.indexEtape, routine.etapes.count - 1)
        let e = routine.etapes[i]
        let couleur = Color(hex: e.couleur)
        let duree = Double(max(1, e.fin - e.debut))
        let depuis = Date().timeIntervalSince(moteur.debutEtapeReel)
        // Temps forts : juste après l'annonce, puis la dernière minute
        let tempsFort = (depuis > 4.5 && depuis < 16) || moteur.reste <= 60
        let rappels = moteur.rappelsDuJour
        let puces = e.details + (e.rappels == "complet" ? rappels.map { "📌 " + $0 } : [])
        let nombreRestant = moteur.reste > 60 ? "\(Int(ceil(moteur.reste / 60)))" : "\(Int(ceil(moteur.reste)))"
        let uniteRestante = moteur.reste > 60 ? "min" : "secondes"

        VStack(spacing: 0) {
            BarreHaut(droite: moteur.texteFin.replacingOccurrences(of: " \(routine.finTitre)", with: ""))

            HStack(spacing: 90) {
                ZStack {
                    SceneEtape(type: Modeles.scene(pour: e), force: tempsFort ? 1 : 0.25)
                        .frame(width: 1000, height: 1000)
                    Anneau(fraction: moteur.reste / duree, couleur: couleur, urgent: moteur.reste <= 60)
                    Text(e.emoji).font(.system(size: 230))
                }
                .frame(width: 560, height: 560)

                VStack(alignment: .leading, spacing: 26) {
                    Text("Étape \(i + 1) sur \(routine.etapes.count)")
                        .font(.system(size: 38, weight: .medium, design: .rounded))
                        .opacity(0.7)
                    Text(moteur.perso(e.titre))
                        .font(.system(size: 104, weight: .bold, design: .rounded))
                        .lineLimit(2)
                        .minimumScaleFactor(0.6)
                    if !puces.isEmpty {
                        Flux(espacement: 18) {
                            ForEach(puces.indices, id: \.self) { k in
                                Text(puces[k])
                                    .font(.system(size: 40, weight: .semibold, design: .rounded))
                                    .padding(.horizontal, 24)
                                    .padding(.vertical, 10)
                                    .background(Capsule().fill(Color.white.opacity(0.12)))
                                    .overlay(Capsule().stroke(puces[k].hasPrefix("📌") ? Config.or : couleur, lineWidth: 5))
                            }
                        }
                    }
                    HStack(alignment: .firstTextBaseline, spacing: 16) {
                        Text("encore")
                        Text(nombreRestant)
                            .font(.system(size: 96, weight: .bold, design: .rounded))
                            .foregroundStyle(couleur)
                        Text(uniteRestante)
                    }
                    .font(.system(size: 56, weight: .medium, design: .rounded))
                    if e.rappels != "complet" && !rappels.isEmpty {
                        Text("📌 Aujourd'hui : " + rappels.joined(separator: " · "))
                            .font(.system(size: 36, weight: .semibold, design: .rounded))
                            .foregroundStyle(Config.or)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxHeight: .infinity)

            Route(routine: routine, index: i, progression: moteur.progressionRoute, mascotte: moteur.reglages.mascotte)
                .frame(height: 170)
        }
        .padding(.horizontal, 80)
        .padding(.vertical, 50)
    }
}

struct Anneau: View {
    let fraction: Double
    let couleur: Color
    let urgent: Bool

    var body: some View {
        TimelineView(.animation(minimumInterval: nil, paused: !urgent)) { tl in
            let battement = urgent ? 1 + 0.04 * sin(tl.date.timeIntervalSinceReferenceDate * 2 * .pi) : 1
            ZStack {
                Circle().fill(Color.white.opacity(0.06))
                Circle().stroke(Color.white.opacity(0.14), lineWidth: 36)
                Circle()
                    .trim(from: 0, to: max(0.001, min(1, fraction)))
                    .stroke(couleur, style: StrokeStyle(lineWidth: 36, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 0.25), value: fraction)
            }
            .scaleEffect(battement)
        }
    }
}

struct Route: View {
    let routine: Routine
    let index: Int
    let progression: Double
    let mascotte: String

    var body: some View {
        HStack(alignment: .bottom, spacing: 30) {
            GeometryReader { geo in
                let espace: CGFloat = 10
                let total = Double(max(1, routine.fin - routine.debut))
                let utile = geo.size.width - espace * CGFloat(routine.etapes.count - 1)
                ZStack(alignment: .bottomLeading) {
                    HStack(alignment: .bottom, spacing: espace) {
                        ForEach(routine.etapes.indices, id: \.self) { k in
                            let e = routine.etapes[k]
                            VStack(spacing: 8) {
                                ZStack(alignment: .topTrailing) {
                                    Text(e.emoji).font(.system(size: k == index ? 62 : 46))
                                    if k < index {
                                        Text("✓")
                                            .font(.system(size: 40, weight: .bold))
                                            .foregroundStyle(Config.vert)
                                            .offset(x: 24, y: -12)
                                    }
                                }
                                Capsule()
                                    .fill(Color(hex: e.couleur))
                                    .frame(height: 30)
                                    .shadow(color: k == index ? Color(hex: e.couleur) : .clear, radius: 16)
                            }
                            .frame(width: max(20, utile * CGFloat(Double(e.fin - e.debut) / total)))
                            .opacity(k < index ? 0.35 : 1)
                        }
                    }
                    Mascotte(emoji: mascotte, marche: true)
                        .font(.system(size: 72))
                        .position(x: geo.size.width * CGFloat(min(1, max(0, progression))), y: geo.size.height - 78)
                        .animation(.linear(duration: 0.25), value: progression)
                }
                .frame(width: geo.size.width, height: geo.size.height, alignment: .bottomLeading)
            }
            Text(routine.finEmoji).font(.system(size: 90))
        }
    }
}

// MARK: - Écrans calmes

struct EcranDodo: View {
    @Environment(Moteur.self) private var moteur

    var body: some View {
        let reste = Double(moteur.routine?.debut ?? 0) - moteur.secondes
        ZStack {
            CielEtoile()
            VStack(spacing: 18) {
                Text("🌙").font(.system(size: 240))
                Text(moteur.decor.fete.map { "🎂 Joyeux anniversaire \($0.nom) !" } ?? "Chut… tout le monde dort")
                    .font(.system(size: 92, weight: .bold, design: .rounded))
                Text(reste <= 3600 ? "Réveil dans \(Int(ceil(reste / 60))) min" : "Réveil à \(Temps.heure(moteur.routine?.debut ?? 0))")
                    .font(.system(size: 50, design: .rounded))
                    .opacity(0.8)
                if !moteur.reglages.mascotte.isEmpty {
                    SundaeDort(emoji: moteur.reglages.mascotte).padding(.top, 30)
                }
            }
            VStack {
                BarreHaut(compteurs: false)
                Spacer()
            }
            .padding(60)
        }
    }
}

struct EcranAttente: View {
    @Environment(Moteur.self) private var moteur

    var body: some View {
        let r = moteur.routine
        let reste = Double(r?.debut ?? 0) - moteur.secondes
        let minutes = Int(ceil(reste / 60))
        ZStack {
            VStack(spacing: 18) {
                Text(r?.emoji.isEmpty == false ? (r?.emoji ?? "⏳") : "⏳").font(.system(size: 240))
                Text(moteur.decor.fete.map { "🎂 Joyeux anniversaire \($0.nom) !" } ?? "\(r?.nom ?? "") à \(Temps.heure(r?.debut ?? 0))")
                    .font(.system(size: 92, weight: .bold, design: .rounded))
                Text(minutes >= 60 ? "dans \(minutes / 60) h \(String(format: "%02d", minutes % 60))" : "dans \(minutes) min")
                    .font(.system(size: 50, design: .rounded))
                    .opacity(0.8)
            }
            VStack {
                BarreHaut()
                Spacer()
            }
            .padding(60)
        }
    }
}

struct EcranFin: View {
    @Environment(Moteur.self) private var moteur

    var body: some View {
        let r = moteur.routine
        ZStack {
            VStack(spacing: 20) {
                TimelineView(.animation) { tl in
                    let p = Scenes.cycle(tl.date.timeIntervalSinceReferenceDate, periode: 7, phase: 0)
                    HStack(spacing: 10) {
                        Text(r?.finEmoji ?? "🏁")
                        if !moteur.reglages.mascotte.isEmpty {
                            Mascotte(emoji: moteur.reglages.mascotte, marche: true, miroir: false)
                        }
                    }
                    .font(.system(size: 200))
                    .scaleEffect(x: -1, y: 1)   // le véhicule et le chat regardent vers la droite
                    .offset(x: -1300 + p * 2600)
                }
                .frame(height: 260)
                Text(moteur.decor.fete.map { "🎂 Joyeux anniversaire \($0.nom) !" } ?? moteur.perso(r?.finMessage ?? "Bravo les filles !"))
                    .font(.system(size: 92, weight: .bold, design: .rounded))
                Text(moteur.perso(r?.finSous ?? ""))
                    .font(.system(size: 50, design: .rounded))
                    .opacity(0.8)
                LigneBocal()
            }
            VStack {
                BarreHaut()
                Spacer()
            }
            .padding(60)
        }
    }
}

struct EcranRepos: View {
    @Environment(Moteur.self) private var moteur

    var body: some View {
        ZStack {
            VStack(spacing: 20) {
                Text(moteur.decor.fete == nil ? "🎉" : "🎂").font(.system(size: 240))
                Text(moteur.decor.fete.map { "Joyeux anniversaire \($0.nom) !" } ?? "Pas d'école aujourd'hui")
                    .font(.system(size: 92, weight: .bold, design: .rounded))
                Text(moteur.raison ?? "Profitez bien !")
                    .font(.system(size: 50, design: .rounded))
                    .opacity(0.8)
                LigneBocal()
            }
            VStack {
                BarreHaut()
                Spacer()
            }
            .padding(60)
        }
    }
}

struct LigneBocal: View {
    @Environment(Moteur.self) private var moteur

    var body: some View {
        if let b = moteur.bocal {
            Text(b.pleine ? "🎉 Le bocal est plein : \(b.recompense)"
                 : "🫙 Encore \(Texte.pluriel(b.objectif - b.progres, "étoile")) pour \(b.recompense)")
                .font(.system(size: 42, weight: .semibold, design: .rounded))
                .foregroundStyle(Config.or)
                .padding(.top, 10)
        }
    }
}

// MARK: - Annonce d'une nouvelle étape

struct Annonce: View {
    let etape: Etape
    let titre: String
    @State private var visible = false

    var body: some View {
        ZStack {
            Config.nuit.opacity(0.93).ignoresSafeArea()
            VStack(spacing: 10) {
                Text(etape.emoji)
                    .font(.system(size: 340))
                    .scaleEffect(visible ? 1 : 0.2)
                    .rotationEffect(.degrees(visible ? 0 : -20))
                Text("C'est l'heure !")
                    .font(.system(size: 56, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color(hex: etape.couleur))
                Text(titre)
                    .font(.system(size: 116, weight: .bold, design: .rounded))
                    .multilineTextAlignment(.center)
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.5)) { visible = true }
        }
    }
}

// MARK: - Les étoiles

struct PanneauEtoiles: View {
    @Environment(Moteur.self) private var moteur
    let panneau: PanneauNotes
    var focus: FocusState<CibleFocus?>.Binding

    var body: some View {
        let complet = Config.filles.allSatisfy { (panneau.valeurs[$0.nom] ?? 0) > 0 }
        ZStack {
            Config.nuit.opacity(0.97).ignoresSafeArea()
            VStack(spacing: 26) {
                Text(panneau.titre)
                    .font(.system(size: 84, weight: .bold, design: .rounded))
                Text(moteur.texteFin)
                    .font(.system(size: 42, design: .rounded))
                    .opacity(0.75)
                ForEach(Config.filles) { f in
                    HStack(spacing: 40) {
                        Text(f.nom)
                            .font(.system(size: 86, weight: .bold, design: .rounded))
                            .foregroundStyle(f.couleur)
                            .frame(width: 300, alignment: .trailing)
                        HStack(spacing: 12) {
                            ForEach(1...3, id: \.self) { n in
                                Button { moteur.noter(f.nom, n) } label: {
                                    Text("★")
                                        .font(.system(size: 130))
                                        .foregroundStyle((panneau.valeurs[f.nom] ?? 0) >= n ? Config.or : Color.white.opacity(0.18))
                                }
                                .buttonStyle(StyleTele())
                                .focused(focus, equals: .etoile(f.nom, n))
                            }
                        }
                    }
                    .focusSection()
                }
                HStack(spacing: 50) {
                    Button { moteur.panneau = nil } label: {
                        Text("Plus tard").font(.system(size: 48, weight: .bold, design: .rounded))
                    }
                    .buttonStyle(StyleTele(fond: Color.white.opacity(0.12)))
                    .focused(focus, equals: .plusTard)
                    Button { moteur.validerNotes() } label: {
                        Text("Valider")
                            .font(.system(size: 48, weight: .bold, design: .rounded))
                            .foregroundStyle(complet ? Config.nuit : Color.white.opacity(0.4))
                    }
                    .buttonStyle(StyleTele(fond: complet ? Config.or : Color.white.opacity(0.08)))
                    .disabled(!complet)
                    .focused(focus, equals: .valider)
                }
                .focusSection()
                .padding(.top, 20)
                Text("Astuce : le bouton ⏯ de la télécommande rouvre cet écran.")
                    .font(.system(size: 28, design: .rounded))
                    .opacity(0.5)
            }
        }
    }
}

struct EcranBravo: View {
    @Environment(Moteur.self) private var moteur
    let bravo: Bravo

    var body: some View {
        ZStack {
            Config.nuit.opacity(0.97).ignoresSafeArea()
            Confettis()
            VStack(spacing: 30) {
                Text("Bravo les filles !")
                    .font(.system(size: 110, weight: .bold, design: .rounded))
                HStack(spacing: 140) {
                    VStack(spacing: 30) {
                        ForEach(Config.filles) { f in
                            VStack(spacing: 4) {
                                Text(f.nom)
                                    .font(.system(size: 78, weight: .bold, design: .rounded))
                                    .foregroundStyle(f.couleur)
                                Text(String(repeating: "★", count: bravo.notes[f.nom] ?? 0))
                                    .font(.system(size: 100))
                                    .foregroundStyle(Config.or)
                                Text("Total : \(bravo.totaux[f.nom] ?? 0) ⭐")
                                    .font(.system(size: 42, design: .rounded))
                                    .opacity(0.85)
                            }
                        }
                    }
                    if let b = bravo.bocal {
                        VueBocal(bocal: b, avant: bravo.avantBocal)
                    }
                }
            }
            if !moteur.reglages.mascotte.isEmpty {
                HStack {
                    Mascotte(emoji: moteur.reglages.mascotte, saute: true, miroir: false)
                    Spacer()
                    Mascotte(emoji: moteur.reglages.mascotte, saute: true)
                }
                .font(.system(size: 140))
                .padding(.horizontal, 100)
                .frame(maxHeight: .infinity, alignment: .bottom)
                .padding(.bottom, 60)
            }
        }
    }
}

struct VueBocal: View {
    let bocal: EtatBocal
    let avant: Int
    @State private var niveau: Double = 0

    var body: some View {
        let apres = min(1, Double(bocal.progres) / Double(max(1, bocal.objectif)))
        VStack(spacing: 14) {
            ZStack {
                FormeBocal().fill(Color.white.opacity(0.08))
                Rectangle()
                    .fill(Config.or)
                    .frame(height: 300 * niveau)
                    .frame(maxHeight: .infinity, alignment: .bottom)
                    .mask(FormeBocal())
                FormeBocal().stroke(Color.white.opacity(0.85), lineWidth: 8)
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color(hex: "#C8A26B"))
                    .frame(width: 126, height: 34)
                    .position(x: 120, y: 65)
                Text(bocal.pleine ? "🎉" : "⭐")
                    .font(.system(size: 70))
                    .offset(y: 40)
            }
            .frame(width: 240, height: 300)
            Text("\(min(bocal.progres, bocal.objectif)) / \(bocal.objectif)")
                .font(.system(size: 70, weight: .bold, design: .rounded))
                .foregroundStyle(Config.or)
            Text(bocal.pleine ? "Le bocal est plein !\n\(bocal.recompense)"
                 : "Encore \(Texte.pluriel(bocal.objectif - bocal.progres, "étoile"))\npour \(bocal.recompense)")
                .font(.system(size: 40, weight: .semibold, design: .rounded))
                .multilineTextAlignment(.center)
        }
        .task {
            niveau = min(1, Double(avant) / Double(max(1, bocal.objectif)))
            try? await Task.sleep(for: .milliseconds(700))
            withAnimation(.easeOut(duration: 1.6)) { niveau = apres }
        }
    }
}

struct FormeBocal: Shape {
    func path(in r: CGRect) -> Path {
        let sx = r.width / 100
        let sy = r.height / 124
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: r.minX + x * sx, y: r.minY + y * sy) }
        var chemin = Path()
        chemin.move(to: p(22, 34))
        chemin.addQuadCurve(to: p(12, 54), control: p(12, 40))
        chemin.addLine(to: p(12, 106))
        chemin.addQuadCurve(to: p(28, 120), control: p(12, 120))
        chemin.addLine(to: p(72, 120))
        chemin.addQuadCurve(to: p(88, 106), control: p(88, 120))
        chemin.addLine(to: p(88, 54))
        chemin.addQuadCurve(to: p(78, 34), control: p(88, 40))
        chemin.closeSubpath()
        return chemin
    }
}
