import { lazy, Suspense } from "react";

/**
 * Code-Splitting für den Profil-Bearbeiten-Dialog: wird ausschließlich beim
 * Öffnen geladen (eigener Chunk), Aussehen und Verhalten bleiben identisch.
 */
const ProfileEditDialogImpl = lazy(() =>
  import("@/components/ProfileEditDialog").then((m) => ({ default: m.ProfileEditDialog })),
);

export function LazyProfileEditDialog(props: {
  open: boolean;
  onClose: () => void;
  initialTab?: "profile" | "settings" | "security";
}) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <ProfileEditDialogImpl {...props} />
    </Suspense>
  );
}
