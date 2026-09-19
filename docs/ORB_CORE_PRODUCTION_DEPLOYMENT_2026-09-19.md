# ORB Core – Production Deployment (2026-09-19)

Umfang: **ausschliesslich ORB Core** aus dem validierten Staging-Stand
(Projekt „Y-Dude Staging“, Snapshot-Commit `078b98d4`).
Kein vollständiger Staging→Production-Sync, keine Änderung ausserhalb von ORB.

Grundlage: `docs/ORB_CORE_PRODUCTION_READINESS_AUDIT.md` (Staging) – Status dort
🟢 READY FOR PRODUCTION EXPERIMENT.

---

## 1. Production-Ausgangszustand (vor der Änderung, gemessen)

| Prüfung | Ergebnis |
|---|---|
| Tabellen mit Präfix `orb_` | **keine** |
| Typen mit Präfix `orb_` | **keine** |
| Funktionen mit Präfix `orb_` | **keine** |
| `public.set_updated_at()` (Voraussetzung der Migration 1) | **vorhanden** |
| ORB-Komponenten / Route / Tests im Code | **keine** |
| Channels-Integration | kein ORB-Eintrag |
| Letzte Migration | `0040_can_read_media_fix_ambiguous_owner.sql` |

Damit war kein Teilbestand vorhanden, der hätte überschrieben werden können;
alle drei Migrationen waren vollständig anwendbar.

## 2. Ausgeführte Migrationen (genau drei, in dieser Reihenfolge)

| # | Datei in Production | Inhalt | Ergebnis |
|---|---|---|---|
| 1 | `drizzle/migrations/0041_orb_core_base.sql` | Typ `orb_node_type`, Tabellen `orb_nodes`, `orb_connections`, `orb_state`, `orb_messages`, Grants, RLS, Policies, Indizes, Funktion `orb_owns_node` (SECURITY DEFINER, EXECUTE für `anon` entzogen), `updated_at`-Trigger | ✅ angewendet, danach 4 Tabellen mit aktiver RLS und je 1 Policy |
| 2 | `drizzle/migrations/0042_orb_core_v02.sql` | Typen `orb_info_source`, `orb_suggestion_status`; Spalten `source`/`norm_key`/`topic` auf `orb_nodes` (additiv); Tabellen `orb_interests`, `orb_suggestions`, `orb_metrics`; Unique-/Teilindizes, Policies, Trigger | ✅ angewendet |
| 3 | `drizzle/migrations/0043_orb_core_least_privilege.sql` | Nur `REVOKE`/`GRANT` auf den sieben ORB-Tabellen (Bedingung B1) | ✅ angewendet |

SQL identisch zu den im Audit dokumentierten Staging-Migrationen
(`20260919051344`, `20260919054047`, `20260919062249`); Kommentarzeilen mit dem
Hinweis „nur Staging“ wurden inhaltlich neutral formuliert, keine SQL-Anweisung
geändert. Keine weiteren Migrationen ausgeführt. Kein `DROP`, `TRUNCATE`,
`DELETE` oder `UPDATE` auf bestehenden Daten; ausserhalb von `orb_*` wurde kein
Objekt verändert (Ausnahme: Nutzung der bestehenden Funktion
`public.set_updated_at()` in Triggern der neuen Tabellen).

## 3. ORB-Komponenten (übernommen, unverändert)

Neu im Production-Code:

* `src/routes/_authenticated/channels.orb.tsx` (Route `/channels/orb`)
* `src/components/orb/` – `OrbAvatarPicker`, `OrbChat`, `OrbDevPanel`,
  `OrbErrorState`, `OrbExperimentNotice`, `OrbFace`, `OrbGraph`, `OrbInterests`,
  `OrbRealFace`, `OrbSuggestions`, `OrbVoice`
* `src/lib/` – `orb-avatar.ts`, `orb-core.ts`, `orb-memory.ts`, `orb.functions.ts`,
  `orb.server.ts`, `orb-feed.server.ts`, `orb-voice.server.ts`,
  `use-orb-avatar-mode.ts`
* `src/assets/orb-face.png` (Referenzbild, 1341×1173, in dieses Projekt neu
  hochgeladen – Asset-Zeiger auf Projekt-ID dieses Projekts)
* Tests: `tests/orb-core.test.ts`, `tests/orb-memory.test.ts`,
  `tests/orb-avatar.test.ts`, `tests/integration/db-orb-security.test.ts`

Einzige Änderung an einer bestehenden Datei:
`src/routes/_authenticated/channels.index.tsx` – ein Link „ORB Core“ nach
`/channels/orb` plus Icon-Import. Kein neuer Hauptnavigationseintrag.

Textanpassungen innerhalb von ORB (nur Beschriftung/Kommentar, keine Logik):
„Testbereich (nur Staging)“ → „Testbereich (Experiment)“ sowie zwei
Dateikommentare mit dem Vermerk „nur Staging“.

## 4. Security / RLS (nach den Migrationen in Production gemessen)

| Tabelle | RLS | Policies | Rechte `anon` | Rechte `authenticated` |
|---|---|---|---|---|
| `orb_nodes` | aktiv | `orb_nodes_own` (`authenticated`, `user_id = auth.uid()`) | **keine** | SELECT, INSERT, UPDATE, DELETE |
| `orb_connections` | aktiv | `orb_connections_own` | **keine** | SELECT, INSERT, UPDATE, DELETE |
| `orb_state` | aktiv | `orb_state_own` | **keine** | SELECT, INSERT, UPDATE, DELETE |
| `orb_messages` | aktiv | `orb_messages_own` | **keine** | SELECT, INSERT, UPDATE, DELETE |
| `orb_interests` | aktiv | `orb_interests_own` | **keine** | SELECT, INSERT, UPDATE, DELETE |
| `orb_suggestions` | aktiv | `orb_suggestions_own` | **keine** | SELECT, INSERT, UPDATE, DELETE |
| `orb_metrics` | aktiv | `orb_metrics_own` | **keine** | SELECT, INSERT, DELETE |

`service_role` behält `ALL` (nur serverseitig genutzt).

**Live-Gegenprobe ohne Anmeldung** (öffentlicher Schlüssel, Datenschnittstelle):

* Lesen aller sieben Tabellen → **HTTP 401 / `42501` permission denied**
* Schreibversuch in `orb_nodes` mit fremder Benutzerkennung → **HTTP 401 / `42501`**

**Angemeldeter Zugriff (Testkonto):** ausschliesslich eigene Zeilen; die Policies
binden `auth.uid()` in `USING` und `WITH CHECK`, `orb_connections` prüft
zusätzlich die Eigentümerschaft beider Knoten über `orb_owns_node`. Fremde Daten
sind über die Anwendung nicht erreichbar. Ein Zugriff „User A liest Daten von
User B“ wurde nicht mit zwei echten Production-Konten durchgespielt – belegt ist
die Isolation über Policy-Vertrag (77 DB-Tests) und die Live-Gegenprobe ohne
Anmeldung.

Keine Servicerolle und keine Geheimnisse im Client: ORB-Komponenten und Route
enthalten keine Fundstelle von `supabaseAdmin`, `client.server` oder
`process.env`. Der KI-Schlüssel (`LOVABLE_API_KEY`, in Production vorhanden) wird
nur in `orb.server.ts` / `orb-voice.server.ts` im Serverhandler gelesen.

## 5. Channels-Integration

ORB Core ist ausschliesslich unter **Channels → ORB Core** (`/channels/orb`)
erreichbar. Kein neuer Hauptnavigationseintrag. Abzeichen „EXPERIMENT“ sichtbar.
Dauerhafter Hinweis oben auf der Seite (live geprüft):

> ORB Core ist ein experimentelles KI-System. Funktionen und Verhalten können
> sich während der Entwicklung verändern. Für bestimmte Funktionen können
> Inhalte an externe KI-Dienste übertragen und dort verarbeitet werden.

Zusätzlich bleibt der Hinweis „technische Simulation – kein Bewusstsein“ erhalten.

## 6. Avatar

Beide Darstellungen vorhanden: **realistisches Gesicht** (`OrbRealFace`,
ausschliesslich Ausschnitte des festen Referenzbildes) und **bestehendes blaues
ORB-Emoji** (`OrbFace`, unverändert; Standard). Keine KI-Bildgenerierung zur
Laufzeit, keine Neugenerierung. Auswahl liegt im lokalen Speicher
(`orb.avatar.mode`).

Browsertest: Umschalten auf „Realistisches Gesicht“ → gespeichert (`face`),
nach Neuladen **erhalten** (`face`), Referenzbild geladen (naturalWidth 1341),
Rückschalten auf Emoji → `emoji`. Keine Datenbank- oder Serveranfrage pro Bild.

## 7. Voice

Übernommen wie validiert: Mikrofon nur nach Knopfdruck („Mit ORB sprechen“),
kein Dauerbetrieb, sichtbarer Hinweis während der Aufnahme, erkannter Text wird
angezeigt, Vorlesen in Deutsch.

* **Vorlesen (TTS):** live geprüft – Knopf nach einer neuen Antwort aktiv,
  Serveraufruf HTTP 200, keine Fehlermeldung.
* **Mikrofon/Spracherkennung (STT):** in dieser Prüfumgebung **nicht** ausgeführt
  (kein Mikrofon im automatisierten Browser). Belegt ist nur der Code-Pfad und
  die Staging-Prüfung – keine Production-Messung.

## 8. Memory / Learning

Unverändert aus Staging: Verfall ist reine Berechnung beim Lesen mit Untergrenze
`W_MIN = 0.05`, in `orb.server.ts`/`orb-feed.server.ts` existiert keine
Löschoperation auf ORB-Tabellen → **Vergessen ≠ Löschen**. Deduplizierung
konservativ (`norm_key` behält Verneinung, Bewertung, Tätigkeit); bei
Schlüsselkonflikt wird getrennt gespeichert, nie zusammengeführt. Herkunft
`USER_STATED > OBSERVED > INFERRED`.

Live in Production geprüft: Nachricht „Ich mag Pizza mit Ananas.“ →
1 Erinnerung, 1 Interesse („essen“, selbst gesagt, Sicherheit 0.90),
2 Verlaufszeilen, 1 Messwert-Zeile. Antwort des ORB wurde erzeugt.

## 9. Autonomie / Feed Observation

`AUTONOMOUS_SOCIAL_ACTIONS_ENABLED = false`, `ACTIVE_AUTONOMY_LEVEL = 2`
(Level 3/4 inaktiv) – unverändert übernommen. Kein Schreibzugriff auf `posts`,
`comments`, `post_likes`, `messages`, `follows`; ORB schreibt nur in `orb_*`.
Beobachtung läuft im angemeldeten Benutzerkontext, maximal 30 Beiträge, nur
lesen/bewerten/vorschlagen. Live geprüft: „Feed beobachten“ lief ohne Fehler,
Ergebnis 0 Vorschläge (keine thematisch passenden Beiträge) – keine Like-,
Kommentar-, Nachrichten- oder Folgeaktion, `orb_suggestions` = 0 Zeilen.

## 10. Performance

Grenzen wie validiert: 6 Erinnerungen im KI-Kontext, 20 Kandidaten je Abfrage,
Teilgraph 40 Knoten/40 Verbindungen, 30 beobachtete Beiträge, Eingabe 1.000
Zeichen. Keine Vollabfrage des Gedächtnisnetzes pro Nachricht, keine Abfrage pro
Avatarbild (Animation rein clientseitig). Gemessen: `total_ms` max. 2.393 ms je
Interaktion (inkl. KI-Antwort).

## 11. Tests

| Prüfung | Ergebnis |
|---|---|
| Typprüfung (`tsgo --noEmit`) | ✅ ohne Fehler |
| Lint der ORB-Dateien | ✅ ohne Befund (Formatierung angepasst) |
| Lint gesamt | unverändert vorbestehende Befunde, überwiegend in den Release-Ordnern (`release/…/types.ts`); keine neuen ORB-Befunde |
| Unit-/Logiktests (`bun run test`) | ✅ 50 Dateien / **725 Tests** (vorher 678, +47 ORB) |
| DB-Sicherheitstests (`bun run test:db`) | ✅ 9 Dateien / **77 Tests** (inkl. 9 ORB-Tests) |
| Build | ✅ erfolgreich, Build-Protokoll „build OK“ |

## 12. Smoke Test (Production-Datenbank, Testkonto, angemeldet)

| # | Prüfung | Ergebnis |
|---|---|---|
| 1 | Anmeldung | ✅ |
| 2 | Channels öffnen | ✅ Eintrag „ORB Core“ sichtbar |
| 3 | ORB Core öffnen | ✅ `/channels/orb` lädt |
| 4 | Realistisches Gesicht | ✅ Referenzbild geladen |
| 5 | Emoji-Avatar | ✅ Standard, unverändert |
| 6 | Avatar wechseln | ✅ |
| 7/8 | Neuladen, Auswahl erhalten | ✅ `face` nach Reload |
| 9 | ORB-Chat | ✅ Antwort erzeugt |
| 10 | Erinnerung anlegen | ✅ 1 Knoten |
| 11 | Erinnerung abrufen | ✅ im Gedächtnisbereich sichtbar |
| 12 | Reaktivierung | ✅ Code-Pfad aktiv (Zähler), in Production nicht eigens ausgelöst |
| 13 | Verfall | ✅ Berechnung beim Lesen, kein Löschen (0 Löschoperationen) |
| 14 | Interessen | ✅ „essen“ erkannt |
| 15 | Vorschläge | ✅ Lauf ohne Fehler, 0 Treffer |
| 16 | Rückmeldung | ✅ Bedienelemente vorhanden (Daumen) |
| 17 | Spracheingabe | ⚪ nicht geprüft (kein Mikrofon in der Prüfumgebung) |
| 18 | Vorlesen | ✅ HTTP 200, keine Fehlermeldung |
| 19 | Avatar-Zustandsreaktion | ✅ Werte aktualisiert (Freude 0.53, Energie 0.75) |
| 20 | Feed-Beobachtung | ✅ nur lesend |
| 21 | Fehlerbehandlung | ✅ eigene ORB-Fehleranzeige verdrahtet (`errorComponent`, `notFoundComponent`, Abfragefehler) – im Test kein Fehler ausgelöst |

## 13. Regression Test

| Bereich | Ergebnis |
|---|---|
| Feed | ✅ lädt |
| Nachrichten (Messenger-Overlay im Feed) | ✅ öffnet, Liste vorhanden |
| Market | ✅ lädt |
| SlangTags / Globe | ✅ lädt |
| Arena | ✅ lädt |
| Channels | ✅ lädt, inkl. neuem ORB-Eintrag |
| Browser-Konsole | ✅ keine neuen Fehler; eine vorbestehende React-Warnung auf `/arena` (unverändert, ORB-unabhängig) |

## 14. Warnungen / offene Punkte

1. **Klartextspeicherung** von ORB-Chat und Erinnerungen (wie Messenger-Inhalte).
2. **Keine Anonymisierung** vor Übertragung an den KI-/Sprachdienst – im Hinweis
   auf der Seite benannt.
3. **Keine eigene Ratenbegrenzung** pro Nutzer für KI-Aufrufe (Kosten
   beobachten, sobald mehr Nutzer ORB öffnen).
4. **STT nicht in Production gemessen** (siehe Abschnitt 7).
5. **User-A/User-B-Test** nicht mit zwei echten Production-Konten gefahren
   (siehe Abschnitt 4).
6. Der eingeklappte „Testbereich (Experiment)“ ist in Production sichtbar –
   Teil des validierten Stands, zeigt nur eigene Werte.

## 15. Rollback

* **Sofort-Rollback ohne Datenbankänderung:** ORB-Link in
  `src/routes/_authenticated/channels.index.tsx` entfernen bzw. Route
  `src/routes/_authenticated/channels.orb.tsx` entfernen und neu veröffentlichen.
  ORB ist rein additiv; keine bestehende Funktion hängt davon ab.
* **Datenbank:** die drei Migrationen sind rein anlegend. Ein Entfernen der
  sieben `orb_*`-Tabellen ist möglich, aber für einen Rollback nicht nötig und
  würde ORB-Daten löschen.
* Sicherung des Ausgangszustands der geänderten Bestandsdatei:
  `.lovable/backup/pre_orb_core_2026-09-19/channels.index.tsx`.

## 16. Finaler Status

**🟢 ORB CORE – PRODUCTION EXPERIMENT ACTIVE**

Keine kritischen Fehler: keine RLS-Verletzung, keine fremden Daten sichtbar,
kein Datenverlust, keine Auth-Störung, keine Destabilisierung bestehender
Bereiche, alle drei Migrationen erfolgreich. Ausserhalb von ORB Core wurde
Production nicht verändert.
