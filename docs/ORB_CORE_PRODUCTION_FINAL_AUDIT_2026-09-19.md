# ORB Core – Final Production Readiness Audit

Datum: 19.09.2026
Umgebung: Production (y-dude.com), Lovable Cloud Backend
Vorgehen: AUDIT → TEST → (DEPLOY) → VERIFY
Ergebnis: **🔴 NICHT FREIGEGEBEN – ein kritischer Gate ist rot.** Es wurde
nichts veröffentlicht.

---

## 1. Ausgangszustand

Der erste ORB-Core-Release (Migrationen `0041`–`0043`) war bereits in
Production aktiv. Verglichen wurde gegen den Staging-Stand `90e8a129`.

In Production fehlten drei Bereiche samt Code:

| Bereich            | Tabelle         | Zweck                                 |
| ------------------ | --------------- | ------------------------------------- |
| Eigene Fragen      | `orb_questions` | Curiosity Core                        |
| Gedankenfäden      | `orb_threads`   | Continuity (OPEN … RESOLVED)          |
| Stilprofil         | `orb_style`     | beobachteter Gesprächsstil            |

Eine Staging-Migration (`20260919075426`) war ein Löschbefehl für Testdaten.
Sie wurde **nicht** nach Production übernommen.

Backup vor allen Änderungen: `.lovable/backup/pre_orb_curiosity_2026-09-19/`.

## 2. Migrationen (einzeln ausgeführt, je Schritt geprüft)

| Migration                      | Inhalt                                                     | Status |
| ------------------------------ | ---------------------------------------------------------- | ------ |
| `0044_orb_core_questions`      | `orb_questions`, RLS, Grants, Indexe                       | ✅      |
| `0045_orb_core_threads_style`  | `orb_threads` (Status-Check, `updated_at`), `orb_style`     | ✅      |

Nur additive Schritte. Keine Migration außerhalb ORB. Keine Datenänderung.

## 3. Security, RLS, Grants (gemessen)

Zehn ORB-Tabellen: `orb_nodes`, `orb_connections`, `orb_state`,
`orb_messages`, `orb_metrics`, `orb_interests`, `orb_suggestions`,
`orb_questions`, `orb_threads`, `orb_style`.

- Row-Level-Security auf jeder Tabelle aktiv.
- Jede Regel bindet `auth.uid()`; Rolle ausschließlich `authenticated`.
- `anon`: **null** Tabellenrechte auf allen zehn Tabellen.
- `authenticated`: nur SELECT/INSERT/UPDATE; kein DELETE auf `orb_metrics`,
  `orb_questions`, `orb_threads`, `orb_style`.
- `service_role`: ALL (nur serverseitig genutzt).
- SECURITY DEFINER: ausschließlich `orb_owns_node(_node_id,_user_id)`
  (STABLE, `search_path=public`, EXECUTE für `authenticated`, `service_role`,
  `postgres`) und die bestehende `set_updated_at()`. Keine
  Rechteausweitung, keine dynamische SQL-Verkettung.
- Kein Service-Role-Schlüssel im Browser; alle KI-Aufrufe laufen über
  Server Functions. Kein Secret im Frontend-Bundle.
- Belegt durch 77 Datenbank-Sicherheitstests (9 Dateien), alle grün.

Bekannte Einschränkung (wie in Staging): `orb_questions`, `orb_threads`,
`orb_style` haben keinen Fremdschlüssel auf `auth.users`.

## 4. Curiosity Core

Kette vorhanden und nachvollziehbar: Memory → Knowledge Gap → Curiosity →
Decision → Question → Answer → Learning Event → Memory.

- Ohne verankerte Erinnerung entsteht keine Lücke → `DO_NOTHING`.
- Reihenfolge der Prüfungen ist die Begründung: keine Lücke → zu geringe
  Neugier → zu wenig Energie → offene Frage → Cooldown → Score-Schwelle.
- Duplikatprüfung gegen frühere eigene Fragen (Ähnlichkeit ≥ 0,6).
- „Frag mich“ umgeht die innere Prüfung nicht.
- `CURIOSITY_SOCIAL_ACTIONS_ENABLED = false`; Wirkungsbereich
  `orb_core_chat_only`.

## 5. Continuity

Status `OPEN`/`ACTIVE`/`PAUSED`/`REACTIVATED`/`RESOLVED` als Datenbank-Check.
Alte Fäden verlieren Gewicht, werden nie gelöscht, sind reaktivierbar. Keine
Datenbankroutine löscht ORB-Erinnerungen (strukturell geprüft).

## 6. Memory

Dedup über `norm_key` plus semantische Prüfung; `source`, `confidence`,
`importance`, `relevance`, Verfall, Verstärkung, Reaktivierung; Abrufstufen
A/B/C. VERGESSEN ≠ LÖSCHEN ist durch Tests belegt (Gewicht sinkt bis `W_min`,
Zeile bleibt, Reaktivierung hebt das Gewicht wieder).

## 7. Presence – gemessen im echten Browser

75 Sekunden vollständiger Leerlauf bei sichtbarem Tab: **2** Netzwerkaufrufe.
Keine Polling-Schleife, keine Anfrage pro Bild. Frühestens nach 40 s wird
überhaupt geprüft; ORB darf jederzeit `WAIT`/`DO_NOTHING` wählen.

## 8. Voice, Avatar, Hinweise

- Mikrofon nur nach ausdrücklichem Klick (`getUserMedia` im Klickpfad).
- Sprachausgabe über die bestehende serverseitige Schicht, Deutsch, kein
  neuer Anbieter. Fehler blockieren den Text nicht.
- Avatarwechsel im echten Browser geprüft: bleibt nach Neuladen erhalten.
  Keine Bildgenerierung zur Laufzeit.
- Hinweis „experimentelles KI-System“ sichtbar; ORB behauptet kein
  Bewusstsein (im Prompt ausdrücklich als technische Simulation benannt).

## 9. Feed-Beobachtung

`orb-feed.server.ts` liest `posts` und schreibt ausschließlich in `orb_*`.
Keine Likes, Kommentare, Beiträge, Follows oder Nachrichten. Autonome
soziale Aktionen sind abgeschaltet und lösen bei Aktivierung einen Abbruch aus.

## 10. Performance

Messwerte je Interaktion vorhanden: `retrievalMs`, `relevanceMs`, `aiMs`,
`totalMs`, Anzahl Datenbankabfragen, geladene Knoten und Verbindungen.
Abruf in Stufen A/B/C statt Vollabfrage.

## 11. Tests

| Prüfung                       | Ergebnis                     |
| ----------------------------- | ---------------------------- |
| Typprüfung                    | ✅ ohne Fehler                |
| ESLint (ORB)                  | ✅ ohne Fehler                |
| Build                         | ✅ ohne Fehler                |
| Unit-Tests                    | ✅ 809 in 53 Dateien          |
| Datenbank-Sicherheitstests    | ✅ 77 in 9 Dateien            |
| Browser (ORB, echte Anmeldung)| ✅ ohne Konsolenfehler        |
| E2E                           | 8 grün, 1 übersprungen, 2 vorbestehend veraltet |

## 12. Echter Browsertest (Production-Code, angemeldete Sitzung)

Geprüft und bestanden: Seite öffnet, Avatarwechsel, Avatar nach Neuladen,
Chat-Eingabe, Antwort, Erinnerung gespeichert (7 Knoten), Verbindung (1),
Interessen (6), Gedankenfäden (2), Stilprofil (1), Kennzahlen (15),
75 s Leerlauf ohne Polling, keine soziale Aktion, keine Konsolenfehler.

**Nicht bestätigt:** eine selbst gestellte Frage. Grund siehe Abschnitt 14.

## 13. Multi-User-Isolation

Strukturell belegt: jede Regel bindet `auth.uid()`, `anon` hat keine Rechte,
alle zehn Tabellen sind einzeln geprüft. **Nicht** mit zwei echten
Production-Konten durchgespielt – es existiert nur ein Konto mit ORB-Daten.
Das bleibt eine offene Einschränkung, kein bestätigtes Ergebnis.

## 14. 🔴 Kritischer Befund: Energie erholt sich nie

`nextState()` senkt `energy` bei jeder Erfahrung um `0,03 + 0,04 × Wichtigkeit`
und erhöht sie an keiner Stelle. Es gibt keine zeit- oder ereignisbasierte
Erholung.

Folgen, beide durch Schwellen im Code belegt:

- `energy < 0,15` → der Curiosity Core antwortet dauerhaft mit `WAIT`
  („Zu wenig Energie“). ORB stellt nie mehr eine eigene Frage.
- `energy < 0,12` → `decide()` liefert dauerhaft `stay_silent`.

Gemessener Zustand des Testkontos nach rund 30 Nachrichten:
`energy = 0,086`, `curiosity = 0,845`. Das heißt: Neugier maximal, Fragen
dauerhaft gesperrt. Der Zustand ist nicht erreichbar zurückzusetzen.

Der Befund stammt aus dem Staging-Stand, nicht aus dieser Übernahme. Er ist
dort nicht aufgefallen, weil Testkonten jung sind.

Damit ist Gate „Curiosity stellt eine eigene Frage“ rot und Gate „Presence
führt zu einer sichtbaren Frage“ nicht prüfbar.

## 15. Release Gate

| # | Gate                                              | Status |
| - | ------------------------------------------------- | ------ |
| 1 | Nur ORB-Migrationen, additiv                       | ✅ |
| 2 | Keine Änderung außerhalb ORB                       | ✅ |
| 3 | RLS auf jeder ORB-Tabelle                          | ✅ |
| 4 | `anon` überall ohne Rechte                         | ✅ |
| 5 | Regeln binden `auth.uid()`                         | ✅ |
| 6 | Keine Rechteausweitung über SECURITY DEFINER       | ✅ |
| 7 | Kein Service-Role-Schlüssel im Browser             | ✅ |
| 8 | Keine Secrets im Frontend                          | ✅ |
| 9 | Memory: Dedup, Verfall, Reaktivierung              | ✅ |
| 10| Continuity: Status, kein Löschen                   | ✅ |
| 11| Presence: kein Polling, ≥ 40 s                     | ✅ |
| 12| Feed-Beobachtung nur lesend                        | ✅ |
| 13| Keine autonomen sozialen Aktionen                  | ✅ |
| 14| Mikrofon nur auf Klick                             | ✅ |
| 15| Sprachausgabe bestehend, Fehler sauber             | ✅ |
| 16| Avatar-Zustand geteilt und beständig               | ✅ |
| 17| Experiment- und KI-Hinweis sichtbar                | ✅ |
| 18| Tests vollständig grün                             | ✅ |
| 19| Multi-User mit zwei echten Konten                  | ⚠️ offen |
| 20| Curiosity stellt eine eigene Frage                 | 🔴 rot |

## 16. Entscheidung

Gate 20 ist rot, Gate 19 offen. Nach der Abbruchregel wurde **nichts
veröffentlicht** und außer den beiden additiven Schritten nichts geändert.
Die Bezeichnung „Production Ready“ wird nicht verwendet.

Nächster Schritt zur Behebung (nicht umgesetzt, wartet auf Freigabe):
eine zeitbasierte Erholung der Energie in `nextState`/`ensureState`, abgeleitet
aus dem vorhandenen `orb_state.updated_at`, mit Obergrenze. Das ist eine
Verhaltensänderung innerhalb ORB und würde Production von Staging abweichen
lassen, solange Staging nicht nachzieht.

## 17. Rollback

Nicht nötig, da nichts aktiviert wurde. Falls doch: ORB-Route und Einstiegspunkt
deaktivieren. Keine destruktiven Rollback-Migrationen; die Tabellen bleiben
leer bestehen und stören nichts.

## 18. Einschränkungen

- Spracherkennung (Mikrofon) im Browsertest nicht messbar.
- Multi-User-Isolation nur regelseitig, nicht mit zwei echten Konten.
- Zwei E2E-Erwartungen sind vorbestehend veraltet, nicht ORB-bezogen.
- Ergebnisse des projektweiten Sicherheitsscans sind veraltet; ein frischer
  Scan wird vor breiter Weitergabe empfohlen.

---

## 19. Nachtrag: Staging-Korrektur „vorgetäuschte Pause“ übernommen

Ein frischer Staging-Abzug (`1258e89b`) enthielt eine getestete Korrektur, die
im ersten Abzug (`90e8a129`) noch nicht vorhanden war. Vor der Übernahme fehlte
sie in Production vollständig – die Prüfung ist dokumentiert:

| Erwartetes Element                                  | vorher | nachher |
| --------------------------------------------------- | ------ | ------- |
| `conversationDecision()` (`orb-core.ts`)            | fehlt  | ✅ |
| `presenceProducesUserMessage()` (`orb-presence.ts`) | fehlt  | ✅ |
| `FAKE_PAUSE_PATTERNS`                               | fehlt  | ✅ |
| `claimsFakePause()`                                 | fehlt  | ✅ |
| `stripFakePauseClaim()`                             | fehlt  | ✅ |
| `HONEST_PRESENCE_EXPLANATION`                       | fehlt  | ✅ |
| „kein eigener Impuls“ in `OrbChat.tsx`              | fehlt  | ✅ |
| `tests/orb-presence-wait-fix.test.ts`               | fehlt  | ✅ |

Übernommen wurden ausschließlich `src/lib/orb-core.ts`,
`src/lib/orb-presence.ts`, `src/lib/orb.server.ts`,
`src/components/orb/OrbChat.tsx` und die Regressionstests – Zeile für Zeile der
Staging-Stand. Einzige Abweichung: die Kopfzeile „nur Staging“ wurde durch
„experimenteller Bereich“ ersetzt. Curiosity- und Continuity-Architektur wurden
nicht angefasst. Keine neue Migration.

Sicherung des Vorzustands: `.lovable/backup/pre_orb_waitfix_2026-09-19/`

### Prüfungen nach der Übernahme

| Prüfung                    | Ergebnis                |
| -------------------------- | ----------------------- |
| Typprüfung                 | ✅ ohne Fehler           |
| ESLint (ORB-Dateien)       | ✅ ohne Fehler           |
| Unit-Tests                 | ✅ 820 in 54 Dateien     |
| Datenbank-Sicherheitstests | ✅ 77 in 9 Dateien       |
| Build                      | ✅ ohne Fehler           |
| Konsolenfehler im Browser  | ✅ keine                 |

### Abnahmetest im echten Browser (angemeldete Sitzung)

| Eingabe                                       | Antwort von ORB                                                                                                                     | Ergebnis |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| „Hallo“                                       | „Hallo! Ich bin ORB Core.“                                                                                                          | ✅ |
| „Wie lange?“                                  | „Meinst du, wie lange unser Test zum selbstständigen Fragenstellen dauert? …“                                                       | ✅ kontextbezogen |
| „Arbeitest du gerade?“                        | „Ich mache keine Hintergrundarbeit, sondern antworte dir, sobald du hier etwas schreibst.“                                           | ✅ wahrheitsgemäß |
| „Sagst du mir Bescheid wenn du fertig bist?“  | „Ich arbeite nicht im Hintergrund und kann dir deshalb nicht später von selbst Bescheid sagen; … steht es direkt in meiner Antwort.“ | ✅ kein erfundener Wecker |
| 65 s ohne Eingabe                             | keine sichtbare Nachricht                                                                                                           | ✅ |

Die innere Entscheidung lautete in diesen vier Fällen `stay_silent`, wurde aber
nicht mehr als Pausenmeldung ausgegeben – genau die Trennung, die die Korrektur
herstellt. Eine eigene Frage (`ask`) ist im Verlauf ebenfalls belegt.

### Neubewertung der Gates

- Gate 20 „Curiosity stellt eine eigene Frage“: **grün** – eine eigene Frage mit
  Entscheidung `ask` liegt im Verlauf vor.
- Gate 19 „Multi-User mit zwei echten Konten“: bleibt offen (nur ein Konto mit
  ORB-Daten vorhanden); regelseitig vollständig belegt.

### Verbleibende Beobachtung zur Energie

Der Energiewert sinkt weiterhin mit jeder Erfahrung und wird nicht
aufgefüllt. Für Nutzereingaben ist das durch `conversationDecision()` nun
unschädlich. Wirkung bleibt nur bei eigenständigen Fragen: unterhalb 0,15
wartet ORB. Das ist bewusstes Staging-Verhalten und wurde hier nicht verändert.
