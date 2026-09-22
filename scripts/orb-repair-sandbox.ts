/**
 * ORB Developer / Repair Environment – Phase 3: Sandbox-Runner.
 *
 * Bewusst ausserhalb des laufenden ORB-Serverprozesses: der veröffentlichte
 * Serverprozess darf keine Prozesse starten und keinen Code anwenden. Dieser
 * Runner läuft in einer Node-/Bun-Umgebung und führt einen bereits
 * freigegebenen Fix ausschliesslich in einer isolierten Arbeitskopie aus.
 *
 * Aufruf:
 *   bun run scripts/orb-repair-sandbox.ts <ORB-FIX-0001> <approval.json>
 *
 * Die Freigabedatei wird im Administrationsbereich erzeugt und enthält
 * Fix-ID, Fingerabdruck und freigegebene Operationen. Ohne gültige Freigabe
 * wird nichts ausgeführt. Der Runner ändert weder Production noch Staging,
 * committet nichts und veröffentlicht nichts.
 */

import { readFileSync } from "node:fs";

import { diagnoseMemoryRecallCase, proposalFromDiagnosis } from "@/orb-dev/diagnose.server";
import { fixFingerprint, type FixApproval } from "@/orb-dev/fix-model";
import { executeApprovedFixInSandbox } from "@/orb-dev/sandbox.server";

async function main(): Promise<void> {
  const [fixId, approvalPath] = process.argv.slice(2);
  if (!fixId || !approvalPath) {
    console.error("Aufruf: bun run scripts/orb-repair-sandbox.ts <FIX-ID> <approval.json>");
    process.exit(2);
    return;
  }

  const diagnosis = await diagnoseMemoryRecallCase();
  const candidate = proposalFromDiagnosis(diagnosis, fixId);
  if ("error" in candidate) {
    console.error(candidate.error);
    process.exit(3);
    return;
  }

  const approval = JSON.parse(readFileSync(approvalPath, "utf8")) as FixApproval;
  const record = await executeApprovedFixInSandbox({
    proposal: candidate,
    approval,
    executor: `runner:${process.env["USER"] ?? "unknown"}`,
    projectRoot: process.cwd(),
  });

  console.log(
    JSON.stringify(
      {
        executionId: record.executionId,
        fixId: record.fixId,
        fingerprint: record.fingerprint,
        expectedFingerprint: fixFingerprint(candidate),
        baseCommit: record.baseCommit,
        state: record.state,
        reason: record.reason,
        reproduction: {
          attempted: record.reproduction.attempted,
          failureConfirmed: record.reproduction.failureConfirmed,
        },
        integrity: record.integrity,
        steps: record.steps.map((s) => ({
          command: s.command,
          exitCode: s.exitCode,
          durationMs: s.durationMs,
        })),
        cleanedUp: record.cleanedUp,
        liveCodeChanged: false,
        deployed: false,
      },
      null,
      2,
    ),
  );
  process.exit(record.state === "PASSED" ? 0 : 1);
}

void main();
