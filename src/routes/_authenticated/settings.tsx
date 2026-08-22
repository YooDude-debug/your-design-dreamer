import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { ProfileEditDialog } from "@/components/ProfileEditDialog";

/**
 * Deep-Link auf die Einstellungen.
 *
 * Es wird die bestehende Einstellungs-Oberfläche (ProfileEditDialog) verwendet;
 * beim Schliessen geht es zurück in den Feed.
 */
export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  component: SettingsRoute,
});

function SettingsRoute() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[60vh]">
      <ProfileEditDialog
        open
        initialTab="profile"
        onClose={() => navigate({ to: "/dev", replace: true })}
      />
    </div>
  );
}
