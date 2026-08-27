# Realtime – Broadcast/Presence Sicherheits-Fix

**Datum:** 27. August 2026
**Auslöser:** Finding „Realtime-Broadcast ohne Topic-Policies“ aus `docs/Y-DUDE_GESAMTANALYSE_2026-08-27_1945.md`

## Vorher

| Topic              | Art                          | Zugriff                     | Übertragene Metadaten                                   |
| ------------------ | ---------------------------- | --------------------------- | ------------------------------------------------------- |
| `ydude-presence`   | Presence (global)            | jeder Client, auch anon     | User-ID + Online-Status + Zeitstempel **aller** Nutzer   |
| `ydude-social`     | postgres_changes + Broadcast | jeder Client                | Tipp-Hinweise (`conversationId`, `userId`) aller Chats   |
| `ydude-social-out` | Broadcast (Senden)           | jeder Client                | dito, gesendet an ein globales Topic                     |

Risiko: **MEDIUM** – kein Nachrichteninhalt, aber vollständige Online-Liste und
Chat-/Nutzer-IDs für jeden Zuhörer; Tipp-Hinweise waren zudem fälschbar.
(Nebenbefund: Senden und Empfangen liefen auf zwei verschiedenen Topics.)

## Nachher

| Topic                     | Art                       | Wer betritt es                                              | Inhalt              |
| ------------------------- | ------------------------- | ----------------------------------------------------------- | ------------------- |
| `presence-u-<user-uuid>`  | Presence, ein Topic/Nutzer| der Nutzer selbst (sendet) + bestätigte Verbindungen und Chat-Partner (lesen) | nur `{ status }` |
| `chat-<conversation-uuid>`| Broadcast, ein Topic/Chat | nur Mitglieder der Unterhaltung (RLS-geladene Liste)        | nur `{ u: userId }` |
| `ydude-social-<user-uuid>`| postgres_changes          | der Nutzer selbst; Zeilen weiterhin RLS-gefiltert            | DB-Ereignisse       |

Nicht mehr sichtbar: globale Online-Liste, fremde Chat-IDs, fremde Tipp-Hinweise,
Presence-Zeitstempel. Eingehende Tipp-Hinweise werden zusätzlich clientseitig
gegen die Chat-Mitgliedschaft geprüft, Senden nur in eigene Chats.

## Unverändert

RLS, SECURITY-DEFINER-Funktionen, Migrationen, Push, Feed, Market, Arena, Auth
und die Messenger-Oberfläche. `postgres_changes` war bereits durch RLS
abgesichert und blieb inhaltlich gleich. Keine neue Migration nötig.

## Performance

Keine zusätzlichen Datenbankabfragen pro Nachricht. Statt einem globalen Kanal
gibt es jetzt Kanäle je Gegenüber/Chat auf derselben WebSocket-Verbindung,
begrenzt auf 80 Presence-Partner und 60 Chat-Topics.

## Restrisiko: LOW / ACCEPTABLE

Topic-Namen enthalten UUIDs, die nur Berechtigte kennen. Eine harte
serverseitige Durchsetzung würde Policies auf `realtime.messages` (Realtime
Authorization) erfordern; das Realtime-Schema wird plattformseitig verwaltet
und deshalb hier nicht verändert. Eine geplante E2E-Verschlüsselung bleibt
möglich, da über die Topics keine Nachrichteninhalte laufen.

## Tests

Typecheck, Lint (0 Fehler), 474 Unit-Tests, 26 DB-Integrationstests,
10 E2E-Tests, Produktionsbuild – alle grün. Zusätzlicher Realtime-Angriffstest
mit anonymem Schlüssel: alte globalen Topics und ein fremdes Presence-Topic
liefern keine Presence-Einträge und keine Nutzdaten.
