/**
 * Channels, die der angemeldete Nutzer verwaltet (Owner oder Moderator).
 *
 * Grundlage ist ausschliesslich die Relation `channel_members`
 * (user_id → channel_id → role) im bestehenden Channel-System. Die Rolle
 * steuert die Menuepunkte; die eigentliche Berechtigung wird zusaetzlich
 * serverseitig über RLS und geprüfte Datenbankfunktionen erzwungen.
 */

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listManagedChannels } from "@/lib/channels.functions";

export function useManagedChannels(enabled = true) {
  const load = useServerFn(listManagedChannels);
  const { data = [], isLoading } = useQuery({
    queryKey: ["managed-channels"],
    queryFn: () => load(),
    enabled,
    staleTime: 60_000,
  });
  return { channels: data, loading: isLoading };
}
