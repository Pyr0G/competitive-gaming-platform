import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Flag, MessageCircle, Send, ShieldBan } from "lucide-react";
import { json } from "../../lib/api";
import { useLocale } from "../../i18n";
import { useSession, useChat, type ReportTarget } from "../../app/contexts";
import { Avatar, Dialog, Alert, useAction, Loading } from "../../components/ui";

export function ChatDialog() {
  const { t, date } = useLocale();
  const { account, request } = useSession();
  const chat = useChat();
  const conversation = chat.conversations.find(
    (item) => item.id === chat.selected,
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const action = useAction();
  const previousAction = useAction();
  const blockAction = useAction();
  const bottom = useRef<HTMLDivElement>(null);
  const previousLast = useRef<number | undefined>(undefined);
  useEffect(() => {
    const last = chat.messages.at(-1)?.id;
    if (last !== previousLast.current)
      bottom.current?.scrollIntoView({ block: "nearest" });
    previousLast.current = last;
  }, [chat.messages]);
  const blocked =
    conversation?.blockedByMe ||
    conversation?.blockedByOther ||
    conversation?.unavailable;
  const draft = chat.selected ? drafts[chat.selected] || "" : "";
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || !chat.selected) return;
    const id = chat.selected;
    const sent = draft;
    void action.run(async () => {
      await chat.send(sent);
      setDrafts((current) =>
        current[id] === sent ? { ...current, [id]: "" } : current,
      );
    });
  }
  return (
    <Dialog title={t("chat.title")} close={chat.close} className="chat-dialog">
      <div className={`chat-layout ${chat.selected ? "has-selected" : ""}`}>
        <aside className="conversation-list">
          {chat.conversations.map((item) => (
            <button
              className={`conversation-item ${item.id === chat.selected ? "selected" : ""}`}
              key={item.id}
              onClick={() => chat.select(item.id)}
            >
              <Avatar name={item.player.username} />
              <span>
                <strong>{item.player.username}</strong>
                <small>{item.lastMessage?.body || t("chat.noMessages")}</small>
              </span>
              {item.unreadCount > 0 && (
                <span className="conversation-badge">{item.unreadCount}</span>
              )}
            </button>
          ))}
          {!chat.conversations.length && (
            <div className="empty-state compact">
              <MessageCircle size={27} />
              <h3>{t("chat.empty")}</h3>
              <p>{t("chat.start")}</p>
            </div>
          )}
        </aside>
        <section className="chat-thread">
          {conversation ? (
            <>
              <header className="thread-header">
                <button
                  className="icon-button thread-back"
                  onClick={() => chat.select("")}
                  aria-label={t("common.back")}
                >
                  <ArrowLeft size={18} />
                </button>
                <Link
                  to={`/players/${conversation.player.id}`}
                  onClick={chat.close}
                >
                  <Avatar name={conversation.player.username} />
                  <strong>{conversation.player.username}</strong>
                </Link>
                <button
                  className="icon-button"
                  aria-label={t(
                    conversation.blockedByMe
                      ? "profile.unblock"
                      : "profile.block",
                  )}
                  disabled={blockAction.busy}
                  onClick={() =>
                    void blockAction.run(async () => {
                      await request(
                        `/blocks/${conversation.player.id}`,
                        json(conversation.blockedByMe ? "DELETE" : "PUT"),
                      );
                      chat.refresh();
                    })
                  }
                >
                  <ShieldBan size={18} />
                </button>
              </header>
              <div
                className="message-history"
                role="log"
                aria-label={t("chat.title")}
                aria-live="polite"
              >
                {chat.hasMore && (
                  <button
                    className="button button-secondary button-small earlier-messages"
                    onClick={() => void previousAction.run(chat.previous)}
                    disabled={previousAction.busy}
                  >
                    {t("chat.previous")}
                  </button>
                )}
                <Alert code={previousAction.error} />
                {chat.loading && !chat.messages.length ? (
                  <Loading />
                ) : !chat.messages.length ? (
                  <p className="chat-start-hint">{t("chat.noMessages")}</p>
                ) : (
                  chat.messages.map((message) => (
                    <article
                      key={message.id}
                      className={`message ${message.senderId === account!.id ? "message-own" : ""}`}
                    >
                      <div className="message-bubble">
                        <p className="user-content">{message.body}</p>
                        <footer>
                          <time dateTime={message.createdAt}>
                            {date(message.createdAt, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </time>
                          {message.senderId !== account!.id && (
                            <button
                              className="message-report"
                              aria-label={t("chat.report")}
                              onClick={() =>
                                chat.report({
                                  messageId: message.id,
                                  username: conversation.player.username,
                                })
                              }
                            >
                              <Flag size={13} />
                            </button>
                          )}
                        </footer>
                      </div>
                    </article>
                  ))
                )}
                <div ref={bottom} />
              </div>
              {chat.error && (
                <p className="chat-connection" role="status">
                  {t("chat.connection")}
                </p>
              )}
              <Alert code={blockAction.error} />
              <form className="message-composer" onSubmit={submit}>
                {blocked ? (
                  <p className="muted">{t("chat.blocked")}</p>
                ) : (
                  <>
                    <textarea
                      aria-label={t("chat.messageLabel")}
                      placeholder={t("chat.placeholder")}
                      rows={2}
                      maxLength={2000}
                      value={draft}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [chat.selected!]: event.target.value,
                        }))
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          if (draft.trim() && !action.busy)
                            event.currentTarget.form?.requestSubmit();
                        }
                      }}
                    />
                    <button
                      className="button icon-send"
                      disabled={action.busy || !draft.trim()}
                      aria-label={t(action.busy ? "chat.sending" : "chat.send")}
                    >
                      <Send size={18} />
                    </button>
                  </>
                )}
                <Alert code={action.error} />
              </form>
            </>
          ) : (
            <div className="empty-state">
              <MessageCircle size={36} />
              <h3>{t("chat.select")}</h3>
            </div>
          )}
        </section>
      </div>
    </Dialog>
  );
}

export function ReportDialog({
  target,
  close,
}: {
  target: ReportTarget;
  close: () => void;
}) {
  const { t } = useLocale();
  const { request } = useSession();
  const [reason, setReason] = useState("");
  const action = useAction();
  function submit(event: FormEvent) {
    event.preventDefault();
    void action.run(async () => {
      await request(
        "/reports",
        json("POST", { messageId: target.messageId, reason }),
      );
      setReason("");
    }, "report.sent");
  }
  return (
    <Dialog title={t("report.title")} close={close} className="report-dialog">
      <p className="muted">{t("report.help")}</p>
      <p className="report-target">
        <Avatar name={target.username} />
        <strong>{target.username}</strong>
      </p>
      {action.success ? (
        <>
          <Alert success code={action.success} />
          <button className="button" onClick={close}>
            {t("common.close")}
          </button>
        </>
      ) : (
        <form className="form-stack" onSubmit={submit}>
          <label>
            {t("report.reason")}
            <textarea
              required
              minLength={3}
              maxLength={1000}
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <Alert code={action.error} />
          <button className="button" disabled={action.busy}>
            {t("report.submit")}
          </button>
        </form>
      )}
    </Dialog>
  );
}
