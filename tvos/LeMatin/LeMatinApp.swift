import SwiftUI

@main
struct LeMatinApp: App {
    @State private var moteur = Moteur()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(moteur)
                .preferredColorScheme(.dark)
        }
    }
}

enum CibleFocus: Hashable {
    case fond
    case etoile(String, Int)
    case valider
    case plusTard
}

struct ContentView: View {
    @Environment(Moteur.self) private var moteur
    @FocusState private var focus: CibleFocus?

    var body: some View {
        ZStack {
            Config.nuit.ignoresSafeArea()
            if moteur.parent == nil {
                Accueil()
            } else {
                principal
            }
        }
    }

    private var principal: some View {
        ZStack {
            // Fond « focusable » invisible : il reçoit les boutons Menu et Lecture de la télécommande
            Rectangle()
                .fill(Color.white.opacity(0.001))
                .ignoresSafeArea()
                .focusable(moteur.panneau == nil)
                .focused($focus, equals: .fond)
                .focusEffectDisabled()

            if moteur.ecran == .routine, let r = moteur.routine, moteur.indexEtape < r.etapes.count {
                Halo(couleur: Color(hex: r.etapes[moteur.indexEtape].couleur))
            }
            if moteur.ecran != .routine {
                PluieDecor(particules: moteur.decor.particules)
            } else if moteur.decor.fete != nil {
                PluieDecor(particules: moteur.decor.particules)
            }

            switch moteur.ecran {
            case .routine:
                if let r = moteur.routine { EcranRoutine(routine: r) }
            case .dodo:
                EcranDodo()
            case .attente:
                EcranAttente()
            case .fin:
                EcranFin()
            case .repos:
                EcranRepos()
            }

            if moteur.annonceVisible, let r = moteur.routine, moteur.indexEtape < r.etapes.count {
                let e = r.etapes[moteur.indexEtape]
                Annonce(etape: e, titre: moteur.perso(e.titre))
                    .id("\(r.id)-\(e.heure)")
            }
            if let p = moteur.panneau {
                PanneauEtoiles(panneau: p, focus: $focus)
            }
            if let b = moteur.bravo {
                EcranBravo(bravo: b).id(b.id)
            }
        }
        .onExitCommand { moteur.retour() }
        .onPlayPauseCommand { moteur.ouvrirNotes(nil) }
        .onChange(of: moteur.panneau != nil) { _, visible in
            focus = visible ? .etoile(Config.filles[0].nom, 3) : .fond
        }
        .onAppear { focus = .fond }
    }
}

// MARK: - Accueil

struct Accueil: View {
    @Environment(Moteur.self) private var moteur
    @State private var saisie = ""
    @FocusState private var focus: String?

    var body: some View {
        VStack(spacing: 40) {
            Text("☀️ Le matin de Lou et Alba")
                .font(.system(size: 96, weight: .bold, design: .rounded))
            if moteur.donnees.code == nil {
                Text("Pour commencer, colle ton code famille.")
                    .font(.system(size: 46, design: .rounded))
                Text("Espace parent › Réglages › Liens : copie le lien de l'écran du matin. Tu peux le coller en entier, l'app garde le code.")
                    .font(.system(size: 32, design: .rounded))
                    .opacity(0.7)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 1300)
                TextField("Code famille", text: $saisie)
                    .frame(width: 1100)
                    .focused($focus, equals: "code")
                    .onSubmit { valider() }
                Button("Valider") { valider() }
            } else {
                Text("Qui est là aujourd'hui ?")
                    .font(.system(size: 54, design: .rounded))
                    .opacity(0.85)
                HStack(spacing: 60) {
                    Button { moteur.demarrer("Papa") } label: {
                        Text("👨 Papa").font(.system(size: 70, weight: .bold, design: .rounded))
                            .padding(.horizontal, 50).padding(.vertical, 20)
                    }
                    .focused($focus, equals: "papa")
                    Button { moteur.demarrer("Maman") } label: {
                        Text("👩 Maman").font(.system(size: 70, weight: .bold, design: .rounded))
                            .padding(.horizontal, 50).padding(.vertical, 20)
                    }
                }
                Text(moteur.donnees.etatLisible)
                    .font(.system(size: 30, design: .rounded))
                    .opacity(0.6)
                HStack(spacing: 40) {
                    Button("▶︎ Essai accéléré ×10") { moteur.demarrerDemo() }
                    Button("Changer le code famille") { moteur.donnees.definirCode(nil) }
                }
                .font(.system(size: 30, design: .rounded))
                .padding(.top, 40)
            }
        }
        .defaultFocus($focus, moteur.donnees.code == nil ? "code" : "papa")
    }

    private func valider() {
        var c = saisie.trimmingCharacters(in: .whitespacesAndNewlines)
        if let r = c.range(of: "famille=") { c = String(c[r.upperBound...]) }
        c = c.filter { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-" || $0 == "_") }
        if c.count >= 24 {
            moteur.donnees.definirCode(c)
            saisie = ""
        }
    }
}

// MARK: - Éléments communs

struct Halo: View {
    let couleur: Color

    var body: some View {
        Circle()
            .fill(couleur)
            .frame(width: 1700, height: 1300)
            .blur(radius: 180)
            .opacity(0.28)
            .offset(x: -520, y: -380)
            .animation(.easeInOut(duration: 1.5), value: couleur)
            .allowsHitTesting(false)
    }
}

struct Compteurs: View {
    @Environment(Moteur.self) private var moteur

    var body: some View {
        HStack(spacing: 16) {
            ForEach(Config.filles) { f in
                pastille(texte: f.nom, valeur: "⭐ \(moteur.totaux[f.nom] ?? 0)", bord: f.couleur)
            }
            if let b = moteur.bocal {
                pastille(texte: b.pleine ? "🎉" : "🫙", valeur: "\(min(b.progres, b.objectif))/\(b.objectif)", bord: Config.or)
            }
        }
    }

    private func pastille(texte: String, valeur: String, bord: Color) -> some View {
        HStack(spacing: 10) {
            Text(texte)
            Text(valeur).foregroundStyle(Config.or)
        }
        .font(.system(size: 34, weight: .semibold, design: .rounded))
        .padding(.horizontal, 22)
        .padding(.vertical, 8)
        .background(Capsule().fill(Color.white.opacity(0.1)))
        .overlay(Capsule().stroke(bord, lineWidth: 5))
    }
}

struct BarreHaut: View {
    @Environment(Moteur.self) private var moteur
    var droite: String?
    var compteurs = true

    var body: some View {
        HStack {
            Text(moteur.horloge)
                .font(.system(size: 64, weight: .bold, design: .rounded))
                .frame(minWidth: 260, alignment: .leading)
            Spacer()
            if compteurs { Compteurs() }
            Spacer()
            if let droite {
                Text(droite)
                    .font(.system(size: 42, weight: .semibold, design: .rounded))
                    .padding(.horizontal, 30)
                    .padding(.vertical, 12)
                    .background(Capsule().fill(Color.white.opacity(0.12)))
            } else {
                Color.clear.frame(width: 260, height: 1)
            }
        }
    }
}

/// Mise en page qui passe à la ligne (pastilles)
struct Flux: Layout {
    var espacement: CGFloat = 16

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let largeurMax = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var hauteurLigne: CGFloat = 0
        var largeur: CGFloat = 0
        for vue in subviews {
            let t = vue.sizeThatFits(.unspecified)
            if x > 0 && x + t.width > largeurMax {
                y += hauteurLigne + espacement
                x = 0
                hauteurLigne = 0
            }
            x += t.width + espacement
            hauteurLigne = max(hauteurLigne, t.height)
            largeur = max(largeur, x - espacement)
        }
        return CGSize(width: largeur, height: y + hauteurLigne)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var hauteurLigne: CGFloat = 0
        for vue in subviews {
            let t = vue.sizeThatFits(.unspecified)
            if x > bounds.minX && x + t.width > bounds.maxX {
                y += hauteurLigne + espacement
                x = bounds.minX
                hauteurLigne = 0
            }
            vue.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(t))
            x += t.width + espacement
            hauteurLigne = max(hauteurLigne, t.height)
        }
    }
}

/// Style des boutons pilotés à la télécommande
struct StyleTele: ButtonStyle {
    var fond: Color = .clear

    func makeBody(configuration: Configuration) -> some View {
        Contenu(configuration: configuration, fond: fond)
    }

    struct Contenu: View {
        let configuration: ButtonStyleConfiguration
        let fond: Color
        @Environment(\.isFocused) private var focus

        var body: some View {
            configuration.label
                .padding(.horizontal, 26)
                .padding(.vertical, 10)
                .background(Capsule().fill(focus ? Color.white.opacity(0.28) : fond))
                .scaleEffect(focus ? 1.15 : (configuration.isPressed ? 0.95 : 1))
                .animation(.easeOut(duration: 0.15), value: focus)
        }
    }
}
