import SwiftUI
import UIKit
import Observation

enum Ecran: String {
    case dodo, attente, routine, fin, repos
}

struct PanneauNotes: Equatable {
    var cle: String
    var titre: String
    var valeurs: [String: Int]
}

struct Bravo {
    let id = UUID()
    var notes: [String: Int]
    var totaux: [String: Int]
    var bocal: EtatBocal?
    var avantBocal: Int
    var rempli: Bool
    var jusqua: Date
}

/// Essai accéléré : une heure simulée qui avance plus vite, sans rien enregistrer.
struct Demo {
    let debutSimule: Date
    let debutReel: Date
    let vitesse: Double
    let routineId: String
}

@MainActor
@Observable
final class Moteur {
    let donnees = Donnees()
    let calendrier = Calendrier()
    @ObservationIgnored let son = Son()
    @ObservationIgnored let voix = Voix()

    // Démarrage
    var parent: String?
    var demo: Demo?

    // Ce que l'écran affiche
    var ecran: Ecran = .repos
    var routine: Routine?
    var indexEtape = 0
    var reste: Double = 0
    var secondes: Double = 0
    var progressionRoute: Double = 0
    var horloge = ""
    var debutEtapeReel = Date()
    var annonceVisible = false
    var panneau: PanneauNotes?
    var bravo: Bravo?
    var raison: String?
    var decor = Decor(particules: [], fete: nil)
    var reglages = Reglages.defaut
    var totaux: [String: Int] = [:]
    var bocal: EtatBocal?
    var rappelsDuJour: [String] = []

    @ObservationIgnored private var cleEcran: String?
    @ObservationIgnored private var cleEtape: String?
    @ObservationIgnored private var annonceJusqua = Date.distantPast
    @ObservationIgnored private var alerteFaite = false
    @ObservationIgnored private var autoOuvert: Set<String> = []
    @ObservationIgnored private var notesVues: (jour: String, map: [String: String])?
    @ObservationIgnored private var cacheProgramme: (cle: String, programme: Programme)?
    @ObservationIgnored private var boucle: Task<Void, Never>?

    init() {
        boucle = Task { [weak self] in
            while !Task.isCancelled {
                self?.tick()
                try? await Task.sleep(for: .milliseconds(250))
            }
        }
    }

    // MARK: - Commandes

    func demarrer(_ quiEstLa: String) {
        parent = quiEstLa
        cleEcran = nil
        cleEtape = nil
        UIApplication.shared.isIdleTimerDisabled = true
        voix.parler("C'est parti !", delai: 0)
        tick()
    }

    func demarrerDemo() {
        let aujourdhui = Modeles.programme(donnees, date: Date(), calendrier: calendrier, forcer: false, seule: nil)
        guard let r = aujourdhui.routines.first ?? Modeles.routines(donnees).first else { return }
        let minuit = Calendar.current.startOfDay(for: Date())
        demo = Demo(debutSimule: minuit.addingTimeInterval(Double(r.debut) - 10),
                    debutReel: Date(), vitesse: 10, routineId: r.id)
        donnees.demo = true
        autoOuvert = []
        notesVues = nil
        demarrer("Papa")
    }

    func quitter() {
        let etaitDemo = demo != nil
        parent = nil
        demo = nil
        panneau = nil
        bravo = nil
        donnees.demo = false
        if etaitDemo { donnees.redemarrer() }   // on recharge les vraies données
        UIApplication.shared.isIdleTimerDisabled = false
    }

    /// Bouton Menu / retour de la télécommande
    func retour() {
        if bravo != nil { bravo = nil; return }
        if panneau != nil { panneau = nil; return }
        quitter()
    }

    func perso(_ texte: String) -> String {
        texte.replacingOccurrences(of: "{parent}", with: parent ?? "Papa")
    }

    func heure() -> Date {
        guard let demo else { return Date() }
        return demo.debutSimule.addingTimeInterval(Date().timeIntervalSince(demo.debutReel) * demo.vitesse)
    }

    // MARK: - Boucle

    private func programme(_ d: Date) -> Programme {
        let cle = "\(Temps.cleJour(d))|\(donnees.version)|\(calendrier.version)|\(Int(Date().timeIntervalSince1970 / 60))|\(demo?.routineId ?? "")"
        if let c = cacheProgramme, c.cle == cle { return c.programme }
        let p = Modeles.programme(donnees, date: d, calendrier: calendrier, forcer: demo != nil, seule: demo?.routineId)
        cacheProgramme = (cle, p)
        return p
    }

    func tick() {
        let d = heure()
        let s = Temps.secondes(d)
        let minutes = Calendar.current.component(.minute, from: d)
        horloge = "\(Calendar.current.component(.hour, from: d))h" + String(format: "%02d", minutes)
        guard parent != nil else { return }

        let jour = Temps.cleJour(d)
        secondes = s
        reglages = Reglages(donnees)
        decor = Modeles.decor(d, reglages)
        rappelsDuJour = Modeles.rappels(donnees, d)
        var t: [String: Int] = [:]
        for f in Config.filles { t[f.nom] = Modeles.total(donnees, f.nom) }
        totaux = t
        bocal = Modeles.bocal(donnees)

        // Quelle routine maintenant, laquelle vient de finir, laquelle arrive ?
        let p = programme(d)
        raison = p.raison
        var courante: Routine?
        var derniere: Routine?
        var prochaine: Routine?
        for r in p.routines {
            if Double(r.debut) <= s && s < Double(r.fin) {
                courante = r
            } else if s >= Double(r.fin) {
                if derniere == nil || r.fin > (derniere?.fin ?? 0) { derniere = r }
            } else if prochaine == nil || r.debut < (prochaine?.debut ?? Int.max) {
                prochaine = r
            }
        }
        var nouvel = Ecran.repos
        var cible: Routine?
        if let c = courante {
            nouvel = .routine
            cible = c
        } else if let pr = prochaine, Double(pr.debut) - s <= 3600 || derniere == nil {
            nouvel = pr.debut < 12 * 3600 ? .dodo : .attente
            cible = pr
        } else if let dr = derniere {
            nouvel = .fin
            cible = dr
        }

        let cle = "\(nouvel.rawValue)-\(cible?.id ?? "")"
        if cle != cleEcran {
            if nouvel == .fin, let c = cible, cleEcran == "routine-\(c.id)" {
                son.jouer("bus")
                voix.parler(perso(c.finVoix))
            }
            if nouvel != .routine { cleEtape = nil }
            cleEcran = cle
        }
        ecran = nouvel
        routine = cible
        if nouvel == .routine, let r = cible { majRoutine(r, s) }
        annonceVisible = nouvel == .routine && Date() < annonceJusqua

        // Écran des étoiles à l'heure prévue, une fois par routine
        if let r = cible, nouvel == .routine || nouvel == .fin, r.etoiles, let heureNotes = r.heureNotes,
           donnees.synchronise || demo != nil {
            let cleNote = Modeles.cleNote(jour, r.id)
            if s >= Double(heureNotes) && s < Double(r.fin + 3600) && !autoOuvert.contains(cleNote) {
                autoOuvert.insert(cleNote)
                if donnees.lire("notes/" + cleNote) == nil {
                    ouvrirNotes(r)
                    son.jouer("etoile")
                    voix.parler("\(parent ?? "Papa"), c'est l'heure des étoiles !", delai: 0.3)
                }
            }
        }

        verifierNotes(jour)
        if let b = bravo, Date() > b.jusqua { bravo = nil }
    }

    private func majRoutine(_ r: Routine, _ s: Double) {
        var i = 0
        for (k, e) in r.etapes.enumerated() where s >= Double(e.debut) { i = k }
        let e = r.etapes[i]
        indexEtape = i
        reste = max(0, Double(e.fin) - s)
        progressionRoute = (s - Double(r.debut)) / Double(max(1, r.fin - r.debut))
        let cle = "\(r.id)|\(e.heure)|\(e.titre)"
        if cle != cleEtape {
            cleEtape = cle
            debutEtapeReel = Date()
            alerteFaite = reste <= 60
            annoncer(r, i)
        }
        if !alerteFaite && reste <= 60 && e.fin - e.debut >= 180 {
            alerteFaite = true
            son.jouer("alerte")
            voix.parler(e.alerte.isEmpty ? "Plus qu'une minute !" : perso(e.alerte))
        }
    }

    private func annoncer(_ r: Routine, _ i: Int) {
        let e = r.etapes[i]
        annonceJusqua = Date().addingTimeInterval(5)
        son.jouer("etape")
        var phrase = perso(e.voix)
        if i == 0, let f = decor.fete {
            phrase = "Joyeux anniversaire \(f.nom) ! \(f.age) ans aujourd'hui ! " + phrase
        }
        if !e.rappels.isEmpty && !rappelsDuJour.isEmpty {
            phrase += " Aujourd'hui, n'oubliez pas : " + rappelsDuJour.map(Texte.sansEmoji).joined(separator: ", ") + "."
        }
        voix.parler(phrase)
    }

    // MARK: - Étoiles

    var texteFin: String {
        guard ecran == .routine, let r = routine else { return "" }
        return "\(r.finEmoji) \(r.finTitre) dans \(Int(ceil((Double(r.fin) - secondes) / 60))) min"
    }

    /// Bouton lecture/pause : ouvre les étoiles de la routine du moment
    func ouvrirNotes(_ r: Routine?) {
        var cible = r
        if cible == nil {
            if let actuelle = routine, actuelle.etoiles {
                cible = actuelle
            } else {
                cible = programme(heure()).routines.first { $0.etoiles }
            }
        }
        let id = cible?.id ?? "ecole"
        let cle = Modeles.cleNote(Temps.cleJour(heure()), id)
        let deja = (donnees.lire("notes/" + cle) as? [String: Any]) ?? [:]
        var valeurs: [String: Int] = [:]
        for f in Config.filles { valeurs[f.nom] = (deja[f.nom] as? Int) ?? 0 }
        let titre = (id == "ecole") ? "⭐ Les étoiles du matin" : "⭐ Les étoiles · \(cible?.nom ?? "")"
        bravo = nil
        panneau = PanneauNotes(cle: cle, titre: titre, valeurs: valeurs)
    }

    func noter(_ nom: String, _ n: Int) {
        panneau?.valeurs[nom] = n
        son.jouer("etoile")
    }

    func validerNotes() {
        guard let p = panneau else { return }
        var objet: [String: Any] = [:]
        for (k, v) in p.valeurs { objet[k] = v }
        panneau = nil
        donnees.ecrire("notes/" + p.cle, objet)
        verifierNotes(Temps.cleJour(heure()))
    }

    /// Repère une note nouvelle ou modifiée (ici ou depuis un téléphone) et lance le bravo
    private func verifierNotes(_ jour: String) {
        guard donnees.synchronise || demo != nil else { return }
        let toutes = (donnees.lire("notes") as? [String: Any]) ?? [:]
        var map: [String: String] = [:]
        for (k, v) in toutes where k.hasPrefix(jour) { map[k] = Texte.json(v) }
        guard let vues = notesVues, vues.jour == jour else {
            notesVues = (jour, map)
            return
        }
        var change: String?
        for (k, v) in map where vues.map[k] != v { change = k }
        notesVues = (jour, map)
        guard let k = change, let notes = toutes[k] as? [String: Any] else { return }
        let avant = vues.map[k].flatMap { Texte.depuisJson($0) as? [String: Any] } ?? [:]
        montrerBravo(notes, avant)
    }

    private func montrerBravo(_ notes: [String: Any], _ avant: [String: Any]) {
        func somme(_ d: [String: Any]) -> Int {
            Config.filles.reduce(0) { $0 + ((d[$1.nom] as? Int) ?? 0) }
        }
        let gagne = somme(notes) - somme(avant)
        var valeurs: [String: Int] = [:]
        var tot: [String: Int] = [:]
        for f in Config.filles {
            valeurs[f.nom] = (notes[f.nom] as? Int) ?? 0
            tot[f.nom] = Modeles.total(donnees, f.nom)
        }
        let etatBocal = Modeles.bocal(donnees)
        let avantBocal = max(0, (etatBocal?.progres ?? 0) - gagne)
        let rempli = etatBocal.map { avantBocal < $0.objectif && $0.pleine } ?? false
        panneau = nil
        bravo = Bravo(notes: valeurs, totaux: tot, bocal: etatBocal, avantBocal: avantBocal, rempli: rempli,
                      jusqua: Date().addingTimeInterval(rempli ? 14 : 10))
        son.jouer("fanfare")
        var phrase = Config.filles
            .filter { (valeurs[$0.nom] ?? 0) > 0 }
            .map { "Bravo \($0.nom), \(Texte.pluriel(valeurs[$0.nom] ?? 0, "étoile")) !" }
            .joined(separator: " ")
        if rempli, let b = etatBocal {
            phrase += " Et le bocal est plein ! \(Texte.sansEmoji(b.recompense)) !"
            Task { [weak self] in
                try? await Task.sleep(for: .seconds(3))
                self?.son.jouer("bocal")
            }
        }
        voix.parler(phrase, delai: 0.9)
    }
}
