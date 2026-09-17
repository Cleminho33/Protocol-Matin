import SwiftUI

enum Config {
    static let baseURL = "https://protocol-matin-default-rtdb.europe-west1.firebasedatabase.app"

    static let filles: [Fille] = [
        Fille(nom: "Lou", couleur: Color(hex: "#FF6B9D")),
        Fille(nom: "Alba", couleur: Color(hex: "#54A0FF"))
    ]

    static let nuit = Color(hex: "#141833")
    static let or = Color(hex: "#FFD93D")
    static let vert = Color(hex: "#7CFFB2")
}

struct Fille: Identifiable {
    let nom: String
    let couleur: Color
    var id: String { nom }
}

extension Color {
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        self.init(
            red: Double((v >> 16) & 0xFF) / 255,
            green: Double((v >> 8) & 0xFF) / 255,
            blue: Double(v & 0xFF) / 255
        )
    }
}

enum Temps {
    static func secondes(_ d: Date) -> Double {
        let c = Calendar.current.dateComponents([.hour, .minute, .second, .nanosecond], from: d)
        return Double(c.hour ?? 0) * 3600 + Double(c.minute ?? 0) * 60 + Double(c.second ?? 0)
            + Double(c.nanosecond ?? 0) / 1_000_000_000
    }

    static func cleJour(_ d: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// 0 = dimanche … 6 = samedi, comme dans l'espace parent
    static func jourSemaine(_ d: Date) -> Int {
        Calendar.current.component(.weekday, from: d) - 1
    }

    static func heure(_ secondes: Int) -> String {
        "\(secondes / 3600)h" + String(format: "%02d", (secondes % 3600) / 60)
    }

    static func secondes(depuis texte: String?) -> Int? {
        guard let texte else { return nil }
        let p = texte.split(separator: ":")
        guard p.count >= 2, let h = Int(p[0]), let m = Int(p[1]) else { return nil }
        return h * 3600 + m * 60
    }
}

enum Texte {
    static func pluriel(_ n: Int, _ mot: String) -> String {
        "\(n) \(mot)\(n > 1 ? "s" : "")"
    }

    /// Retire les emojis pour la voix
    static func sansEmoji(_ s: String) -> String {
        var vue = String.UnicodeScalarView()
        vue.append(contentsOf: s.unicodeScalars.filter { u in
            if u.value == 0xFE0F || u.value == 0x200D { return false }
            if u.properties.isEmojiPresentation { return false }
            if u.properties.isEmoji && u.value > 0x2000 { return false }
            return true
        })
        return String(vue).trimmingCharacters(in: .whitespaces)
    }

    static func json(_ v: Any) -> String {
        guard JSONSerialization.isValidJSONObject(v),
              let d = try? JSONSerialization.data(withJSONObject: v, options: [.sortedKeys]) else {
            return "\(v)"
        }
        return String(decoding: d, as: UTF8.self)
    }

    static func depuisJson(_ s: String) -> Any? {
        try? JSONSerialization.jsonObject(with: Data(s.utf8))
    }
}
