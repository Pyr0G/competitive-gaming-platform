export type Language = "en" | "pl";

export const minSearchLength = 2;
export const maxSearchLength = 64;

export function normalizeSearchQuery(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

export const gamingRoles = ["entry", "support", "awp", "igl", "flex"] as const;
export const availabilityTimes = [
  "daytime",
  "evenings",
  "nights",
  "weekends",
] as const;
export const spokenLanguages = [
  "en",
  "pl",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "nl",
  "sv",
  "da",
  "fi",
  "cs",
  "sk",
  "uk",
  "ru",
  "tr",
] as const;
export const maxSpokenLanguages = 5;

export type GamingRole = (typeof gamingRoles)[number];
export type AvailabilityTime = (typeof availabilityTimes)[number];
export type SpokenLanguage = (typeof spokenLanguages)[number];

export interface GamingProfile {
  role: GamingRole | null;
  level: number | null;
  availability: AvailabilityTime[];
  languages: SpokenLanguage[];
}

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
  gaming: GamingProfile;
}

export interface PlayerResponse {
  player: Player;
  gaming: GamingProfile;
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
  teams: TeamSummary[];
  nextCursor: string | null;
  nextTeamCursor: string | null;
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

export interface Post {
  id: string;
  title: string;
  body: string;
  bannerUrl: string | null;
  authorUsername: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostsResponse {
  posts: Post[];
}

export interface AdminPostsResponse extends PostsResponse {
  nextCursor: string | null;
}

export interface TeamSummary {
  id: string;
  name: string;
  tag: string;
  captainId: string | null;
  captainUsername: string | null;
  memberCount: number;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  username: string;
  role: "captain" | "member";
  joinedAt: string;
}

export interface TeamDetails extends TeamSummary {
  members: TeamMember[];
}

export interface TeamsResponse {
  teams: TeamSummary[];
  nextCursor: string | null;
}

export interface ApiError {
  error: { code: string };
}
