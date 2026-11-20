import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import type {
  Account,
  AuthResponse,
  ConversationSummary,
  Message,
  SyncResponse,
} from "../../shared/contracts";
import { fetchApi, json, RequestError, type Request } from "../lib/api";
import { useLocale } from "../i18n";
import {
  SessionContext,
  ChatContext,
  useSession,
  type ReportTarget,
} from "./contexts";
import { Shell } from "./Shell";
import { ChatDialog, ReportDialog } from "../features/chat/chat";

export function mergeMessages(current: Message[], incoming: Message[]) {
  return [
    ...new Map(
      [...current, ...incoming].map((item) => [item.id, item]),
    ).values(),
  ].sort((a, b) => a.id - b.id);
}

export function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const session = useRef({
    generation: 0,
    accountId: null as string | null,
    csrfToken: null as string | null,
  });
  const pending = useRef(new Set<AbortController>());
  const validation = useRef<Promise<boolean> | null>(null);
  const validationController = useRef<AbortController | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const lastRevision = useRef("");
  const loggingOut = useRef(false);
  const navigate = useNavigate();
  const { setPreferences } = useLocale();
  const abortPending = useCallback(() => {
    session.current.generation++;
    for (const controller of pending.current) controller.abort();
    pending.current.clear();
  }, []);
  const cancelValidation = useCallback(() => {
    validationController.current?.abort();
    validationController.current = null;
    validation.current = null;
  }, []);
  const announceSession = useCallback(() => {
    const revision = crypto.randomUUID();
    lastRevision.current = revision;
    channel.current?.postMessage(revision);
    try {
      localStorage.setItem("cgp.session.revision", revision);
    } catch {
      return;
    }
  }, []);
  const clearSession = useCallback(
    (announce: boolean) => {
      abortPending();
      cancelValidation();
      loggingOut.current = false;
      session.current.accountId = null;
      session.current.csrfToken = null;
      setAccount(null);
      if (announce) announceSession();
    },
    [abortPending, cancelValidation, announceSession],
  );
  const loadAccountPreferences = useCallback(
    (next: Account) => {
      let region: string;
      try {
        region = new Intl.Locale(next.locale).region || "";
      } catch {
        region = "";
      }
      setPreferences({
        language: next.language,
        region,
        timeZone: next.timeZone,
      });
    },
    [setPreferences],
  );
  const authenticate = useCallback(
    (result: AuthResponse) => {
      abortPending();
      cancelValidation();
      loggingOut.current = false;
      session.current.accountId = result.account?.id || null;
      session.current.csrfToken = result.csrfToken;
      setAccount(result.account);
      if (result.account) loadAccountPreferences(result.account);
      announceSession();
    },
    [abortPending, cancelValidation, loadAccountPreferences, announceSession],
  );
  const revalidate = useCallback(
    (loadPreferences = false): Promise<boolean> => {
      if (loggingOut.current) return Promise.resolve(false);
      if (validation.current) return validation.current;
      const controller = new AbortController();
      validationController.current = controller;
      const generation = session.current.generation;
      const work = (async () => {
        try {
          const result = await fetchApi<AuthResponse>("/auth/me", {
            signal: controller.signal,
          });
          if (
            controller.signal.aborted ||
            generation !== session.current.generation
          )
            return false;
          if (
            session.current.accountId !== (result.account?.id || null) ||
            session.current.csrfToken !== result.csrfToken
          ) {
            abortPending();
            session.current.accountId = result.account?.id || null;
            session.current.csrfToken = result.csrfToken;
            setAccount(result.account);
            if (result.account && loadPreferences)
              loadAccountPreferences(result.account);
          }
          return true;
        } catch {
          return false;
        } finally {
          if (validationController.current === controller) {
            validationController.current = null;
            validation.current = null;
            setLoading(false);
          }
        }
      })();
      validation.current = work;
      return work;
    },
    [abortPending, loadAccountPreferences],
  );
  const request = useCallback<Request>(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      if (loggingOut.current)
        throw new DOMException("Session changed", "AbortError");
      const before = validation.current;
      if (before && !(await before))
        throw new RequestError("SERVICE_UNAVAILABLE");
      if (loggingOut.current)
        throw new DOMException("Session changed", "AbortError");
      const generation = session.current.generation;
      const csrfToken = session.current.csrfToken;
      const controller = new AbortController();
      const abort = () => controller.abort();
      options.signal?.addEventListener("abort", abort, { once: true });
      if (options.signal?.aborted) controller.abort();
      pending.current.add(controller);
      try {
        const result = await fetchApi<T>(
          path,
          { ...options, signal: controller.signal },
          csrfToken,
        );
        const checking = validation.current;
        if (checking && !(await checking))
          throw new RequestError("SERVICE_UNAVAILABLE");
        if (
          controller.signal.aborted ||
          generation !== session.current.generation
        )
          throw new DOMException("Session changed", "AbortError");
        return result;
      } catch (error) {
        const checking = validation.current;
        if (checking) await checking;
        if (
          controller.signal.aborted ||
          generation !== session.current.generation
        )
          throw new DOMException("Session changed", "AbortError");
        if (
          error instanceof RequestError &&
          ["UNAUTHENTICATED", "ACCOUNT_BANNED"].includes(error.code)
        )
          clearSession(true);
        throw error;
      } finally {
        options.signal?.removeEventListener("abort", abort);
        pending.current.delete(controller);
      }
    },
    [clearSession],
  );
  const updateAccount = useCallback((next: Account) => {
    setAccount((current) =>
      current?.id === next.id &&
      session.current.accountId === next.id &&
      session.current.csrfToken &&
      !loggingOut.current
        ? next
        : current,
    );
  }, []);
  const captureSession = useCallback(() => {
    const generation = session.current.generation;
    return () =>
      generation === session.current.generation && !loggingOut.current;
  }, []);
  useEffect(() => {
    let hasBrowserPreferences: boolean;
    try {
      hasBrowserPreferences = localStorage.getItem("cgp.preferences") !== null;
    } catch {
      hasBrowserPreferences = false;
    }
    void revalidate(!hasBrowserPreferences);
    const externalChange = (revision: unknown) => {
      if (
        typeof revision !== "string" ||
        !/^[a-f0-9-]{36}$/.test(revision) ||
        revision === lastRevision.current
      )
        return;
      lastRevision.current = revision;
      clearSession(false);
      void revalidate();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === "cgp.session.revision") externalChange(event.newValue);
    };
    const focus = () => {
      void revalidate();
    };
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("cgp.session");
      channel.current.onmessage = (event) => externalChange(event.data);
    }
    window.addEventListener("storage", storage);
    window.addEventListener("focus", focus);
    return () => {
      abortPending();
      cancelValidation();
      channel.current?.close();
      channel.current = null;
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", focus);
    };
  }, [abortPending, cancelValidation, clearSession, revalidate]);
  async function logout() {
    if (loggingOut.current) return;
    const csrfToken = session.current.csrfToken;
    cancelValidation();
    abortPending();
    loggingOut.current = true;
    const generation = session.current.generation;
    const controller = new AbortController();
    pending.current.add(controller);
    try {
      await fetchApi(
        "/auth/logout",
        { ...json("POST"), signal: controller.signal },
        csrfToken,
      );
      if (
        controller.signal.aborted ||
        generation !== session.current.generation
      )
        return;
      clearSession(true);
      navigate("/");
    } catch (error) {
      if (
        !controller.signal.aborted &&
        generation === session.current.generation &&
        error instanceof RequestError &&
        error.code === "UNAUTHENTICATED"
      ) {
        clearSession(true);
        navigate("/");
        return;
      }
      throw error;
    } finally {
      pending.current.delete(controller);
      if (generation === session.current.generation) loggingOut.current = false;
    }
  }
  return (
    <SessionContext.Provider
      value={{
        account,
        loading,
        request,
        authenticate,
        updateAccount,
        captureSession,
        logout,
        requireLogin: () => navigate("/login"),
      }}
    >
      <ChatProvider key={account?.id || "guest"}>
        <Shell />
      </ChatProvider>
    </SessionContext.Provider>
  );
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { account, request, requireLogin } = useSession();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const latest = useRef(0);
  const read = useRef(0);
  const epoch = useRef(0);
  const conversationEpoch = useRef(0);
  const selectedRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      epoch.current++;
      conversationEpoch.current++;
    },
    [],
  );
  const accountId = account?.id;
  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = false;
    let failures = 0;
    let catchupPages = 0;
    const myEpoch = epoch.current;
    const myConversationEpoch = conversationEpoch.current;
    async function poll() {
      if (active || document.hidden || controller.signal.aborted) return;
      active = true;
      let followUp = false;
      if (!latest.current && selected && open) setLoading(true);
      try {
        const after = latest.current;
        const query =
          selected && open
            ? `?conversationId=${encodeURIComponent(selected)}&after=${after}`
            : "";
        const result = await request<SyncResponse>(`/sync${query}`, {
          signal: controller.signal,
        });
        if (
          controller.signal.aborted ||
          myEpoch !== epoch.current ||
          myConversationEpoch !== conversationEpoch.current
        )
          return;
        setConversations(result.conversations);
        setUnread(result.unreadCount);
        setError("");
        failures = 0;
        if (selected && open) {
          setMessages((current) => mergeMessages(current, result.messages));
          if (!latest.current) setHasMore(result.hasMore);
          const last = Math.max(
            latest.current,
            result.messages.at(-1)?.id || 0,
          );
          latest.current = Math.max(latest.current, last);
          const hasNewer = after > 0 && result.hasMore;
          if (hasNewer && last > after && catchupPages < 3) {
            catchupPages++;
            followUp = true;
          } else {
            catchupPages = 0;
          }
          if (last > read.current && document.hasFocus() && !reportTarget) {
            await request(
              `/conversations/${selected}/read`,
              json("POST", { messageId: last }),
            );
            if (
              controller.signal.aborted ||
              myEpoch !== epoch.current ||
              myConversationEpoch !== conversationEpoch.current
            )
              return;
            read.current = last;
            const unreadHere =
              result.conversations.find((item) => item.id === selected)
                ?.unreadCount || 0;
            setUnread(
              hasNewer
                ? result.unreadCount
                : Math.max(0, result.unreadCount - unreadHere),
            );
            setConversations((items) =>
              items.map((item) =>
                item.id === selected && !hasNewer
                  ? { ...item, unreadCount: 0 }
                  : item,
              ),
            );
          }
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          setError(failure instanceof RequestError ? failure.code : "generic");
          failures++;
        }
      } finally {
        active = false;
        if (!controller.signal.aborted) {
          setLoading(false);
          timer = setTimeout(
            poll,
            followUp && !failures
              ? 250
              : Math.min(
                  60000,
                  (open ? 5000 : 20000) * 2 ** Math.min(failures, 3),
                ),
          );
        }
      }
    }
    const visibility = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", visibility);
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", visibility);
    };
  }, [accountId, selected, open, revision, request, reportTarget]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  function select(id: string) {
    if (selectedRef.current !== id) {
      conversationEpoch.current++;
      setMessages([]);
      latest.current = 0;
      read.current = 0;
      setHasMore(false);
    }
    selectedRef.current = id || null;
    setSelected(id || null);
    setOpen(true);
  }
  async function start(playerId: string) {
    if (!account) {
      requireLogin();
      return;
    }
    const myEpoch = epoch.current;
    const result = await request<{ conversationId: string }>(
      "/conversations",
      json("POST", { playerId }),
    );
    if (myEpoch !== epoch.current) return;
    select(result.conversationId);
    refresh();
  }
  async function send(body: string) {
    if (!selected || !account) return;
    const id = selected;
    const myEpoch = epoch.current;
    const myConversationEpoch = conversationEpoch.current;
    const result = await request<{ message: Message }>(
      `/conversations/${id}/messages`,
      json("POST", { body, clientId: crypto.randomUUID() }),
    );
    if (
      myEpoch !== epoch.current ||
      myConversationEpoch !== conversationEpoch.current ||
      selectedRef.current !== id
    )
      return;
    setMessages((current) => mergeMessages(current, [result.message]));
    refresh();
  }
  async function previous() {
    if (!selected || !messages.length) return;
    const myEpoch = epoch.current;
    const myConversationEpoch = conversationEpoch.current;
    const id = selected;
    const result = await request<{ messages: Message[]; hasMore: boolean }>(
      `/conversations/${selected}/messages?before=${messages[0].id}`,
    );
    if (
      myEpoch !== epoch.current ||
      myConversationEpoch !== conversationEpoch.current ||
      selectedRef.current !== id
    )
      return;
    setMessages((current) => mergeMessages(current, result.messages));
    setHasMore(result.hasMore);
  }
  return (
    <ChatContext.Provider
      value={{
        conversations,
        selected,
        messages,
        hasMore,
        unread,
        loading,
        error,
        open,
        show: () => {
          if (!account) requireLogin();
          else setOpen(true);
        },
        close: () => setOpen(false),
        select,
        start,
        send,
        previous,
        refresh,
        report: setReportTarget,
      }}
    >
      {children}
      {open && account && <ChatDialog />}
      {reportTarget && account && (
        <ReportDialog
          target={reportTarget}
          close={() => setReportTarget(null)}
        />
      )}
    </ChatContext.Provider>
  );
}
