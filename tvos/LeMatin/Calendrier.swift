import Foundation
import Observation

/// Vacances scolaires de la zone A (Bordeaux) et jours fériés, depuis les API officielles.
@MainActor
@Observable
final class Calendrier {
    struct Vacance: Codable {
        let nom: String
        let debut: String
        let fin: String
        let ete: Bool
    }

    struct Cache: Codable {
        let le: Date
        let vacances: [Vacance]
        let feries: [String: String]
    }

    private(set) var version = 0
    @ObservationIgnored private var cache: Cache?

    init() {
        if let d = UserDefaults.standard.data(forKey: "calendrier"),
           let c = try? JSONDecoder().decode(Cache.self, from: d) {
            cache = c
        }
        Task { [weak self] in
            while !Task.isCancelled {
                await self?.charger()
                try? await Task.sleep(for: .seconds(6 * 3600))
            }
        }
    }

    func charger() async {
        if let c = cache, Date().timeIntervalSince(c.le) < 3 * 86400 { return }
        let an = Calendar.current.component(.year, from: Date())
        guard var comp = URLComponents(string: "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records") else { return }
        comp.queryItems = [
            URLQueryItem(name: "where", value: "location=\"Bordeaux\" and end_date>\"\(an - 1)-06-01\""),
            URLQueryItem(name: "order_by", value: "start_date"),
            URLQueryItem(name: "limit", value: "60")
        ]
        guard let urlVacances = comp.url,
              let urlFeries = URL(string: "https://calendrier.api.gouv.fr/jours-feries/metropole.json") else { return }
        do {
            let (dv, _) = try await URLSession.shared.data(from: urlVacances)
            let (df, _) = try await URLSession.shared.data(from: urlFeries)
            let jv = try JSONSerialization.jsonObject(with: dv) as? [String: Any]
            let feries = (try JSONSerialization.jsonObject(with: df) as? [String: String]) ?? [:]
            let iso = ISO8601DateFormatter()
            var vacances: [Vacance] = []
            for rec in (jv?["results"] as? [[String: Any]]) ?? [] {
                if (rec["population"] as? String) == "Enseignants" { continue }
                guard let nom = rec["description"] as? String,
                      let sd = rec["start_date"] as? String, let ed = rec["end_date"] as? String,
                      let d1 = iso.date(from: sd), let d2 = iso.date(from: ed) else { continue }
                vacances.append(Vacance(nom: nom, debut: Temps.cleJour(d1), fin: Temps.cleJour(d2),
                                        ete: nom.contains("Été") || nom.contains("été")))
            }
            let c = Cache(le: Date(), vacances: vacances, feries: feries)
            cache = c
            version += 1
            if let d = try? JSONEncoder().encode(c) {
                UserDefaults.standard.set(d, forKey: "calendrier")
            }
        } catch {
            // on garde l'ancien cache
        }
    }

    /// nil si ce n'est ni un jour férié ni un jour de vacances, sinon la raison
    func raison(_ date: Date) -> String? {
        guard let c = cache else { return nil }
        let k = Temps.cleJour(date)
        if let f = c.feries[k] { return "Jour férié : \(f)" }
        for v in c.vacances {
            if v.ete {
                if k >= v.debut && k < String(v.debut.prefix(4)) + "-09-01" { return "Vacances d'été" }
            } else if (v.debut == v.fin) ? (k == v.debut) : (k >= v.debut && k < v.fin) {
                return v.nom
            }
        }
        return nil
    }
}
