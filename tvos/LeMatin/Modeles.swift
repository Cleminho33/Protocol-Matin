import Foundation

struct Etape {
    var debut: Int          // secondes depuis minuit
    var fin: Int
    var heure: String       // "07:25"
    var titre: String
    var emoji: String
    var couleur: String
    var voix: String
    var alerte: String
    var rappels: String     // "", "voix" ou "complet"
    var details: [String]
    var scene: String
}

struct Routine {
    var id: String
    var nom: String
    var emoji: String
    var jours: Set<Int>
    var ecole: Bool
    var debut: Int
    var fin: Int
    var finEmoji: String
    var finTitre: String
    var finVoix: String
    var finMessage: String
    var finSous: String
    var etoiles: Bool
    var heureNotes: Int?
    var etapes: [Etape]
}

struct Programme {
    var routines: [Routine]
    var raison: String?
}

struct Fete {
    let nom: String
    let age: Int
}

struct Decor {
    var particules: [String]
    var fete: Fete?
}

struct Reglages {
    var mascotte: String
    var decor: Bool
    var anniversaires: [String: String]

    static let defaut = Reglages(mascotte: "🐈", decor: true, anniversaires: [:])

    init(mascotte: String, decor: Bool, anniversaires: [String: String]) {
        self.mascotte = mascotte
        self.decor = decor
        self.anniversaires = anniversaires
    }

    @MainActor
    init(_ d: Donnees) {
        let r = (d.lire("reglages") as? [String: Any]) ?? [:]
        mascotte = r["mascotte"] == nil ? "🐈" : ((r["mascotte"] as? String) ?? "🐈")
        decor = (r["decor"] as? Bool) ?? true
        anniversaires = (r["anniversaires"] as? [String: String]) ?? [:]
    }
}

struct EtatBocal {
    var objectif: Int
    var recompense: String
    var progres: Int
    var pleine: Bool
}

@MainActor
enum Modeles {

    // MARK: - Lecture des données brutes

    static func liste(_ x: Any?) -> [Any] {
        if let a = x as? [Any] { return a.filter { !($0 is NSNull) } }
        if let d = x as? [String: Any] {
            return d.keys.sorted { (Int($0) ?? 0) < (Int($1) ?? 0) }.compactMap { d[$0] }
        }
        return []
    }

    static func texte(_ d: [String: Any], _ k: String) -> String {
        (d[k] as? String) ?? ""
    }

    static func booleen(_ d: [String: Any], _ k: String) -> Bool {
        (d[k] as? Bool) ?? false
    }

    /// Jours cochés, que Firebase les renvoie en objet {"1": true} ou en tableau [null, true]
    static func joursExplicites(_ x: Any?) -> [Int: Bool] {
        var out: [Int: Bool] = [:]
        if let a = x as? [Any] {
            for (i, v) in a.enumerated() { if let b = v as? Bool { out[i] = b } }
        }
        if let d = x as? [String: Any] {
            for (k, v) in d { if let i = Int(k), let b = v as? Bool { out[i] = b } }
        }
        return out
    }

    static func routine(id: String, brut: Any?) -> Routine? {
        guard let d = brut as? [String: Any], !booleen(d, "supprimee"),
              let fin = Temps.secondes(depuis: d["fin"] as? String) else { return nil }
        var brutes: [(Int, [String: Any])] = []
        for e in liste(d["etapes"]) {
            if let ed = e as? [String: Any], let s = Temps.secondes(depuis: ed["debut"] as? String) {
                brutes.append((s, ed))
            }
        }
        brutes.sort { $0.0 < $1.0 }
        guard !brutes.isEmpty else { return nil }
        var etapes: [Etape] = []
        for i in brutes.indices {
            let (s, ed) = brutes[i]
            let f = i + 1 < brutes.count ? brutes[i + 1].0 : fin
            etapes.append(Etape(
                debut: s, fin: f, heure: texte(ed, "debut"),
                titre: texte(ed, "titre"), emoji: texte(ed, "emoji"),
                couleur: (ed["couleur"] as? String) ?? "#FF9F43",
                voix: texte(ed, "voix"), alerte: texte(ed, "alerte"), rappels: texte(ed, "rappels"),
                details: liste(ed["details"]).compactMap { $0 as? String },
                scene: texte(ed, "scene")
            ))
        }
        var jours = Set<Int>()
        for (i, b) in joursExplicites(d["jours"]) where b { jours.insert(i) }
        return Routine(
            id: id, nom: texte(d, "nom"), emoji: texte(d, "emoji"), jours: jours,
            ecole: booleen(d, "ecole"), debut: etapes[0].debut, fin: fin,
            finEmoji: (d["finEmoji"] as? String) ?? "🏁", finTitre: (d["finTitre"] as? String) ?? "Fin",
            finVoix: texte(d, "finVoix"), finMessage: texte(d, "finMessage"), finSous: texte(d, "finSous"),
            etoiles: booleen(d, "etoiles"), heureNotes: Temps.secondes(depuis: d["heureNotes"] as? String),
            etapes: etapes
        )
    }

    // MARK: - Routines

    /// La routine École d'origine reste présente tant qu'elle n'a pas été enregistrée ou supprimée.
    static func routines(_ d: Donnees) -> [Routine] {
        let enregistrees = (d.lire("routines") as? [String: Any]) ?? [:]
        var out: [Routine] = []
        if enregistrees["ecole"] == nil, var r = routine(id: "ecole", brut: Defauts.ecole) {
            // réglages de l'ancienne version de l'espace parent
            if let ancien = d.lire("reglages") as? [String: Any] {
                for (i, b) in joursExplicites(ancien["joursEcole"]) {
                    if b { r.jours.insert(i) } else { r.jours.remove(i) }
                }
                if (ancien["vacances"] as? Bool) == false { r.ecole = false }
            }
            out.append(r)
        }
        for (id, brut) in enregistrees {
            if let r = routine(id: id, brut: brut) { out.append(r) }
        }
        return out.sorted { $0.debut < $1.debut }
    }

    static func programme(_ d: Donnees, date: Date, calendrier: Calendrier, forcer: Bool, seule: String?) -> Programme {
        let raisonVacances = forcer ? nil : calendrier.raison(date)
        let jour = Temps.jourSemaine(date)
        var out = Programme(routines: [], raison: nil)
        for r in routines(d) {
            if let seule, r.id != seule { continue }
            if !forcer && !r.jours.contains(jour) { continue }
            if r.ecole, let raison = raisonVacances {
                out.raison = raison
                continue
            }
            out.routines.append(r)
        }
        return out
    }

    // MARK: - Étoiles, bocal, rappels

    static func cleNote(_ jour: String, _ routineId: String) -> String {
        routineId == "ecole" ? jour : jour + "~" + routineId
    }

    static func total(_ d: Donnees, _ nom: String) -> Int {
        let notes = (d.lire("notes") as? [String: Any]) ?? [:]
        return notes.values.reduce(0) { somme, v in
            somme + (((v as? [String: Any])?[nom] as? Int) ?? 0)
        }
    }

    static func bocal(_ d: Donnees) -> EtatBocal? {
        guard let c = d.lire("cagnotte") as? [String: Any],
              let objectif = c["objectif"] as? Int, objectif > 0 else { return nil }
        let tous = Config.filles.reduce(0) { $0 + total(d, $1.nom) }
        let progres = max(0, tous - ((c["base"] as? Int) ?? 0))
        return EtatBocal(objectif: objectif, recompense: (c["recompense"] as? String) ?? "",
                         progres: progres, pleine: progres >= objectif)
    }

    static func rappels(_ d: Donnees, _ date: Date) -> [String] {
        var out: [String] = []
        let sources = [d.lire("rappels/hebdo/\(Temps.jourSemaine(date))"),
                       d.lire("rappels/dates/\(Temps.cleJour(date))")]
        for source in sources {
            if let dict = source as? [String: Any] {
                for k in dict.keys.sorted() { if let s = dict[k] as? String { out.append(s) } }
            }
        }
        return out
    }

    // MARK: - Décor du jour (hors routine) et anniversaires

    static func decor(_ date: Date, _ r: Reglages) -> Decor {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        let md = String(format: "%02d-%02d", c.month ?? 1, c.day ?? 1)
        var fete: Fete?
        for f in Config.filles where fete == nil {
            if let naissance = r.anniversaires[f.nom], naissance.count >= 10, String(naissance.suffix(5)) == md {
                fete = Fete(nom: f.nom, age: (c.year ?? 0) - (Int(naissance.prefix(4)) ?? (c.year ?? 0)))
            }
        }
        let particules: [String]
        if fete != nil { particules = ["🎈", "🎉", "🎂", "✨", "🎁"] }
        else if md >= "10-24" && md <= "10-31" { particules = ["🎃", "👻", "🦇", "🍬"] }
        else if md >= "12-01" && md <= "12-25" { particules = ["❄️", "⭐", "❄️", "🎄"] }
        else if md >= "12-26" || md <= "03-19" { particules = ["❄️", "❄️", "❄️"] }
        else if md <= "06-20" { particules = ["🌸", "🌷", "🦋"] }
        else if md <= "09-21" { particules = ["🌻", "🐝", "☀️"] }
        else { particules = ["🍂", "🍁", "🍂"] }
        return Decor(particules: r.decor ? particules : [], fete: fete)
    }

    // MARK: - Scène animée d'une étape

    static func scene(pour e: Etape) -> TypeScene {
        if let choisie = TypeScene(rawValue: e.scene) { return choisie }
        let t = (e.titre + " " + e.emoji).lowercased()
        func contient(_ mots: [String]) -> Bool { mots.contains { t.contains($0) } }
        if contient(["réveil", "reveil", "câlin", "calin", "🤗", "⏰"]) { return .reveil }
        if contient(["déj", "dej", "repas", "goûter", "gouter", "dîner", "diner", "🥣", "🍽", "🥐"]) { return .repas }
        if contient(["dent", "🪥"]) { return .dents }
        if contient(["coiff", "cheveu", "🎀"]) { return .coiffure }
        if contient(["pyjama", "👚"]) { return .pyjama }
        if contient(["habill", "👕", "👗"]) { return .habits }
        if contient(["rang", "🧺", "🧸"]) { return .rangement }
        if contient(["chaussure", "👟", "manteau", "🧥"]) { return .chaussures }
        if contient(["libre", "jeu", "jouer", "🎈", "🎨"]) { return .jeu }
        if contient(["bain", "douche", "🛁"]) { return .bain }
        if contient(["histoire", "lecture", "livre", "📖"]) { return .histoire }
        return .etoiles
    }
}

/// La routine École d'origine, identique à celle de commun.js
@MainActor
enum Defauts {
    static let ecole: [String: Any] = [
        "nom": "École", "emoji": "🎒",
        "jours": ["1": true, "2": true, "3": true, "4": true, "5": true] as [String: Any],
        "ecole": true,
        "fin": "08:08", "finEmoji": "🚌", "finTitre": "Le bus",
        "finVoix": "C'est l'heure du bus ! Bonne journée les filles !",
        "finMessage": "Bonne journée les filles !", "finSous": "❤️ À ce soir",
        "etoiles": true, "heureNotes": "08:06",
        "etapes": [
            ["debut": "07:25", "titre": "Réveil + câlins à {parent}", "emoji": "🤗", "couleur": "#FF9F43",
             "voix": "Debout les filles ! C'est l'heure des câlins à {parent} !", "rappels": "voix"] as [String: Any],
            ["debut": "07:30", "titre": "Petit déjeuner", "emoji": "🥣", "couleur": "#EE5A52",
             "voix": "À table ! C'est l'heure du petit déjeuner."] as [String: Any],
            ["debut": "07:45", "titre": "On s'habille", "emoji": "👕", "couleur": "#2E86DE",
             "voix": "C'est l'heure de s'habiller !"] as [String: Any],
            ["debut": "07:50", "titre": "Dents + coiffure", "emoji": "🪥", "couleur": "#10AC84",
             "voix": "Brossage des dents et coiffure !",
             "details": ["🪥 Les dents", "🎀 Les cheveux"]] as [String: Any],
            ["debut": "07:55", "titre": "On range !", "emoji": "🧺", "couleur": "#A55EEA",
             "voix": "On range ! Le pyjama, la veilleuse et le petit déjeuner.",
             "details": ["👚 Pyjama", "💡 Veilleuse", "🥣 Petit déj"]] as [String: Any],
            ["debut": "07:58", "titre": "Les chaussures", "emoji": "👟", "couleur": "#00B8C4",
             "voix": "Les chaussures ! Vite, avant le temps libre !", "rappels": "complet"] as [String: Any],
            ["debut": "08:00", "titre": "Temps libre", "emoji": "🎈", "couleur": "#F7B731",
             "voix": "Bravo les filles ! C'est le temps libre !",
             "alerte": "Plus qu'une minute ! On file au bus !"] as [String: Any]
        ] as [Any]
    ]
}
