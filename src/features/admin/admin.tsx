import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Search } from "lucide-react";
import type {
  AdminAction,
  AdminUser,
  Post,
  Report,
} from "../../../shared/contracts";
import { json, RequestError } from "../../lib/api";
import { useLocale } from "../../i18n";
import { useSession } from "../../app/contexts";
import {
  Avatar,
  Dialog,
  Alert,
  useAction,
  Loading,
  PageHeading,
} from "../../components/ui";

interface AdminPageResponse {
  users?: AdminUser[];
  reports?: Report[];
  posts?: Post[];
  actions?: AdminAction[];
  nextCursor: string | null;
}

export function AdminPage() {
  const { t, date } = useLocale();
  const { request, account } = useSession();
  const [tab, setTab] = useState<"users" | "reports" | "posts" | "audit">(
    "users",
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [actions, setActions] = useState<AdminAction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [moderation, setModeration] = useState<{
    user?: AdminUser;
    report?: Report;
  } | null>(null);
  const [postEditor, setPostEditor] = useState<{
    id?: string;
    title: string;
    body: string;
  } | null>(null);
  const [postDeleteId, setPostDeleteId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const action = useAction();
  const moreAction = useAction();
  const pageEpoch = useRef(0);
  function resetPage() {
    pageEpoch.current++;
    setLoading(true);
    setError("");
    action.setError("");
    moreAction.setError("");
    setPostDeleteId(null);
    setUsers([]);
    setReports([]);
    setPosts([]);
    setActions([]);
    setCursor(null);
  }
  function refreshPage() {
    resetPage();
    setRevision((value) => value + 1);
  }
  const endpoint =
    tab === "users"
      ? `/admin/users?q=${encodeURIComponent(query)}`
      : tab === "reports"
        ? `/admin/reports?status=${status}`
        : tab === "posts"
          ? "/admin/posts"
          : "/admin/actions";
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        request<AdminPageResponse>(endpoint, { signal: controller.signal })
          .then((result) => {
            if (controller.signal.aborted) return;
            setUsers(result.users || []);
            setReports(result.reports || []);
            setPosts(result.posts || []);
            setActions(result.actions || []);
            setCursor(result.nextCursor ?? null);
          })
          .catch((failure) => {
            if (!controller.signal.aborted)
              setError(
                failure instanceof RequestError ? failure.code : "generic",
              );
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      query && tab === "users" ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [endpoint, query, revision, request, tab]);
  async function more() {
    if (!cursor) return;
    const currentEpoch = pageEpoch.current;
    const separator = endpoint.includes("?") ? "&" : "?";
    const result = await request<AdminPageResponse>(
      `${endpoint}${separator}cursor=${encodeURIComponent(cursor)}`,
    );
    if (currentEpoch !== pageEpoch.current) return;
    setUsers((current) => [...current, ...(result.users || [])]);
    setReports((current) => [...current, ...(result.reports || [])]);
    setPosts((current) => [...current, ...(result.posts || [])]);
    setActions((current) => [...current, ...(result.actions || [])]);
    setCursor(result.nextCursor);
  }
  function openPostEditor(post?: Post) {
    action.setError("");
    setPostDeleteId(null);
    setPostEditor(
      post
        ? { id: post.id, title: post.title, body: post.body }
        : { title: "", body: "" },
    );
  }
  function submitPost(event: FormEvent) {
    event.preventDefault();
    if (!postEditor) return;
    void action.run(async () => {
      if (postEditor.id)
        await request(
          `/admin/posts/${postEditor.id}`,
          json("PATCH", {
            title: postEditor.title,
            body: postEditor.body,
          }),
        );
      else
        await request(
          "/admin/posts",
          json("POST", {
            title: postEditor.title,
            body: postEditor.body,
          }),
        );
      setPostEditor(null);
      refreshPage();
    }, "admin.postSaved");
  }
  function submitModeration(event: FormEvent) {
    event.preventDefault();
    void action.run(async () => {
      if (moderation?.user)
        await request(
          `/admin/users/${moderation.user.id}/${moderation.user.bannedAt ? "unban" : "ban"}`,
          json("POST", { reason }),
        );
      else if (moderation?.report)
        await request(
          `/admin/reports/${moderation.report.id}/resolve`,
          json("POST", { reason }),
        );
      setModeration(null);
      setReason("");
      refreshPage();
    });
  }
  return (
    <div className="page-container admin-page">
      <PageHeading eyebrow="admin.label" title="admin.title" />
      <div className="tabs admin-tabs">
        {(["users", "reports", "posts", "audit"] as const).map((value) => (
          <button
            className={tab === value ? "active" : ""}
            onClick={() => {
              if (tab === value) return;
              resetPage();
              setTab(value);
            }}
            key={value}
          >
            {t(`admin.${value}`)}
          </button>
        ))}
      </div>
      <section className="panel admin-panel">
        <div className="admin-toolbar">
          {tab === "users" ? (
            <label className="input-with-icon">
              <Search size={18} />
              <input
                placeholder={t("admin.search")}
                aria-label={t("admin.search")}
                maxLength={64}
                value={query}
                onChange={(event) => {
                  resetPage();
                  setQuery(event.target.value);
                }}
              />
            </label>
          ) : tab === "reports" ? (
            <label className="inline-label">
              {t("admin.status")}
              <select
                value={status}
                onChange={(event) => {
                  resetPage();
                  setStatus(event.target.value as "open" | "resolved");
                }}
              >
                <option value="open">{t("admin.open")}</option>
                <option value="resolved">{t("admin.resolved")}</option>
              </select>
            </label>
          ) : tab === "posts" ? (
            <button
              className="button button-small"
              onClick={() => openPostEditor()}
              disabled={action.busy}
            >
              {t("admin.newPost")}
            </button>
          ) : (
            <h2>{t("admin.audit")}</h2>
          )}
          <button
            className="button button-secondary button-small"
            onClick={refreshPage}
            disabled={action.busy}
          >
            {t("common.refresh")}
          </button>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <Alert code={error} />
        ) : tab === "users" ? (
          users.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("admin.users")}</th>
                    <th>{t("admin.status")}</th>
                    <th>{t("admin.role")}</th>
                    <th>{t("admin.joined")}</th>
                    <th>{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <Link className="table-user" to={`/players/${user.id}`}>
                          <Avatar name={user.username} />
                          <strong>{user.username}</strong>
                        </Link>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${user.bannedAt ? "status-banned" : ""}`}
                        >
                          {t(user.bannedAt ? "admin.banned" : "admin.active")}
                        </span>
                      </td>
                      <td>
                        {t(user.isAdmin ? "admin.admin" : "admin.member")}
                      </td>
                      <td>{date(user.createdAt)}</td>
                      <td>
                        {!user.isAdmin && user.id !== account!.id && (
                          <button
                            className="button button-secondary button-small"
                            onClick={() => {
                              setModeration({ user });
                              setReason("");
                            }}
                          >
                            {t(user.bannedAt ? "admin.unban" : "admin.ban")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-table">{t("admin.noUsers")}</p>
          )
        ) : tab === "posts" ? (
          posts.length ? (
            <div className="report-list">
              {posts.map((post) => (
                <article className="report-card" key={post.id}>
                  <header>
                    <div>
                      <strong>{post.title}</strong>
                      <small>
                        {post.authorUsername} · {date(post.createdAt)}
                      </small>
                    </div>
                  </header>
                  <p className="user-content">{post.body}</p>
                  <div className="button-row">
                    <button
                      className="button button-secondary button-small"
                      onClick={() => openPostEditor(post)}
                      disabled={action.busy}
                    >
                      {t("admin.editPost")}
                    </button>
                    <button
                      className="button button-secondary button-small"
                      onClick={() => {
                        setPostDeleteId(post.id);
                        void action.run(async () => {
                          await request(
                            `/admin/posts/${post.id}`,
                            json("DELETE"),
                          );
                          refreshPage();
                        }, "admin.postDeleted");
                      }}
                      disabled={action.busy}
                    >
                      {t("admin.deletePost")}
                    </button>
                  </div>
                  <Alert code={postDeleteId === post.id ? action.error : ""} />
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-table">{t("admin.noPosts")}</p>
          )
        ) : tab === "reports" ? (
          reports.length ? (
            <div className="report-list">
              {reports.map((report) => (
                <article className="report-card" key={report.id}>
                  <header>
                    <div>
                      <strong>{report.reportedUsername}</strong>
                      <small>
                        {t("admin.reportedBy", {
                          name: report.reporterUsername,
                        })}
                      </small>
                    </div>
                    <time dateTime={report.createdAt}>
                      {date(report.createdAt, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </header>
                  <p className="user-content">{report.reason}</p>
                  <details className="report-evidence">
                    <summary>
                      {t("admin.evidence")}
                      <ChevronDown size={16} />
                    </summary>
                    {report.evidence.map((message) => (
                      <blockquote key={message.id}>
                        <strong>{message.username}</strong>
                        <p className="user-content">{message.body}</p>
                        <time dateTime={message.createdAt}>
                          {date(message.createdAt, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </time>
                      </blockquote>
                    ))}
                  </details>
                  {report.status === "open" ? (
                    <button
                      className="button button-secondary button-small"
                      onClick={() => {
                        setModeration({ report });
                        setReason("");
                      }}
                    >
                      {t("admin.resolve")}
                    </button>
                  ) : (
                    <div className="report-resolution">
                      <span className="status-pill">{t("admin.resolved")}</span>
                      <p className="user-content">{report.resolution}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-table">{t("admin.noReports")}</p>
          )
        ) : actions.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("admin.action")}</th>
                  <th>{t("admin.actor")}</th>
                  <th>{t("admin.target")}</th>
                  <th>{t("admin.reason")}</th>
                  <th>{t("admin.date")}</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {t(
                        item.action === "ban"
                          ? "admin.action.user_banned"
                          : item.action === "unban"
                            ? "admin.action.user_unbanned"
                            : "admin.action.report_resolved",
                      )}
                    </td>
                    <td>{item.actorUsername}</td>
                    <td>{item.targetUsername || t("common.none")}</td>
                    <td className="user-content">{item.reason}</td>
                    <td>
                      {date(item.createdAt, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-table">{t("admin.noAudit")}</p>
        )}
        {cursor && (
          <button
            className="button button-secondary load-more"
            disabled={moreAction.busy}
            onClick={() => void moreAction.run(more)}
          >
            {t("common.more")}
          </button>
        )}
        <Alert code={moreAction.error} />
        <Alert success code={action.success} />
      </section>
      {postEditor && (
        <Dialog
          title={t(postEditor.id ? "admin.editPost" : "admin.newPost")}
          close={() => {
            if (!action.busy) setPostEditor(null);
          }}
        >
          <form className="form-stack" onSubmit={submitPost}>
            <label>
              {t("admin.postTitle")}
              <input
                required
                maxLength={120}
                value={postEditor.title}
                onChange={(event) =>
                  setPostEditor({ ...postEditor, title: event.target.value })
                }
              />
            </label>
            <label>
              {t("admin.postBody")}
              <textarea
                rows={6}
                required
                maxLength={4000}
                value={postEditor.body}
                onChange={(event) =>
                  setPostEditor({ ...postEditor, body: event.target.value })
                }
              />
            </label>
            <Alert code={action.error} />
            <div className="button-row">
              <button
                type="button"
                className="button button-secondary"
                disabled={action.busy}
                onClick={() => setPostEditor(null)}
              >
                {t("common.cancel")}
              </button>
              <button className="button" disabled={action.busy}>
                {t(action.busy ? "common.saving" : "common.save")}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {moderation && (
        <Dialog
          title={
            moderation.user
              ? t(
                  moderation.user.bannedAt
                    ? "admin.confirmUnban"
                    : "admin.confirmBan",
                  { name: moderation.user.username },
                )
              : t("admin.resolve")
          }
          close={() => {
            if (!action.busy) setModeration(null);
          }}
          className="moderation-dialog"
        >
          <p className="muted">
            {t(moderation.user ? "admin.banHelp" : "admin.resolveHelp")}
          </p>
          <form className="form-stack" onSubmit={submitModeration}>
            <label>
              {t(moderation.report ? "admin.resolveNote" : "admin.reason")}
              <textarea
                rows={4}
                required
                minLength={3}
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <Alert code={action.error} />
            <div className="button-row">
              <button
                type="button"
                className="button button-secondary"
                disabled={action.busy}
                onClick={() => setModeration(null)}
              >
                {t("common.cancel")}
              </button>
              <button className="button" disabled={action.busy}>
                {t(
                  moderation.user
                    ? moderation.user.bannedAt
                      ? "admin.unban"
                      : "admin.ban"
                    : "admin.resolve",
                )}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
