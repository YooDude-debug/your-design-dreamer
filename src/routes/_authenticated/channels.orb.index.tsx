import { createFileRoute, redirect } from "@tanstack/react-router";

/** `/channels/orb` → `/channels/orb/normal` (kein eigener Chat-Kontext). */
export const Route = createFileRoute("/_authenticated/channels/orb/")({
  beforeLoad: () => {
    throw redirect({ to: "/channels/orb/$scope", params: { scope: "normal" }, replace: true });
  },
});
