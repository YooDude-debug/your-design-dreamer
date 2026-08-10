import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SocialContext, type SocialCtx } from "@/lib/social-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { removeUploads, signPaths, uploadDataUrl } from "@/lib/media";
import { useData } from "@/lib/data-context";
import {
  disablePush,
  enablePush,
  pushPermission,
  pushSupported,
  syncPushDevice,
} from "@/lib/push-client";
import { flushPushQueue } from "@/lib/push.functions";
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

export type MessageKind = "text" | "image" | "gif" | "audio" | "slangtag" | "chat_slangtag";

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
  createdAt: number;
  deliveredAt: number | null;
  readAt: number | null;
};

export type Conversation = {
  id: string;
  kind: string;
  title: string;
  createdBy: string;
  lastMessageAt: number;
  members: string[];
  lastReadAt: number;
};

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
};

/** Pagination: Anzahl der Nachrichten pro Ladevorgang. */
const MESSAGE_PAGE_SIZE = 30;

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
    createdAt: ts(r.created_at),
    deliveredAt: r.delivered_at ? ts(r.delivered_at) : null,
    readAt: r.read_at ? ts(r.read_at) : null,
  };
}

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user, profiles } = useData();
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
  const connectedIdsRef = useRef<string[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const [typingIn, setTypingIn] = useState<Record<string, string[]>>({});
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [suggestions, setSuggestions] = useState<ConnectionSuggestion[]>([]);
  const [pushEnabled, setPushEnabledState] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const me = uid ? profiles[uid] : undefined;

  // ---------- Laden ----------
  const loadConnections = useCallback(async () => {
    if (!uid) return setConnections([]);
    const { data } = await supabase
      .from("connections")
      .select("*")
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
      .order("created_at", { ascending: false });
    setConnections(((data ?? []) as Row[]).map(mapConnection));
  }, [uid]);

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
    const { data: memberRows } = await supabase
      .from("conversation_members")
      .select("conversation_id,user_id,last_read_at");
    const rows = (memberRows ?? []) as Row[];
    const myIds = rows.filter((r) => r.user_id === uid).map((r) => r.conversation_id as string);
    if (myIds.length === 0) return setConversations([]);

    const { data: convRows } = await supabase
      .from("conversations")
      .select("*")
      .in("id", myIds)
      .order("last_message_at", { ascending: false });

    setConversations(
      ((convRows ?? []) as Row[]).map((c) => {
        const id = c.id as string;
        const members = rows
          .filter((r) => r.conversation_id === id)
          .map((r) => r.user_id as string);
        const mine = rows.find((r) => r.conversation_id === id && r.user_id === uid);
        return mapConversation(c, members, mine?.last_read_at);
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
  }, [loadConnections, loadConversations, loadNotifications, loadUnreadCounts]);


  /** Präsenz + Realtime für Connections, Chats und Benachrichtigungen. */
  useEffect(() => {
    if (!uid) return;
    const presence = supabase.channel("ydude-presence", { config: { presence: { key: uid } } });
    presence
      .on("presence", { event: "sync" }, () => {
        setOnlineIds(Object.keys(presence.presenceState()));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void presence.track({ at: Date.now() });
      });

    const live = supabase
      .channel("ydude-social")
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, () => {
        void loadConnections();
        // Der Cache wird per Trigger geleert – danach neu berechnen.
        void loadSuggestions(true);
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_members" },
        () => {
          void loadConversations();
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        void loadConversations();
      })
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
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as { conversationId: string; userId: string };
        if (!p || p.userId === uid) return;
        setTypingIn((prev) => ({
          ...prev,
          [p.conversationId]: Array.from(new Set([...(prev[p.conversationId] ?? []), p.userId])),
        }));
        const key = `${p.conversationId}:${p.userId}`;
        clearTimeout(typingTimers.current[key]);
        typingTimers.current[key] = setTimeout(() => {
          setTypingIn((prev) => ({
            ...prev,
            [p.conversationId]: (prev[p.conversationId] ?? []).filter((u) => u !== p.userId),
          }));
        }, 3000);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(presence);
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

  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const emitTyping = useCallback(
    (conversationId: string) => {
      if (!uid) return;
      if (!typingChannel.current) {
        typingChannel.current = supabase.channel("ydude-social-out");
        typingChannel.current.subscribe();
      }
      void typingChannel.current.send({
        type: "broadcast",
        event: "typing",
        payload: { conversationId, userId: uid },
      });
    },
    [uid],
  );
  useEffect(
    () => () => {
      if (typingChannel.current) void supabase.removeChannel(typingChannel.current);
    },
    [],
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
      void flushPushQueue().catch(() => undefined);
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
        console.error("[social] sendRequest", error.message);
        return;
      }
      await notify(userId, "connection_request", "hat dir eine Connection-Anfrage gesendet", {
        link: "/dev",
      });
      await loadConnections();
    },
    [uid, notify, loadConnections],
  );

  const acceptRequest = useCallback<SocialCtx["acceptRequest"]>(
    async (connectionId) => {
      const c = connections.find((x) => x.id === connectionId);
      const { error } = await supabase
        .from("connections")
        .update({ status: "accepted" })
        .eq("id", connectionId);
      if (error) return console.error("[social] accept", error.message);
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
      await supabase.from("connections").update({ status: "declined" }).eq("id", connectionId);
      await loadConnections();
    },
    [loadConnections],
  );

  const removeConnection = useCallback<SocialCtx["removeConnection"]>(
    async (connectionId) => {
      await supabase.from("connections").delete().eq("id", connectionId);
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
      if (!uid) return;
      const mediaPath = input.mediaDataUrl
        ? await uploadDataUrl(uid, input.mediaDataUrl, input.kind === "audio" ? "audio" : "images")
        : null;
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: uid,
        kind: input.kind,
        body: input.body ?? "",
        media_url: mediaPath,
        slang_tag_ids: input.slangTagIds ?? [],
        chat_slang_tag_id: input.chatSlangTagId ?? null,
        delivered_at: new Date().toISOString(),
      });
      if (error) {
        console.error("[social] sendMessage", error.message);
        await removeUploads([mediaPath]);
        toast.error("Nachricht konnte nicht gesendet werden.");
        return;
      }

      const conv = conversations.find((c) => c.id === conversationId);
      const partner = conv ? partnerOf(conv) : null;
      if (partner)
        await notify(partner, "message", "hat dir eine Nachricht gesendet", {
          entityType: "conversation",
          entityId: conversationId,
        });
      await loadMessages(conversationId);
    },
    [uid, conversations, partnerOf, notify, loadMessages],
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
        toast.error("Privater SlangTag konnte nicht gesendet werden.");
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
      const now = new Date().toISOString();
      await supabase
        .from("conversation_members")
        .update({ last_read_at: now })
        .eq("conversation_id", conversationId)
        .eq("user_id", uid);
      await supabase
        .from("messages")
        .update({ read_at: now })
        .eq("conversation_id", conversationId)
        .neq("sender_id", uid)
        .is("read_at", null);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, lastReadAt: Date.now() } : c)),
      );
      setUnreadCounts((prev) => ({ ...prev, [conversationId]: 0 }));
    },
    [uid],
  );

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
    setPushEnabledState(stored && pushPermission() === "granted");
    if (stored && pushPermission() === "granted") void syncPushDevice();
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
          toast.error("Dieses Gerät unterstützt keine Push-Benachrichtigungen.");
          return false;
        }
        const result = await enablePush();
        if (result !== "enabled") {
          setPushEnabledState(false);
          await supabase.from("profiles").update({ push_enabled: false }).eq("id", uid);
          toast.error(
            result === "denied"
              ? "Berechtigung abgelehnt – Push bleibt aus. Du kannst sie in den Browsereinstellungen erlauben."
              : "Push-Benachrichtigungen konnten nicht aktiviert werden.",
          );
          return false;
        }
        setPushEnabledState(true);
        await supabase.from("profiles").update({ push_enabled: true }).eq("id", uid);
        toast.success("Push-Benachrichtigungen sind aktiv.");
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
    const tick = () => void flushPushQueue().catch(() => undefined);
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
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
    connectedIdsRef.current = connectedIds;
  }, [connectedIds]);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );
  const isOnline = useCallback((userId: string) => onlineIds.includes(userId), [onlineIds]);

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
      loadOlderMessages,
      hasMoreMessages,
      loadMessages,
      sendMessage,
      sendChatSlangTag,
      chatSlangTags,
      markConversationRead,
      unreadInConversation,
      partnerOf,
      emitTyping,
      typingIn,
      notifications,
      unreadNotifications,
      markNotificationsRead,
      pushEnabled,
      pushBusy,
      pushSupported: pushSupported(),
      pushPermission: pushPermission(),
      setPushEnabled,
      onlineIds,
      isOnline,
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
      loadMessages,
      loadOlderMessages,
      hasMoreMessages,
      sendMessage,
      sendChatSlangTag,
      chatSlangTags,
      markConversationRead,
      unreadInConversation,
      partnerOf,
      emitTyping,
      typingIn,
      notifications,
      unreadNotifications,
      markNotificationsRead,
      pushEnabled,
      pushBusy,
      setPushEnabled,
      onlineIds,
      isOnline,
    ],
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}
