# Y-Dude – Rechtliche & dokumentarische Bestandsaufnahme (Gap-Analyse)

Stand: 27. August 2026. **Technische Compliance-Gap-Analyse, keine Rechtsberatung.**
Ersetzt keine Prüfung durch Anwalt/Datenschutzbeauftragten. Es wurden keine
Rechtstexte geändert und keine Unternehmensdaten erfunden.

Trennung im gesamten Dokument:
**[T]** = technische Feststellung aus dem Code · **[R]** = rechtliche Einordnung/Hinweis.

---

## 1. Bestandsaufnahme: vorhandene Dokumente

| Dokument | Datei | Version / Stand | Sprachen | Route |
| --- | --- | --- | --- | --- |
| Datenschutzerklärung (36 Abschnitte) | `src/lib/legal/privacy{,.en,.el}.ts` | 3.0 / 10.08.2026 | de, en, el | `/datenschutz` |
| AGB (22 Abschnitte) | `src/lib/legal/terms{,.en,.el}.ts` | 3.0 / 10.08.2026 | de, en, el | `/agb` |
| Community-Richtlinien (15 Abschnitte) | `src/lib/legal/guidelines{,.en,.el}.ts` | 1.0 | de, en, el | `/richtlinien` |
| Impressum | `src/routes/impressum.tsx` + `src/lib/legal/company.ts` | ohne Version | de, en, el (UI-Texte) | `/impressum` |
| Konto-Löschung (öffentlich) | `src/routes/delete-account.tsx`, `GdprPublicPage.tsx` | – | de, en, el | `/delete-account` |
| Datenexport (öffentlich) | `src/routes/request-data.tsx` | – | de, en, el | `/request-data` |
| Cookie-/Consent-Banner | **nicht vorhanden** | – | – | – |
| Market-/Verkaufsbedingungen | **nicht vorhanden** | – | – | – |
| Widerrufsbelehrung | **nicht vorhanden** | – | – | – |
| DSA-Melde-/Beschwerdeverfahren als Dokument | **nicht vorhanden** (nur AGB §10/§11a) | – | – | – |

Alle drei Doc-Typen tragen den Hinweis
`LEGAL_NOTICE = "Technischer Stand zur rechtlichen Prüfung – nicht anwaltlich geprüft."`
(`src/lib/legal/types.ts:23-26`) und enthalten Platzhalter `[RECHTLICHE PRÜFUNG DURCH ANWALT]`.

### Wo werden sie angezeigt?
- Landingpage-Footer `src/components/SiteFooter.tsx:32-45` (alle vier).
- Querverweise innerhalb jeder Rechtsseite `src/components/LegalPage.tsx:89-100`.
- Profil/Einstellungen `src/components/ProfilePanel.tsx:194-221`.
- Registrierung: Pflicht-Checkbox mit Links zu AGB, Richtlinien, Datenschutz
  `src/routes/auth.tsx:805-826`, Validierung `auth.tsx:505-508`.
- Sitemap `src/routes/sitemap[.]xml.ts:15-18`.
- **[T] Lücke:** `SiteFooter` wird nur in `src/routes/index.tsx:228` gerendert. Im
  eingeloggten Bereich (Feed, Market, Messenger, Arena, Globe) gibt es keinen
  Footer; Rechtstexte sind dort nur über das Profilmenü erreichbar.
  **[R]** Impressumspflicht verlangt „leichte Erkennbarkeit und unmittelbare
  Erreichbarkeit" von jeder Seite – hier zu prüfen/nachzubessern.

---

## 2. Funktionen vs. Rechtstexte

### Abgedeckt (Text vorhanden und im Kern zutreffend)
Registrierung/Login (§3), Profildaten (§4), Beiträge/Medien/SlangTags (§5, §5a),
Interaktionen (§6), Chats (§7), Standort (§8), KI-Moderation (§9–9b),
Meldesystem (§10), Serverlogs (§11), Profiling/Feed (§12), Werbung (§12a/12b),
Push (§13), E-Mail/Double-Opt-in (§14), Cookies/Storage (§15), Turnstile (§16),
Dienste (§17), Aufbewahrung (§19), Backups (§20), Löschung (§21), Export (§22),
Betroffenenrechte (§23), Mindestalter 16 (§25).

### Nicht oder unzureichend abgedeckt

| Funktion (im Code vorhanden) | Fundstelle | Lücke im Rechtstext |
| --- | --- | --- |
| **Y-Dude Market** (Inserate, Angebote, Transaktionen, Versand, Streitfälle) | `market_items`, `market_transactions`, `market_shipping`, `src/lib/market-tx.server.ts` | **Kein einziger Market-Abschnitt** in Datenschutz, AGB oder Richtlinien |
| **Zahlungen über Stripe** (Checkout, Kundenkonto, Abo) | `src/lib/billing.server.ts:181-195,415,531`, `market_payment_records` | Stripe wird in §17 „Eingesetzte Dienste" nicht genannt; keine Rechtsgrundlage/Empfänger-Angabe |
| **Versandadresse** (Klarname, Anschrift) | `market_shipping.address` (jsonb) | Datenkategorie fehlt vollständig |
| **Market-Analytics / gespeicherte Suchen** | `market_analytics_events`, `market_searches` | Tracking-Zweck nicht beschrieben |
| **Plattformgebühr / Provisionsmodell** | `market_fee_settings`, `platform_fee_cents` | Rolle von Y-Dude (Vermittler vs. Verkäufer) nirgends erklärt |
| **Channels** (`channels`, `channel_members`, `channel_bans`) | DB + UI | In AGB §3 Leistungsbeschreibung nicht genannt |
| **Connections & Kontaktvorschläge** | `connections`, `connection_suggestions` (Score, Gründe) | Profiling für Kontaktvorschläge nicht als eigener Zweck beschrieben |
| **Business-/Premium-Abos** | `subscriptions`, `business_plan_tier()`, `src/routes/.../business.tsx` | AGB §3a sagt „kostenlose Nutzung"; Bezahlfunktionen existieren bereits |
| **Nachrichten-Transkripte / Übersetzung** | `messages.transcript`, `message_translations`, `src/lib/translate.server.ts` | §7 nennt Chats, aber nicht KI-Übersetzung/Transkription von Nachrichteninhalten an externe KI |
| **Ops-/Incident-Monitoring** | `ops_events`, `ops_incidents`, Discord-Alert-Webhook | §11 nennt Serverlogs allgemein; externer Alarmkanal (Discord) nicht als Empfänger genannt |
| **Push-User-Agent** | `push_subscriptions.user_agent`, `src/lib/push-client.ts:187` | Datenkategorie Geräte-/Browserkennung nicht ausdrücklich benannt |
| **Reisepläne** | `travel_plans` (Land, Stadt, Zeitraum) | Nicht beschrieben |
| **Globe-Einträge / Voting** | `globe_entries`, `globe_vote_*` | Nicht in Datenschutz beschrieben |

### Diskrepanzen Text ↔ Code

1. **[T]** AGB §3a: „kostenlose Nutzung" – gleichzeitig existieren Stripe-Abos und
   kostenpflichtige Market-Promotions (`market_promotions`, `PromoteItemDialog`).
2. **[T]** Datenschutz §12b („Widerspruch gegen Personalisierung") und der
   Werbeschalter: `ads_enabled` ist laut `src/lib/ad-pause.ts:137,144-168` ein
   **Admin-only**-Schalter. Normale Nutzer haben nur `ad_pauses` (3 Pausen/Monat,
   bis Mitternacht). **[R]** Ein zeitlich begrenzter Pausenknopf ist kein
   dauerhafter Widerspruch i. S. v. Art. 21 DSGVO.
3. **[T]** AGB §11a verspricht „Information und Widerspruch" gegen
   Moderationsmaßnahmen. Im UI existiert nur `PostModerationNotice.tsx:62-81`
   (Statusanzeige + „Bearbeiten"). Ein Einspruchs-Workflow ist nicht implementiert.
4. **[T]** Kontolöschung (`src/lib/account.server.ts:313-400`) räumt Profil, Posts,
   Chats, Signale usw. – **nicht** aber `market_transactions`,
   `market_payment_records`, `market_shipping`, `market_analytics_events`,
   `market_searches`, `account_security_events`, `admin_audit_log`, `ops_events`,
   `globe_entries`. §21 der Datenschutzerklärung erwähnt diese Ausnahmen nicht.
5. **[T]** Aufbewahrungsfristen (`src/lib/retention.server.ts:8-11,88-93`): Ist eine
   `RETENTION_DAYS_*`-Variable nicht gesetzt, wird **nichts** gelöscht. Aktuell sind
   keine Fristen produktiv gesetzt → faktisch unbegrenzte Speicherung technischer
   Protokolle. §19 nennt dagegen „Aufbewahrung und Löschung".
6. **[T]** §15a: „Analyse- oder Marketing-Cookies werden derzeit nicht eingesetzt" –
   das deckt sich mit dem Code (kein Analytics-SDK, keine Third-Party-Cookies gefunden).

---

## 3. DSGVO-Prüfpunkte

| Punkt | Status | Feststellung |
| --- | --- | --- |
| Verantwortlicher | vorhanden | `company.ts`, aber Firmenstatus „UG i. G." – **[R]** Angaben prüfen, sobald HR-Eintragung erfolgt |
| Datenschutzkontakt | teilweise | nur allgemeine E-Mail `Tidymagic@gmail.com`; **[R]** Freemailer als offizieller Datenschutzkontakt ist unüblich; DSB-Benennung prüfen |
| Zwecke | überwiegend | Market-, Zahlungs- und Abo-Zwecke fehlen |
| Rechtsgrundlagen | Platzhalter | §2 verweist auf `[RECHTLICHE PRÜFUNG DURCH ANWALT]` – je Verarbeitung noch zuzuordnen |
| Datenkategorien | Lücken | Versandadresse, Zahlungsreferenzen, User-Agent, Reisepläne fehlen |
| Empfänger / Auftragsverarbeiter | Lücken | Stripe und Discord-Alert-Webhook fehlen; Lovable/Supabase/Cloudflare/OpenAI/Google/BigDataCloud sind genannt |
| Drittlandtransfer | Platzhalter | §17a offen; **[R]** USA-Transfers (Stripe, OpenAI, Cloudflare, Discord) benötigen Grundlage (DPF/SCC) |
| Speicherdauer | kritisch offen | keine produktiven Fristen gesetzt (s. o.) |
| Betroffenenrechte | gut | Selbstservice `/request-data` (Export inkl. Medien) und `/delete-account`; Passwortprüfung + Rate-Limit |
| Widerspruch / Widerruf | Lücke | Feed-Reset vorhanden (`FeedResetSection.tsx`), Werbe-Opt-out für Nutzer fehlt |
| TOM | vorhanden | §24; RLS, Turnstile, Rate-Limits, Audit-Log real implementiert |
| Cookies/Storage | Text ok | Kein Consent-Banner nötig, **[R]** solange nur technisch erforderliche Speicher genutzt werden – Bewertung sollte anwaltlich bestätigt werden, da auch Personalisierungs-Caches im Storage liegen |
| Tracking/Analytics | kein Third-Party | intern: `feed_signals`, `interaction_events`, `market_analytics_events` |
| Push | Text ok | §13; Opt-in über Browser-Permission |
| Profiling | teilweise | Feed-Ranking + Interest Engine beschrieben; Kontaktvorschläge und Market-Empfehlungen nicht |
| Automatisierte Entscheidungen | relevant | KI-Moderation kann Inhalte **blockieren** (`moderation_status='blocked'`) – **[R]** Art. 22 DSGVO prüfen; menschliche Nachprüfung ist implementiert (Admin-Moderation) |
| Minderjährige | 16+ Selbstauskunft | `MIN_AGE_YEARS = 16`, keine Verifikation |

---

## 4. Online-Marktplatz (größte Lücke)

**[T] Technische Rolle von Y-Dude:** Käufer und Verkäufer sind getrennte Nutzer
(`buyer_id`/`seller_id`), Y-Dude berechnet eine konfigurierbare Plattformgebühr
(`market_fee_settings.platform_fee_bps` + Fixbetrag) und schüttet
`seller_amount_cents` an den Verkäufer aus. Zahlungsabwicklung über Stripe.
Es existiert **kein** „Merchant of Record"-Flag. Das entspricht technisch einem
**Vermittlermodell** – **[R]** die rechtliche Einordnung (u. a. ob Y-Dude bei
Gebühreneinzug/Auszahlung selbst Zahlungsdienste erbringt) ist anwaltlich zu klären.

Fehlend im Market-UI und in den Texten:

| Anforderung | Status |
| --- | --- |
| Kennzeichnung Verbraucher vs. Unternehmer je Anbieter | **fehlt** (kein Feld, keine Anzeige) |
| Hinweis, dass Verbraucherschutz bei Privatverkäufern nicht gilt | **fehlt** |
| Verkäufer-Identitätsangaben für gewerbliche Anbieter | **fehlt** |
| Ranking-Transparenz (Hauptparameter der Sortierung) | **fehlt**; Ranking existiert real (`market_promotions` = bezahlte Hervorhebung!) |
| Kennzeichnung bezahlter Platzierung / Werbung im Market | **zu prüfen** – `market_promotions`/`market_ad_campaigns` existieren |
| Widerrufsbelehrung + Muster-Widerrufsformular für gewerbliche Verkäufer | **fehlt** |
| Preisangaben (inkl. Steuern/Versand) | teilweise (`total_cents`, `shipping`), rechtliche Preisangabenpflichten nicht abgebildet |
| Wer ist Vertragspartner des Kaufvertrags | **nirgends erklärt** |
| Verbotene/eingeschränkte Angebote (Waffen, Arzneimittel, Tiere, Fälschungen …) | **fehlt** in den Richtlinien |
| Melde-/Beschwerdeweg für Angebote | teilweise (`reports`, `market_disputes`), nicht dokumentiert |
| Gebühren-/Auszahlungsbedingungen | **fehlt** |

**[R]** Für Online-Marktplätze greifen zusätzlich u. a. Omnibus-/Preisangaben-Regeln,
§ 312k BGB-Informationspflichten sowie ab 2026 die DSA-Marktplatzpflichten
(Art. 30–32 DSA: Rückverfolgbarkeit gewerblicher Händler, Prüfpflicht der Angaben,
Information betroffener Verbraucher bei illegalen Produkten). Das ist der
dringlichste Handlungsblock.

---

## 5. Digital Services Act – Relevanz nach Schwellen

**Aktuell zwingend (jeder Hosting-/Online-Plattformanbieter):**
- Art. 11/12: **Zentrale Kontaktstelle** für Behörden und für Nutzer, in den AGB
  benannt und leicht auffindbar → **[T] fehlt** (nur allgemeine E-Mail).
- Art. 14: AGB müssen Moderationsregeln, eingesetzte Algorithmen und
  Entscheidungsverfahren verständlich beschreiben → teilweise erfüllt (AGB §9–11).
- Art. 16: **Melde-Verfahren** für illegale Inhalte → **[T] vorhanden**
  (`ReportDialog.tsx`, `reports`), aber Eingangsbestätigung und Entscheidungs-
  mitteilung an den Melder sind nicht implementiert.
- Art. 17: **Begründung von Moderationsentscheidungen** (Statement of Reasons) mit
  Rechtsgrundlage, Tatsachen, Automatisierungshinweis, Rechtsbehelfen →
  **[T] nur rudimentär** (`PostModerationNotice.tsx` zeigt Grund, keinen strukturierten SoR).
- Art. 20/21: **Internes Beschwerdemanagement** (6 Monate) und Hinweis auf
  außergerichtliche Streitbeilegung → **[T] fehlt vollständig**.
- Art. 23: Maßnahmen gegen Missbrauch/wiederholte Verstöße + Vorwarnung → teilweise
  (`user_warnings`, `user_bans`) – Regeln nicht veröffentlicht.
- Art. 26: **Werbekennzeichnung** („Werbung", wer bezahlt, Hauptparameter der
  Ausspielung) → **[T] `FeedAdCard`/`market_promotions` prüfen**, Parameter-Offenlegung fehlt.
- Art. 27: **Transparenz der Empfehlungssysteme** in den AGB (Hauptparameter des Feeds)
  → **[T] fehlt**; Feed-Ranking + Interest Engine sind real im Einsatz.
- Art. 28: **Schutz Minderjähriger** – kein Profiling-basiertes Advertising für
  Minderjährige. Y-Dude erlaubt 16+ → **[R] relevant**, da 16–17-Jährige minderjährig sind
  und personalisierte Werbung ausgespielt wird.
- Art. 30–32 (Marktplatz): Händler-Rückverfolgbarkeit, Best-Effort-Prüfung,
  Verbraucherinformation → **[T] fehlt** (s. Abschnitt 4).

**Erst ab Schwellen relevant:**
- Art. 15/24 Transparenzberichte: für Kleinstunternehmen/KMU **ausgenommen**
  (Art. 19), sobald < 50 Mitarbeitende und < 10 Mio. € Umsatz.
- Art. 22 Trusted Flaggers, Art. 24(5) Datenbankmeldungen: erst mit wachsender Größe/
  Behördenpraxis.
- **VLOP/VLOSE (Art. 33 ff., ab 45 Mio. monatliche EU-Nutzer): derzeit nicht relevant.**
  Risikobewertungen, externe Audits, Datenzugang für Forschende, Ad-Repository:
  **nicht anwendbar.**

---

## 6. AGB – Deckungsanalyse

Gut abgedeckt: Konto, Nutzungsregeln, verbotene Inhalte, Nutzerinhalte/Lizenz,
Messenger, Moderation, Sperrung, Beendigung, Haftung, Änderungen, Schlussbestimmungen.

Fehlend oder widersprüchlich:
- **Market-Kapitel komplett** (Anbieterrolle, Gebühren, Zahlung, Auszahlung, Versand,
  Streitfälle, Rückabwicklung, verbotene Angebote).
- **Premium-/Bezahlfunktionen**: existieren (`subscriptions`, Promotions), AGB
  bezeichnen die Nutzung als kostenlos (§3a).
- **Channels** nicht in der Leistungsbeschreibung.
- **DSA-Pflichtinhalte**: Kontaktstelle, Empfehlungssystem-Parameter,
  Beschwerdemanagement, Rechtsbehelfsfristen.
- **Widerspruchs-/Einspruchsverfahren** gegen Moderation (versprochen in §11a,
  technisch nicht umgesetzt).
- Verbraucherinformationen (§17) sind reiner Platzhalter.

---

## 7. Impressum

Vorhanden: Firma, Straße, PLZ/Ort, Land, E-Mail (`src/lib/legal/company.ts:2-8`),
plus Abschnitt „Weitere Angaben (in Klärung)" (`impressum.tsx:47-55`).

**Information vom Betreiber erforderlich:**
- Telefonnummer oder gleichwertiger unmittelbarer Kommunikationsweg
- USt-IdNr. bzw. Hinweis Kleinunternehmerregelung
- Handelsregister + Registernummer (sobald UG eingetragen; aktuell „i. G.")
- Vertretungsberechtigte Person(en) (Geschäftsführer namentlich)
- Verantwortlich i. S. d. § 18 Abs. 2 MStV (Name + Anschrift)
- Hinweis EU-Streitbeilegung / Verbraucherschlichtungsstelle (§ 36 VSBG)
- DSA-Kontaktstelle inkl. akzeptierter Sprachen
- ggf. Datenschutzbeauftragter

**[T]** Erreichbarkeit: nur Landing-Footer + Profilmenü, nicht im eingeloggten Bereich.

---

## 8. Sprachversionen

**[T]** Datenschutz, AGB und Richtlinien liegen vollständig in de/en/el vor;
Impressum-Rahmen ebenfalls (über `LEGAL_UI_TEXTS`), Firmendaten sprachneutral.
GDPR-Formulare `/delete-account`, `/request-data` sind über `i18n-gdpr-public.ts` dreisprachig.

Lücken:
- Übersetzungen sind maschinell/technisch erstellt und **nicht anwaltlich geprüft**
  (Notice-Text in allen drei Sprachen sagt das korrekt aus).
- Deutsch ist als „verbindliche Referenz" nur im Quellcode-Kommentar
  (`index.ts:20`) markiert – **[R]** eine Sprachvorrangklausel fehlt im AGB-Text selbst.
- `LEGAL_DOCS` für den PDF-Export enthält nur die deutschen Fassungen (`index.ts:39`).
- Version 1.0 der Richtlinien vs. 3.0 der übrigen Dokumente → Versionsstände
  konsolidieren.
- Neue Market-/DSA-Abschnitte müssen in allen drei Sprachen synchron ergänzt werden.
- **[R]** Griechische Fassung sollte vor Launch in GR juristisch gegengeprüft werden.

---

## 9. Technische Prüfung – Kurzbefund

- **Kein IP-Logging** im Anwendungscode (keine Treffer für `x-forwarded-for`,
  `cf-connecting-ip`); Plattform-/Edge-Logs liegen beim Hoster.
- **User-Agent** wird gespeichert: `push_subscriptions.user_agent`
  (`src/lib/push-client.ts:187`, `push.server.ts:411`), im Export enthalten
  (`account.server.ts:244`).
- **Keine Third-Party-Cookies, kein Analytics-SDK.** Client-Speicher ausschließlich
  funktional: Auth-Session, Sprache, Theme, Autoplay, Feed-Cache, Composer-Entwurf,
  signierte Medien-URLs, Chat-Sprache, Kamera-Richtung, Onboarding-Flags.
- **Externe Dienste:** Supabase (DB/Auth/Storage), Lovable (Hosting, AI Gateway,
  E-Mail), Cloudflare (Turnstile/CDN), OpenAI und/oder Google (Moderation,
  Übersetzung, Transkription – über AI Gateway), BigDataCloud (Reverse Geocoding),
  **Stripe** (Zahlungen/Abos), Browser-Push-Dienste, **Discord** (Ops-Alarm-Webhook).
- **Standort:** Browser-Geolocation → BigDataCloud; gespeichert wird nur der Ortsname
  (`profiles.location`) mit `location_visibility`; Ausnahme: `market_shipping.address`.
- **Profiling:** `interaction_events`, `feed_signals`, `interest_confidence`,
  `connection_suggestions`, `market_analytics_events`, `feed_learned_weights`.
- **Monitoring:** `ops_events.context` (jsonb) ist nicht typgeprüft – **[T] Risiko**,
  dass dort unbeabsichtigt personenbezogene Daten landen; sollte auditiert werden.

---

## 10. Prioritätenliste

| Bereich | Status | Problem | Priorität | Empfohlene Maßnahme |
| --- | --- | --- | --- | --- |
| Market – Rechtstexte | **Fehlt** | Kein Market-Kapitel in AGB/Datenschutz; Rolle, Gebühren, Zahlung, Versand, Streitfälle ungeregelt | **Kritisch** | Eigenes Market-Kapitel in AGB + Datenschutz-Abschnitte (Transaktion, Versandadresse, Stripe) |
| Market – Anbieterkennzeichnung | **Fehlt** | Verbraucher/Unternehmer nicht unterscheidbar | **Kritisch** | Feld im Verkäuferprofil + sichtbares Badge + Pflichtangaben für Gewerbliche |
| Market – Widerruf | **Fehlt** | Keine Widerrufsbelehrung für gewerbliche Anbieter | **Kritisch** | Belehrung + Musterformular je Angebot |
| Datenschutz – Stripe/Zahlungen | **Fehlt** | Empfänger, Zweck, Drittland nicht genannt | **Kritisch** | Abschnitt „Zahlungsabwicklung" ergänzen |
| Datenschutz – Löschumfang | **Update** | Market-/Finanz-/Sicherheitsdaten überleben Kontolöschung, Text schweigt | **Kritisch** | §21 präzisieren + Anonymisierungskonzept |
| Speicherfristen | **Fehlt** | `RETENTION_DAYS_*` nicht gesetzt → keine Löschung | **Kritisch** | Fristen je Tabelle festlegen und Cron aktivieren |
| DSA – Kontaktstelle | **Fehlt** | Art. 11/12 Kontaktstelle nicht benannt | **Hoch** | In Impressum + AGB aufnehmen (inkl. Sprachen) |
| DSA – Beschwerdeverfahren | **Fehlt** | Art. 20/21 internes Beschwerdesystem fehlt | **Hoch** | Einspruchs-Flow gegen Sperren/Blockierungen implementieren + dokumentieren |
| DSA – Begründungen | **Update** | Art. 17 Statement of Reasons unvollständig | **Hoch** | Strukturierte Begründung inkl. Automatisierungshinweis + Rechtsbehelf |
| DSA – Empfehlungssystem | **Fehlt** | Art. 27 Hauptparameter des Feeds nicht offengelegt | **Hoch** | AGB-Abschnitt „Wie der Feed sortiert" |
| DSA – Werbetransparenz | **Update** | Art. 26 Kennzeichnung/Parameter der Ausspielung | **Hoch** | „Werbung"-Label + Erklärseite |
| AGB – Bezahlfunktionen | **Update** | §3a „kostenlos" widerspricht Abos/Promotions | **Hoch** | Abschnitt Premium/Promotions + Vertragslaufzeit/Kündigung |
| Werbe-Opt-out | **Update** | `ads_enabled` nur für Admins; Nutzer haben nur 3 Pausen/Monat | **Hoch** | Dauerhaften Opt-out für Nutzer oder Text an Realität anpassen |
| Impressum | **Update** | Telefon, USt-ID, Register, Vertretung, MStV, Streitbeilegung offen | **Hoch** | **Information vom Betreiber erforderlich** |
| Impressum-Erreichbarkeit | **Update** | Im eingeloggten Bereich kein Footer | **Hoch** | Persistenter Legal-Link in App-Navigation |
| Community Guidelines – Market | **Update** | Verbotene/eingeschränkte Angebote fehlen | **Hoch** | Katalog verbotener Waren ergänzen |
| Rechtsgrundlagen | **Update** | Platzhalter statt Art.-6-Zuordnung | **Hoch** | Anwaltliche Zuordnung je Verarbeitung |
| Drittlandtransfer | **Update** | §17a Platzhalter | **Hoch** | DPF/SCC je Anbieter dokumentieren |
| Minderjährigenschutz | **Update** | 16–17-Jährige erhalten personalisierte Werbung | **Hoch** | Profiling-Werbung für <18 abschalten (DSA Art. 28) |
| Datenschutzkontakt | **Update** | Freemail-Adresse als offizieller Kontakt | **Mittel** | Domain-E-Mail (z. B. datenschutz@y-dude.com) |
| Channels / Connections / Globe / Reisepläne | **Fehlt** | Verarbeitungen nicht beschrieben | **Mittel** | Datenschutz-Abschnitte ergänzen |
| Chat-Übersetzung/Transkript | **Update** | KI-Verarbeitung von Nachrichten nicht beschrieben | **Mittel** | §7/§9a erweitern |
| Ops-Monitoring & Discord | **Update** | Externer Alarmempfänger nicht genannt; `ops_events.context` ungeprüft | **Mittel** | Empfänger ergänzen + PII-Audit der Events |
| Cookies/Consent | **OK (zu bestätigen)** | Kein Banner, aber auch keine Tracking-Cookies | **Mittel** | Bewertung anwaltlich bestätigen lassen, Storage-Liste in §15 aktuell halten |
| Betroffenenrechte | **OK** | Export + Löschung als Selbstservice implementiert | **Niedrig** | Fristen-/Ablaufbeschreibung ergänzen |
| Push-Hinweise | **OK** | §13 deckt Opt-in ab | **Niedrig** | User-Agent als Datenkategorie ergänzen |
| Sprachversionen | **Update** | Nicht geprüfte Übersetzungen, keine Vorrangklausel, Versionsdrift | **Niedrig–Mittel** | Vorrangklausel, Versionsstände angleichen, GR/EN-Review |
| DSA-Transparenzberichte | **Nicht erforderlich** | KMU-Ausnahme Art. 19 | – | später beobachten |
| VLOP-Pflichten | **Nicht erforderlich** | Schwelle 45 Mio. EU-Nutzer nicht erreicht | – | – |

---

## 11. Zwingend vor dem öffentlichen Launch

1. Market rechtlich vollständig abbilden: AGB-Kapitel, Datenschutz-Abschnitte,
   Anbieterkennzeichnung (Verbraucher/Unternehmer), Widerrufsbelehrung,
   Verbotene-Waren-Katalog, Gebühren-/Auszahlungsbedingungen.
2. Stripe und alle weiteren fehlenden Empfänger (Discord-Alarm) in die
   Datenschutzerklärung aufnehmen, inkl. Drittlandgrundlage.
3. Rechtsgrundlagen (Art. 6) und Speicherfristen konkret festlegen; `RETENTION_DAYS_*`
   produktiv setzen.
4. Löschkonzept nachziehen: Market-, Sicherheits- und Audit-Daten anonymisieren oder
   Aufbewahrung sauber begründen und im Text offenlegen.
5. Impressum vervollständigen (Betreiberangaben liefern) und von **allen** Bereichen
   erreichbar machen.
6. DSA-Basics: Kontaktstelle benennen, Beschwerde-/Einspruchsverfahren umsetzen,
   Moderationsbegründungen strukturieren, Feed- und Werbetransparenz in die AGB.
7. AGB-Widerspruch „kostenlose Nutzung" vs. Abos/Promotions auflösen.
8. Werbe-Opt-out für Nutzer bereitstellen bzw. Datenschutztext an die Realität anpassen;
   personalisierte Werbung für Minderjährige deaktivieren.
9. Anwaltliche Endabnahme aller drei Sprachfassungen; `LEGAL_NOTICE`-Platzhalter entfernen.

## 12. Aktuell nicht erforderlich / erst bei Wachstum

- DSA-Transparenzberichte (Art. 15/24) – KMU-Ausnahme.
- Trusted Flagger-Verfahren, Meldung an die DSA-Datenbank.
- Sämtliche VLOP/VLOSE-Pflichten (Risikobewertung, externe Audits, Ad-Repository,
  Forschungsdatenzugang) – Schwelle 45 Mio. monatliche EU-Nutzer.
- Cookie-Consent-Banner, solange nachweislich nur technisch erforderliche
  Client-Speicher genutzt werden (aktueller Codestand).
- Bestellung eines Datenschutzbeauftragten, solange die gesetzlichen Schwellen
  nicht erreicht sind – **[R]** bei umfangreicher Profilbildung ggf. früher zu prüfen.
- Konzernweite Auftragsverarbeitungsverträge über die bereits genutzten Dienste hinaus.
