# Production – Diagnose instabile Domain-Statusanzeige (2026-09-07)

Read-only. Keine DNS-, Domain-, Code- oder Deployment-Änderung.

## Ergebnis (gemessen)

| Prüfung | Ergebnis |
| --- | --- |
| Status y-dude.com (Plattform) | `active` / connected, seit 32d0h, primäre Domain |
| Status www.y-dude.com (Plattform) | `active` / connected, seit 32d0h |
| Projekt veröffentlicht | ja |
| TXT-Nachweis `_lovable` beide Domains | erwartet = beobachtet, ok |
| A-Record beide Domains | 185.158.133.1 (erwartet = beobachtet) |
| Nameserver | indie/malcolm.ns.cloudflare.com, Delegation ok |
| DNS-Auflösung 3 Wiederholungen | identisch, keine Abweichung |
| IPv4 / IPv6 | nur IPv4-A-Records; IPv6-Auflösung ist IPv4-mapped, kein AAAA-Konflikt |
| HTTP y-dude.com, 10 Aufrufe | 10× 200 |
| HTTP www.y-dude.com, 10 Aufrufe | 10× 302 → https://y-dude.com/ (korrekt) |
| TLS y-dude.com | gültig, Google Trust Services WE1, 06.08.2026–04.11.2026, SAN y-dude.com |
| TLS www.y-dude.com | gültig, WE1, 06.08.2026–04.11.2026, SAN www.y-dude.com |
| Zertifikatsprüfung curl | `ssl_verify_result=0` (ok) bei allen Aufrufen |
| Zielumgebung | beide Domains treffen dieselbe Adresse 185.158.133.1, Server: cloudflare (Edge vor Production) |

## Bewertung

Fall **B**: Die Domains sind korrekt konfiguriert und erreichbar. Die Meldung
„Prüfung fehlgeschlagen – Wir konnten den aktuellen Verbindungsstatus dieser
Domain nicht abrufen“ ist eine Aussage über den **Abruf des Status**, nicht über
die Domain. In allen Messungen dieser Diagnose lieferte die Statusprüfung
`active` für beide Domains; DNS und TLS waren über mehrere Wiederholungen
unverändert.

Ursache der wechselnden Anzeige ist daher ein zeitweise fehlgeschlagener
Statusabruf im Domain-Settings-UI (Timeout/Fehlerantwort der Statusabfrage bzw.
der vorgeschalteten DNS-Abfrage), das dann auf den orangen Fehlerzustand
zurückfällt. Deshalb erscheinen „Live“ und „Prüfung fehlgeschlagen“
zeitweise gleichzeitig für unterschiedliche Einträge derselben Zone.

Fall **A** liegt nicht vor: kein fehlender, doppelter oder abweichender Record,
keine Delegationsabweichung, kein Zertifikatsfehler.

## Empfehlung

Keine DNS-Änderung. Keine Neuverbindung. Kein Entfernen der Domains. Bei
erneutem Auftreten Seite neu laden; der Statusabruf ist nicht persistent und
ändert die Domainkonfiguration nicht.

## Abschluss

- y-dude.com: **LIVE**
- www.y-dude.com: **LIVE**
- DNS: **OK**
- SSL: **OK**
- Lovable Statusprüfung: **INSTABIL** (nur Anzeige/Abruf)
- Tatsächliche Website-Erreichbarkeit: **OK**

Änderungen durchgeführt: keine (Code NEIN, DNS NEIN, Domains NEIN, Deployment NEIN).
