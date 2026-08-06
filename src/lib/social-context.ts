import { createContext, useContext } from "react";
import type { Profile } from "@/lib/types";
import type { ConnectionSuggestion } from "@/lib/connection-suggestions";
import type {
  AppNotification,
  ChatMessage,
  ChatSlangTag,
  Connection,
  Conversation,
  RelationState,
  SendMessageInput,
} from "@/lib/social";

export type SocialCtx = {
  loading: boolean;
  connections: Connection[];
  incoming: Connection[];
  outgoing: Connection[];
  connectedIds: string[];
  relationWith: (userId: string) => RelationState;
  connectionOf: (userId: string) => Connection | undefined;
  connectionCount: (userId: string) => number;
  mutualConnections: (userId: string) => string[];
  searchProfiles: (q: string) => Profile[];
  /** Serverseitig gerankte Freundevorschläge (Datenschutz wird beachtet). */
  suggestions: ConnectionSuggestion[];
  /** Vorschläge neu laden; `force` erzwingt eine Neuberechnung. */
  refreshSuggestions: (force?: boolean) => Promise<void>;
  sendRequest: (userId: string) => Promise<void>;
  acceptRequest: (connectionId: string) => Promise<void>;
  declineRequest: (connectionId: string) => Promise<void>;
  removeConnection: (connectionId: string) => Promise<void>;

  conversations: Conversation[];
  messagesByConversation: Record<string, ChatMessage[]>;
  openDirectChat: (userId: string) => Promise<string | null>;
  loadMessages: (conversationId: string) => Promise<void>;
  loadOlderMessages: (conversationId: string) => Promise<void>;
  hasMoreMessages: Record<string, boolean>;
  sendMessage: (conversationId: string, input: SendMessageInput) => Promise<void>;
  /** Nimmt einen privaten SlangTag auf und sendet ihn in den Chat. */
  sendChatSlangTag: (
    conversationId: string,
    input: { name: string; audioDataUrl: string; duration: string },
  ) => Promise<void>;
  /** Private Chat-SlangTags der geladenen Nachrichten. */
  chatSlangTags: Record<string, ChatSlangTag>;
  markConversationRead: (conversationId: string) => Promise<void>;
  unreadInConversation: (conversationId: string) => number;
  partnerOf: (conversation: Conversation) => string | null;
  emitTyping: (conversationId: string) => void;
  typingIn: Record<string, string[]>;

  notifications: AppNotification[];
  unreadNotifications: number;
  markNotificationsRead: () => Promise<void>;

  /** Push-Benachrichtigungen dieses Kontos (dauerhaft im Profil gespeichert). */
  pushEnabled: boolean;
  /** Push wird gerade ein-/ausgeschaltet. */
  pushBusy: boolean;
  /** Unterstuetzt dieses Gerät Web Push? */
  pushSupported: boolean;
  /** Aktueller Berechtigungsstatus des Browsers. */
  pushPermission: NotificationPermission | "unsupported";
  /** Schaltet Push ein/aus; liefert den tatsaechlichen Zustand danach. */
  setPushEnabled: (on: boolean) => Promise<boolean>;

  onlineIds: string[];
  isOnline: (userId: string) => boolean;
};

export const SocialContext = createContext<SocialCtx | null>(null);

/** Zugriff auf Verbindungen, Chats und Benachrichtigungen. */
export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error("useSocial must be used within SocialProvider");
  return ctx;
}
