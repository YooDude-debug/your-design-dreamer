import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

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
  const wasOpen = useRef(false);

  useEffect(() => {
    openMessenger();
  }, [openMessenger]);

  // Erst nach dem Öffnen gilt ein leeres Panel als "geschlossen" – sonst würde
  // der erste Render (Panel noch null) sofort zurück in den Feed springen.
  useEffect(() => {
    if (panel === "messenger") {
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current && panel === null) navigate({ to: "/dev", replace: true });
  }, [panel, navigate]);

  return <div className="min-h-[60vh]" aria-hidden />;
}
