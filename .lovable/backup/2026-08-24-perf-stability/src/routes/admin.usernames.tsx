import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminAddReservedUsername,
  adminDeleteReservedUsername,
  adminGetReservedUsernames,
  adminSetReservedUsernameActive,
} from "@/lib/admin.functions";
import {
  AdminButton,
  AdminEmpty,
  AdminInput,
  AdminLoading,
  AdminPanel,
  AdminSection,
  AdminSelect,
} from "@/components/admin/AdminUI";

const CATEGORIES = [
  "system",
  "staff",
  "admin",
  "support",
  "moderation",
  "official",
  "brand",
  "reserved",
  "impersonation",
  "inappropriate",
  "other",
] as const;

type Category = (typeof CATEGORIES)[number];

type Row = {
  id: string;
  username: string;
  normalized: string;
  category: string;
  reason: string;
  active: boolean;
  createdAt: string;
};

export const Route = createFileRoute("/admin/usernames")({
  head: () => ({
    meta: [
      { title: "Gesperrte Usernames — Y-Dude Admin" },
      {
        name: "description",
        content:
          "Verwaltung reservierter, geschützter und unzulässiger Usernames inklusive Bestandskonflikten.",
      },
      { property: "og:title", content: "Gesperrte Usernames — Y-Dude Admin" },
      {
        property: "og:description",
        content: "Sperrliste für Usernames zentral pflegen und Konflikte erkennen.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminUsernames,
});

function AdminUsernames() {
  const load = useServerFn(adminGetReservedUsernames);
  const add = useServerFn(adminAddReservedUsername);
  const setActive = useServerFn(adminSetReservedUsernameActive);
  const remove = useServerFn(adminDeleteReservedUsername);

  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [conflicts, setConflicts] = useState<
    { userId: string; username: string; category: string }[]
  >([]);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("reserved");
  const [newReason, setNewReason] = useState("");

  const refresh = useCallback(
    async (q: string) => {
      setRows(null);
      try {
        const res = await load({ data: { query: q } });
        setRows(res.rows);
        setConflicts(res.conflicts);
      } catch {
        setRows([]);
      }
    },
    [load],
  );

  useEffect(() => {
    void refresh("");
  }, [refresh]);

  const onAdd = async () => {
    if (newName.trim().length < 2) {
      toast.error("Bitte einen Eintrag mit mindestens 2 Zeichen angeben.");
      return;
    }
    try {
      await add({ data: { username: newName, category: newCategory, reason: newReason } });
      toast.success("Eintrag gespeichert.");
      setNewName("");
      setNewReason("");
      void refresh(query);
    } catch {
      toast.error("Eintrag konnte nicht gespeichert werden.");
    }
  };

  return (
    <AdminSection
      title="Gesperrte Usernames"
      description="Zentrale Sperrliste: Systemnamen, Markenschutz, Impersonation und unzulässige Begriffe. Varianten wie Trennzeichen oder angehängte Zahlen werden automatisch mitgeprüft."
      actions={
        <AdminButton onClick={() => void refresh(query)}>
          <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
        </AdminButton>
      }
    >
      <AdminPanel>
        <div className="flex flex-wrap items-center gap-2">
          <AdminInput value={newName} onChange={setNewName} placeholder="Username / Begriff" />
          <AdminSelect
            value={newCategory}
            onChange={setNewCategory}
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <AdminInput
            value={newReason}
            onChange={setNewReason}
            placeholder="Begründung (intern)"
            className="flex-1"
          />
          <AdminButton onClick={() => void onAdd()}>
            <Plus className="h-3.5 w-3.5" /> Hinzufügen
          </AdminButton>
        </div>
      </AdminPanel>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <AdminInput value={query} onChange={setQuery} placeholder="Suchen …" className="flex-1" />
        <AdminButton onClick={() => void refresh(query)}>Suchen</AdminButton>
      </div>

      {conflicts.length > 0 && (
        <AdminPanel>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <ShieldAlert className="h-3.5 w-3.5 text-brand" />
            Bestandskonten mit inzwischen gesperrtem Username ({conflicts.length})
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Diese Konten bleiben nutzbar; bei der nächsten Username-Änderung greift die Sperre.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {conflicts.map((c) => (
              <span
                key={c.userId}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                @{c.username} · {c.category}
              </span>
            ))}
          </div>
        </AdminPanel>
      )}

      {rows === null ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty>Keine Einträge gefunden.</AdminEmpty>
      ) : (
        <div className="mt-2 space-y-1.5">
          {rows.map((r) => (
            <AdminPanel key={r.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-foreground">
                    <span className="font-semibold">@{r.username}</span> · {r.category}
                    {r.active ? "" : " · inaktiv"}
                  </p>
                  {r.reason && <p className="text-[10px] text-muted-foreground">{r.reason}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <AdminButton
                    onClick={async () => {
                      await setActive({ data: { id: r.id, active: !r.active } });
                      void refresh(query);
                    }}
                  >
                    {r.active ? "Deaktivieren" : "Aktivieren"}
                  </AdminButton>
                  <AdminButton
                    variant="danger"
                    onClick={async () => {
                      await remove({ data: { id: r.id } });
                      void refresh(query);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </AdminButton>
                </div>
              </div>
            </AdminPanel>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
