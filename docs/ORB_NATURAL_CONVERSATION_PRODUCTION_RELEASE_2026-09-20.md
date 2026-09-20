# ORB Natural Conversation – Production Release 2026-09-20

Status: **Übertragung abgeschlossen, Veröffentlichung angefordert**
PRODUCTION CHANGED: YES · DATABASE CHANGED: NO · RLS CHANGED: NO
MEMORY FORMELN/THRESHOLD 0.35/DECAY/RECALL/CONNECTIONS/ELIGIBILITY/CURIOSITY/PRESENCE/COOLDOWNS: UNVERÄNDERT
SDK-VERTRAG: unverändert (nur zusätzlicher Typ-Export) · OpenAI-Provider/Fallback: unverändert

## 1. Commits

- Production BEFORE: `f18a16f6c31c46668fc7fe305e6aa78575c25c92`
- Production AFTER: `dc5bae1f7c5eadd5eaedc6ddb5ec9ddfad6e41f3`
- Staging RELEASE SOURCE: read-only Abzug `b24a77a1`
  (`/tmp/cross-project/y-dude-staging-4a5bd367098d4501b2069e1696fcc09c`)
- Zeitpunkt: 2026-09-20T19:18Z

## 2. Backup / Rollback

`.lovable/backup/pre_orb_natural_conversation_2026-09-20/`
(Originale von `engine.server.ts`, `llm/prompt.server.ts`, `orb-sdk/index.ts`,
`BACKUP_TIME_UTC.txt`, `PRODUCTION_BEFORE_COMMIT.txt`, `ROLLBACK.txt`).
Rollback = Dateien zurückkopieren, `src/orb-core/conversation.ts` und
`tests/orb-conversation-decision.test.ts` entfernen.

## 3. Übertragener Stand (vollständige Liste)

| Datei | Art |
| --- | --- |
| `src/orb-core/conversation.ts` | neu, reine Logik: Modi DIRECT_ANSWER, FOLLOW_UP, SMALLTALK, PROACTIVE_IMPULSE, LISTEN; Strang-Relevanzfilter |
| `src/orb-core/engine.server.ts` | Gesprächsentscheidung vor der Sprachschicht; Kontextreduktion (themenfremde Stränge gehen nicht ans LLM); `conversation` im Ergebnis |
| `src/orb-core/llm/prompt.server.ts` | Prompt-Zeile „Gesprächsmodus“ + Modus-Hinweis |
| `src/orb-sdk/index.ts` | nur `export type { ConversationMode }` |
| `tests/orb-conversation-decision.test.ts` | neue Tests des getesteten Stands |

Bewusst NICHT übernommen (Staging ist dort abweichend/schwächer, kein Teil der Freigabe):

- Staging-Beschriftungen („nur Staging“, „Staging-Experiment“) in
  `engine.server.ts`, `prompt.server.ts`, `openai.server.ts`, `select.server.ts`,
  `continuity-store.server.ts`, `OrbDevPanel.tsx`, `channels.orb.tsx`
- abgeschwächter Sicherheitstest `tests/integration/db-orb-security.test.ts`
  (Production prüft zusätzlich `orb_threads`, `orb_style`, Löschrechte)
- reine Formatierung in `src/orb-core/core.ts`
- alle Staging-Unterschiede außerhalb des ORB-Bereichs (u. a. Docs), keine
  Staging-Secrets, keine Staging-Daten

**Thinking-State-Lifecycle-Fix:** im geprüften Staging-Commit `b24a77a1` **nicht
enthalten** (keine Abweichung in `src/components/orb/OrbChat.tsx` oder der
ORB-Route). Deshalb nicht übertragen und nicht behauptet.

## 4. Datenbank

Keine Migration, keine Tabelle, kein Schema, keine Policy, kein Grant, kein
Index geändert. Memory-Quality-Fix, Importance-Schwelle 0.35, Decay, Recall,
Connections, Eligibility, Curiosity, Presence und Cooldowns unverändert.

## 5. Prüfungen (alle vor der Veröffentlichung)

| Prüfung | Ergebnis |
| --- | --- |
| Typecheck (`tsgo --noEmit`) | 0 Fehler |
| Lint (ORB-Bereich + neuer Test) | 0 Fehler |
| Unit-/Logiktests | 69 Dateien / 1073 Tests grün |
| DB-/Security-Tests | 9 Dateien / 77 Tests grün (RLS aktiv, anon ohne Rechte, Regeln an `auth.uid()`) |
| Build | erfolgreich, Bauprotokoll „build OK“ |
| Security-Scan | keine kritischen Punkte; zwei bestehende `warn`-Punkte außerhalb ORB (moderation_actions.internal_note, reports.review_note) |

## 6. Smoke-Test (Preview, authentifiziert, 1280 px)

- ORB öffnet, Chat funktioniert, keine Konsolenfehler
- Memory Recall: „Ich arbeite als Koch.“ → „Was mache ich beruflich?“ → „Du arbeitest als Koch.“
- Direkte Frage: „Welche Schuhgröße habe ich?“ → „Du hast mir erzählt, dass du Schuhgröße 42 hast.“
- Smalltalk-Pfad: „Hallo“ → ein kurzer Satz; „Danke“ → „Gern.“
- Aussage ohne Frage: „Ich koche gern Pasta.“ → kurzer Anschluss, keine erfundene Verbindung
- `conversation`-Entscheidung (Modus, Grund, relevante Stränge) ist im
  Server-Ergebnis vorhanden; nur relevante Stränge erreichen die Sprachschicht
- Keine Regression in Y-Dude festgestellt (keine Änderungen außerhalb ORB)

## 7. Offene Punkte / Risiken

- Bestehender Impuls (PROACTIVE_IMPULSE) wurde im Smoke-Test nicht ausgelöst
  (Leerlauf- und Cooldown-Bedingungen nicht erfüllt) – belegt nur durch Tests.
- Thinking-State-Lifecycle-Fix ist nicht Teil dieses Stands (siehe 3).
- Zwei bestehende `warn`-Sicherheitspunkte außerhalb ORB bleiben offen.
- Veröffentlichung wurde angefordert (https://y-dude.com); der Abschluss des
  Deployments wurde nicht separat verifiziert.
