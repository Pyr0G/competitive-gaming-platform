import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, Search, Users, X } from "lucide-react";
import {
  maxSearchLength,
  minSearchLength,
  normalizeSearchQuery,
  type TeamDetails,
  type TeamSummary,
  type TeamsResponse,
} from "../../../shared/contracts";
import { json, RequestError } from "../../lib/api";
import { useLocale } from "../../i18n";
import { useSession } from "../../app/contexts";
import {
  Alert,
  Avatar,
  Dialog,
  Loading,
  PageHeading,
  useAction,
} from "../../components/ui";

function teamListPath(query: string, cursor?: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (cursor) params.set("cursor", cursor);
  const search = params.toString();
  return search ? `/teams?${search}` : "/teams";
}

export function TeamsPage() {
  const { t, date } = useLocale();
  const { request, account, requireLogin } = useSession();
  const [query, setQuery] = useState("");
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const queryEpoch = useRef(0);
  const more = useAction();
  const term = normalizeSearchQuery(query);
  const shortQuery = term.length > 0 && [...term].length < minSearchLength;
  function changeQuery(value: string) {
    queryEpoch.current++;
    const next = normalizeSearchQuery(value);
    setQuery(value);
    setTeams([]);
    setCursor(null);
    setError("");
    more.setError("");
    setLoading(!next || [...next].length >= minSearchLength);
  }
  useEffect(() => {
    const controller = new AbortController();
    const currentEpoch = queryEpoch.current;
    const isCurrent = () =>
      !controller.signal.aborted && currentEpoch === queryEpoch.current;
    const search = normalizeSearchQuery(query);
    if (search && [...search].length < minSearchLength)
      return () => controller.abort();
    const timer = setTimeout(
      () => {
        request<TeamsResponse>(teamListPath(query.trim()), {
          signal: controller.signal,
        })
          .then((result) => {
            if (!isCurrent()) return;
            setTeams(result.teams);
            setCursor(result.nextCursor);
          })
          .catch((failure) => {
            if (isCurrent())
              setError(
                failure instanceof RequestError ? failure.code : "generic",
              );
          })
          .finally(() => {
            if (isCurrent()) setLoading(false);
          });
      },
      search ? 250 : 0,
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, request]);
  function loadMore() {
    if (!cursor) return;
    const currentEpoch = queryEpoch.current;
    void more.run(async () => {
      try {
        const result = await request<TeamsResponse>(
          teamListPath(query.trim(), cursor),
        );
        if (currentEpoch !== queryEpoch.current) return;
        setTeams((current) => [...current, ...result.teams]);
        setCursor(result.nextCursor);
      } catch (failure) {
        if (currentEpoch === queryEpoch.current) throw failure;
      }
    });
  }
  function openCreate() {
    if (!account) {
      requireLogin();
      return;
    }
    setCreateOpen(true);
  }
  return (
    <div className="page-container section-page">
      <PageHeading eyebrow="nav.teams" title="teams.title" />
      <div className="section-toolbar">
        <p className="muted">{t("teams.help")}</p>
        <button className="button" onClick={openCreate}>
          <Plus size={17} />
          {t("teams.create")}
        </button>
      </div>
      <section className="panel">
        <div className="input-with-icon team-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            maxLength={maxSearchLength}
            placeholder={t("teams.search")}
            aria-label={t("teams.search")}
          />
          {query && (
            <button
              className="icon-button"
              onClick={() => changeQuery("")}
              aria-label={t("search.clear")}
            >
              <X size={16} />
            </button>
          )}
        </div>
        {shortQuery ? (
          <div className="empty-state compact">
            <Search size={28} />
            <p>{t("search.minimum")}</p>
          </div>
        ) : loading ? (
          <Loading />
        ) : error ? (
          <Alert code={error} />
        ) : teams.length ? (
          <div className="entity-list">
            {teams.map((team) => (
              <Link
                to={`/teams/${team.id}`}
                className="entity-card"
                key={team.id}
              >
                <span className="team-tag">{team.tag}</span>
                <div>
                  <strong>{team.name}</strong>
                  <small>
                    {team.captainUsername === null
                      ? t("teams.captainUnavailable")
                      : t("teams.captain", { name: team.captainUsername })}{" "}
                    · {t("teams.members", { count: team.memberCount })} ·{" "}
                    {date(team.createdAt)}
                  </small>
                </div>
              </Link>
            ))}
          </div>
        ) : term ? (
          <div className="empty-state compact">
            <Users size={28} />
            <h3>{t("teams.noMatches")}</h3>
          </div>
        ) : (
          <div className="empty-state compact">
            <Users size={28} />
            <h3>{t("teams.empty")}</h3>
            <p>{t("teams.emptyHelp")}</p>
            <button className="button" onClick={openCreate}>
              <Plus size={17} />
              {t("teams.create")}
            </button>
          </div>
        )}
        {cursor && (
          <button
            className="button button-secondary load-more"
            disabled={more.busy}
            onClick={loadMore}
          >
            {t("common.more")}
          </button>
        )}
        <Alert code={more.error} />
      </section>
      {createOpen && <CreateTeamDialog close={() => setCreateOpen(false)} />}
    </div>
  );
}

function CreateTeamDialog({ close }: { close: () => void }) {
  const { t } = useLocale();
  const { request } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const action = useAction();
  function submit(event: FormEvent) {
    event.preventDefault();
    void action.run(async () => {
      const result = await request<{ team: TeamSummary }>(
        "/teams",
        json("POST", { name, tag }),
      );
      close();
      navigate(`/teams/${result.team.id}`);
    });
  }
  return (
    <Dialog title={t("teams.create")} close={close}>
      <form className="form-stack" onSubmit={submit}>
        <label>
          {t("teams.name")}
          <input
            required
            minLength={3}
            maxLength={32}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <small>{t("teams.nameHelp")}</small>
        </label>
        <label>
          {t("teams.tag")}
          <input
            required
            minLength={2}
            maxLength={5}
            value={tag}
            onChange={(event) => setTag(event.target.value.toUpperCase())}
          />
          <small>{t("teams.tagHelp")}</small>
        </label>
        <Alert code={action.error} />
        <button className="button" disabled={action.busy}>
          {t(action.busy ? "common.saving" : "teams.create")}
        </button>
      </form>
    </Dialog>
  );
}

export function TeamPage() {
  const { id } = useParams();
  const { t, date } = useLocale();
  const { request } = useSession();
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    request<{ team: TeamDetails }>(`/teams/${encodeURIComponent(id || "")}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setTeam(result.team);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(failure instanceof RequestError ? failure.code : "generic");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, request]);
  if (loading) return <Loading />;
  if (!team)
    return (
      <div className="empty-state">
        <Users size={32} />
        <h1>{t("teams.notFound")}</h1>
        <Alert code={error} />
        <Link to="/teams" className="button button-secondary">
          {t("nav.teams")}
        </Link>
      </div>
    );
  return (
    <div className="page-container section-page">
      <section className="panel">
        <div className="team-header">
          <span className="team-tag large">{team.tag}</span>
          <div>
            <h1>{team.name}</h1>
            <p className="muted">
              {team.captainUsername === null
                ? t("teams.captainUnavailable")
                : t("teams.captain", { name: team.captainUsername })}{" "}
              · {t("teams.created", { date: date(team.createdAt) })}
            </p>
          </div>
        </div>
        <h2>{t("teams.roster")}</h2>
        {team.members.length > 0 ? (
          <div className="entity-list">
            {team.members.map((member) => (
              <Link
                to={`/players/${member.id}`}
                className="entity-card"
                key={member.id}
              >
                <Avatar name={member.username} />
                <div>
                  <strong>{member.username}</strong>
                  <small>
                    {t(
                      member.role === "captain"
                        ? "teams.roleCaptain"
                        : "teams.roleMember",
                    )}{" "}
                    · {date(member.joinedAt)}
                  </small>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted">{t("teams.rosterEmpty")}</p>
        )}
      </section>
    </div>
  );
}
