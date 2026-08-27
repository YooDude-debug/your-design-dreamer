/**
 * Aufbewahrungs- und Löschkonzept (DSGVO Art. 5 Abs. 1 lit. e).
 *
 * Dieses Modul ist bewusst browser-sicher: es beschreibt ausschließlich das
 * Regelwerk (was, warum, wie lange, welche Aktion, welche gesetzliche
 * Aufbewahrung). Die Ausführung liegt in `retention.server.ts`.
 *
 * Grundsätze:
 * - Jede Regel hat eine begründete Regelfrist (`days`) und eine Aktion.
 * - `delete`     → Datensatz wird vollständig entfernt.
 * - `anonymize`  → Datensatz bleibt, der Personenbezug wird entfernt.
 * - `keep`       → keine automatische Löschung, weil eine gesetzliche
 *                  Aufbewahrungspflicht besteht (Handels-/Steuerrecht).
 * - Fristen sind pro Regel über `RETENTION_DAYS_<KEY>` überschreibbar;
 *   `0` deaktiviert die Regel gezielt, `RETENTION_DISABLED=1` alle Regeln.
 * - Nutzerinhalte (Beiträge, SlangTags, Nachrichten, Angebote) werden hier
 *   NICHT nach Alter gelöscht – dafür sind Nutzer und Kontolöschung zuständig.
 */

export type RetentionAction = "delete" | "anonymize" | "keep";

export type RetentionRule = {
  /** Stabiler Schlüssel; Umgebungsvariable ist `RETENTION_DAYS_<KEY>`. */
  key: string;
  table: string;
  /** Zeitstempelspalte, gegen die die Frist gerechnet wird. */
  column: string;
  /** Regelfrist in Tagen. `null` bei `keep`. */
  days: number | null;
  action: RetentionAction;
  /** Was wird gespeichert und warum. */
  purpose: string;
  /** Rechtsgrundlage bzw. Aufbewahrungsgrund. */
  legalBasis: string;
  /**
   * Bei `anonymize`: Spalten, deren Personenbezug überschrieben wird.
   * Bei `delete`/`keep` leer.
   */
  anonymize?: Record<string, string | null>;
  /** Zusatzinformation für Bericht und Rechtstexte. */
  note?: string;
};

/** Platzhalter für entfernte Personenbezüge (kein echtes Konto). */
export const ANONYMOUS_UUID = "00000000-0000-0000-0000-000000000000";

export const RETENTION_RULES: RetentionRule[] = [
  // ------------------------------------------------ Sicherheit & Moderation
  {
    key: "ACCOUNT_SECURITY_EVENTS",
    table: "account_security_events",
    column: "created_at",
    days: 180,
    action: "delete",
    purpose: "Protokoll zu Datenexport und Kontolöschung (Ratenbegrenzung, Missbrauchserkennung).",
    legalBasis: "Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO), Sicherheit der Verarbeitung.",
  },
  {
    key: "CONTENT_MODERATION_LOG",
    table: "content_moderation_log",
    column: "created_at",
    days: 365,
    action: "delete",
    purpose:
      "Protokoll automatisierter Moderationsentscheidungen (Nachvollziehbarkeit, Einspruch).",
    legalBasis: "Rechtliche Verpflichtung (DSA Art. 17/20) und berechtigtes Interesse.",
  },
  {
    key: "SLANGTAG_MODERATION_EVENTS",
    table: "slang_tag_moderation_events",
    column: "created_at",
    days: 365,
    action: "delete",
    purpose: "Moderationsverlauf einzelner SlangTags.",
    legalBasis: "Rechtliche Verpflichtung (DSA Art. 17) und berechtigtes Interesse.",
  },
  {
    key: "MODERATION_ACTIONS",
    table: "moderation_actions",
    column: "created_at",
    days: 730,
    action: "delete",
    purpose: "Begründete Moderationsentscheidungen mit Einspruchsbezug.",
    legalBasis:
      "Rechtliche Verpflichtung (DSA Art. 17/20); Frist deckt die Einspruchs- und Nachweisphase.",
  },
  {
    key: "MODERATION_APPEALS",
    table: "moderation_appeals",
    column: "created_at",
    days: 730,
    action: "delete",
    purpose: "Einsprüche gegen Moderationsentscheidungen und deren Ergebnis.",
    legalBasis: "Rechtliche Verpflichtung (DSA Art. 20) und berechtigtes Interesse.",
  },
  {
    key: "REPORTS",
    table: "reports",
    column: "updated_at",
    days: 730,
    action: "delete",
    purpose: "Meldungen von Inhalten und Profilen inklusive Entscheidung.",
    legalBasis: "Rechtliche Verpflichtung (DSA Art. 16) und Missbrauchsabwehr.",
  },
  {
    key: "ADMIN_AUDIT_LOG",
    table: "admin_audit_log",
    column: "created_at",
    days: 1095,
    action: "delete",
    purpose: "Protokoll administrativer Eingriffe (Missbrauchs- und Sicherheitsnachweis).",
    legalBasis: "Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO), Rechenschaftspflicht.",
  },
  {
    key: "POST_MODERATION_JOBS",
    table: "post_moderation_jobs",
    column: "updated_at",
    days: 90,
    action: "delete",
    purpose: "Abgearbeitete Moderations-Warteschlange.",
    legalBasis: "Berechtigtes Interesse; nach Abschluss ohne weiteren Zweck.",
  },

  // -------------------------------------------- Personalisierung & Signale
  {
    key: "FEED_SIGNALS",
    table: "feed_signals",
    column: "created_at",
    days: 90,
    action: "delete",
    purpose: "Rohsignale der Feed-Personalisierung.",
    legalBasis: "Berechtigtes Interesse; kurze Frist wegen laufender Relevanz.",
  },
  {
    key: "INTERACTION_EVENTS",
    table: "interaction_events",
    column: "created_at",
    days: 180,
    action: "delete",
    purpose: "Rohsignale der Interessen- und Empfehlungsberechnung.",
    legalBasis: "Berechtigtes Interesse; abgeleitete Werte bleiben aggregiert.",
  },
  {
    key: "FEED_SCORE_CACHE",
    table: "feed_score_cache",
    column: "computed_at",
    days: 30,
    action: "delete",
    purpose: "Zwischenspeicher berechneter Feed-Bewertungen.",
    legalBasis: "Berechtigtes Interesse; rein technischer Cache.",
  },
  {
    key: "AD_TEST_EVENTS",
    table: "ad_test_events",
    column: "created_at",
    days: 90,
    action: "delete",
    purpose: "Messwerte des internen Werbe-Testmodus.",
    legalBasis: "Berechtigtes Interesse; nur interne Qualitätssicherung.",
  },
  {
    key: "NOTIFICATIONS",
    table: "notifications",
    column: "created_at",
    days: 180,
    action: "delete",
    purpose: "Benachrichtigungen im Postfach des Nutzers.",
    legalBasis: "Vertrag/berechtigtes Interesse; nach Ablauf ohne Nutzen.",
  },
  {
    key: "NOTIFICATION_JOBS",
    table: "notification_jobs",
    column: "created_at",
    days: 30,
    action: "delete",
    purpose: "Versandwarteschlange für Push-Nachrichten.",
    legalBasis: "Berechtigtes Interesse; technische Warteschlange.",
  },
  {
    key: "MESSAGE_TRANSLATIONS",
    table: "message_translations",
    column: "created_at",
    days: 180,
    action: "delete",
    purpose: "Zwischenspeicher maschineller Übersetzungen von Nachrichten.",
    legalBasis: "Vertrag (Funktion) und berechtigtes Interesse; Cache.",
  },
  {
    key: "POST_TRANSLATIONS",
    table: "post_translations",
    column: "created_at",
    days: 365,
    action: "delete",
    purpose: "Zwischenspeicher maschineller Übersetzungen von Beiträgen.",
    legalBasis: "Vertrag (Funktion) und berechtigtes Interesse; Cache.",
  },

  // ------------------------------------------------------- Betrieb/Technik
  {
    key: "OPS_EVENTS",
    table: "ops_events",
    column: "created_at",
    days: 90,
    action: "delete",
    purpose: "Technische Betriebsereignisse und Fehler (ohne Klartext-Nutzerdaten).",
    legalBasis: "Berechtigtes Interesse (Betriebssicherheit, Fehleranalyse).",
  },
  {
    key: "OPS_INCIDENTS",
    table: "ops_incidents",
    column: "created_at",
    days: 365,
    action: "delete",
    purpose: "Zusammengefasste Störungsmeldungen des Betriebsmonitorings.",
    legalBasis: "Berechtigtes Interesse (Betriebssicherheit, Nachvollziehbarkeit).",
  },
  {
    key: "MEDIA_VARIANT_JOBS",
    table: "media_variant_jobs",
    column: "created_at",
    days: 30,
    action: "delete",
    purpose: "Warteschlange der Bildvarianten-Erzeugung.",
    legalBasis: "Berechtigtes Interesse; technische Warteschlange.",
  },
  {
    key: "COUNTER_EVENTS",
    table: "counter_events",
    column: "created_at",
    days: 7,
    action: "delete",
    purpose: "Zwischenpuffer für Zählerstände (ohne Personenbezug).",
    legalBasis: "Berechtigtes Interesse; technischer Puffer.",
  },

  // -------------------------------------------------------------- Market
  {
    key: "MARKET_ANALYTICS_EVENTS",
    table: "market_analytics_events",
    column: "created_at",
    days: 400,
    action: "delete",
    purpose: "Aufrufe, Favoriten, Kontakte und Angebote zu Inseraten (Verkäuferstatistik).",
    legalBasis: "Berechtigtes Interesse; Statistik nur für den jeweiligen Verkäufer.",
  },
  {
    key: "MARKET_SEARCHES",
    table: "market_searches",
    column: "created_at",
    days: 365,
    action: "delete",
    purpose: "Gespeicherte Suchen inklusive Benachrichtigungswunsch.",
    legalBasis: "Vertrag (auf Wunsch des Nutzers gespeichert).",
    note: "Nutzer können gespeicherte Suchen jederzeit selbst löschen.",
  },
  {
    key: "MARKET_PAYMENT_WEBHOOK_EVENTS",
    table: "market_payment_webhook_events",
    column: "processed_at",
    days: 180,
    action: "delete",
    purpose: "Kennungen verarbeiteter Zahlungsereignisse (Schutz vor Doppelverarbeitung).",
    legalBasis: "Berechtigtes Interesse; keine Zahlungsdaten enthalten.",
  },
  {
    key: "MARKET_SHIPPING_ADDRESS",
    table: "market_shipping",
    column: "created_at",
    days: 1095,
    action: "anonymize",
    anonymize: { address: null, tracking_number: null, carrier: null },
    purpose: "Lieferadresse und Sendungsdaten zur Erfüllung des Kaufvertrags.",
    legalBasis:
      "Vertrag; nach Ablauf der Gewährleistungs- und Verjährungsfristen entfällt der Zweck.",
    note: "Die Transaktion selbst bleibt als Buchungsnachweis erhalten – ohne Adresse.",
  },
  {
    key: "MARKET_TRANSACTIONS",
    table: "market_transactions",
    column: "created_at",
    days: null,
    action: "keep",
    purpose: "Buchungsnachweis über Kauf, Gebühren und Zahlungsstatus.",
    legalBasis:
      "Gesetzliche Aufbewahrungspflicht (§ 147 AO, § 257 HGB – bis zu 10 Jahre); Löschung vor Ablauf ausgeschlossen.",
    note: "Bei Kontolöschung bleibt der Datensatz erhalten; der Personenbezug wird nicht mit gelöscht, weil er Teil des Nachweises ist.",
  },
  {
    key: "MARKET_PAYMENT_RECORDS",
    table: "market_payment_records",
    column: "created_at",
    days: null,
    action: "keep",
    purpose: "Zahlungsnachweis (Anbieter-Kennungen, Betrag, Währung, Status, Umgebung).",
    legalBasis: "Gesetzliche Aufbewahrungspflicht (§ 147 AO, § 257 HGB – bis zu 10 Jahre).",
    note: "Enthält keine Karten- oder Kontodaten; diese liegen ausschließlich beim Zahlungsdienstleister.",
  },
];

export function ruleByKey(key: string): RetentionRule | undefined {
  return RETENTION_RULES.find((r) => r.key === key);
}

/** Regeln, die tatsächlich löschen oder anonymisieren. */
export function activeRules(): RetentionRule[] {
  return RETENTION_RULES.filter((r) => r.action !== "keep");
}
