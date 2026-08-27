import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SocialContext, type SocialCtx } from "@/lib/social-context";
import { parsePlacement, type MediaTagPlacement } from "@/lib/messenger-image-tag";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { removeUploads, signPaths, uploadDataUrl } from "@/lib/media";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { loadSessionBootstrap } from "@/lib/session-bootstrap";
import type { PresenceStatus } from "@/lib/types";

import {
  disablePush,
  enablePush,
  pushDeviceActive,
  pushPermission,
  pushSupported,
  syncPushDevice,
} from "@/lib/push-client";
import { flushPushQueue } from "@/lib/push.functions";

/**
 * Hintergrundversand: darf die App nie stoeren. Faengt auch synchrone Fehler
 * (z. B. veraltete Server-Function-IDs nach einem Deploy) ab.
 */
async function safeFlushPushQueue() {
  try {
    await flushPushQueue();
  } catch {
    /* ignoriert */
  }
}
import {
  fetchConnectionSuggestions,
  refreshConnectionSuggestions,
  type ConnectionSuggestion,
} from "@/lib/connection-suggestions";

type Row = Record<string, unknown>;

export type ConnectionStatus = "pending" | "accepted" | "declined";

export type Connection = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: ConnectionStatus;
  createdAt: number;
  updatedAt: number;
};

export type MessageKind =
  | "text"
  | "image"
  | "gif"
  | "audio"
  | "slangtag"
  | "chat_slangtag"
  /** Market-Artikelkontext im Chat (verweist auf den Original-Artikel). */
  | "market_item"
  /** Preisangebot im Chat (verweist auf `market_offers`). */
  | "market_offer";

/**
 * Privater Chat-SlangTag: existiert ausschliesslich innerhalb einer
 * Unterhaltung. Vollstaendig getrennt von oeffentlichen SlangTags
 * (eigene Tabelle `chat_slang_tags`) – erscheint daher nie in Bibliothek,
 * Feed, Suche, Rankings oder Statistiken.
 */
export type ChatSlangTag = {
  id: string;
  conversationId: string;
  creatorId: string;
  name: string;
  audioPath: string | null;
  audio: string | null;
  duration: string;
  createdAt: number;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  kind: MessageKind;
  body: string;
  mediaPath: string | null;
  media: string | null;
  slangTagIds: string[];
  chatSlangTagId: string | null;
  /** SlangTag-Overlay auf einem Bild (relative Position, getrennt vom Bild). */
  mediaPlacement: MediaTagPlacement | null;
  /** Optionaler Market-Bezug (Artikelkontext / Angebot). */
  marketItemId: string | null;
  marketOfferId: string | null;
  createdAt: number;
  deliveredAt: number | null;
  readAt: number | null;
};

export type Conversation = {
  id: string;
  /** "direct" = Connection-Chat, "market" = Market-Chat (eigene Kategorie). */
  kind: string;
  title: string;
  createdBy: string;
  lastMessageAt: number;
  members: string[];
  lastReadAt: number;
  /** Nur bei Market-Chats gesetzt: der zugehoerige Artikel. */
  marketItemId: string | null;
};

/** Market-Chats erscheinen ausschliesslich in der Market-Kategorie. */
export function isMarketConversation(c: Conversation): boolean {
  return c.kind === "market";
}

export type AppNotification = {
  id: string;
  userId: string;
  actorId: string | null;
  type: "connection_request" | "connection_accepted" | "message" | string;
  title: string | null;
  body: string;
  entityType: string | null;
  entityId: string | null;
  /** Sprungziel innerhalb der App (z. B. `/p/<id>`). */
  link: string | null;
  read: boolean;
  createdAt: number;
  /** Anzahl gebündelter Ereignisse (z. B. Likes an einem Beitrag). */
  groupCount: number;
};

/** Beziehung zwischen mir und einem anderen Profil. */
export type RelationState = "self" | "none" | "outgoing" | "incoming" | "connected" | "declined";

export type SendMessageInput = {
  kind: MessageKind;
  body?: string;
  /** Data-URL für Bild / GIF / Audio */
  mediaDataUrl?: string | null;
  slangTagIds?: string[];
  chatSlangTagId?: string | null;
  /** Relative Position eines SlangTags auf dem Bild (0..1). */
  mediaPlacement?: MediaTagPlacement | null;
  /** Optionaler Market-Artikelbezug. */
  marketItemId?: string | null;
};

/** Pagination: Anzahl der Nachrichten pro Ladevorgang. */
const MESSAGE_PAGE_SIZE = 30;

/**
 * Entprellung des Lesestatus je Unterhaltung: Treffen mehrere Nachrichten
 * schnell hintereinander ein, wird nur einmal geschrieben. Die Anzeige bleibt
 * sofort korrekt, weil der lokale Zustand direkt aktualisiert wird.
 */
const READ_DEBOUNCE_MS = 2000;

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const ts = (v: unknown) => (v ? new Date(v as string).getTime() : 0);

function mapConnection(r: Row): Connection {
  return {
    id: r.id as string,
    requesterId: r.requester_id as string,
    addresseeId: r.addressee_id as string,
    status: r.status as ConnectionStatus,
    createdAt: ts(r.created_at),
    updatedAt: ts(r.updated_at),
  };
}

/** Benachrichtigungszeile -> UI-Objekt (gleich für Einzelabfrage und Bootstrap). */
function mapNotification(r: Row): AppNotification {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    actorId: (r.actor_id as string | null) ?? null,
    type: r.type as string,
    title: (r.title as string | null) ?? null,
    body: (r.body as string) ?? "",
    entityType: (r.entity_type as string | null) ?? null,
    entityId: (r.entity_id as string | null) ?? null,
    link: (r.link as string | null) ?? null,
    read: Boolean(r.read),
    createdAt: ts(r.created_at),
    groupCount: Math.max(1, Number(r.group_count ?? 1) || 1),
  };
}

/** Chatzeile inkl. Mitgliederliste -> UI-Objekt. */
function mapConversation(c: Row, members: string[], lastReadAt: unknown): Conversation {
  return {
    id: c.id as string,
    kind: (c.kind as string) ?? "direct",
    title: (c.title as string) ?? "",
    createdBy: c.created_by as string,
    lastMessageAt: ts(c.last_message_at),
    members,
    lastReadAt: ts(lastReadAt),
    marketItemId: (c.kind as string) === "market" ? (c.title as string) || null : null,
  };
}

function mapMessage(r: Row, urls: Record<string, string>): ChatMessage {
  const path = (r.media_url as string | null) ?? null;
  return {
    id: r.id as string,
    conversationId: r.conversation_id as string,
    senderId: r.sender_id as string,
    kind: (r.kind as MessageKind) ?? "text",
    body: (r.body as string) ?? "",
    mediaPath: path,
    media: path ? (urls[path] ?? null) : null,
    slangTagIds: asArray<string>(r.slang_tag_ids),
    chatSlangTagId: (r.chat_slang_tag_id as string | null) ?? null,
    mediaPlacement: parsePlacement(r.media_placement),
    marketItemId: (r.market_item_id as string | null) ?? null,
    marketOfferId: (r.market_offer_id as string | null) ?? null,
    createdAt: ts(r.created_at),
    deliveredAt: r.delivered_at ? ts(r.delivered_at) : null,
    readAt: r.read_at ? ts(r.read_at) : null,
  };
}

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user, profiles, ensureProfiles } = useData();
  // Wörterbuch als Ref, damit Sprachwechsel keine Callback-Identitäten ändert.
  const { t } = useLang();
  const tRef = useRef(t);
  tRef.current = t;
  const uid = user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messagesByConversation, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [chatSlangTags, setChatSlangTags] = useState<Record<string, ChatSlangTag>>({});
  const [hasMoreMessages, setHasMoreMessages] = useState<Record<string, boolean>>({});
  /** Ungelesen-Zähler je Chat (ohne geladene Nachrichteninhalte). */
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const messagesRef = useRef<Record<string, ChatMessage[]>>({});
  /** Aktuelle Ungelesen-Zähler ohne Neuaufbau von Callbacks. */
  const unreadCountsRef = useRef<Record<string, number>>({});
  /** Zeitpunkt des letzten geschriebenen Lesestatus je Chat (Entprellung). */
  const readWriteAtRef = useRef<Record<string, number>>({});
  const readTimersRef = useRef<Record<string, number>>({});
  /** Vorgemerkte (entprellte) Lesestatus-Schreibvorgaenge je Unterhaltung. */
  const readPendingRef = useRef<Record<string, boolean>>({});
  const markConversationReadRef = useRef<((id: string) => Promise<void>) | null>(null);
  /** Aktueller Chat-Stand ohne Neuaufbau von Callbacks (verhindert Effekt-Schleifen). */
  const conversationsRef = useRef<Conversation[]>([]);

  const connectedIdsRef = useRef<string[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  /** Letzter bekannter Stand – für Rollback bei fehlgeschlagenem Löschen. */
  const notificationsRef = useRef<AppNotification[]>([]);
  /** Technische Präsenz: welche Clients sind gerade verbunden (nur informativ). */
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  /**
   * Live-Aktualisierungen des manuell gewählten Status. Quelle der Wahrheit
   * bleibt `profiles.presence_status`; hier landen nur neuere Werte aus
   * Realtime, bis der Profil-Datensatz erneut geladen wurde.
   */
  const [presenceOverrides, setPresenceOverrides] = useState<Record<string, PresenceStatus>>({});
  const [typingIn, setTypingIn] = useState<Record<string, string[]>>({});
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [suggestions, setSuggestions] = useState<ConnectionSuggestion[]>([]);
  const [pushEnabled, setPushEnabledState] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const me = uid ? profiles[uid] : undefined;

  // ---------- Laden ----------
  /**
   * Verbindungen beider Richtungen laden (ich als Anfragender ODER als
   * Empfänger) und die zugehörigen Profile über die User-ID nachziehen –
   * sonst fehlen Name, Handle und Avatar bei Konten, die nicht im
   * Profil-Grundstock stecken.
   */
  const loadConnections = useCallback(async () => {
    if (!uid) return setConnections([]);
    const { data, error } = await supabase
      .from("connections")
      .select("*")
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[social] connections_fetch_error", error.code ?? "", error.message);
      toast.error(tRef.current.connectionsLoadError);
      return;
    }
    const rows = (data ?? []) as Row[];
    const mapped = rows.map(mapConnection);
    setConnections(mapped);
    const counterparts = mapped.map((c) => (c.requesterId === uid ? c.addresseeId : c.requesterId));
    if (counterparts.length > 0) await ensureProfiles(counterparts);
  }, [uid, ensureProfiles]);

  /**
   * Freundevorschläge: liest den serverseitigen Cache. Ist er leer oder
   * veraltet, wird die Neuberechnung asynchron angestossen – die UI wartet
   * nie darauf.
   */
  const loadSuggestions = useCallback(
    async (force = false) => {
      if (!uid) return setSuggestions([]);
      const rows = await fetchConnectionSuggestions();
      setSuggestions(rows);
      if (rows.length === 0 || force) {
        void refreshConnectionSuggestions(force)
          .then(fetchConnectionSuggestions)
          .then((next) => {
            if (next.length) setSuggestions(next);
          })
          .catch(() => undefined);
      }
    },
    [uid],
  );

  const loadConversations = useCallback(async () => {
    if (!uid) return setConversations([]);
    // Schritt 1: nur die EIGENEN Mitgliedschaften (indexgestuetzt ueber
    // user_id) – nicht mehr alle sichtbaren Mitgliedschaftszeilen.
    const { data: mineRows } = await supabase
      .from("conversation_members")
      .select("conversation_id,last_read_at")
      .eq("user_id", uid);
    const mine = (mineRows ?? []) as Row[];
    const myIds = mine.map((r) => r.conversation_id as string);
    if (myIds.length === 0) return setConversations([]);
    const lastReadById = new Map(
      mine.map((r) => [r.conversation_id as string, r.last_read_at as string | null]),
    );

    // Schritt 2: Mitgliederlisten ausschliesslich fuer die eigenen Chats.
    const [{ data: convRows }, { data: memberRows }] = await Promise.all([
      supabase
        .from("conversations")
        .select("*")
        .in("id", myIds)
        .order("last_message_at", { ascending: false }),
      supabase
        .from("conversation_members")
        .select("conversation_id,user_id")
        .in("conversation_id", myIds),
    ]);
    const rows = (memberRows ?? []) as Row[];

    setConversations(
      ((convRows ?? []) as Row[]).map((c) => {
        const id = c.id as string;
        const members = rows
          .filter((r) => r.conversation_id === id)
          .map((r) => r.user_id as string);
        return mapConversation(c, members, lastReadById.get(id) ?? undefined);
      }),
    );
  }, [uid]);

  const loadNotifications = useCallback(async () => {
    if (!uid) return setNotifications([]);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications(((data ?? []) as Row[]).map(mapNotification));
  }, [uid]);

  /** Laedt private Chat-SlangTags zu den angezeigten Nachrichten nach. */
  const loadChatSlangTags = useCallback(async (rows: Row[]) => {
    const ids = Array.from(
      new Set(
        rows
          .map((r) => r.chat_slang_tag_id as string | null)
          .filter((v): v is string => Boolean(v)),
      ),
    );
    if (ids.length === 0) return;
    const { data } = await supabase.from("chat_slang_tags").select("*").in("id", ids);
    const tagRows = (data ?? []) as Row[];
    if (tagRows.length === 0) return;
    const urls = await signPaths(tagRows.map((r) => r.audio_url as string | null));
    setChatSlangTags((prev) => {
      const next = { ...prev };
      for (const r of tagRows) {
        const path = (r.audio_url as string | null) ?? null;
        next[r.id as string] = {
          id: r.id as string,
          conversationId: r.conversation_id as string,
          creatorId: r.creator_id as string,
          name: (r.name as string) ?? "",
          audioPath: path,
          audio: path ? (urls[path] ?? null) : null,
          duration: (r.duration as string) ?? "0:01",
          createdAt: ts(r.created_at),
        };
      }
      return next;
    });
  }, []);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);
      const rows = ((data ?? []) as Row[]).slice().reverse();
      const urls = await signPaths(rows.map((r) => r.media_url as string | null));
      void loadChatSlangTags(rows);
      setMessages((prev) => ({ ...prev, [conversationId]: rows.map((r) => mapMessage(r, urls)) }));
      setHasMoreMessages((prev: Record<string, boolean>) => ({
        ...prev,
        [conversationId]: rows.length === MESSAGE_PAGE_SIZE,
      }));
    },
    [loadChatSlangTags],
  );

  /** Lazy Loading: lädt die nächste Seite älterer Nachrichten. */
  useEffect(() => {
    messagesRef.current = messagesByConversation;
  }, [messagesByConversation]);

  useEffect(() => {
    unreadCountsRef.current = unreadCounts;
  }, [unreadCounts]);

  // Offene Entprellungs-Timer beim Verlassen aufräumen.
  useEffect(
    () => () => {
      Object.values(readTimersRef.current).forEach((t) => window.clearTimeout(t));
      readTimersRef.current = {};
    },
    [],
  );

  const loadOlderMessages = useCallback(
    async (conversationId: string) => {
      const current = messagesRef.current[conversationId] ?? [];
      const oldest = current[0];
      if (!oldest) return;
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .lt("created_at", new Date(oldest.createdAt).toISOString())
        .order("created_at", { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);
      const rows = ((data ?? []) as Row[]).slice().reverse();
      const urls = await signPaths(rows.map((r) => r.media_url as string | null));
      void loadChatSlangTags(rows);
      setMessages((prev) => ({
        ...prev,
        [conversationId]: [
          ...rows.map((r) => mapMessage(r, urls)),
          ...(prev[conversationId] ?? []),
        ],
      }));
      setHasMoreMessages((prev: Record<string, boolean>) => ({
        ...prev,
        [conversationId]: rows.length === MESSAGE_PAGE_SIZE,
      }));
    },
    [loadChatSlangTags],
  );

  /**
   * Ungelesene Nachrichten je Chat – bewusst ohne Nachrichteninhalte.
   * So zeigt die Chatliste korrekte Zähler, ohne alle Chats vorzuladen.
   */
  const loadUnreadCounts = useCallback(async () => {
    if (!uid) return setUnreadCounts({});
    const { data } = await supabase
      .from("messages")
      .select("conversation_id")
      .neq("sender_id", uid)
      .is("read_at", null);
    const next: Record<string, number> = {};
    ((data ?? []) as Row[]).forEach((r) => {
      const key = r.conversation_id as string;
      next[key] = (next[key] ?? 0) + 1;
    });
    setUnreadCounts(next);
  }, [uid]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      // Freundevorschlaege gehoeren nicht zum Sitzungsstart: sie werden erst
      // geladen, wenn das Verbindungen-Fenster geoeffnet wird (spart beim
      // Start eine Abfrage plus die Neuberechnung).
      //
      // Verbindungen, Chats, Ungelesen-Zaehler und Benachrichtigungen kommen
      // beim Start gebuendelt aus dem Bootstrap-Aufruf des Datenkerns
      // (fuenf Abfragen weniger). Fehlt er, wird wie bisher einzeln geladen.
      const boot = uid ? await loadSessionBootstrap(uid) : null;
      if (boot && Array.isArray(boot.connections) && Array.isArray(boot.conversations)) {
        if (!cancelled) {
          const bootConnections = (boot.connections as Row[]).map(mapConnection);
          setConnections(bootConnections);
          // Profile der Gegenüber (Anfragen + bestätigte Verbindungen) nachziehen.
          void ensureProfiles(
            bootConnections.map((c) => (c.requesterId === uid ? c.addresseeId : c.requesterId)),
          );
          setConversations(
            (boot.conversations as Row[]).map((c) =>
              mapConversation(
                c,
                Array.isArray(c.members) ? (c.members as string[]) : [],
                c.last_read_at,
              ),
            ),
          );
          setUnreadCounts((boot.unread_counts as Record<string, number>) ?? {});
          setNotifications(
            Array.isArray(boot.notifications)
              ? (boot.notifications as Row[]).map(mapNotification)
              : [],
          );
          setLoading(false);
        }
        return;
      }
      await Promise.all([
        loadConnections(),
        loadConversations(),
        loadNotifications(),
        loadUnreadCounts(),
      ]);
      if (!cancelled) setLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    uid,
    ensureProfiles,
    loadConnections,
    loadConversations,
    loadNotifications,
    loadUnreadCounts,
  ]);

  /**
   * Präsenz + Realtime für Connections, Chats und Benachrichtigungen.
   *
   * Sicherheitsprinzip (Realtime-Scoping): Es gibt keine globalen Broadcast-
   * oder Presence-Topics mehr. Jeder Nutzer sendet seinen Status nur in sein
   * eigenes Topic (`presence-u-<uuid>`) und hört ausschliesslich die Topics
   * der Personen ab, die er ohnehin sehen darf (bestätigte Verbindungen und
   * Chat-Partner). Tipp-Hinweise laufen pro Unterhaltung über
   * `chat-<conversation-uuid>` – abonniert werden nur Unterhaltungen, deren
   * Mitgliedschaft die Datenbank (RLS) bereits bestätigt hat.
   */
  const presenceRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const myStatus = me?.presenceStatus ?? "online";
  const myStatusRef = useRef<PresenceStatus>(myStatus);

  /**
   * Personen, deren Präsenz sichtbar sein darf: bestätigte Verbindungen und
   * Mitglieder eigener Unterhaltungen. Beides ist bereits serverseitig
   * (RLS) gefiltert geladen.
   */
  const presencePeerIds = useMemo(() => {
    if (!uid) return [] as string[];
    const set = new Set<string>();
    connections
      .filter((c) => c.status === "accepted")
      .forEach((c) => set.add(c.requesterId === uid ? c.addresseeId : c.requesterId));
    conversations.forEach((c) => c.members.forEach((m) => set.add(m)));
    set.delete(uid);
    // Obergrenze schützt die Realtime-Verbindung vor unnötig vielen Kanälen.
    return Array.from(set).slice(0, PRESENCE_PEER_LIMIT).sort();
  }, [uid, connections, conversations]);
  const presencePeerKey = presencePeerIds.join(",");

  /** Eigenes Presence-Topic: nur der eigene Status wird gesendet. */
  useEffect(() => {
    if (!uid) return;
    const presence = supabase.channel(presenceTopic(uid), {
      config: { presence: { key: uid } },
    });
    presenceRef.current = presence;
    presence.subscribe((status) => {
      // Nur der Status reist mit – keine Zeitstempel oder weitere Metadaten.
      if (status === "SUBSCRIBED") void presence.track({ status: myStatusRef.current });
    });
    return () => {
      presenceRef.current = null;
      void supabase.removeChannel(presence);
    };
  }, [uid]);

  /** Presence der berechtigten Gegenüber – ein Topic je Person. */
  useEffect(() => {
    if (!uid) return;
    const peers = presencePeerKey ? presencePeerKey.split(",") : [];
    if (peers.length === 0) {
      setOnlineIds([]);
      return;
    }
    const online = new Set<string>();
    const channels = peers.map((peerId) => {
      const ch = supabase.channel(presenceTopic(peerId), {
        config: { presence: { key: `o-${uid}` } },
      });
      const sync = () => {
        const state = ch.presenceState() as Record<string, Array<{ status?: PresenceStatus }>>;
        // Nur der Eigentümer des Topics zählt; Mitleser tragen `o-`-Keys.
        const metas = state[peerId];
        const isOnline = Array.isArray(metas) && metas.length > 0;
        if (isOnline) online.add(peerId);
        else online.delete(peerId);
        setOnlineIds(Array.from(online));
        const status = metas?.[metas.length - 1]?.status;
        if (status) {
          setPresenceOverrides((prev) => (prev[peerId] === status ? prev : { ...prev, [peerId]: status }));
        }
      };
      ch.on("presence", { event: "sync" }, sync)
        .on("presence", { event: "join" }, sync)
        .on("presence", { event: "leave" }, sync)
        .subscribe();
      return ch;
    });
    return () => {
      channels.forEach((ch) => void supabase.removeChannel(ch));
    };
  }, [uid, presencePeerKey]);

  /** Datenbank-Ereignisse (RLS-gefiltert) in einem nutzereigenen Topic. */
  useEffect(() => {
    if (!uid) return;
    const live = supabase.channel(`ydude-social-${uid}`);
    /**
     * Verbindungen: serverseitig auf die eigenen Datensätze gefiltert
     * (zwei Filter, da Realtime nur eine Spalte je Listener prüfen kann).
     */
    const onConnection = (payload: { new: Row | null; eventType: string }) => {
      const row = payload.new;
      if (payload.eventType === "INSERT" && row?.["addressee_id"] === uid)
        console.info("[social] connection_request_received");
      void loadConnections();
      // Der Cache wird per Trigger geleert – danach neu berechnen.
      void loadSuggestions(true);
    };
    live
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "connections",
          filter: `requester_id=eq.${uid}`,
        },
        (p) => onConnection(p as never),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "connections",
          filter: `addressee_id=eq.${uid}`,
        },
        (p) => onConnection(p as never),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_members",
          filter: `user_id=eq.${uid}`,
        },
        () => {
          void loadConversations();
        },
      )
      // `conversations` selbst wird nicht mehr abonniert: jede Änderung dort
      // folgt aus einer neuen Nachricht bzw. Mitgliedschaft und wird über die
      // beiden folgenden Listener bereits abgedeckt.
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const conv = (payload.new as Row)?.conversation_id as string | undefined;
          // Nachrichteninhalte werden nur für bereits geöffnete Chats
          // nachgeladen; für alle anderen genügen Liste und Zähler.
          if (conv && messagesRef.current[conv]) void loadMessages(conv);
          void loadConversations();
          void loadUnreadCounts();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const conv = (payload.new as Row)?.conversation_id as string | undefined;
          if (conv && messagesRef.current[conv]) void loadMessages(conv);
          void loadUnreadCounts();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        () => {
          void loadNotifications();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(live);
    };
  }, [
    uid,
    loadConnections,
    loadConversations,
    loadMessages,
    loadNotifications,
    loadSuggestions,
    loadUnreadCounts,
  ]);

  /** Statuswechsel sofort im eigenen Presence-Topic nachziehen. */

  useEffect(() => {
    myStatusRef.current = myStatus;
    const ch = presenceRef.current;
    if (ch) void ch.track({ status: myStatus });
  }, [myStatus]);

  /**
   * Tipp-Hinweise: ein privates Topic je Unterhaltung. Abonniert werden nur
   * Unterhaltungen, in denen die Datenbank die eigene Mitgliedschaft bereits
   * bestätigt hat – fremde Chat-Topics werden nie betreten.
   */
  const typingChannels = useRef<Record<string, ReturnType<typeof supabase.channel>>>({});
  const conversationIdKey = useMemo(
    () =>
      conversations
        .map((c) => c.id)
        .sort()
        .join(","),
    [conversations],
  );

  useEffect(() => {
    if (!uid) return;
    const ids = conversationIdKey ? conversationIdKey.split(",").slice(0, CHAT_TOPIC_LIMIT) : [];
    const created: ReturnType<typeof supabase.channel>[] = [];
    ids.forEach((conversationId) => {
      if (typingChannels.current[conversationId]) return;
      const ch = supabase.channel(chatTopic(conversationId));
      ch.on("broadcast", { event: "typing" }, ({ payload }) => {
        const senderId = (payload as { u?: string } | null)?.u;
        if (!senderId || senderId === uid) return;
        // Nur Mitglieder derselben Unterhaltung dürfen einen Tipp-Hinweis setzen.
        const conv = conversationsRef.current.find((c) => c.id === conversationId);
        if (!conv || !conv.members.includes(senderId)) return;
        setTypingIn((prev) => ({
          ...prev,
          [conversationId]: Array.from(new Set([...(prev[conversationId] ?? []), senderId])),
        }));
        const key = `${conversationId}:${senderId}`;
        clearTimeout(typingTimers.current[key]);
        typingTimers.current[key] = setTimeout(() => {
          setTypingIn((prev) => ({
            ...prev,
            [conversationId]: (prev[conversationId] ?? []).filter((u) => u !== senderId),
          }));
        }, 3000);
      }).subscribe();
      typingChannels.current[conversationId] = ch;
      created.push(ch);
    });
    // Kanäle verlassener Unterhaltungen abbauen.
    Object.keys(typingChannels.current).forEach((id) => {
      if (ids.includes(id)) return;
      const ch = typingChannels.current[id];
      delete typingChannels.current[id];
      if (ch) void supabase.removeChannel(ch);
    });
    return () => {
      created.forEach((ch) => {
        const id = Object.keys(typingChannels.current).find((k) => typingChannels.current[k] === ch);
        if (id) delete typingChannels.current[id];
        void supabase.removeChannel(ch);
      });
    };
  }, [uid, conversationIdKey]);

  const emitTyping = useCallback(
    (conversationId: string) => {
      if (!uid) return;
      // Nur in eigene Unterhaltungen senden.
      const conv = conversationsRef.current.find((c) => c.id === conversationId);
      if (!conv || !conv.members.includes(uid)) return;
      const ch = typingChannels.current[conversationId];
      if (!ch) return;
      void ch.send({ type: "broadcast", event: "typing", payload: { u: uid } });
    },
    [uid],
  );

  // ---------- Connections ----------
  const connectionOf = useCallback<SocialCtx["connectionOf"]>(
    (userId) =>
      connections.find(
        (c) =>
          (c.requesterId === uid && c.addresseeId === userId) ||
          (c.addresseeId === uid && c.requesterId === userId),
      ),
    [connections, uid],
  );

  const relationWith = useCallback<SocialCtx["relationWith"]>(
    (userId) => {
      if (!uid) return "none";
      if (userId === uid) return "self";
      const c = connectionOf(userId);
      if (!c) return "none";
      if (c.status === "accepted") return "connected";
      if (c.status === "declined") return "declined";
      return c.requesterId === uid ? "outgoing" : "incoming";
    },
    [uid, connectionOf],
  );

  const incoming = useMemo(
    () => connections.filter((c) => c.status === "pending" && c.addresseeId === uid),
    [connections, uid],
  );
  const outgoing = useMemo(
    () => connections.filter((c) => c.status === "pending" && c.requesterId === uid),
    [connections, uid],
  );
  const connectedIds = useMemo(
    () =>
      connections
        .filter((c) => c.status === "accepted")
        .map((c) => (c.requesterId === uid ? c.addresseeId : c.requesterId)),
    [connections, uid],
  );

  /** Zählt nur die eigenen bestätigten Verbindungen (fremde Listen sind privat). */
  const connectionCount = useCallback<SocialCtx["connectionCount"]>(
    (userId) => (userId === uid ? connectedIds.length : connectedIds.includes(userId) ? 1 : 0),
    [uid, connectedIds],
  );

  const mutualConnections = useCallback<SocialCtx["mutualConnections"]>(
    (userId) => (connectedIds.includes(userId) ? connectedIds.filter((i) => i !== userId) : []),
    [connectedIds],
  );

  const searchProfiles = useCallback<SocialCtx["searchProfiles"]>(
    (q) => {
      const key = q.trim().toLowerCase();
      // Profil-Sichtbarkeit: privat nie, "nur Freunde" ausschliesslich fuer Connections.
      const all = Object.values(profiles).filter((p) => {
        if (p.id === uid) return false;
        if (p.profileVisibility === "private") return false;
        if (p.profileVisibility === "connections") return connectedIds.includes(p.id);
        return true;
      });
      if (!key) return all.slice(0, 12);
      return all
        .filter(
          (p) =>
            p.username.toLowerCase().includes(key) || p.displayName.toLowerCase().includes(key),
        )
        .slice(0, 20);
    },
    [profiles, uid, connectedIds],
  );

  const notify = useCallback(
    async (
      target: string,
      type: string,
      body: string,
      extra?: { title?: string; entityType?: string; entityId?: string | null; link?: string },
    ) => {
      if (!uid) return;
      await supabase.from("notifications").insert({
        user_id: target,
        actor_id: uid,
        type,
        title: extra?.title,
        body,
        entity_type: extra?.entityType,
        entity_id: extra?.entityId ?? null,
        link: extra?.link,
      });
      // Versand laeuft im Hintergrund – niemals darauf warten.
      void safeFlushPushQueue();
    },
    [uid],
  );

  const sendRequest = useCallback<SocialCtx["sendRequest"]>(
    async (userId) => {
      if (!uid || userId === uid) return;
      const { error } = await supabase
        .from("connections")
        .insert({ requester_id: uid, addressee_id: userId });
      if (error) {
        console.error("[social] connection_create_error", error.code ?? "", error.message);
        toast.error(tRef.current.connectionAcceptError);
        return;
      }
      console.info("[social] connection_request_sent");
      await notify(userId, "connection_request", "hat dir eine Connection-Anfrage gesendet", {
        link: "/dev",
      });
      await loadConnections();
    },
    [uid, notify, loadConnections],
  );

  /**
   * Annehmen: die Zeile in `connections` IST die Verbindung (bidirektional über
   * requester_id/addressee_id). Der Statuswechsel wird zurückgelesen, damit
   * kein Erfolg gemeldet wird, den die Datenbank nicht bestätigt hat – und die
   * Liste erst danach neu geladen wird (keine Race Condition).
   */
  const acceptRequest = useCallback<SocialCtx["acceptRequest"]>(
    async (connectionId) => {
      const c = connections.find((x) => x.id === connectionId);
      console.info("[social] connection_request_accepted");
      const { data, error } = await supabase
        .from("connections")
        .update({ status: "accepted" })
        .eq("id", connectionId)
        .select("id,status,requester_id,addressee_id,updated_at")
        .maybeSingle();
      if (error || !data || (data as Row).status !== "accepted") {
        console.error(
          "[social] connection_create_error",
          error?.code ?? "",
          error?.message ?? "update lieferte keine bestätigte Verbindung",
        );
        toast.error(tRef.current.connectionAcceptError);
        await loadConnections();
        return;
      }
      console.info("[social] connection_created");
      // Verbindung sofort lokal aktivieren, damit die Liste ohne Wartezeit stimmt.
      setConnections((prev) =>
        prev.map((x) =>
          x.id === connectionId
            ? { ...x, status: "accepted", updatedAt: ts((data as Row).updated_at) }
            : x,
        ),
      );
      if (c)
        await notify(c.requesterId, "connection_accepted", "hat deine Connection angenommen", {
          link: "/dev",
        });
      await loadConnections();
    },
    [connections, notify, loadConnections],
  );

  const declineRequest = useCallback<SocialCtx["declineRequest"]>(
    async (connectionId) => {
      const { error } = await supabase
        .from("connections")
        .update({ status: "declined" })
        .eq("id", connectionId);
      if (error) {
        console.error("[social] connection_create_error", error.code ?? "", error.message);
        toast.error(tRef.current.connectionAcceptError);
      }
      await loadConnections();
    },
    [loadConnections],
  );

  const removeConnection = useCallback<SocialCtx["removeConnection"]>(
    async (connectionId) => {
      const { error } = await supabase.from("connections").delete().eq("id", connectionId);
      if (error) {
        console.error("[social] connections_delete_error", error.code ?? "", error.message);
        toast.error(tRef.current.connectionAcceptError);
      }
      await loadConnections();
    },
    [loadConnections],
  );

  // ---------- Messenger ----------
  const partnerOf = useCallback<SocialCtx["partnerOf"]>(
    (conversation) => conversation.members.find((m) => m !== uid) ?? null,
    [uid],
  );

  const openDirectChat = useCallback<SocialCtx["openDirectChat"]>(
    async (userId) => {
      if (!uid) return null;
      if (userId === uid) return null;

      const existing = conversations.find(
        (c) => c.kind === "direct" && c.members.length === 2 && c.members.includes(userId),
      );
      if (existing) {
        await loadMessages(existing.id);
        return existing.id;
      }
      const convId = crypto.randomUUID();
      const { error } = await supabase
        .from("conversations")
        .insert({ id: convId, kind: "direct", created_by: uid });
      if (error) {
        console.error("[social] openDirectChat", error.message);
        return null;
      }
      const { error: ownMemberError } = await supabase
        .from("conversation_members")
        .insert({ conversation_id: convId, user_id: uid });
      if (ownMemberError) {
        console.error("[social] addOwnMember", ownMemberError.message);
        return null;
      }
      const { error: partnerMemberError } = await supabase
        .from("conversation_members")
        .insert({ conversation_id: convId, user_id: userId });
      if (partnerMemberError) {
        console.error("[social] addPartnerMember", partnerMemberError.message);
        return null;
      }
      setConversations((prev) => [
        {
          id: convId,
          kind: "direct",
          title: "",
          createdBy: uid,
          lastMessageAt: Date.now(),
          members: [uid, userId],
          lastReadAt: Date.now(),
          marketItemId: null,
        },
        ...prev.filter((conversation) => conversation.id !== convId),
      ]);
      setMessages((prev) => ({ ...prev, [convId]: prev[convId] ?? [] }));
      await loadConversations();
      return convId;
    },
    [uid, conversations, loadConversations, loadMessages],
  );

  /**
   * Market-Chat zu genau einem Artikel. Bewusst eine eigene Unterhaltung
   * (`kind: "market"`, `title` = Artikel-ID): so bleiben Market-Gespraeche
   * vollstaendig aus den Connection-Chats heraus und umgekehrt.
   */
  const openMarketChat = useCallback<SocialCtx["openMarketChat"]>(
    async (userId, itemId) => {
      if (!uid || userId === uid) return null;

      const existing = conversations.find(
        (c) =>
          c.kind === "market" &&
          c.marketItemId === itemId &&
          c.members.length === 2 &&
          c.members.includes(userId),
      );
      if (existing) {
        await loadMessages(existing.id);
        return existing.id;
      }
      const convId = crypto.randomUUID();
      const { error } = await supabase
        .from("conversations")
        .insert({ id: convId, kind: "market", title: itemId, created_by: uid });
      if (error) {
        console.error("[social] openMarketChat", error.message);
        return null;
      }
      const { error: ownMemberError } = await supabase
        .from("conversation_members")
        .insert({ conversation_id: convId, user_id: uid });
      if (ownMemberError) {
        console.error("[social] addOwnMember", ownMemberError.message);
        return null;
      }
      const { error: partnerMemberError } = await supabase
        .from("conversation_members")
        .insert({ conversation_id: convId, user_id: userId });
      if (partnerMemberError) {
        console.error("[social] addPartnerMember", partnerMemberError.message);
        return null;
      }
      setConversations((prev) => [
        {
          id: convId,
          kind: "market",
          title: itemId,
          createdBy: uid,
          lastMessageAt: Date.now(),
          members: [uid, userId],
          lastReadAt: Date.now(),
          marketItemId: itemId,
        },
        ...prev.filter((conversation) => conversation.id !== convId),
      ]);
      setMessages((prev) => ({ ...prev, [convId]: prev[convId] ?? [] }));
      await loadConversations();
      return convId;
    },
    [uid, conversations, loadConversations, loadMessages],
  );

  const sendMessage = useCallback<SocialCtx["sendMessage"]>(
    async (conversationId, input) => {
      if (!uid) return false;
      const mediaPath = input.mediaDataUrl
        ? await uploadDataUrl(uid, input.mediaDataUrl, input.kind === "audio" ? "audio" : "images")
        : null;
      // Upload fehlgeschlagen: Nachricht nicht senden, Auswahl bleibt beim Aufrufer erhalten.
      if (input.mediaDataUrl && !mediaPath) {
        toast.error(tRef.current.msgSendFailed);
        return false;
      }
      const { data: inserted, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: uid,
          kind: input.kind,
          body: input.body ?? "",
          media_url: mediaPath,
          slang_tag_ids: input.slangTagIds ?? [],
          chat_slang_tag_id: input.chatSlangTagId ?? null,
          media_placement: input.mediaPlacement ?? null,
          market_item_id: input.marketItemId ?? null,
          delivered_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();
      if (error) {
        console.error("[social] sendMessage", error.message);
        await removeUploads([mediaPath]);
        toast.error(tRef.current.msgSendFailed);
        return false;
      }

      // Die Benachrichtigung des Empfaengers erzeugt die Datenbank selbst und
      // buendelt dabei mehrere Nachrichten derselben Unterhaltung zu einer
      // einzigen Meldung. Deshalb hier bewusst kein eigener Eintrag mehr.
      void safeFlushPushQueue();

      await loadMessages(conversationId);
      return true;
    },
    [uid, loadMessages],
  );

  /**
   * Legt einen privaten Chat-SlangTag an, OHNE eine Nachricht zu senden.
   * Wird fuer SlangTag-Overlays auf Bildern gebraucht (Audio + Nachricht in
   * einem Schritt) und von `sendChatSlangTag` mitbenutzt.
   */
  const createChatSlangTag = useCallback<SocialCtx["createChatSlangTag"]>(
    async (conversationId, input) => {
      if (!uid) return null;
      const audioPath = await uploadDataUrl(uid, input.audioDataUrl, "audio");
      const { data, error } = await supabase
        .from("chat_slang_tags")
        .insert({
          conversation_id: conversationId,
          creator_id: uid,
          name: input.name,
          audio_url: audioPath,
          duration: input.duration,
        })
        .select("id")
        .single();
      if (error || !data) {
        console.error("[social] createChatSlangTag", error?.message);
        await removeUploads([audioPath]);
        toast.error(tRef.current.privateTagSendFailed);
        return null;
      }
      return (data as Row).id as string;
    },
    [uid],
  );

  const sendChatSlangTag = useCallback<SocialCtx["sendChatSlangTag"]>(
    async (conversationId, input) => {
      if (!uid) return;
      const audioPath = await uploadDataUrl(uid, input.audioDataUrl, "audio");
      const { data, error } = await supabase
        .from("chat_slang_tags")
        .insert({
          conversation_id: conversationId,
          creator_id: uid,
          name: input.name,
          audio_url: audioPath,
          duration: input.duration,
        })
        .select("id")
        .single();
      if (error || !data) {
        console.error("[social] sendChatSlangTag", error?.message);
        await removeUploads([audioPath]);
        toast.error(tRef.current.privateTagSendFailed);
        return;
      }

      await sendMessage(conversationId, {
        kind: "chat_slangtag",
        chatSlangTagId: (data as Row).id as string,
      });
    },
    [uid, sendMessage],
  );

  const markConversationRead = useCallback<SocialCtx["markConversationRead"]>(
    async (conversationId) => {
      if (!uid) return;

      // Nur zugehoerige Glocken-Benachrichtigungen schliessen (unabhaengig
      // davon, ob der Lesestatus selbst geschrieben werden muss).
      const closeMessageNotifications = async () => {
        const conv = conversationsRef.current.find((c) => c.id === conversationId);
        const partner = conv ? (conv.members.find((m) => m !== uid) ?? null) : null;
        if (!partner) return;
        const openIds = notificationsRef.current
          .filter(
            (n) =>
              !n.read &&
              n.type === "message" &&
              (n.entityId === conversationId || n.actorId === partner),
          )
          .map((n) => n.id);
        if (!openIds.length) return;
        setNotifications((prev) =>
          prev.map((n) => (openIds.includes(n.id) ? { ...n, read: true } : n)),
        );
        await supabase.from("notifications").update({ read: true }).in("id", openIds);
      };

      // 1) Nur schreiben, wenn sich der Lesestatus wirklich aendern kann.
      //    Ein vorgemerkter (entprellter) Schreibvorgang wird immer ausgefuehrt,
      //    da der lokale Zustand bereits optimistisch aktualisiert wurde.
      const writePending = readPendingRef.current[conversationId] === true;
      const conv = conversationsRef.current.find((c) => c.id === conversationId);
      const openList = messagesRef.current[conversationId];
      const pendingUnread = openList
        ? openList.some((m) => m.senderId !== uid && (!conv || m.createdAt > conv.lastReadAt))
        : (unreadCountsRef.current[conversationId] ?? 0) > 0;
      const stampStale = conv ? conv.lastReadAt < conv.lastMessageAt : true;
      if (!writePending && !pendingUnread && !stampStale) {
        await closeMessageNotifications();
        return;
      }

      // 2) Entprellung je Unterhaltung: bei mehreren schnell eintreffenden
      //    Nachrichten wird nur einmal geschrieben.
      const lastWrite = readWriteAtRef.current[conversationId] ?? 0;
      const sinceLastWrite = Date.now() - lastWrite;
      if (sinceLastWrite < READ_DEBOUNCE_MS) {
        // Lokal sofort korrekt anzeigen und den Schreibvorgang nachziehen.
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, lastReadAt: Date.now() } : c)),
        );
        setUnreadCounts((prev) => ({ ...prev, [conversationId]: 0 }));
        readPendingRef.current[conversationId] = true;
        if (readTimersRef.current[conversationId]) return;
        readTimersRef.current[conversationId] = window.setTimeout(() => {
          delete readTimersRef.current[conversationId];
          void markConversationReadRef.current?.(conversationId);
        }, READ_DEBOUNCE_MS - sinceLastWrite);
        await closeMessageNotifications();
        return;
      }
      readWriteAtRef.current[conversationId] = Date.now();
      delete readPendingRef.current[conversationId];

      // 3) Beide Schreibvorgaenge in einem Datenbankaufruf.
      const { error } = await supabase.rpc("mark_conversation_read", {
        _conversation_id: conversationId,
      });
      if (error) {
        // Bei einem Fehler nicht blockieren: naechster Versuch darf sofort schreiben.
        readWriteAtRef.current[conversationId] = 0;
        readPendingRef.current[conversationId] = true;
        console.error("[social] markConversationRead", error.message);
      }

      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, lastReadAt: Date.now() } : c)),
      );
      setUnreadCounts((prev) => ({ ...prev, [conversationId]: 0 }));
      await closeMessageNotifications();
    },
    [uid],
  );
  markConversationReadRef.current = markConversationRead;

  const unreadInConversation = useCallback<SocialCtx["unreadInConversation"]>(
    (conversationId) => {
      const conv = conversations.find((c) => c.id === conversationId);
      if (!conv) return 0;
      const list = messagesByConversation[conversationId];
      // Geöffnete Chats rechnen exakt, geschlossene nutzen den leichten Zähler.
      if (list) {
        return list.filter((m) => m.senderId !== uid && m.createdAt > conv.lastReadAt).length;
      }
      return unreadCounts[conversationId] ?? 0;
    },
    [conversations, messagesByConversation, unreadCounts, uid],
  );

  // ---------- Push-Benachrichtigungen ----------
  // Gespeicherte Einstellung uebernehmen und Geraet bei erteilter Berechtigung
  // wieder anmelden (z. B. nach App-Neustart oder Abo-Erneuerung).
  useEffect(() => {
    const stored = Boolean((me as { pushEnabled?: boolean } | undefined)?.pushEnabled);
    if (!stored || pushPermission() !== "granted") {
      setPushEnabledState(false);
      return;
    }
    // Kein Schein-Zustand: der Schalter zeigt nur AN, wenn im Browser wirklich
    // ein Abo existiert (bzw. neu angemeldet werden konnte).
    let cancelled = false;
    void (async () => {
      const active = await pushDeviceActive();
      if (!cancelled) setPushEnabledState(active);
      const ok = await syncPushDevice();
      if (!cancelled) setPushEnabledState(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, [me]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === "push-subscription-change") {
        void syncPushDevice();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  const setPushEnabled = useCallback<SocialCtx["setPushEnabled"]>(
    async (on) => {
      if (!uid || pushBusy) return false;
      setPushBusy(true);
      try {
        if (!on) {
          await disablePush();
          setPushEnabledState(false);
          await supabase.from("profiles").update({ push_enabled: false }).eq("id", uid);
          return false;
        }
        if (!pushSupported()) {
          toast.error(tRef.current.pushUnsupported);
          return false;
        }
        const result = await enablePush();
        if (!result.ok) {
          setPushEnabledState(false);
          await supabase.from("profiles").update({ push_enabled: false }).eq("id", uid);
          // Verstaendliche Meldung + technischer Code (Entwickler-Diagnose).
          const message =
            result.reason === "permission_denied" || result.reason === "permission_dismissed"
              ? tRef.current.pushDenied
              : result.reason === "unsupported" || result.reason === "insecure_context"
                ? tRef.current.pushUnsupported
                : tRef.current.pushFailed;
          toast.error(message, { description: `Code: ${result.reason}` });
          return false;
        }
        setPushEnabledState(true);
        await supabase.from("profiles").update({ push_enabled: true }).eq("id", uid);
        toast.success(tRef.current.pushActive);
        return true;
      } finally {
        setPushBusy(false);
      }
    },
    [uid, pushBusy],
  );

  // Zustellung sicherstellen, auch fuer Benachrichtigungen aus dem Backend.
  useEffect(() => {
    if (!uid) return;
    const tick = () => void safeFlushPushQueue();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [uid]);

  /**
   * Einzelne Benachrichtigung wirklich löschen (DB + lokaler State).
   * Der Lesestatus spielt dabei keine Rolle.
   */
  const deleteNotification = useCallback(
    async (id: string) => {
      if (!uid) return;
      const prev = notificationsRef.current;
      setNotifications((list) => list.filter((n) => n.id !== id));
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id)
        .eq("user_id", uid);
      if (error) setNotifications(prev);
    },
    [uid],
  );

  /** Alle bereits gelesenen Benachrichtigungen löschen. */
  const deleteReadNotifications = useCallback(async () => {
    if (!uid) return;
    const prev = notificationsRef.current;
    setNotifications((list) => list.filter((n) => !n.read));
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", uid)
      .eq("read", true);
    if (error) setNotifications(prev);
  }, [uid]);

  const markNotificationsRead = useCallback(async () => {
    if (!uid) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", uid)
      .eq("read", false);
  }, [uid]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    connectedIdsRef.current = connectedIds;
  }, [connectedIds]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // Chat-Nachrichten gehoeren an das Nachrichten-Symbol, nicht an die Glocke.
  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read && n.type !== "message").length,
    [notifications],
  );

  /** Summe aller ungelesenen Chat-Nachrichten (Badge am Nachrichten-Symbol). */
  const unreadMessages = useMemo(() => {
    const ids = new Set<string>([...conversations.map((c) => c.id), ...Object.keys(unreadCounts)]);
    let total = 0;
    ids.forEach((id) => {
      const conv = conversations.find((c) => c.id === id);
      const list = messagesByConversation[id];
      if (conv && list) {
        total += list.filter((m) => m.senderId !== uid && m.createdAt > conv.lastReadAt).length;
      } else {
        total += unreadCounts[id] ?? 0;
      }
    });
    return total;
  }, [conversations, messagesByConversation, unreadCounts, uid]);

  /**
   * Bestätigte Live-Werte aufräumen: sobald der neu geladene Profil-Datensatz
   * denselben Status enthält, wird die Zwischenspeicherung verworfen. Weicht
   * er ab, ist der Live-Wert der neuere und bleibt erhalten.
   */
  useEffect(() => {
    setPresenceOverrides((prev) => {
      const entries = Object.entries(prev).filter(
        ([id, status]) => profiles[id]?.presenceStatus !== status,
      );
      if (entries.length === Object.keys(prev).length) return prev;
      return Object.fromEntries(entries) as Record<string, PresenceStatus>;
    });
  }, [profiles]);

  /**
   * Angezeigter Status = gespeicherter, manuell gewählter Status,
   * aber NUR solange tatsächlich eine Live-Presence-Verbindung besteht.
   * Ohne aktive Session/Presence (Logout, Tab geschlossen, Session-Ende)
   * gilt der Nutzer immer als „offline“ – ein gespeicherter Profilstatus
   * allein bedeutet niemals „online“.
   */
  const onlineSet = useMemo(() => new Set(onlineIds), [onlineIds]);
  const presenceOf = useCallback(
    (userId: string): PresenceStatus => {
      const stored = presenceOverrides[userId] ?? profiles[userId]?.presenceStatus ?? "offline";
      if (stored === "offline") return "offline";
      // Eigener Client: die eigene Session ist per Definition aktiv.
      const live = userId === uid || onlineSet.has(userId);
      return live ? stored : "offline";
    },
    [presenceOverrides, profiles, onlineSet, uid],
  );
  const isOnline = useCallback((userId: string) => presenceOf(userId) === "online", [presenceOf]);

  const value = useMemo<SocialCtx>(
    () => ({
      loading,
      connections,
      incoming,
      outgoing,
      connectedIds,
      relationWith,
      connectionOf,
      connectionCount,
      mutualConnections,
      searchProfiles,
      suggestions,
      refreshSuggestions: loadSuggestions,
      sendRequest,
      acceptRequest,
      declineRequest,
      removeConnection,
      conversations,
      messagesByConversation,
      openDirectChat,
      openMarketChat,
      loadOlderMessages,
      hasMoreMessages,
      loadMessages,
      sendMessage,
      sendChatSlangTag,
      createChatSlangTag,
      chatSlangTags,
      markConversationRead,
      unreadInConversation,
      partnerOf,
      emitTyping,
      typingIn,
      notifications,
      unreadNotifications,
      unreadMessages,
      markNotificationsRead,
      deleteNotification,
      deleteReadNotifications,
      pushEnabled,
      pushBusy,
      pushSupported: pushSupported(),
      pushPermission: pushPermission(),
      setPushEnabled,
      onlineIds,
      isOnline,
      presenceOf,
    }),
    [
      loading,
      suggestions,
      loadSuggestions,
      connections,
      incoming,
      outgoing,
      connectedIds,
      relationWith,
      connectionOf,
      connectionCount,
      mutualConnections,
      searchProfiles,

      sendRequest,
      acceptRequest,
      declineRequest,
      removeConnection,
      conversations,
      messagesByConversation,
      openDirectChat,
      openMarketChat,

      loadMessages,
      loadOlderMessages,
      hasMoreMessages,
      sendMessage,
      sendChatSlangTag,
      createChatSlangTag,
      chatSlangTags,
      markConversationRead,
      unreadInConversation,
      partnerOf,
      emitTyping,
      typingIn,
      notifications,
      unreadNotifications,
      unreadMessages,
      markNotificationsRead,
      deleteNotification,
      deleteReadNotifications,
      pushEnabled,
      pushBusy,
      setPushEnabled,
      onlineIds,
      isOnline,
      presenceOf,
    ],
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}
