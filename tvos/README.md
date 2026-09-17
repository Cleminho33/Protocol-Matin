# Le matin : l'app Apple TV

App native tvOS (SwiftUI) qui affiche les routines de Lou et Alba directement sur l'Apple TV, sans iPad ni recopie AirPlay.
Elle lit la même base Firebase que l'espace parent : étoiles, routines, rappels, bocal et réglages restent gérés depuis le téléphone.

## Fichiers (`LeMatin/`)

| Fichier | Rôle |
|---|---|
| `LeMatinApp.swift` | Point d'entrée, accueil (code famille, Papa ou Maman, essai accéléré), éléments communs |
| `Moteur.swift` | Le cerveau : quelle routine, quelle étape, annonces, voix, étoiles, bravo |
| `Donnees.swift` | Synchronisation en direct avec Firebase |
| `Modeles.swift` | Routines, bocal, rappels, décor, routine École d'origine |
| `Calendrier.swift` | Vacances zone A et jours fériés |
| `Ecrans.swift` | Tous les écrans : routine, dodo, attente, fin, repos, étoiles, bravo |
| `Scenes.swift` | Les scènes animées par étape, la mascotte et les décors |
| `SonEtVoix.swift` | Mélodies générées et voix française |
| `Config.swift` | Adresse de la base, prénoms, couleurs, outils |

## Installation (une fois, sur le Mac)

1. **Xcode** : l'installer depuis l'App Store et l'ouvrir une fois. S'il propose des composants, cocher **tvOS**.
2. **Compte** : Xcode › Réglages › Comptes › **+** › Apple ID, avec ton identifiant Apple habituel.
3. **Projet** : Fichier › Nouveau › Projet › onglet **tvOS** › **App** › Suivant.
   - Product Name : `LeMatin`
   - Team : ton nom (Personal Team)
   - Organization Identifier : `fr.cleminho`
   - Interface : SwiftUI, Language : Swift, pas de tests
4. Dans la colonne de gauche, **supprimer** `ContentView.swift` et `LeMatinApp.swift` (clic droit › Delete › Move to Trash).
5. **Code** : sur github.com/Cleminho33/Protocol-Matin, bouton **Code › Download ZIP**. Dézipper, puis glisser les 9 fichiers `.swift` de `tvos/LeMatin/` dans le dossier jaune `LeMatin` d'Xcode. Cocher « Copy items if needed » et la cible LeMatin.
6. Cliquer sur le projet (icône bleue) › cible LeMatin › General › **Minimum Deployments : tvOS 17.0**.
7. **Essai sur le Mac** : en haut, choisir le simulateur « Apple TV 4K », puis ▶. Coller le lien famille dans le champ.

## Installation sur l'Apple TV

1. Mac et Apple TV sur le **même Wi-Fi**.
2. Apple TV : Réglages › Télécommandes et appareils › **App Remote et appareils** : l'écran d'appairage s'affiche.
3. Xcode : Window › **Devices and Simulators** › l'Apple TV apparaît › **Pair** › taper le code affiché sur la télé.
4. En haut d'Xcode, choisir l'Apple TV comme destination, puis ▶.
5. Au premier lancement, l'app demande le **code famille** : une notification « Saisie clavier » arrive sur l'iPhone, il suffit d'y **coller le lien de l'écran du matin**.

## Chaque semaine (compte Apple gratuit)

L'app installée avec un compte gratuit s'arrête au bout de **7 jours**. Pour la prolonger : ouvrir le projet dans Xcode, choisir l'Apple TV, ▶. Environ 2 minutes.
Avec le compte développeur Apple (99 €/an), elle tient un an.

## Chaque matin

1. iPhone › Centre de contrôle › **Télécommande Apple TV** : allumer.
2. Ouvrir **LeMatin** (à épingler en haut de l'écran d'accueil de l'Apple TV).
3. Choisir **Papa** ou **Maman**. C'est tout, le téléphone peut être verrouillé.

Télécommande pendant la routine :
- **⏯ Lecture/Pause** : ouvre l'écran des étoiles.
- **Menu / Retour** : ferme le bravo ou les étoiles, sinon revient à l'accueil.
