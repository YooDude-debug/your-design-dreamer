import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Historische Route: Der angemeldete Startbereich (Feed) lag früher unter
 * `/dev`. Er heißt jetzt `/feed`. Diese Route existiert nur noch, damit alte
 * Deep-Links, Push-Benachrichtigungen und Lesezeichen weiterhin funktionieren –
 * sie leitet unverändert (inklusive Suchparameter wie `?chat=`) auf `/feed`.
 */
export const Route = createFileRoute("/_authenticated/dev")({
  beforeLoad: ({ location }) => {
    throw redirect({
      href: `/feed${location.searchStr ?? ""}${location.hash ? `#${location.hash}` : ""}`,
      replace: true,
    });
  },
  component: () => null,
});
