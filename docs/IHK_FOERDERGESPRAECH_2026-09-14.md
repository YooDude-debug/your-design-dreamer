# Y-DUDE – IHK-/FÖRDERGESPRÄCH

Stand: 13.09.2026 · Grundlage: aktueller Produktivstand des Projekts Y-Dude
Hinweis: Alle Angaben stammen aus dem tatsächlichen Projektstand. Es werden keine Nutzerzahlen, Umsätze oder Marktanteile behauptet. Status wird durchgängig unterschieden in **live**, **fertig**, **in Weiterentwicklung**, **geplant**.

---

## 1. Kurzbeschreibung

Y-Dude ist ein soziales Netzwerk für Sprache, Slang und regionale Stimmen. Nutzer veröffentlichen Beiträge, an die sie kurze Sprachaufnahmen – sogenannte SlangTags – direkt an eine Stelle im Bild oder Video heften. Dazu kommen ein Messenger mit Übersetzung, ein Marktplatz, Kanäle, Wettbewerbsformate und ein Werbesystem für Unternehmen. Die Plattform ist unter y-dude.com öffentlich erreichbar und wird produktiv betrieben. Entwickelt wurde sie bislang vollständig in Eigenleistung.

## 2. Die Idee

Sprache ist mehr als Text. Dialekt, Akzent, Betonung und lokale Ausdrücke gehen in den heutigen textlastigen Netzwerken verloren. Gleichzeitig ist gesprochene Sprache die größte Hürde, wenn Menschen aus verschiedenen Regionen und Ländern miteinander in Kontakt kommen.

Y-Dude setzt genau dort an: Gesprochene Sprache wird zum eigenständigen Inhaltstyp, der gesammelt, geteilt, erklärt und übersetzt werden kann. Nutzer bringen ihre eigene Sprechweise ein, andere können sie hören, verstehen und verwenden. Die Plattform verbindet damit lokale Identität mit internationaler Verständlichkeit.

## 3. Was macht Y-Dude besonders?

- **SlangTags als eigenes Format:** kurze Audioschnipsel (1–5 Sekunden), frei im Bild oder Video positionierbar, mit Definition, Übersetzung und Abspielreihenfolge. Das gibt es in dieser Form bei den bekannten Netzwerken nicht.
- **Sprache als Verbindungsebene, nicht nur als Inhalt:** Beiträge, Kommentare und Chatnachrichten können übersetzt werden; Slang wird erklärt statt nur angezeigt.
- **Ein gemeinsames Datenfundament:** Feed, Marktplatz, Kanäle, Messenger und Werbung nutzen dasselbe Interessen- und Rechtemodell. Das ermöglicht Relevanz über Bereichsgrenzen hinweg.
- **Regionalität ist eingebaut**, unter anderem über den Slang-Globe, über Regionsignale im Feed und über regionale Wettbewerbe.
- **Werbung, die zur Plattform passt:** ein eigenes Kampagnensystem für lokale Unternehmen, ergänzt um externe Werbenachfrage – nicht nur ein eingebundenes Fremdsystem.
- **Sicherheit und Rechtekonzept von Anfang an**: Zugriffsrechte werden in der Datenbank durchgesetzt, nicht in der Oberfläche.

## 4. Aktueller Entwicklungsstand

**Live und produktiv im Einsatz**
- Öffentliche Plattform unter y-dude.com, dazu eine getrennte Testumgebung
- Registrierung und Anmeldung inkl. Google-Anmeldung, Bot-Schutz bei der Registrierung
- Sozialer Feed mit Beiträgen, Bildern, Videos, Kommentaren, Likes, Teilen, Speichern
- SlangTag-System inklusive Aufnahme, Positionierung, Transkription, Definitionen, QR-Deep-Links
- Messenger mit Echtzeitzustellung und Übersetzung
- Marktplatz mit Artikeln, Angeboten, Transaktionen, Verkäuferprofilen, Käufer-Verkäufer-Chat
- Kanäle, Hashtags, Kontakte/Follower, Profile
- Slang-Globe, Arena (Wettbewerbe/Voting), Mini-Game
- Werbesystem mit Kampagnenverwaltung für Unternehmen
- Push-Benachrichtigungen, installierbare App-Version (PWA)
- Moderation, Meldewesen, Widerspruchsverfahren, Transparenzseite, rechtliche Seiten
- Umfangreicher Verwaltungsbereich für Betrieb, Moderation und Auswertung

**Fertig entwickelt, aber noch mit begrenzter Nutzung**
- Creator-Funktionen (Zugangsschwelle, eigene SlangTags, Abonnements, exklusive Inhalte)
- Unternehmens-Onboarding mit Tarifen und Kampagnenlimits
- Zahlungsanbindung inkl. geprüfter Webhook-Verarbeitung

**In Weiterentwicklung**
- Personalisierung des Feeds: Die Gewichtung der Relevanzfaktoren ist heute fest konfiguriert; eine lernende Komponente existiert nur ansatzweise.
- Wirkungsmessung von Kampagnen: Es werden bisher nur Einblendungen und Klicks gezählt; eine Erfolgskette bis zu Marktplatz oder Profil fehlt.
- Qualitätsmessung der automatischen Moderation (bisher ohne belastbare Fehlerquoten)
- Verhalten bei stark wachsender Nutzerzahl (bisher bis 750 gleichzeitige Testnutzer geprüft)

**Geplante nächste Schritte** – siehe Abschnitt 12.

## 5. Wichtigste Produktbereiche

| Bereich | Was es ist | Status |
| --- | --- | --- |
| **Social Feed** | Beiträge mit Bild, Video und Audio; Tabs für Feed, Gefolgte, Kanäle und Markt; eigene Relevanzsortierung mit Vielfaltsregel | live |
| **Messenger** | Direktnachrichten in Echtzeit, getrennte Marktplatz-Chats, Sprachschnipsel im Chat, Übersetzung von Nachrichten | live |
| **SlangTag** | 1–5 Sekunden Audio, frei im Bild/Video platzierbar, mit Transkription, Definition, Freigabemodell und QR-Link | live |
| **Market** | Artikel einstellen, Angebote, Kaufabwicklung, Verkäufer-Shop, eigene Artikel, Gebührenmodell, Versand, Streitfälle | live |
| **Globe / Arena / JUMP** | dreidimensionaler Slang-Globus mit regionalen Einträgen und Abstimmungen; Arena mit Challenges, Einreichungen, Voting und Auszeichnungen; ein kleines Spiel als spielerischer Einstieg | live |
| **Übersetzung** | Beiträge, Kommentare und Nachrichten werden über einen KI-Dienst übersetzt und gespeichert, mit Kontingentsteuerung | live |
| **Push** | Benachrichtigungen für Nachrichten und Interaktionen, gebündelt und mit Direktsprung in den passenden Bereich | live |
| **Profile** | öffentliche Profile, Rollen (Community, Creator, Unternehmen), Sichtbarkeitsregeln, Kontakte und Follower | live |
| **Werbesystem** | eigenes Kampagnensystem für Unternehmen mit Zielgruppenbezug, Platzierungslogik im Feed, Werbepausen für Nutzer; zusätzlich Anbindung externer Werbenachfrage mit Einwilligungsprüfung | im Betrieb, externe Nachfrage per Schalter steuerbar |
| **PWA** | installierbare App-Version mit Startbildschirm-Symbol, Offlinegrundlage, Teilen-Funktion des Betriebssystems | live |

## 6. Zielgruppen

**Private Nutzer**
- Menschen mit Bezug zu Dialekt, Region und lokaler Sprachkultur
- Mehrsprachige Nutzer, Migrations- und Auslandscommunities, die zwischen zwei Sprachwelten leben
- Jüngere Zielgruppen, die Sprache, Slang und Sprachnachrichten ohnehin als Ausdrucksmittel nutzen
- Sprachinteressierte und Lernende, die Alltagssprache statt Lehrbuchsprache suchen

**Creator**
- kleinere Stimmen mit regionalem Bezug, für die Reichweite in großen Netzwerken schwer erreichbar ist

**Gewerbliche Nutzer**
- lokale Unternehmen (Gastronomie, Handel, Handwerk, Dienstleistung) mit regionalem Werbeinteresse
- Veranstalter, Tourismus und Regionalmarketing
- Verkäufer auf dem Marktplatz, vom Privatverkauf bis zum kleinen gewerblichen Shop

## 7. Geschäftsmodell

**Bereits technisch vorhanden und nutzbar**
- Werbekampagnen für Unternehmen: Onboarding, Tarifstufen, Kampagnenverwaltung, Limits, Ausspielung im Feed
- Marktplatzgebühren: Gebührenmodell und Zahlungsabwicklung inkl. geprüfter Webhook-Verarbeitung sind implementiert
- Creator-Abonnements: Preise und Abonnements sind angelegt, exklusive Inhalte technisch abgebildet
- Bezahlte Marktplatz-Hervorhebungen (Promotions)

**Technisch vorhanden, aktuell schaltbar deaktiviert**
- externe Werbenachfrage über ein Anzeigennetzwerk mit Einwilligungsprüfung

**Zukünftig vorgesehen**
- gestaffelte Unternehmensangebote mit Auswertung und Reporting
- regionale Kampagnenformate in Verbindung mit SlangTag-QR-Codes offline
- wachstumsabhängige Erweiterungen des Marktplatzgeschäfts

Ehrlich benannt: Es gibt bislang keine belastbaren Umsatzzahlen. Die Einnahmewege sind gebaut, aber noch nicht in nennenswertem Umfang vermarktet.

## 8. Innovations- und Entwicklungspotenzial

Y-Dude ist keine Website mit Social-Media-Optik, sondern eine eigenständige Plattform mit eigenem Datenmodell und eigener Produktlogik. Die eigentliche Entwicklungsleistung liegt in Bereichen, die man auf den ersten Blick nicht sieht:

- **Eigenes Inhaltsformat:** Audio, das räumlich an Bildinhalte gebunden ist, inklusive Rechte-, Freigabe- und Wiederverwendungsmodell.
- **Ein gemeinsamer Signal- und Interessenlayer:** Aus dem Nutzerverhalten entsteht ein Interessenprofil, das Feed-Reihenfolge, Marktplatzrelevanz und Kampagnenzuordnung zugleich speist.
- **Eigene Relevanzlogik statt Standardsortierung:** mehrere Faktoren (Interessen, Region, Beziehung, Qualität, Aktualität, Neulingsförderung, Spam-Abzug) plus eine Vielfaltsregel, damit nicht immer dieselben Autoren dominieren.
- **Eigene Werbelogik:** Die Plattform entscheidet, *wo* Werbung erscheint; die Anzeigenquelle liefert nur, *was* erscheint. Dadurch ist die Umgebung austauschbar, ohne das Nutzererlebnis umzubauen.
- **Sicherheit als Architektur:** Zugriffsrechte liegen in der Datenbank, nicht in der Oberfläche; Beiträge können ausschließlich über die serverseitige Moderationsprüfung veröffentlicht werden.
- **Technische Sonderlösungen aufgrund der Betriebsumgebung:** eigene Bild- und Videoverarbeitung, weil im gewählten schlanken Serverbetrieb klassische Medienwerkzeuge nicht verfügbar sind.

Offene Forschungs- und Entwicklungsfragen – und damit das eigentliche Zukunftspotenzial – sind: lernende Relevanzsteuerung, datenschutzkonforme Wirkungsmessung vom QR-Code bis zum Kauf, messbare Qualität der KI-Moderation und belastbares Verhalten bei starkem Wachstum.

## 9. Eigenleistung

Bereits erbracht, vollständig in Eigenentwicklung:

- **Produktkonzept und Produktlogik:** Rollenmodell (Community, Creator, Unternehmen, Verwaltung), Zugangsschwellen, Freigabe- und Sichtbarkeitsregeln, Marktplatzregeln
- **Plattformarchitektur:** Aufteilung in öffentlichen und geschützten Bereich, serverseitige Funktionslogik, getrennte Test- und Produktivumgebung
- **Datenmodell:** über 120 Tabellen mit Auswertungen, Zählern, Automatismen und mehreren hundert Zugriffsregeln, in mehr als 200 kontrollierten Änderungsschritten gewachsen
- **Sicherheitskonzept:** Zeilensicherheit auf allen Tabellen, rollenbasierte Rechte, eigene Rollentabelle, gehärtete Datenbankfunktionen, wiederkehrende Sicherheitsprüfungen
- **Messenger:** Konversationen, Mitgliedsprüfung in der Datenbank, Echtzeitkanäle mit nutzerbezogener Abschottung, Marktplatz-Chats
- **Marktplatz:** vollständiger Ablauf von Einstellung über Angebot und Kauf bis Abschluss, mit Ereignisprotokoll, Zahlungsabgleich, Rückerstattung und Streitfall
- **Übersetzung:** Anbindung an einen KI-Dienst, Speicherung, Kontingentsteuerung, Übersetzung auch von Slang-Definitionen
- **Interaktionen und Feed:** Relevanzsortierung, Vielfaltsregel, Interessenberechnung, Ladeverhalten und Scrollverhalten im Feed
- **Arena-/Spiele-System:** Challenges, Einreichungen, Abstimmungen, Auszeichnungen, Slang-Globe in 3D, Mini-Game
- **Werbesystem:** Platzierungslogik, Kampagnenverwaltung, Zielgruppenbezug, Messung, Testmodus, Werbepausen, Einwilligungssteuerung
- **PWA und Push:** Installierbarkeit, Benachrichtigungen mit Bündelung und Direktsprung
- **Moderation und Rechtsrahmen:** automatische Vorprüfung von Text, Bild und Audio, Meldewesen, Widerspruch, Transparenz, Protokollierung
- **Qualitätssicherung und Betrieb:** automatisierte Testsuite, Datenbank-Sicherheitstests, Browsertests, Freigabeprozess vor jeder Veröffentlichung, Notfall- und Wiederherstellungsunterlagen

## 10. Skalierungspotenzial

- **Betrieb ohne eigenen Serverpark:** Die Anwendung läuft in einer verteilten Ausführungsumgebung; zusätzliche Last führt nicht zu manuellem Serverausbau.
- **Datenbank als tragende Schicht:** Zugriffsrechte, Zähler und Auswertungen liegen zentral, mit Indizes und Zwischenspeicher für die Feed-Sortierung.
- **Fachlich sauber getrennte Bereiche:** Feed, Markt, Messenger und Werbung können unabhängig weiterentwickelt und einzeln entlastet werden.
- **Mehrsprachigkeit bereits angelegt** (Deutsch, Englisch, Griechisch), damit ist internationale Ausweitung kein Umbau.
- **Werbequellen austauschbar**, dadurch skaliert die Vermarktung mit der Reichweite.
- **Belegte Grenze:** Lasttest bisher mit 750 gleichzeitigen Nutzern. Das Verhalten bei deutlich höherem Signalvolumen ist nicht nachgewiesen und ist ein bewusster nächster Arbeitsschritt.

## 11. Aktueller Stand (belegbare Fakten)

- **Live-Status:** Plattform öffentlich erreichbar unter y-dude.com, laufender Produktivbetrieb, getrennte Testumgebung
- **Produktbereiche live:** Feed, SlangTag, Messenger, Market, Kanäle, Profile, Globe, Arena, Mini-Game, Werbesystem, Push, PWA, Moderation, Verwaltungsbereich
- **Technischer Reifegrad:** über 100.000 Zeilen eigener Anwendungscode, mehr als 120 Datenbanktabellen, über 200 kontrollierte Datenbank-Änderungsschritte, Zeilensicherheit auf allen Tabellen
- **Test- und Qualitätssituation:** 660 automatisierte Logiktests, 68 Datenbank-Sicherheitstests, Browsertests für die Kernabläufe, verbindliches Freigabe-Gate mit Typprüfung, Tests und Build vor jeder Veröffentlichung
- **Sicherheitsstand:** wiederkehrende Sicherheitsprüfungen; der zuletzt festgestellte relevante Befund wurde behoben; aktuell keine offenen hohen oder kritischen Abhängigkeitsbefunde
- **Entwicklungsphase:** Stabilisierung und Betriebshärtung eines bereits live laufenden Produkts – nicht Prototyp, aber auch noch nicht in der Vermarktungsphase

## 12. Was soll als Nächstes entwickelt werden?

Priorität eins ist, Vorhandenes zu vervollständigen, nicht Neues zu ergänzen.

1. **Wirkungsmessung und Reporting für Unternehmen** – aus reinen Einblendungs- und Klickzählern eine verständliche Auswertung machen; ohne sie ist Werbung schwer verkäuflich.
2. **Lernende Feed-Relevanz absichern** – Bewertungsrahmen, Vergleichsmessung und Schutz gegen Selbstverstärkung, bevor die Automatik echte Entscheidungen übernimmt.
3. **Qualität der automatischen Moderation messbar machen** – Referenzfälle, Fehlerquoten, Schwellenkalibrierung; das ist auch rechtlich relevant.
4. **Skalierung belegen** – Lasttests deutlich über den bisherigen Rahmen, Entlastung des Sortierpfads.
5. **Messbare Brücke zwischen offline und online** – SlangTag-QR-Codes datenschutzkonform auswertbar machen.
6. **Mobile Erfahrung und PWA abrunden** – Ladezeiten, Medienwiedergabe, Stabilität auf schwächeren Geräten.
7. **Marktplatz- und Unternehmensfunktionen für echte Nutzung abrunden** – Verkäuferwerkzeuge, Abläufe, Klarheit der Kosten.
8. **Ende-zu-Ende-Verschlüsselung im Messenger** – konzeptionell vorgesehen, heute nicht umgesetzt; Voraussetzung für sensiblere Nutzungsszenarien.
9. **Erste Nutzergewinnung und Markteinführung** – begleitet von Messung, nicht auf Verdacht.

## 13. Möglicher Förderbedarf

Aus dem Entwicklungsstand ergeben sich folgende Bereiche, die von einer Förderung profitieren könnten. Es wird keine Aussage darüber getroffen, ob diese Kosten förderfähig sind – das ist Gegenstand der Beratung.

- **Weiterentwicklung der Plattform:** Personalisierung, Wirkungsmessung, Reporting
- **Technische Infrastruktur und Skalierung:** Lasttests, Entlastung des Sortier- und Signalpfads, Betriebsüberwachung
- **Sicherheit und Datenschutz:** Fortführung der Sicherheitsprüfungen, Datenschutzkonzept für Messungen, externe Prüfung
- **Kommunikationstechnologie:** Messenger-Ausbau einschließlich Ende-zu-Ende-Verschlüsselung
- **Übersetzung und Sprachverarbeitung:** Qualität der Übersetzung und Transkription, Kostensteuerung bei steigendem Volumen
- **Mobile/PWA-Optimierung:** Performance und Stabilität auf Endgeräten
- **Markt- und Business-Funktionen:** Verkäufer- und Unternehmenswerkzeuge, Auswertungen
- **Entwicklung und Qualitätssicherung:** Ausbau der Tests, externe Unterstützung, Dokumentation
- **Nutzergewinnung und Markteinführung:** erste Reichweitenmaßnahmen mit messbarer Auswertung

## 14. Warum jetzt?

Y-Dude ist über die Ideenphase deutlich hinaus. Die Plattform ist gebaut, läuft live, hat ein durchdachtes Rechte- und Sicherheitskonzept und ein funktionierendes Qualitätsverfahren. Die Entwicklung wurde bislang in Eigenleistung erbracht.

Der Punkt, an dem das Projekt jetzt steht, ist genau der Übergang von „technisch fertig" zu „wirtschaftlich tragfähig": Personalisierung muss belastbar werden, Werbewirkung muss nachweisbar sein, Skalierung muss bewiesen werden, und es braucht erste Nutzer in relevanter Zahl. Diese Schritte sind aufwendiger als das Bauen der Funktionen selbst und lassen sich mit reiner Eigenleistung nur langsam umsetzen. Eine Förderung würde genau diesen Engpass adressieren – auf einem bereits vorhandenen, nicht auf einem geplanten Produkt.

## 15. 60-Sekunden-Pitch

„Y-Dude ist ein soziales Netzwerk für Sprache – für Dialekt, Slang und regionale Stimmen. Bei uns kann man kurze Sprachaufnahmen direkt an eine Stelle im Bild oder Video heften. Wir nennen das SlangTags. Dazu kommen ein Messenger mit Übersetzung, ein Marktplatz, Kanäle und Wettbewerbsformate.

Die Plattform ist keine Idee auf Papier, sondern läuft live. Feed, SlangTags, Messenger, Marktplatz, Werbesystem, Moderation, App-Installation auf dem Handy – das ist alles vorhanden und funktioniert. Ich habe das bisher komplett selbst entwickelt: die Produktlogik, die Datenbank mit über hundert Tabellen, das Sicherheits- und Rechtekonzept, die Tests und den Veröffentlichungsprozess.

Geld verdienen soll Y-Dude über Werbung für lokale Unternehmen, über Gebühren im Marktplatz und über Creator-Abos. Die technische Grundlage dafür ist da, vermarktet ist sie noch nicht.

Woran es jetzt hängt: Ich muss die Personalisierung und vor allem die Wirkungsmessung für Werbekunden belastbar machen, die Skalierung nachweisen und die ersten Nutzer gewinnen. Das ist der Punkt, an dem ich Unterstützung suche – nicht um etwas zu starten, sondern um etwas Vorhandenes wirtschaftlich tragfähig zu machen."

## 16. Mögliche Fragen der IHK – mit Antworten

**1. Was unterscheidet Y-Dude von bestehenden Plattformen?**
Gesprochene Sprache ist bei uns ein eigenständiges Format, nicht nur eine Sprachnachricht. SlangTags sind an einer Stelle im Bild verankert, haben eine Erklärung, eine Übersetzung und ein Rechtemodell. Dazu kommt die Verbindung von sozialem Netzwerk, Marktplatz und Werbung auf einer gemeinsamen Datenbasis.

**2. Wer soll Y-Dude nutzen?**
Privat: Menschen mit Bezug zu Dialekt und Region, mehrsprachige Nutzer und Sprachinteressierte. Gewerblich: lokale Unternehmen, Veranstalter, Tourismus sowie Verkäufer im Marktplatz.

**3. Wie soll Geld verdient werden?**
Über Werbekampagnen für Unternehmen, Marktplatzgebühren, bezahlte Hervorhebungen und Creator-Abonnements. Alle vier Wege sind technisch vorhanden. Umsätze in nennenswerter Höhe gibt es bisher nicht.

**4. Warum sollte jemand von einer anderen Plattform wechseln?**
Nicht wegen der Grundfunktionen – die gibt es überall. Sondern weil Sprache, Dialekt und lokale Identität hier den Kern bilden und nicht Beiwerk sind. Realistisch ist zunächst kein Wechsel, sondern eine zusätzliche Nutzung für einen bestimmten Zweck.

**5. Wie groß ist der Markt?**
Belastbare eigene Marktzahlen habe ich nicht und behaupte ich auch nicht. Relevant sind zwei Ebenen: der sehr große Markt sozialer Netzwerke insgesamt und der konkretere Markt für regionale Werbung kleiner Unternehmen. Letzterer ist der realistische Einstieg.

**6. Was ist bereits fertig?**
Feed, SlangTags, Messenger mit Übersetzung, Marktplatz mit Zahlungsabwicklung, Kanäle, Profile, Globe, Arena, Mini-Game, Push, App-Installation, Werbesystem, Moderation und Verwaltungsbereich. Alles live.

**7. Was muss noch entwickelt werden?**
Wirkungsmessung und Reporting für Werbekunden, belastbare Personalisierung, geprüfte Qualität der automatischen Moderation, Nachweis der Skalierung, Ende-zu-Ende-Verschlüsselung im Messenger, mobile Feinarbeit.

**8. Was wurde bisher selbst finanziert und entwickelt?**
Die gesamte Plattform. Über 100.000 Zeilen eigener Code, über 120 Datenbanktabellen, das Sicherheitskonzept, die Tests, der Betrieb. Fremdkosten bestehen bislang im Wesentlichen aus laufenden Betriebs- und Dienstkosten.

**9. Wofür genau würde Förderung benötigt?**
Für Entwicklungsarbeit in den genannten Bereichen, für Skalierungs- und Sicherheitsnachweise, für Qualitätssicherung und für eine erste, messbar begleitete Markteinführung.

**10. Was passiert ohne Förderung?**
Das Projekt läuft weiter, aber deutlich langsamer und im Wesentlichen als Eigenleistung. Die wirtschaftlich entscheidenden Schritte – Wirkungsmessung, Skalierung, Nutzergewinnung – würden sich erheblich verzögern.

**11. Wie sollen Nutzer gewonnen werden?**
Über regionale Ankerpunkte: einzelne Regionen und Sprachcommunities gezielt ansprechen, Creator mit lokalem Bezug einbinden, SlangTag-QR-Codes als Brücke von offline nach online nutzen. Wichtig ist, das messbar zu machen statt breit zu streuen.

**12. Wie kann das Projekt wirtschaftlich werden?**
Erst Reichweite in wenigen Regionen, dann lokale Werbekunden, parallel der Marktplatz mit Gebühren. Der Marktplatz kann früher Erlöse bringen als Werbung, weil er nicht von großer Reichweite abhängt.

**13. Wie steht es um Datenschutz und Rechtssicherheit?**
Zugriffsrechte werden in der Datenbank durchgesetzt, alle Tabellen sind geschützt. Es gibt Moderation mit Meldewesen und Widerspruchsverfahren, eine Transparenzseite, Datenauskunft und Kontolöschung. Die Messung von Werbewirkung soll bewusst datensparsam entwickelt werden.

**14. Ist das Ganze von einer Person abhängig?**
Aktuell ja – das ist ein reales Risiko. Gegengesteuert wird über Dokumentation, automatisierte Tests, einen festen Freigabeprozess und Notfallunterlagen. Personelle Verstärkung ist einer der Gründe für den Förderbedarf.

**15. Wie hoch sind die laufenden Kosten?**
Sie bestehen aus Betriebskosten der Plattform, Kosten für Übersetzung und automatische Prüfung sowie Domain- und Dienstkosten. Die Kosten für Übersetzung und Prüfung wachsen mit der Nutzung – deshalb ist die Kostensteuerung bereits eingebaut.

**16. Gibt es Wettbewerber?**
Die großen sozialen Netzwerke sind der allgemeine Wettbewerb, zusätzlich Sprachlern- und Marktplatz-Apps in Teilbereichen. Eine Plattform, die verankertes Kurz-Audio, Slang-Erklärung, Übersetzung und regionalen Marktplatz kombiniert, ist mir nicht bekannt.

## 17. Kurzfassung auf einer Seite

**Problem** – Dialekt, Akzent und lokale Ausdrucksweise gehen in textlastigen Netzwerken verloren; gleichzeitig ist gesprochene Sprache die größte Hürde zwischen Regionen und Ländern.

**Lösung** – Y-Dude, ein soziales Netzwerk für Sprache: kurze Sprachaufnahmen, die direkt im Bild oder Video verankert, erklärt und übersetzt werden, ergänzt um Messenger, Marktplatz, Kanäle und Wettbewerbsformate.

**Innovation** – eigenes Audioformat mit Rechte- und Freigabemodell, gemeinsames Interessen- und Signalmodell für Feed, Markt und Werbung, eigene Relevanz- und Vielfaltslogik, Sicherheitskonzept direkt in der Datenbank, eigenes Werbesystem mit austauschbarer Anzeigenquelle.

**Zielgruppe** – sprach- und regionsaffine Privatnutzer, mehrsprachige Communities, Creator mit lokalem Bezug; gewerblich: lokale Unternehmen, Veranstalter, Marktplatzverkäufer.

**Geschäftsmodell** – Werbekampagnen, Marktplatzgebühren, bezahlte Hervorhebungen, Creator-Abos. Technisch vorhanden, noch nicht vermarktet.

**Entwicklungsstand** – live unter y-dude.com; Feed, SlangTags, Messenger, Markt, Globe, Arena, Werbesystem, Push, PWA, Moderation und Verwaltung im Betrieb; 660 Logiktests und 68 Datenbank-Sicherheitstests, verbindliches Freigabeverfahren.

**Eigenleistung** – vollständige Eigenentwicklung: Produktlogik, Architektur, Datenmodell mit über 120 Tabellen, Sicherheits- und Rollenkonzept, Messenger, Marktplatz, Übersetzung, Werbesystem, Spiele-/Arena-System, PWA, Tests und Betrieb.

**Förderbedarf (möglich)** – Weiterentwicklung von Personalisierung und Wirkungsmessung, Skalierung und Infrastruktur, Sicherheit und Verschlüsselung, Übersetzungsqualität, mobile Optimierung, Business-Funktionen, Qualitätssicherung, erste Markteinführung.

**Nächste Schritte** – Reporting für Werbekunden, abgesicherte Personalisierung, messbare Moderationsqualität, Skalierungsnachweis, Ende-zu-Ende-Verschlüsselung, gezielte regionale Nutzergewinnung.
