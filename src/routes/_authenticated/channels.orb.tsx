import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Elternroute der ORB-Bereiche; eigener Chat-Kontext existiert hier nicht. */
export const Route = createFileRoute("/_authenticated/channels/orb")({
  component: () => <Outlet />,
});
