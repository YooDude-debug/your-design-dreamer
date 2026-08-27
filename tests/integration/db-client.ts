import { execFileSync } from "node:child_process";

/**
 * Nur-lesender Datenbankzugang für Integrationstests.
 *
 * Sicherheitsregeln (bewusst hart durchgesetzt):
 *  - ausschließlich SELECT/WITH-Abfragen; jede schreibende Anweisung wird
 *    abgelehnt, bevor sie die Datenbank erreicht.
 *  - keine Ausgabe von Zugangsdaten; die Verbindung kommt aus den vorhandenen
 *    Umgebungsvariablen der Testumgebung.
 *  - keine Testdaten werden erzeugt, geändert oder gelöscht.
 */

const FORBIDDEN =
  /\b(insert\s+into|update\s+\w+\s+set|delete\s+from|drop\s+|alter\s+|create\s+|truncate\s+|grant\s+|revoke\s+|copy\s+|vacuum|refresh\s+materialized)/i;

export function dbAvailable(): boolean {
  return Boolean(process.env["PGHOST"]);
}

/** Entfernt Zeichenkettenliterale, damit Wörter in Werten nicht als Anweisung gelten. */
function withoutLiterals(sql: string): string {
  return sql.replace(/'([^']|'')*'/g, "''");
}

/** Führt eine lesende Abfrage aus und liefert Zeilen als Spaltenlisten. */
export function query(sql: string): string[][] {
  const trimmed = sql.trim().replace(/;$/, "");
  if (!/^(select|with)\b/i.test(trimmed)) {
    throw new Error("Nur lesende Abfragen sind erlaubt.");
  }
  if (trimmed.includes(";")) {
    throw new Error("Mehrere Anweisungen sind nicht erlaubt.");
  }
  if (FORBIDDEN.test(withoutLiterals(trimmed))) {
    throw new Error("Abfrage enthält eine schreibende Anweisung und wurde abgelehnt.");
  }

  const out = execFileSync("psql", ["-tA", "-F", "\u0001", "-c", trimmed], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split("\u0001"));
}

/** Einzelwert einer Abfrage. */
export function scalar(sql: string): string | undefined {
  return query(sql)[0]?.[0];
}

/** Erste Spalte aller Zeilen. */
export function column(sql: string): string[] {
  return query(sql).map((r) => r[0] ?? "");
}
