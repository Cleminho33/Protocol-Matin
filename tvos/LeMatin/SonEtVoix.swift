import AVFoundation

/// Petites mélodies générées (aucun fichier son), jouées sur la télé.
@MainActor
final class Son {
    private let moteurAudio = AVAudioEngine()
    private let lecteur = AVAudioPlayerNode()
    private let format = AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 1)
    private var tampons: [String: AVAudioPCMBuffer] = [:]

    /// (fréquence, départ, durée) en secondes
    private static let melodies: [String: [(Double, Double, Double)]] = [
        "etape":   [(523, 0, 0.4), (659, 0.15, 0.4), (784, 0.3, 0.4), (1047, 0.45, 0.8)],
        "alerte":  [(880, 0, 0.25), (880, 0.35, 0.25)],
        "bus":     [(784, 0, 0.4), (659, 0.2, 0.4), (784, 0.4, 0.4), (1047, 0.6, 0.4), (1319, 0.8, 1)],
        "etoile":  [(1319, 0, 0.15)],
        "fanfare": [(523, 0, 0.2), (523, 0.2, 0.2), (523, 0.4, 0.2), (659, 0.6, 0.5), (587, 1.1, 0.2), (659, 1.3, 0.2), (784, 1.5, 1.2)],
        "bocal":   [(784, 0, 0.15), (988, 0.12, 0.15), (1175, 0.24, 0.15), (1568, 0.36, 0.9), (1319, 1.2, 0.2), (1568, 1.4, 1.2)]
    ]

    init() {
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)
        guard let format else { return }
        moteurAudio.attach(lecteur)
        moteurAudio.connect(lecteur, to: moteurAudio.mainMixerNode, format: format)
        try? moteurAudio.start()
    }

    func jouer(_ nom: String) {
        guard let notes = Son.melodies[nom] else { return }
        if tampons[nom] == nil { tampons[nom] = fabriquer(notes) }
        guard let tampon = tampons[nom] else { return }
        if !moteurAudio.isRunning { try? moteurAudio.start() }
        lecteur.scheduleBuffer(tampon, at: nil, options: .interrupts, completionHandler: nil)
        if !lecteur.isPlaying { lecteur.play() }
    }

    private func fabriquer(_ notes: [(Double, Double, Double)]) -> AVAudioPCMBuffer? {
        guard let format else { return nil }
        let frequence = 44_100.0
        let duree = (notes.map { $0.1 + $0.2 }.max() ?? 1) + 0.1
        let total = AVAudioFrameCount(duree * frequence)
        guard let tampon = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: total),
              let canal = tampon.floatChannelData?[0] else { return nil }
        tampon.frameLength = total
        let n = Int(total)
        for i in 0..<n { canal[i] = 0 }
        for (freq, debut, longueur) in notes {
            let premier = Int(debut * frequence)
            let nombre = Int(longueur * frequence)
            for k in 0..<nombre where premier + k < n {
                let t = Double(k) / frequence
                let enveloppe = min(1, t / 0.02) * exp(-3.5 * t / longueur)
                let phase = (t * freq).truncatingRemainder(dividingBy: 1)
                let triangle = 4 * abs(phase - 0.5) - 1
                canal[premier + k] += Float(triangle * enveloppe * 0.25)
            }
        }
        return tampon
    }
}

/// La voix française de l'Apple TV.
@MainActor
final class Voix {
    private let synthese = AVSpeechSynthesizer()
    private var attente: Task<Void, Never>?

    func parler(_ texte: String, delai: Double = 1.1) {
        guard !texte.isEmpty else { return }
        attente?.cancel()
        attente = Task { [weak self] in
            try? await Task.sleep(for: .seconds(delai))
            guard !Task.isCancelled, let self else { return }
            self.synthese.stopSpeaking(at: .immediate)
            let phrase = AVSpeechUtterance(string: texte)
            phrase.voice = AVSpeechSynthesisVoice(language: "fr-FR")
            phrase.rate = 0.48
            phrase.pitchMultiplier = 1.1
            self.synthese.speak(phrase)
        }
    }
}
