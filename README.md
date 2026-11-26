# BearingTrackerPro Next

Separate Weiterentwicklung vom 26.11.2026. Das bestehende BearingTrackerPro-Projekt bleibt unverändert.

## Sofort starten

- `BearingTrackerPro.html` direkt im Browser öffnen: Finger Tracking und manuelle RPM funktionieren ohne Server. Diese Datei wird beim Build erzeugt.
- Auf dem Mac `Start.command` doppelklicken: öffnet den vollständigen Tracker unter `http://localhost:4174`, einschließlich Kamera-OCR und Offline-Paket. Node.js muss installiert sein.
- Entwicklung: `npm ci`, `npm run dev` (Port 5174).
- Produktionsbuild: `npm run build`; anschließend `npm start` (Port 4174).

Das erste Öffnen startet unmittelbar im Finger-Tracking-Modus. Die optionale lokale Bildschirmsperre verwendet vorerst die bisherigen Demo-Zugangsdaten `admin` / `bearing123`. Sie ist keine serverseitige Zugriffskontrolle.

## Ablauf

1. Gewünschte Lagerreihe auswählen.
2. Unter **Presets bearbeiten** Werte, Datenqualität und Quellen prüfen, anschließend **Preset speichern**. Ein leeres Zahlenfeld bedeutet unbekannt (`null`). Bei unbekannter Rollenanzahl zeigt die App symbolische Rollen.
3. Unter **Referenzierung & bekannte Bewegung** das reale Referenzblatt, dessen Winkel, den beobachteten beschädigten Wälzkörper und den Endoskopiepunkt erfassen. Referenzierung bestätigen.
4. **Finger Tracking**: am virtuellen Rotorblatt greifen und den realen Rotor nachführen. Aufsetzen und erneutes Greifen ändern die Position nicht. Alternativ manuelle RPM oder Kamera-OCR verwenden. Immer nur eine Eingabequelle ist aktiv.
5. **Analyse & Kalibrierung** zeigt die erforderliche Rotorbewegung zur Inspektionsposition. Bei unsicherer Synchronisation werden präzise Zielwerte unterdrückt.
6. **Fall speichern** speichert den aktuellen Fall. Automatische Sicherung erfolgt zusätzlich alle zwei Sekunden und beim Verlassen. **Backup exportieren/importieren** überträgt Presets, Fall und Kalibrierungen als JSON zwischen Geräten.

Eine bekannte verpasste Rotorbewegung kann mit Vorzeichen nachgetragen werden. Bei unbekannter Bewegung müssen Rotor **und** Wälzkörper erneut beobachtet und referenziert werden. Ein Neustart der App stellt die Synchronisation nicht automatisch wieder her. Eine neue Referenzierung kann den Winkelursprung verändern; die separat gespeicherten Bewegungszähler bleiben erhalten. Nur **Tracking zurücksetzen** beginnt neue Zähler.

## Kamera und Offline

Die Webversion benötigt HTTPS oder localhost für Kamera und Service Worker. OCR-Worker, drei eingebettete WASM-Varianten und englische OCR-Sprachdaten werden lokal ausgeliefert. Nach Anzeige **Offline bereit · inkl. OCR** funktioniert die installierte Webversion ohne Internet. Die direkt geöffnete HTML-Datei unterstützt keine Kamera-OCR.

Kamera-OCR wird beim Wechsel zwischen Tracking und Analyse weiter betrieben. Messwerte älter als 6,5 Sekunden pausieren das Tracking und setzen die Synchronisation auf unsicher. Es gibt keinen automatischen Ersatz durch Demo-RPM und kein fest erfundenes 30-Sekunden-Bremsprofil. Start/Stop betreffen ausschließlich die App.

## Zweite App auf dem iPad

Die neue Version hat einen eigenen App-Namen **BTP Next**, eigene Symbole, eigene Service-Worker-Caches und einen eigenen Speicherbereich. Die alte App bleibt erhalten. Die GitHub-Pages-Adresse muss aus einem **eigenen Repository** kommen; das Workflow verändert kein anderes Projekt.

Nach erfolgreicher Bereitstellung die neue HTTPS-Adresse in Safari öffnen, das Offline-Paket vollständig laden lassen, dann **Teilen → Zum Home-Bildschirm → Hinzufügen**. Presets und Fälle sind lokal je Browser/Gerät gespeichert; zur Übertragung Backup exportieren/importieren. Der Tracker muss vor Ort am iPad einschließlich geeigneter Handschuhe validiert werden.

## Datenlage D10

`k = 0.5081` ist ein ausdrücklich vorläufiger manueller Testfaktor. `d = 100 mm`, `Dm = 4290 mm`, `α = 46°` werden als Schätzwerte geführt. Die ideale Formel für den drehenden Außenring lautet `k = 0.5 * (1 + d/Dm * cos(α))`. Sie unterscheidet Umlauf und Eigendrehung. Die Eignung für die reale Kegelrollengeometrie, effektiver Durchmesser, Schlupf und beide Rollenreihen sind praktisch bzw. anhand der Zeichnung zu bestätigen.

Die Herstellerzeichnung und Ausschnitte werden **nicht** mit dem Projekt veröffentlicht. Rollenanzahlen bleiben unbekannt. Details: [Zeichnungsanalyse](docs/ZEICHNUNGSANALYSE.md).

## Prüfungen

- `npm test`: Kinematik, Gestenlogik, Datenvalidierung, Persistenz, React-Rendering und OCR mit einem synthetischen RPM-Bild.
- `npm run lint` und `npm run build`.
- `npx playwright install chromium`, dann bei laufendem Server `npm run test:browser`: echte Browser-Regressionen über HTTP, synthetische Kamera, Offline-OCR, Preset-Speichern, Kalibrierung und iPhone-Layout. Keine physische Kamera wird im Test verwendet.
- GitHub Actions führt diese Prüfungen vor jeder separaten Pages-Bereitstellung aus.

Grenzen und aktueller Prüfstand: [Abschlussbericht](docs/ABSCHLUSSBERICHT.md).
