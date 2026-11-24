import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, Users } from "lucide-react";
import type {
  TeamDetails,
  TeamSummary,
  TeamsResponse,
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

export function TeamsPage() {
  const { t, date } = useLocale();
  const { request, account, requireLogin } = useSession();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const more = useAction();
  useEffect(() => {
    const controller = new AbortController();
    request<TeamsResponse>("/teams", { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setTeams(result.teams);
        setCursor(result.nextCursor);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(failure instanceof RequestError ? failure.code : "generic");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [request]);
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
        {loading ? (
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
                    {t("teams.captain", { name: team.captainUsername })} ·{" "}
                    {t("teams.members", { count: team.memberCount })} ·{" "}
                    {date(team.createdAt)}
                  </small>
                </div>
              </Link>
            ))}
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
            className="button button-secondary"
            disabled={more.busy}
            onClick={() =>
              void more.run(async () => {
                const result = await request<TeamsResponse>(
                  `/teams?cursor=${encodeURIComponent(cursor)}`,
                );
                setTeams((current) => [...current, ...result.teams]);
                setCursor(result.nextCursor);
              })
            }
          >
            {t("common.more")}
          </button>
        )}
        <Alert code={more.error} />
      </section>
      {createOpen && (
        <CreateTeamDialog
          close={() => setCreateOpen(false)}
          onCreated={(team) => {
            setTeams((current) => [team, ...current]);
            setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CreateTeamDialog({
  close,
  onCreated,
}: {
  close: () => void;
  onCreated: (team: TeamSummary) => void;
}) {
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
      onCreated(result.team);
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
              {t("teams.captain", { name: team.captainUsername })} ·{" "}
              {t("teams.created", { date: date(team.createdAt) })}
            </p>
          </div>
        </div>
        <h2>{t("teams.roster")}</h2>
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
      </section>
    </div>
  );
}
