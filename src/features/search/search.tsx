import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Search, UserRoundSearch, X } from "lucide-react";
import {
  maxSearchLength,
  minSearchLength,
  normalizeSearchQuery,
  type Player,
  type SearchResponse,
  type TeamSummary,
} from "../../../shared/contracts";
import { RequestError } from "../../lib/api";
import { useLocale } from "../../i18n";
import { useSession } from "../../app/contexts";
import { Avatar, Dialog, Alert, useAction, Loading } from "../../components/ui";

type SearchCategory = "players" | "teams";
type SearchTab = "overview" | SearchCategory;

function SearchResultSection({
  category,
  count,
  children,
  onMore,
  busy,
}: {
  category: SearchCategory;
  count: number;
  children: ReactNode;
  onMore?: () => void;
  busy: boolean;
}) {
  const { t } = useLocale();
  const title = t(`search.${category}`);
  return (
    <section className="search-result-section" aria-label={title}>
      <div className="results-heading">
        <h3>{title}</h3>
        {count > 0 && (
          <small>
            {t(category === "players" ? "search.count" : "search.teamCount", {
              count,
            })}
          </small>
        )}
      </div>
      {count > 0 ? (
        <div className="search-result-grid">{children}</div>
      ) : (
        <p className="muted">
          {t(category === "players" ? "search.empty" : "search.teamsEmpty")}
        </p>
      )}
      {onMore && (
        <button
          className="button button-secondary"
          disabled={busy}
          onClick={onMore}
        >
          {t("common.more")}
        </button>
      )}
    </section>
  );
}

export function SearchDialog({ close }: { close: () => void }) {
  const { t } = useLocale();
  const { request } = useSession();
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [playerCursor, setPlayerCursor] = useState<string | null>(null);
  const [teamCursor, setTeamCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<SearchTab>("overview");
  const queryEpoch = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const action = useAction();
  const term = normalizeSearchQuery(query);
  const ready = [...term].length >= minSearchLength;
  function changeQuery(value: string) {
    queryEpoch.current++;
    setQuery(value);
    setPlayers([]);
    setTeams([]);
    setPlayerCursor(null);
    setTeamCursor(null);
    setError("");
    action.setError("");
    setLoading([...normalizeSearchQuery(value)].length >= minSearchLength);
  }
  useEffect(() => {
    const controller = new AbortController();
    const currentEpoch = queryEpoch.current;
    const isCurrent = () =>
      !controller.signal.aborted && currentEpoch === queryEpoch.current;
    if ([...normalizeSearchQuery(query)].length < minSearchLength)
      return () => controller.abort();
    const timer = setTimeout(() => {
      request<SearchResponse>(`/search?q=${encodeURIComponent(query.trim())}`, {
        signal: controller.signal,
      })
        .then((result) => {
          if (isCurrent()) {
            setPlayers(result.players);
            setTeams(result.teams);
            setPlayerCursor(result.nextCursor);
            setTeamCursor(result.nextTeamCursor);
          }
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
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, request]);
  function more(category: SearchCategory) {
    const cursor = category === "players" ? playerCursor : teamCursor;
    if (!cursor) return;
    const currentEpoch = queryEpoch.current;
    void action.run(async () => {
      try {
        const result = await request<SearchResponse>(
          `/search?q=${encodeURIComponent(query.trim())}&category=${category}&cursor=${encodeURIComponent(cursor)}`,
        );
        if (currentEpoch !== queryEpoch.current) return;
        if (category === "players") {
          setPlayers((current) => [...current, ...result.players]);
          setPlayerCursor(result.nextCursor);
        } else {
          setTeams((current) => [...current, ...result.teams]);
          setTeamCursor(result.nextTeamCursor);
        }
      } catch (failure) {
        if (currentEpoch === queryEpoch.current) throw failure;
      }
    });
  }
  return (
    <Dialog
      title={t("search.label")}
      close={close}
      className="search-dialog"
      initialFocus={inputRef}
    >
      <div className="search-input-wrap">
        <Search size={20} />
        <input
          ref={inputRef}
          value={query}
          maxLength={maxSearchLength}
          onChange={(event) => changeQuery(event.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("search.label")}
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
      <div
        className="tabs search-tabs"
        role="tablist"
        aria-label={t("search.label")}
      >
        <button
          role="tab"
          aria-selected={tab === "overview"}
          onClick={() => setTab("overview")}
        >
          {t("search.overview")}
        </button>
        <button
          role="tab"
          aria-selected={tab === "players"}
          onClick={() => setTab("players")}
        >
          {t("search.players")}
        </button>
        <button
          role="tab"
          aria-selected={tab === "teams"}
          onClick={() => setTab("teams")}
        >
          {t("search.teams")}
        </button>
        <button
          disabled
          role="tab"
          aria-selected="false"
          title={t("nav.future")}
        >
          {t("search.tournaments")}
        </button>
      </div>
      <div className="search-results" role="tabpanel">
        {loading ? (
          <Loading />
        ) : error ? (
          <Alert code={error} />
        ) : !ready ? (
          <div className="empty-state compact">
            <UserRoundSearch size={30} />
            <p>
              {t(
                term
                  ? "search.minimum"
                  : tab === "players"
                    ? "search.playerHint"
                    : tab === "teams"
                      ? "search.teamHint"
                      : "search.hint",
              )}
            </p>
          </div>
        ) : (
          <>
            {tab !== "teams" && (
              <SearchResultSection
                category="players"
                count={players.length}
                onMore={playerCursor ? () => more("players") : undefined}
                busy={action.busy}
              >
                {players.map((player) => (
                  <Link
                    to={`/players/${player.id}`}
                    key={player.id}
                    className="search-result-card"
                    onClick={close}
                    aria-label={t("search.open", { name: player.username })}
                  >
                    <Avatar name={player.username} />
                    <span>
                      <strong>{player.username}</strong>
                      <small>{player.bio}</small>
                    </span>
                    <ArrowUpRight size={17} />
                  </Link>
                ))}
              </SearchResultSection>
            )}
            {tab !== "players" && (
              <SearchResultSection
                category="teams"
                count={teams.length}
                onMore={teamCursor ? () => more("teams") : undefined}
                busy={action.busy}
              >
                {teams.map((team) => (
                  <Link
                    to={`/teams/${team.id}`}
                    key={team.id}
                    className="search-result-card"
                    onClick={close}
                    aria-label={t("search.openTeam", {
                      name: team.name,
                      tag: team.tag,
                    })}
                  >
                    <span className="team-tag">{team.tag}</span>
                    <span>
                      <strong>{team.name}</strong>
                      <small>
                        {team.captainUsername === null
                          ? t("teams.captainUnavailable")
                          : t("teams.captain", {
                              name: team.captainUsername,
                            })}{" "}
                        · {t("teams.members", { count: team.memberCount })}
                      </small>
                    </span>
                    <ArrowUpRight size={17} />
                  </Link>
                ))}
              </SearchResultSection>
            )}
          </>
        )}
        <Alert code={action.error} />
        {tab === "overview" && (
          <p className="future-search-note">{t("search.future")}</p>
        )}
      </div>
    </Dialog>
  );
}
