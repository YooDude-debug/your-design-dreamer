import { describe, expect, it } from "vitest";

import {
  OPS_ALERT_RULES,
  OPS_AREAS,
  OPS_AREA_LABEL,
  OPS_LATENCY_BUDGET_MS,
  formatAlert,
  isSelftestEvent,
  opsFingerprint,

  opsIncidentTitle,
  shouldAlert,
  systemStatus,
} from "@/lib/ops-monitor.shared";

/**
 * Phase 3 – Observability: verifiziert Gruppierung, Schwellenwerte,
 * Wiederholungssperre, Umgebungstrennung und Datenschutz der Alarmtexte.
 */

describe("Gruppierung (Fingerprint)", () => {
  it("fasst gleichartige Fehler zusammen", () => {
    const a = opsFingerprint({ area: "payments", event: "webhook_failed", service: "stripe" });
    const b = opsFingerprint({ area: "payments", event: "webhook_failed", service: "stripe" });
    expect(a).toBe(b);
    expect(a).toBe("payments:webhook_failed:stripe");
  });

  it("trennt unterschiedliche Bereiche und Dienste", () => {
    expect(opsFingerprint({ area: "push", event: "failed" })).not.toBe(
      opsFingerprint({ area: "auth", event: "failed" }),
    );
    expect(opsFingerprint({ area: "push", event: "failed", service: "web_push" })).not.toBe(
      opsFingerprint({ area: "push", event: "failed", service: "apns" }),
    );
  });

  it("erzeugt lesbare Vorfallstitel", () => {
    expect(opsIncidentTitle("payments", "webhook_failed")).toContain(OPS_AREA_LABEL.payments);
    expect(opsIncidentTitle("payments", "webhook_failed")).toContain("webhook failed");
  });
});

describe("Alarmregeln", () => {
  it("Zahlungen und Sicherheit alarmieren beim ersten kritischen Ereignis", () => {
    for (const area of ["payments", "security"] as const) {
      expect(OPS_ALERT_RULES[area].threshold).toBe(1);
      expect(
        shouldAlert({ area, severity: "critical", environment: "production", countInWindow: 1 })
          .alert,
      ).toBe(true);
    }
  });

  it("häufige Bereiche brauchen eine Häufung", () => {
    expect(
      shouldAlert({
        area: "push",
        severity: "critical",
        environment: "production",
        countInWindow: 3,
      }).reason,
    ).toBe("below_threshold");
    expect(
      shouldAlert({
        area: "push",
        severity: "critical",
        environment: "production",
        countInWindow: OPS_ALERT_RULES.push.threshold,
      }).alert,
    ).toBe(true);
  });

  it("Hinweise unterhalb des Schweregrads lösen nichts aus", () => {
    expect(
      shouldAlert({
        area: "payments",
        severity: "info",
        environment: "production",
        countInWindow: 9,
      }).reason,
    ).toBe("severity_below_rule");
    expect(
      shouldAlert({
        area: "database",
        severity: "warning",
        environment: "production",
        countInWindow: 99,
      }).reason,
    ).toBe("severity_below_rule");
  });

  it("Development alarmiert niemals", () => {
    expect(
      shouldAlert({
        area: "security",
        severity: "critical",
        environment: "development",
        countInWindow: 100,
      }),
    ).toEqual({ alert: false, reason: "development" });
  });

  it("Staging kann alarmieren, bleibt aber als Staging gekennzeichnet", () => {
    expect(
      shouldAlert({
        area: "payments",
        severity: "critical",
        environment: "staging",
        countInWindow: 1,
      }).alert,
    ).toBe(true);
    expect(
      formatAlert({
        environment: "staging",
        severity: "critical",
        area: "payments",
        event: "webhook_failed",
        incidentId: "i1",
        count: 1,
      }).title,
    ).toContain("STAGING");
  });

  it("wiederholt nicht innerhalb der Sperrzeit, danach wieder", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const rule = OPS_ALERT_RULES.payments;
    const inside = new Date(now.getTime() - (rule.renotifyMinutes - 1) * 60_000).toISOString();
    const outside = new Date(now.getTime() - (rule.renotifyMinutes + 1) * 60_000).toISOString();
    expect(
      shouldAlert({
        area: "payments",
        severity: "critical",
        environment: "production",
        countInWindow: 5,
        lastAlertedAt: inside,
        now,
      }).reason,
    ).toBe("throttled");
    expect(
      shouldAlert({
        area: "payments",
        severity: "critical",
        environment: "production",
        countInWindow: 5,
        lastAlertedAt: outside,
        now,
      }).alert,
    ).toBe(true);
  });

  it("jeder Bereich hat vollständige Regeln und ein Latenzbudget-Konzept", () => {
    for (const area of OPS_AREAS) {
      const rule = OPS_ALERT_RULES[area];
      expect(rule.threshold).toBeGreaterThan(0);
      expect(rule.windowMinutes).toBeGreaterThan(0);
      expect(rule.renotifyMinutes).toBeGreaterThan(0);
      expect(OPS_AREA_LABEL[area]).toBeTruthy();
    }
    for (const budget of Object.values(OPS_LATENCY_BUDGET_MS)) {
      expect(budget).toBeGreaterThan(0);
    }
  });
});

describe("Alarmtext", () => {
  const alert = formatAlert({
    environment: "production",
    severity: "critical",
    area: "webhook",
    event: "stripe_webhook_failed",
    summary: "Error: signature mismatch",
    incidentId: "abc-123",
    count: 4,
    at: new Date("2026-01-01T10:00:00Z"),
  });

  it("enthält Umgebung, Bereich, Schweregrad, Vorfall und Verweis", () => {
    expect(alert.text).toContain("Environment: PRODUCTION");
    expect(alert.text).toContain("Severity: CRITICAL");
    expect(alert.text).toContain("Incident ID: abc-123");
    expect(alert.text).toContain("Occurrences: 4");
    expect(alert.text).toContain("/admin/health");
  });

  it("enthält keine Nutzerdaten oder Geheimnisse", () => {
    const forbidden = ["@", "sb_secret", "Bearer", "sk_live", "password", "token"];
    for (const needle of forbidden) {
      expect(alert.text.toLowerCase()).not.toContain(needle.toLowerCase());
    }
  });
});

describe("Ampel", () => {
  it("kritischer Vorfall setzt den Zustand auf down", () => {
    expect(systemStatus({ criticalOpen: 1, warningOpen: 0, errorsLastHour: 0 }).level).toBe("down");
  });
  it("Warnungen oder hohe Fehlerzahl ergeben degraded", () => {
    expect(systemStatus({ criticalOpen: 0, warningOpen: 2, errorsLastHour: 0 }).level).toBe(
      "degraded",
    );
    expect(systemStatus({ criticalOpen: 0, warningOpen: 0, errorsLastHour: 50 }).level).toBe(
      "degraded",
    );
  });
  it("ohne Auffälligkeiten ok", () => {
    expect(systemStatus({ criticalOpen: 0, warningOpen: 0, errorsLastHour: 1 }).level).toBe("ok");
  });
});

describe("Selbsttest-Trennung", () => {
  it("erkennt Testereignisse", () => {
    expect(isSelftestEvent("selftest_api_error")).toBe(true);
    expect(isSelftestEvent("unhandled_server_error")).toBe(false);
  });

  it("gruppiert Testereignisse in einem eigenen Namensraum", () => {
    expect(opsFingerprint({ area: "api", event: "selftest_api_error" })).toMatch(/^selftest:/);
    expect(opsFingerprint({ area: "api", event: "unhandled_server_error" })).not.toMatch(
      /^selftest:/,
    );
  });

  it("kennzeichnet Testvorfälle im Titel", () => {
    expect(opsIncidentTitle("api", "selftest_api_error")).toContain("[SELBSTTEST]");
  });

  it("alarmiert nie bei Testereignissen", () => {
    const decision = shouldAlert({
      area: "payments",
      severity: "critical",
      environment: "production",
      event: "selftest_api_error",
      countInWindow: 99,
    });
    expect(decision.alert).toBe(false);
    expect(decision.reason).toBe("selftest");
  });
});
