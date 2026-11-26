# D10 — Zeichnungsprüfung und offene Nachweise

Stand: 26.11.2026.

## Verfügbare Grundlage

Das Arbeitspaket nennt die zweitseitige Rasterzeichnung `140.99.4290.012.62.130D_DD_REWM(1).pdf` von Thyssenkrupp rothe erde. Die Datei wurde im vorhandenen Dokumentbestand identifiziert; die Metadaten bestätigen zwei Seiten. Die lokale Übertragung für hochauflösende Ausschnitte scheiterte am gesperrten Netzwerkzugriff. Die zurückgegebenen Seitenverweise allein erlauben keine unabhängige Maß- oder Winkelmessung.

**Es wurde deshalb keine neue hochauflösende Zeichnungsmessung durchgeführt.** Es werden keine Seiten-/Ausschnittnachweise, Rollenzahlen oder Messunsicherheiten erfunden. Im Repository befinden sich weder Originalzeichnung noch Ausschnitte.

## Übernommene Angaben

| Parameter                | Vorgabe aus dem Arbeitspaket    | Behandlung in der App                         |
| ------------------------ | ------------------------------- | --------------------------------------------- |
| Hersteller               | Thyssenkrupp rothe erde         | Quellenangabe Arbeitspaket                    |
| Bauart                   | Kegelrollenlager, erneut prüfen | Unbestätigte Bauart                           |
| Lagerreihen              | 2                               | Upwind / Downwind getrennt                    |
| Nominale Rollenabmessung | 100 × 182 mm                    | Vorläufig; effektiver Durchmesser separat     |
| Außenmaß                 | 4852 ± 2 mm                     | 4852 mm vorläufig, Toleranz hier dokumentiert |
| Lagerspiel               | 0,17–0,22 mm                    | Vorläufige übernommene Angaben                |
| Rollenteilkreis          | etwa 4290 mm                    | ESTIMATED                                     |
| Kontaktwinkel            | etwa 46°                        | ESTIMATED                                     |
| Kinematischer Faktor     | etwa 0,5081                     | ESTIMATED, manueller Testfaktor               |
| Rollenanzahlen           | unbekannt                       | null je Lagerreihe                            |

Die konservative Kennzeichnung ESTIMATED bedeutet: Die unabhängige Zeichnungsprüfung dieser Implementierung steht noch aus. Die vom Nutzer dokumentierten Angaben können nach Nachweis im Preset auf DOCUMENTED geändert und mit einer präzisen Quelle versehen werden.

## Noch zu prüfen

- Beide Zeichnungsseiten hochauflösend rendern; Schnittansichten, Maßlinien und Achsen eindeutig zuordnen.
- Rollenmittelpunkte und Teilkreis je Reihe unabhängig bestimmen. Eine zeichnerische Skalierung muss an dokumentierten Maßen kalibriert werden; Druck-/Scanverzerrung und Linienbreite begrenzen die Genauigkeit.
- Kontaktwinkel anhand eindeutig identifizierter Laufbahnen prüfen; kein bloßer Pixelwinkel ohne Achszuordnung.
- Lagerbauart und logarithmisches Rollenprofil anhand Beschriftung bzw. separater Wälzkörperzeichnung bestätigen.
- Separate Rollenzeichnung `100x182-4290-0-L-01-31-01` beschaffen, insbesondere effektiven kinematischen Durchmesser prüfen.
- Tatsächliche Rollenanzahlen nur aus einer eindeutigen Detailansicht, Stückliste oder Herstellerangabe übernehmen. Die sichtbaren Bohrungen nicht als Wälzkörper zählen.
- Ø 4723 und Ø 4436 gemäß Arbeitspaket als Befestigungslochkreis bzw. Dichtfläche behandeln; sie wurden nicht zur Kinematikberechnung verwendet.

## Formel und Gültigkeit

Für feststehenden Innenring und drehenden Außenring verwendet die App die ideale Näherung `k = 0.5 * (1 + d/Dm * cos(α))`. Als technische Referenz dient die allgemeine Umlaufformel in NSK, _Rolling Bearings for Industrial Machinery_, Gleichung 5.3:
https://www.nsk.com/content/dam/nsk/common/catalogs/ctrgPdf/bearings/e1103b.pdf

Die korrekte allgemeine Formel bestätigt nicht die Eingangsgeometrie dieses D10-Lagers und ersetzt keine Prüfung des effektiven Rollendurchmessers. Die App erlaubt ausdrücklich einen manuell vorgegebenen oder unabhängig kalibrierten Faktor je Lagerreihe. Einheiten der Geometrie: durchgängig Millimeter; Kontaktwinkel: Grad.
