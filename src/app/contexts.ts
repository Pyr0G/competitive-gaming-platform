import { createContext, useContext } from "react";
import type {
  Account,
  AuthResponse,
  ConversationSummary,
  Message,
} from "../../shared/contracts";
import type { Request } from "../lib/api";

type Session = {
  account: Account | null;
  loading: boolean;
  request: Request;
  authenticate: (result: AuthResponse) => void;
  updateAccount: (account: Account) => void;
  captureSession: () => () => boolean;
  logout: () => Promise<void>;
  requireLogin: () => void;
};
export const SessionContext = createContext<Session>(null!);
export const useSession = () => useContext(SessionContext);
export type ReportTarget = { messageId: number; username: string };
type Chat = {
  conversations: ConversationSummary[];
  selected: string | null;
  messages: Message[];
  hasMore: boolean;
  unread: number;
  loading: boolean;
  error: string;
  open: boolean;
  show: () => void;
  close: () => void;
  select: (id: string) => void;
  start: (playerId: string) => Promise<void>;
  send: (body: string) => Promise<void>;
  previous: () => Promise<void>;
  refresh: () => void;
  report: (target: ReportTarget) => void;
};
export const ChatContext = createContext<Chat>(null!);
export const useChat = () => useContext(ChatContext);
