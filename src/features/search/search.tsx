import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Search, UserRoundSearch, X } from "lucide-react";
import type { Player, SearchResponse } from "../../../shared/contracts";
import { RequestError } from "../../lib/api";
import { useLocale } from "../../i18n";
import { useSession } from "../../app/contexts";
import { Avatar, Dialog, Alert, useAction, Loading } from "../../components/ui";

export function SearchDialog({ close }: { close: () => void }) {
  const { t } = useLocale();
  const { request } = useSession();
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const queryEpoch = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const action = useAction();
  function changeQuery(value: string) {
    queryEpoch.current++;
    setQuery(value);
    setPlayers([]);
    setCursor(null);
    setError("");
    setLoading(value.trim().length >= 2);
  }
  useEffect(() => {
    const controller = new AbortController();
    if (query.trim().length < 2) return () => controller.abort();
    const timer = setTimeout(() => {
      request<SearchResponse>(`/search?q=${encodeURIComponent(query.trim())}`, {
        signal: controller.signal,
      })
        .then((result) => {
          if (!controller.signal.aborted) {
            setPlayers(result.players);
            setCursor(result.nextCursor);
          }
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
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, request]);
  function more() {
    const currentEpoch = queryEpoch.current;
    void action.run(async () => {
      const result = await request<SearchResponse>(
        `/search?q=${encodeURIComponent(query.trim())}&cursor=${encodeURIComponent(cursor!)}`,
      );
      if (currentEpoch !== queryEpoch.current) return;
      setPlayers((current) => [...current, ...result.players]);
      setCursor(result.nextCursor);
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
          maxLength={64}
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
          disabled
          role="tab"
          aria-selected="false"
          title={t("nav.future")}
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
        <div className="results-heading">
          <h3>{t("search.players")}</h3>
          {players.length > 0 && (
            <small>{t("search.count", { count: players.length })}</small>
          )}
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <Alert code={error} />
        ) : players.length ? (
          <div className="player-results">
            {players.map((player) => (
              <Link
                to={`/players/${player.id}`}
                key={player.id}
                className="player-result"
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
          </div>
        ) : (
          <div className="empty-state compact">
            <UserRoundSearch size={30} />
            <p>
              {t(
                query.trim().length < 2
                  ? query
                    ? "search.minimum"
                    : "search.hint"
                  : "search.empty",
              )}
            </p>
          </div>
        )}
        {cursor && (
          <button
            className="button button-secondary"
            disabled={action.busy}
            onClick={more}
          >
            {t("common.more")}
          </button>
        )}
        <Alert code={action.error} />
        {tab === "overview" && (
          <p className="future-search-note">{t("search.future")}</p>
        )}
      </div>
    </Dialog>
  );
}
