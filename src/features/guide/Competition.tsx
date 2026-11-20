import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, RotateCcw, ShieldCheck, Trophy } from "lucide-react";
import { useLocale, type MessageKey } from "../../i18n";
import { Dialog } from "../../components/ui";
import {
  type Event,
  type Match,
  type Team,
  exampleReference,
  teams,
  winner,
} from "./data";
import { TeamMark, usePreviewActivity } from "./shared";

const rosterNames = [
  ["Aster", "Nova", "Echo", "Sol"],
  ["Vale", "Rook", "Vega", "Lynx"],
  ["Frost", "Flint", "Rune", "Kestrel"],
  ["Ion", "Neon", "Cedar", "Ash"],
  ["Azure", "Oak", "Iris", "Sage"],
  ["Quartz", "Reed", "Lumen", "Gale"],
  ["Cobalt", "Ember", "Onyx", "Raven"],
  ["Cliff", "Blaze", "Pine", "Comet"],
];

function TeamRoster({ team, close }: { team: Team; close: () => void }) {
  const { t } = useLocale();
  return (
    <Dialog title={team} close={close} className="guide-example-dialog">
      <div className="guide-team-banner">
        <TeamMark name={team} />
        <div>
          <h3>{team}</h3>
          <p>{t("guide.teams.roster")}</p>
        </div>
      </div>
      <ul className="guide-roster">
        {rosterNames[teams.indexOf(team)].map((name, index) => (
          <li key={name}>
            <span>
              <TeamMark name={name} />
              <strong>{name}</strong>
            </span>
            <span>
              {t(
                (
                  [
                    "guide.role.igl",
                    "guide.role.awp",
                    "guide.role.support",
                    "guide.role.entry",
                  ] as const
                )[index],
              )}
            </span>
            <span>
              {t(index === 0 ? "guide.teams.captain" : "guide.teams.member")}
            </span>
          </li>
        ))}
        <li className="guide-open-slot">{t("guide.teams.openSlot")}</li>
      </ul>
      <details className="guide-details">
        <summary>{t("guide.teams.permissions")}</summary>
        <p>{t("guide.teams.permissionsHelp")}</p>
      </details>
    </Dialog>
  );
}

function ResultForm({
  event,
  pending,
  used,
  commit,
}: {
  event: Event;
  pending?: Match;
  used: string[];
  commit: (matchId: string, reference: string) => void;
}) {
  const { t } = useLocale();
  const [value, setValue] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);
  const [success, setSuccess] = useState<Team | null>(null);
  const [submission, setSubmission] = useState<{
    matchId: string;
    reference: string;
    team: Team;
  } | null>(null);
  const [checked, setChecked] = useState(0);
  const ref = useRef<HTMLFormElement>(null);
  const { visible, motion } = usePreviewActivity(ref);
  useEffect(() => {
    if (!submission || !visible) return;
    const timer = window.setTimeout(
      () => {
        setChecked(checked + 1);
        if (checked === 3) {
          commit(submission.matchId, submission.reference);
          setSuccess(submission.team);
          setSubmission(null);
        }
      },
      motion ? 400 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [submission, checked, visible, motion, commit]);
  function submit() {
    setError(null);
    setSuccess(null);
    setChecked(0);
    const reference = value.trim();
    if (!reference) {
      setError("guide.import.required");
      return;
    }
    if (
      !/^https:\/\/(?:www\.)?faceit\.com\/[a-z]{2}\/cs2\/room\/1-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(
        reference,
      )
    ) {
      setError("guide.import.invalid");
      return;
    }
    const normalized = reference
      .split("/")
      .filter(Boolean)
      .at(-1)!
      .toLowerCase();
    if (used.includes(normalized)) {
      setError("guide.import.duplicate");
      return;
    }
    if (!pending) {
      setError("guide.import.noMatch");
      return;
    }
    setSubmission({
      matchId: pending.id,
      reference: normalized,
      team: pending.a,
    });
  }
  return (
    <form
      className="guide-result-form"
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        if (!submission) submit();
      }}
      noValidate
    >
      <div className="guide-result-heading">
        <ShieldCheck size={22} />
        <h3>{t("guide.import.label")}</h3>
        <span className="guide-badge">{t("guide.preview")}</span>
      </div>
      <p>
        {t("guide.import.help")}{" "}
        <button
          type="button"
          className="guide-text-button"
          disabled={Boolean(submission)}
          onClick={() => {
            setValue(exampleReference);
            setError(null);
          }}
        >
          {t("guide.import.example")}
        </button>
      </p>
      <div className="guide-result-input">
        <label className="sr-only" htmlFor={`guide-reference-${event.id}`}>
          {t("guide.import.label")}
        </label>
        <input
          id={`guide-reference-${event.id}`}
          type="url"
          value={value}
          maxLength={180}
          disabled={Boolean(submission)}
          placeholder="https://www.faceit.com/en/cs2/room/1-…"
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
            setSuccess(null);
          }}
          aria-invalid={Boolean(error)}
        />
        <button className="button" disabled={Boolean(submission)}>
          {t(submission ? "guide.import.busy" : "guide.import.submit")}
        </button>
      </div>
      {(submission || checked > 0) && (
        <ol className="guide-result-checks">
          {(["link", "finished", "roster", "advance"] as const).map(
            (key, index) => (
              <li key={key} data-complete={index < checked}>
                <Check size={16} />
                {t(`guide.results.${key}`)}
              </li>
            ),
          )}
        </ol>
      )}
      {error && (
        <p className="alert alert-error" role="alert">
          {t(error)}
        </p>
      )}
      {success && (
        <p className="alert alert-success" role="status">
          {t("guide.import.success", { team: success })}
        </p>
      )}
    </form>
  );
}

export function Competition({
  events,
  selectedId,
  choose,
  used,
  commit,
  reset,
}: {
  events: Event[];
  selectedId: Event["id"];
  choose: (id: Event["id"]) => void;
  used: string[];
  commit: (eventId: Event["id"], matchId: string, reference: string) => void;
  reset: () => void;
}) {
  const { t } = useLocale();
  const event = events.find((item) => item.id === selectedId)!;
  return (
    <>
      <div
        className="guide-tabs"
        role="group"
        aria-label={t("guide.bracket.choose")}
      >
        {events.map((item) => (
          <button
            key={item.id}
            aria-pressed={event.id === item.id}
            onClick={() => choose(item.id)}
          >
            <i
              className={`guide-status-dot is-${item.status}`}
              aria-hidden="true"
            />
            {t(`guide.events.${item.id}`)}
          </button>
        ))}
      </div>
      <Bracket
        key={event.id}
        event={event}
        used={used}
        commit={(matchId, reference) => commit(event.id, matchId, reference)}
      />
      <button className="button button-secondary guide-reset" onClick={reset}>
        <RotateCcw size={16} />
        {t("guide.bracket.reset")}
      </button>
    </>
  );
}

function Bracket({
  event,
  used,
  commit,
}: {
  event: Event;
  used: string[];
  commit: (id: string, reference: string) => void;
}) {
  const { t, number, date } = useLocale();
  const matches = event.rounds.flatMap((round) => round.matches);
  const [selected, setSelected] = useState(
    () =>
      matches.find((match) => match.status === "pending")?.id ??
      matches.at(-1)?.id,
  );
  const [team, setTeam] = useState<Team | null>(null);
  const match = matches.find((item) => item.id === selected) ?? matches[0];
  const pending =
    match?.status === "pending"
      ? match
      : matches.find((item) => item.status === "pending");
  const champion = event.status === "done" ? winner(matches.at(-1)!) : null;
  return (
    <>
      <div className="guide-tournament-layout">
        <div className="guide-tournament-board guide-cut-panel">
          <div className="guide-event-header">
            <div>
              <h3>{t(`guide.events.${event.id}`)}</h3>
              <p>
                {date(event.start, { dateStyle: "medium", timeStyle: "short" })}{" "}
                · {event.format} · {number(event.registered.length)} /{" "}
                {number(event.slots)}
              </p>
            </div>
            <span className={`guide-status is-${event.status}`}>
              {t(`guide.events.${event.status}`)}
            </span>
          </div>
          {event.rounds.length ? (
            <div
              className="guide-bracket-scroll"
              tabIndex={0}
              aria-label={t("guide.tournaments.bracket")}
            >
              <div
                className="guide-bracket"
                style={
                  {
                    gridTemplateColumns: `repeat(${event.rounds.length}, minmax(180px, 1fr))`,
                    minWidth: event.rounds.length === 3 ? 650 : 420,
                    "--guide-bracket-height": `${event.rounds[0].matches.length * 128 - 18}px`,
                  } as CSSProperties
                }
              >
                {event.rounds.map((round) => (
                  <div
                    className="guide-bracket-column"
                    key={round.name}
                    data-matches={round.matches.length}
                  >
                    <h4>{t(`guide.bracket.${round.name}`)}</h4>
                    <div className="guide-round-matches">
                      {round.matches.map((item) => (
                        <button
                          className={`guide-match is-${item.status}`}
                          key={item.id}
                          aria-pressed={item.id === match?.id}
                          onClick={() => setSelected(item.id)}
                          aria-label={t("guide.tournaments.selectMatch", {
                            a: item.a,
                            b: item.b ?? t("guide.bracket.tbd"),
                          })}
                        >
                          {[
                            { name: item.a, score: item.scoreA },
                            { name: item.b, score: item.scoreB },
                          ].map((participant, index) => (
                            <span
                              key={index}
                              className={
                                participant.name === winner(item)
                                  ? "is-winner"
                                  : ""
                              }
                            >
                              <TeamMark name={participant.name ?? "?"} />
                              <span>
                                {participant.name ?? t("guide.bracket.tbd")}
                              </span>
                              <b>
                                {participant.score === undefined
                                  ? "—"
                                  : number(participant.score)}
                              </b>
                            </span>
                          ))}
                          <small>
                            {t(
                              item.status === "done"
                                ? "guide.events.done"
                                : `guide.bracket.${item.status}`,
                            )}
                          </small>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="guide-registered-teams">
              <p>{t("guide.events.unavailable")}</p>
              <ul>
                {event.registered.map((name) => (
                  <li key={name}>
                    <button
                      onClick={() => setTeam(name)}
                      aria-label={t("guide.bracket.roster", { team: name })}
                    >
                      <TeamMark name={name} />
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {champion && (
            <div className="guide-champion">
              <Trophy size={28} />
              <span>
                {t("guide.tournaments.champion")}
                <strong>{champion}</strong>
              </span>
            </div>
          )}
        </div>
        <aside
          className="guide-match-detail guide-cut-panel"
          aria-label={t("guide.tournaments.details")}
          key={match?.id ?? event.id}
        >
          <span className="guide-panel-label">
            {t("guide.tournaments.details")}
          </span>
          <h3>
            {match ? (
              <>
                {match.a} <span>{t("guide.versus")}</span>{" "}
                {match.b ?? t("guide.bracket.tbd")}
              </>
            ) : (
              t(`guide.events.${event.id}`)
            )}
          </h3>
          {match &&
            [match.a, match.b].map((name, index) => (
              <button
                className={`guide-detail-team ${name === winner(match) ? "is-winner" : ""}`}
                key={index}
                disabled={!name}
                onClick={() => name && setTeam(name)}
                aria-label={
                  name
                    ? t("guide.bracket.roster", { team: name })
                    : t("guide.bracket.tbd")
                }
              >
                <TeamMark name={name ?? "?"} />
                <span>{name ?? t("guide.bracket.tbd")}</span>
                <b>{[match.scoreA, match.scoreB][index] ?? "—"}</b>
              </button>
            ))}
          <dl className="guide-facts">
            <div>
              <dt>{t("guide.tournaments.status")}</dt>
              <dd>
                {t(
                  !match
                    ? "guide.events.open"
                    : match.status === "done"
                      ? "guide.events.done"
                      : `guide.bracket.${match.status}`,
                )}
              </dd>
            </div>
            <div>
              <dt>{t("guide.tournaments.map")}</dt>
              <dd>{match?.map ?? t("guide.bracket.tbd")}</dd>
            </div>
            <div>
              <dt>{t("guide.events.start")}</dt>
              <dd>
                {date(event.start, { dateStyle: "medium", timeStyle: "short" })}
              </dd>
            </div>
            <div>
              <dt>{t("guide.tournaments.matchFormat")}</dt>
              <dd>{event.format}</dd>
            </div>
          </dl>
          {match && (
            <>
              <p className="guide-panel-label">
                {t("guide.bracket.reference")}
              </p>
              <code>{match.reference ?? t("guide.bracket.noReference")}</code>
            </>
          )}
          {match && (
            <p>
              {t(
                match.status === "done"
                  ? "guide.bracket.completedHelp"
                  : match.status === "pending"
                    ? "guide.bracket.pendingHelp"
                    : "guide.bracket.scheduledHelp",
              )}
            </p>
          )}
          {!match && (
            <>
              <p>{t("guide.events.unavailable")}</p>
              <button className="button full-width" disabled>
                {t("guide.events.register")}
              </button>
            </>
          )}
        </aside>
      </div>
      <ResultForm event={event} pending={pending} used={used} commit={commit} />
      {team && <TeamRoster team={team} close={() => setTeam(null)} />}
    </>
  );
}

export function Rankings({ events }: { events: Event[] }) {
  const { t, number } = useLocale();
  const completed = events
    .flatMap((event) => event.rounds.flatMap((round) => round.matches))
    .filter((match) => match.status === "done");
  const champions = events
    .filter((event) => event.status === "done")
    .map((event) => winner(event.rounds.at(-1)!.matches[0]));
  const rows = teams
    .map((name) => {
      const played = completed.filter(
        (match) => match.a === name || match.b === name,
      );
      const form = played.map((match) =>
        winner(match) === name ? ("win" as const) : ("loss" as const),
      );
      return {
        name,
        played: played.length,
        won: form.filter((result) => result === "win").length,
        lost: form.filter((result) => result === "loss").length,
        rounds: played.reduce(
          (sum, match) =>
            sum +
            (match.a === name
              ? match.scoreA! - match.scoreB!
              : match.scoreB! - match.scoreA!),
          0,
        ),
        form,
        titles: champions.filter((champion) => champion === name).length,
      };
    })
    .sort(
      (a, b) =>
        b.won - a.won || b.rounds - a.rounds || a.name.localeCompare(b.name),
    );
  const mapCounts = [...new Set(completed.map((match) => match.map!))]
    .map((name) => ({
      name,
      count: completed.filter((match) => match.map === name).length,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return (
    <div className="guide-rankings-layout">
      <div className="table-scroll guide-rankings-table guide-cut-panel">
        <table className="guide-standings">
          <caption>{t("guide.rankings.caption")}</caption>
          <thead>
            <tr>
              {(
                [
                  "place",
                  "team",
                  "played",
                  "won",
                  "lost",
                  "rounds",
                  "form",
                  "titles",
                ] as const
              ).map((key) => (
                <th key={key} scope="col">
                  {t(`guide.rankings.${key}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.name}
                className={index === 0 ? "guide-rank-leader" : ""}
              >
                <td className={`guide-rank-position guide-rank-${index + 1}`}>
                  {number(index + 1)}
                </td>
                <th scope="row">
                  <span className="guide-ranking-team">
                    <TeamMark name={row.name} />
                    {row.name}
                  </span>
                </th>
                <td>{number(row.played)}</td>
                <td className="guide-wins">{number(row.won)}</td>
                <td className="guide-losses">{number(row.lost)}</td>
                <td
                  className={
                    row.rounds > 0
                      ? "guide-wins"
                      : row.rounds < 0
                        ? "guide-losses"
                        : ""
                  }
                >
                  {row.rounds > 0 ? "+" : ""}
                  {number(row.rounds)}
                </td>
                <td>
                  <span className="guide-form">
                    {row.form.slice(-5).map((result, game) => (
                      <span
                        className={`guide-form-${result}`}
                        key={game}
                        aria-label={t(`guide.rankings.${result}`)}
                      >
                        {t(`guide.rankings.${result}Short`)}
                      </span>
                    ))}
                  </span>
                </td>
                <td>
                  {row.titles ? (
                    <span className="guide-titles">
                      <Trophy size={15} />
                      {number(row.titles)}
                    </span>
                  ) : (
                    number(0)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <aside
        className="guide-ranking-insights"
        aria-label={t("guide.rankings.insights")}
      >
        <div className="guide-cut-panel">
          <h3 className="guide-panel-label">{t("guide.rankings.maps")}</h3>
          <ul className="guide-map-stats">
            {mapCounts.map((map) => (
              <li key={map.name}>
                <span>{map.name}</span>
                <b>{number(map.count)}</b>
              </li>
            ))}
          </ul>
        </div>
        <div className="guide-cut-panel">
          <h3 className="guide-panel-label">{t("guide.rankings.facts")}</h3>
          <dl className="guide-facts">
            <div>
              <dt>{t("guide.rankings.matches")}</dt>
              <dd>{number(completed.length)}</dd>
            </div>
            <div>
              <dt>{t("guide.rankings.totalRounds")}</dt>
              <dd>
                {number(
                  completed.reduce(
                    (sum, match) => sum + match.scoreA! + match.scoreB!,
                    0,
                  ),
                )}
              </dd>
            </div>
            <div>
              <dt>{t("guide.tournaments.champion")}</dt>
              <dd>{champions.at(-1) ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
