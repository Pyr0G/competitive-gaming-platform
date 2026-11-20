export type Language = "en" | "pl";

export interface Player {
  id: string;
  username: string;
  bio: string;
  createdAt: string;
}

export interface Account extends Player {
  email: string;
  language: Language;
  locale: string;
  timeZone: string;
  isAdmin: boolean;
}

export interface PlayerResponse {
  player: Player;
  relationship: { blockedByMe: boolean; blockedByOther: boolean } | null;
}

export interface AuthResponse {
  account: Account | null;
  csrfToken: string | null;
}

export interface Message {
  id: number;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  clientId: string;
}

export interface ConversationSummary {
  id: string;
  player: Player;
  unreadCount: number;
  lastMessage: Message | null;
  blockedByMe: boolean;
  blockedByOther: boolean;
  unavailable: boolean;
}

export interface SyncResponse {
  conversations: ConversationSummary[];
  messages: Message[];
  hasMore: boolean;
  unreadCount: number;
}

export interface SearchResponse {
  players: Player[];
  nextCursor: string | null;
  categories: {
    type: "players" | "teams" | "tournaments";
    available: boolean;
  }[];
}

export interface AdminUser extends Player {
  isAdmin: boolean;
  bannedAt: string | null;
  banReason: string | null;
}

export interface ReportEvidence {
  id: number;
  senderId: string;
  username: string;
  body: string;
  createdAt: string;
}

export interface Report {
  id: string;
  reporterId: string;
  reporterUsername: string;
  reportedUserId: string;
  reportedUsername: string;
  reason: string;
  status: "open" | "resolved";
  evidence: ReportEvidence[];
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AdminAction {
  id: number;
  actorUsername: string;
  targetUsername: string | null;
  action: "ban" | "unban" | "resolve_report";
  reason: string;
  createdAt: string;
}

export interface ApiError {
  error: { code: string };
}
