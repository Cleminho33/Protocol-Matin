import Foundation
import Observation

/// Copie locale de la base Firebase (familles/<code>), tenue à jour en direct.
@MainActor
@Observable
final class Donnees {
    private(set) var arbre: [String: Any] = [:]
    private(set) var version = 0
    private(set) var etat = "connexion"
    private(set) var synchronise = false
    private(set) var code: String?
    /// En mode essai, rien n'est envoyé en ligne
    var demo = false

    @ObservationIgnored private var tache: Task<Void, Never>?

    init() {
        code = UserDefaults.standard.string(forKey: "codeFamille")
        if let d = UserDefaults.standard.data(forKey: "cache"),
           let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
            arbre = o
        }
        redemarrer()
    }

    var etatLisible: String {
        switch etat {
        case "en ligne": return "⭐ Étoiles et routines synchronisées"
        case "connexion": return "Connexion…"
        case "refusé": return "Code famille refusé : vérifie-le"
        case "sans code": return "Pas de code famille"
        default: return "Hors ligne : nouvelle tentative dans quelques secondes"
        }
    }

    func definirCode(_ c: String?) {
        code = c
        UserDefaults.standard.set(c, forKey: "codeFamille")
        if c == nil {
            arbre = [:]
            synchronise = false
            UserDefaults.standard.removeObject(forKey: "cache")
        }
        redemarrer()
    }

    func redemarrer() {
        tache?.cancel()
        synchronise = false
        guard let code, !code.isEmpty else {
            etat = "sans code"
            return
        }
        etat = "connexion"
        tache = Task { [weak self] in
            while !Task.isCancelled {
                await self?.ecouter(code: code)
                try? await Task.sleep(for: .seconds(5))
            }
        }
    }

    // MARK: - Lecture

    func lire(_ chemin: String) -> Any? {
        var n: Any? = arbre
        for morceau in chemin.split(separator: "/") {
            if let d = n as? [String: Any] {
                n = d[String(morceau)]
            } else if let a = n as? [Any], let i = Int(morceau), i >= 0, i < a.count {
                n = a[i]
            } else {
                return nil
            }
            if n is NSNull { return nil }
        }
        return n
    }

    // MARK: - Écriture

    func ecrire(_ chemin: String, _ valeur: Any?) {
        poser(chemin: chemin, valeur: valeur)
        version += 1
        guard !demo else { return }
        sauverCache()
        guard let code, let url = URL(string: "\(Config.baseURL)/familles/\(code)/\(chemin).json") else { return }
        var req = URLRequest(url: url)
        if let valeur, let corps = try? JSONSerialization.data(withJSONObject: valeur, options: [.fragmentsAllowed]) {
            req.httpMethod = "PUT"
            req.httpBody = corps
        } else {
            req.httpMethod = "DELETE"
        }
        Task {
            _ = try? await URLSession.shared.data(for: req)
        }
    }

    // MARK: - Écoute en direct (Server-Sent Events de Firebase)

    private func ecouter(code: String) async {
        guard let url = URL(string: "\(Config.baseURL)/familles/\(code).json") else { return }
        var req = URLRequest(url: url)
        req.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        req.timeoutInterval = 120
        do {
            let (octets, reponse) = try await URLSession.shared.bytes(for: req)
            let statut = (reponse as? HTTPURLResponse)?.statusCode ?? 0
            guard statut == 200 else {
                etat = (statut == 401 || statut == 403) ? "refusé" : "hors ligne"
                return
            }
            var evenement = ""
            for try await ligne in octets.lines {
                if ligne.hasPrefix("event:") {
                    evenement = String(ligne.dropFirst(6)).trimmingCharacters(in: .whitespaces)
                } else if ligne.hasPrefix("data:") {
                    let json = String(ligne.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                    recevoir(evenement: evenement, json: json)
                }
            }
        } catch {
            // coupure réseau : on réessaie
        }
        if etat != "refusé" { etat = "hors ligne" }
    }

    private func recevoir(evenement: String, json: String) {
        guard evenement == "put" || evenement == "patch",
              let msg = try? JSONSerialization.jsonObject(with: Data(json.utf8), options: [.fragmentsAllowed]) as? [String: Any],
              let chemin = msg["path"] as? String else { return }
        let valeur = msg["data"]
        if evenement == "patch", let dict = valeur as? [String: Any] {
            let base = chemin.hasSuffix("/") ? String(chemin.dropLast()) : chemin
            for (k, v) in dict { poser(chemin: base + "/" + k, valeur: v) }
        } else {
            poser(chemin: chemin, valeur: valeur)
        }
        etat = "en ligne"
        synchronise = true
        version += 1
        if !demo { sauverCache() }
    }

    private func poser(chemin: String, valeur: Any?) {
        let morceaux = chemin.split(separator: "/").map(String.init)
        let v: Any? = (valeur is NSNull) ? nil : valeur
        if morceaux.isEmpty {
            arbre = (v as? [String: Any]) ?? [:]
            return
        }
        arbre = Donnees.inserer(arbre, morceaux[...], v)
    }

    private static func inserer(_ noeud: [String: Any], _ morceaux: ArraySlice<String>, _ v: Any?) -> [String: Any] {
        var n = noeud
        guard let premier = morceaux.first else { return n }
        if morceaux.count == 1 {
            n[premier] = v
        } else {
            var enfant = (n[premier] as? [String: Any]) ?? [:]
            if let tableau = n[premier] as? [Any] {
                for (i, x) in tableau.enumerated() where !(x is NSNull) { enfant[String(i)] = x }
            }
            n[premier] = inserer(enfant, morceaux.dropFirst(), v)
        }
        return n
    }

    private func sauverCache() {
        if JSONSerialization.isValidJSONObject(arbre),
           let d = try? JSONSerialization.data(withJSONObject: arbre) {
            UserDefaults.standard.set(d, forKey: "cache")
        }
    }
}
