# IST und Implementierungsplan — 26.11.2026

Die neue Version entsteht ausschließlich in BearingTrackerPro-Next. Bestehende Dateien bleiben unangetastet.

## IST

React 19, Vite 8, SVG, Tesseract OCR, Tracking/Analyse/Daten, DE/EN. Kein editierbares Preset, kein persistenter Inspektionsfall, kein Service Worker. Kamera-Drehzahl und feste Mock-RPM; keine freie RPM-Eingabe. Fehler in Käfigformel, Null-RPM-Skalierung, Start-Referenzierung, OCR-Lebenszyklus und festem Bremsmodell. D10-Daten bisher unbestätigt.

## Umsetzung

1. Reine zentrale Kinematik, kontinuierliche Winkel, Tests.
2. D10 Upwind/Downwind mit null für Unbekanntes, Quellen und Qualitätsstatus je Parameter.
3. Persistenter Trackingzustand und exklusive Eingabequelle (manuell, OCR, Finger).
4. Kreisförmige Pointer-Steuerung, Synchronisation und Referenzierung.
5. Editierbare Presets mit explizitem Speichern. Kalibrierungen und Zielsuche.
6. Lokale OCR-Ressourcen und Offline-Cache. Lint, Build, mathematische und Browser-Regressionstests.

Zeichnungsdaten werden unabhängig geprüft, soweit Zugriff und Auflösung es erlauben. Herstellerzeichnung und Ausschnitte bleiben außerhalb des Projektes. Praktische Handschuh-/Anlagentests bleiben vor Ort erforderlich.
