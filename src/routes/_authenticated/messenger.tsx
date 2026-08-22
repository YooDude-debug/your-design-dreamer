import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useSocialUI } from "@/lib/social-ui-context";

/**
 * Deep-Link auf den Messenger.
 *
 * Der Messenger bleibt bewusst das bestehende globale Overlay – diese Route
 * öffnet es nur und schickt den Nutzer beim Schliessen zurück in den Feed.
 */
export const Route = createFileRoute("/_authenticated/messenger")({
  ssr: false,
  component: MessengerRoute,
});

function MessengerRoute() {
  const { panel, openMessenger } = useSocialUI();
  const navigate = useNavigate();

  useEffect(() => {
    openMessenger();
  }, [openMessenger]);

  // Overlay geschlossen (X oder Escape): zurück in den Feed.
  useEffect(() => {
    if (panel === null) navigate({ to: "/dev", replace: true });
  }, [panel, navigate]);

  return <div className="min-h-[60vh]" aria-hidden />;
}
