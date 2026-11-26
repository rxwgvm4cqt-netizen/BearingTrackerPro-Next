# BearingTrackerPro Next — Implementierungs- und Prüfbericht

Stand: 26.11.2026. Separate Projektkopie; bestehende Projektdateien werden vor Abschluss per SHA-256 mit ihrem Ausgangszustand verglichen.

## Implementiert

- Zentrale Kinematik mit kontinuierlichen, vorzeichenbehafteten Winkeln; Normalisierung ausschließlich für Anzeigen. Separate Wälzkörperpositionen und Faktoren je Preset/Lagerreihe, unabhängig von der Rollenanzahl.
- D10 Upwind und Downwind, D8 als unbestätigtes Legacy-Preset sowie editierbares Custom-Preset. Numerische Parameter, Faktorquelle, Herkunft und Qualitätsstatus sind bearbeitbar; expliziter Speicherbutton, Validierung, unbekannte Werte als null.
- Finger-Tracking direkt auf der Rotoransicht: Pointer Capture, Maus/Touch, mehrere Umdrehungen, neuer Griff ohne Sprung, Multitouch-Sperre, Totzone, Cancel/Lost Capture. Bei mehrdeutigem Sprung über 120° pro Ereignis wird nicht blind integriert; Synchronisation wird unsicher.
- Exklusive Eingabequelle: Finger, manuelle RPM oder OCR. Faktor-/Moduswechsel ändern keine vorhandenen Positionen. Getrennte Startfunktionen bleiben als Simulationswerkzeug erhalten; manuelle Pause, Einzelstart und Unterbrechungen können eine erneute Synchronisationsbestätigung erfordern.
- Referenzierung mit Blatt A/B/C, Startpositionen und Endoskopiepunkt, gespiegelte Generatoransicht, bekannte verlorene Rotorbewegung und expliziter Synchronisationsstatus.
- Defektmarkierung am Inspektionspunkt und Ereignisse mit Konfigurationssnapshot, Richtung, Blickrichtung, Faktor, Datenqualität und Zeitstempel.
- Find Broken Roller: gerichtete Restbewegung und nötige Rotorumdrehungen, einschließlich bereits erreichtem Ziel. Bei fehlender Markierung oder unsicherem Tracking werden präzise Zielwerte unterdrückt.
- Kalibrierung mit unabhängiger Wälzkörpermessung, Startwinkeln, signierten Gesamtwinkeln, Anlagenreferenz, Unsicherheit, Richtung/Blickrichtung, Notizen, Messhistorie und Streuung. Übernahme eines Faktors nur nach ausdrücklicher Entscheidung. Zeichnungsgeometrie bleibt erhalten.
- Fall-/Preset-/Kalibrierungsspeicherung, automatische Sicherung, JSON-Backup und validierter Import. Nach Wiederaufnahme ist die Synchronisation unsicher.
- DE/EN, bestehendes dunkles Industrial-Design, responsive Ansichten und separate PWA-Identität BTP Next.
- Lokales Offline-Paket einschließlich OCR; zusätzlich direkt öffnungsfähige HTML-Version für Finger/manuelle RPM und Mac-Starthelfer.

## Berechnungen

- `ΔRoller = ΔRotor * k`; Umlauf der Wälzkörper, keine Berechnung ihrer Eigendrehung.
- Idealer Faktor bei Außenringrotation: `0.5 * (1 + d/Dm * cos(α))`.
- Zielbewegung: gerichtete modulare Restbewegung / aktiver Faktor; am Ziel 0°.
- Kalibrierung: unabhängig gemessene Gesamt-Wälzkörperbewegung / Gesamt-Rotorbewegung. Konservative lineare Unsicherheitsabschätzung aus den angegebenen Winkelunsicherheiten; keine statistisch abgesicherte Genauigkeitsgarantie.

## Lokale Prüfungen

52 automatisierte Prüfungen bestanden: alle 11 vorgegebenen Referenzwerte mit k=0,5081; Richtungswechsel und viele Umdrehungen; Null-RPM-Wiederanlauf; Eingabequellen; unabhängige Reihen; Faktorenwechsel; Zielbewegung; Kalibrierungsfehler; Gestenlogik; Persistenz und Import; DE/EN- und React-Rendering; echtes Tesseract-OCR mit lokalen Sprachdaten und synthetischem Textbild 9.87 RPM. Lint und Produktionsbuild bestanden.

Lokale HTTP-Server sind durch die Ausführungsumgebung gesperrt; eine lokale Browserprüfung konnte daher nicht durchgeführt werden. Browser-Regressionsprüfungen sind für GitHub Actions vorbereitet und werden vor der Pages-Bereitstellung ausgeführt. Echte iPad-/Handschuh-/Anlagentests sind davon ausdrücklich nicht abgedeckt.

## Zeichnungsdaten

Keine neuen Herstellerparameter unabhängig bestätigt. Die hochauflösende Zeichnungsanalyse bleibt offen, siehe ZEICHNUNGSANALYSE.md. 4290 mm, 46° und 0,5081 sind ausdrücklich Schätz-/Testwerte; beide Rollenanzahlen bleiben null. Es wurden keine vertraulichen Zeichnungen oder Ausschnitte ins Projekt übernommen.

## Grenzen

- Menschliche Nachführfehler, OCR-Latenz und Schlupf beeinflussen die reale Position. Eine manuell bestätigte Synchronisation ist kein unabhängiger Messnachweis.
- Ein Winkelursprung kann durch bewusste Referenzierung neu gesetzt werden. Die separat gespeicherten Bewegungszähler zählen beobachtete Bewegung, nicht Referenzsprünge.
- Eine reine Ausrichtung auf Blatt A stellt unbekannte verlorene Umläufe nicht wieder her.
- Daten liegen lokal im jeweiligen Browser; keine automatische Gerätesynchronisation. Backups dienen der Übertragung und dauerhaften Sicherung.
- Die optionale lokale Bildschirmsperre ist keine serverseitige Authentifizierung. Keine Verbindung zu Anlagensteuerungen, keine sicherheitsrelevante Positionierung.
- Die drei OCR-WASM-Varianten werden beim Build aus den gesperrten npm-Abhängigkeiten erzeugt. Die Sprachdaten sind lokal mit Apache-2.0-Lizenz enthalten. Die Offline-Freigabe erfolgt erst nach vollständigem Cache-Aufbau.

## Wesentliche Dateien

`src/engine/kinematics.js`, `src/engine/gesture.js`, `src/data/presets.js`, `src/App.jsx`, `src/components/RotorDial.jsx`, `src/components/CameraRPMPanel.jsx`, `src/pages/TrackingPage.jsx`, `src/pages/BearingDataPage.jsx`, `src/pages/AnalysisPage.jsx`, `src/utils/storage.js`, `src/utils/ocrRpm.js`, `src/utils/captureFrame.js`, `src/i18n/next.js`, `src/styles/next.css`, `scripts/`, `tests/`, `public/manifest.webmanifest`, `.github/workflows/pages.yml`.
