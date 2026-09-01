# Y-Dude – Security Warning Review (3 Warnungen)

Datum: 2026-09-01
Modus: Analyse + minimale sichere Fixes
Ergebnis: **0 Änderungen notwendig** – alle drei Warnungen sind Fehleinschätzungen des Scanners bzw. bewusstes Zugriffsmodell.

Nicht angefasst: Creator Subscription, Business Subscription, Business Campaigns, Video V1, Stripe, Feed Ranking, SlangShot, Rollenarchitektur, `user_roles`, übrige RLS-Architektur.

---

## 1. Profile Visibility – „private profiles via pending connection requests“

### Definitionen (Ist-Logik)

- `public` → jeder angemeldete Nutzer
- `connections` → nur `are_connected()` = Verbindung mit `status = 'accepted'`
- `private` → niemand außer Eigentümer, Admin und akzeptierte Verbindungen
- pending → Zeile in `connections` mit `status = 'pending'`
- accepted → `status = 'accepted'` (einzige Grundlage von `are_connected()`)

### Root Cause

Der Scanner hat die **Richtung** der Pending-Klausel falsch gelesen. In `can_view_profile` lautet sie:

```sql
c.addressee_id = auth.uid() AND c.requester_id = _profile_id AND c.status = 'pending'
```

Sichtbarkeit entsteht also nur, wenn **der Profilinhaber selbst dem Betrachter eine Anfrage geschickt hat** (Betrachter = Empfänger). Der vom Scanner beschriebene Fall – ein Fremder schickt eine Anfrage und sieht dadurch ein privates Profil – wäre `c.requester_id = auth.uid()` und existiert in der Funktion **nicht**.

Fachlich ist das zwingend: wer eine Verbindungsanfrage erhält, muss den Absender ansehen können, um zu entscheiden. Der Absender gibt seine Sichtbarkeit dabei durch eigenes Handeln frei.

### Tests

| # | Fall | Erwartet | Ergebnis |
| --- | --- | --- | --- |
| T1 | private + fremder Nutzer | false | ✅ false (2 Betrachter geprüft) |
| T2 | private + ausgehende Anfrage des Betrachters | false | ✅ false – Klausel greift nur bei eingehender Anfrage (Code-Nachweis, kein Datensatz nötig) |
| T3 | private + akzeptierte Connection | true | ✅ true über `are_connected()` (Klausel `OR are_connected`) |
| T4 | connections + eingehende Pending-Anfrage (Empfänger sieht Absender) | true (gewollt) | ✅ true |
| T4b | connections + fremder Nutzer ohne Bezug | false | ✅ false |
| T5 | connections + akzeptierte Connection | true | ✅ true |
| T6 | eigener Account | true | ✅ true |

### Bewertung

- Root Cause: falsch gelesene Richtung der Pending-Bedingung
- Echtes Sicherheitsproblem: **NEIN**
- Funktionsproblem: **NEIN**
- Änderung notwendig: **NEIN**
- Betroffene Policy/Funktion: `public.can_view_profile()` (unverändert)
- Security-Auswirkung: keine; ein Entfernen der Klausel würde den Anfrage-Workflow brechen (eingehende Anfragen ohne Absenderprofil).

---

## 2. Seller Pickup Codes – `market_transaction_secrets`

### Root Cause

Es gibt bewusst nur eine SELECT-Policy („buyer reads pickup code“, Rolle `authenticated`, gebunden an `t.buyer_id = auth.uid()`). Verkäufer haben **absichtlich** keinen Leserechtsweg: sie sollen den Code nicht kennen, sondern nur den vom Käufer gezeigten Code **verifizieren**.

Die Verifizierung läuft serverseitig in `confirmPickup()` (`src/lib/market-tx.server.ts`) über den privilegierten Client mit vorgeschalteter Eigentumsprüfung `tx.seller_id !== userId → not_seller`. Der Code wird dabei nie an den Verkäufer ausgeliefert, sondern nur verglichen und anschließend als `used_at` entwertet. Der Seller-Workflow funktioniert also vollständig – die Warnung beschreibt kein Defizit.

### Tests

| # | Fall | Erwartet | Ergebnis |
| --- | --- | --- | --- |
| T7 | Verkäufer, eigener Verkauf – Code lesen | kein Lesezugriff, aber Verifizierung möglich | ✅ Lesen 0 Zeilen; `confirmPickup()` funktioniert |
| T8 | Verkäufer, fremder Verkauf | Abbruch | ✅ `not_seller` |
| T9 | Käufer, eigener Kauf | Code sichtbar | ✅ Policy `buyer reads pickup code`, nur solange `used_at IS NULL` |
| T10 | fremder angemeldeter Nutzer | 0 Zeilen | ✅ 0 |
| T11 | anon | kein Zugriff | ✅ kein Tabellen-Grant für `anon`, 0 anon-Policies |

### Bewertung

- Root Cause: bewusst restriktives Zugriffsmodell (Need-to-know)
- Echtes Sicherheitsproblem: **NEIN**
- Funktionsproblem: **NEIN**
- Änderung notwendig: **NEIN**
- Betroffene Policy: `market_transaction_secrets."buyer reads pickup code"` (unverändert)
- Security-Auswirkung: ein Seller-SELECT würde Codes vor der Übergabe offenlegen und Missbrauch erlauben – bewusst nicht umgesetzt.

---

## 3. Arena Awards mit `submission_id IS NULL`

### Root Cause

Die Policy `arena_awards_select` lautet:

```sql
has_role(auth.uid(),'admin')
OR (is_arena_challenge_visible(challenge_id)
    AND (submission_id IS NULL OR can_see_arena_submission(submission_id)))
```

`is_arena_challenge_visible(challenge_id)` ist **immer** erforderlich (AND-verknüpft). Awards ohne Submission sind daher genau so weit sichtbar wie die zugehörige Challenge – nicht öffentlich und nicht ungeprüft. Der Null-Zweig lockert nur die zusätzliche Submission-Prüfung für Awards, die keiner Einreichung zugeordnet sind (z. B. Challenge-Gesamtpreise); Draft-/Business-Challenges bleiben über die Challenge-Sichtbarkeit geschützt.

### Tests

| # | Fall | Erwartet | Ergebnis |
| --- | --- | --- | --- |
| T12 | Award mit Submission | nur bei sichtbarer Challenge + sichtbarer Submission | ✅ Policy-Pfad `can_see_arena_submission` |
| T13 | Award ohne Submission | nur bei sichtbarer Challenge | ✅ Challenge-Gate greift |
| T14 | fremder angemeldeter Nutzer | keine unsichtbaren Challenges | ✅ 0 Zeilen sichtbar |
| T15 | anon | kein Zugriff | ✅ 0 Zeilen (keine Policy für `anon`, RLS = Default Deny) |

Zusatzbefund: `arena_awards` enthält aktuell **0 Zeilen**, davon 0 ohne `submission_id`; `market_transaction_secrets` ebenfalls 0 Zeilen. Es besteht also auch keine historische Exposition.

### Bewertung

- Root Cause: Scanner bewertet den Null-Zweig isoliert, ignoriert das AND-verknüpfte Challenge-Gate
- Echtes Sicherheitsproblem: **NEIN**
- Funktionsproblem: **NEIN**
- Änderung notwendig: **NEIN**
- Betroffene Policy: `arena_awards_select` (unverändert)
- Security-Auswirkung: keine; ein zusätzliches `submission_id IS NOT NULL` würde legitime Challenge-Preise unsichtbar machen.

---

## Verify (ohne Codeänderung)

| Prüfung | Ergebnis |
| --- | --- |
| Typecheck | ✅ fehlerfrei |
| Lint (`src`, `tests`) | ✅ 0 Fehler, 29 vorbestehende Warnungen |
| Unit-Tests | ✅ 552/552 |
| DB-Integrationstests | ✅ 68/68 |
| Build | ✅ erfolgreich |
| Migration | keine ausgeführt – technisch nicht erforderlich |

Hinweis zum Lint-Gesamtlauf: `bun run lint` prüft das gesamte Repository und meldet Prettier-Fehler **ausschließlich** in den entpackten Release-/Backup-Ordnern (`release/…/rollback-production-original/`, `backups/`). Das ist Artefakt-Rauschen außerhalb des Anwendungscodes und wurde bewusst nicht angefasst (Scope-Lock).

## Fazit

🟢 **SECURITY REVIEW COMPLETE** – 3 Warnungen geprüft, 0 echte Sicherheitsprobleme, 0 Funktionsprobleme, 0 Änderungen, 0 Migrationen. Default Deny bleibt in allen drei Bereichen intakt.
