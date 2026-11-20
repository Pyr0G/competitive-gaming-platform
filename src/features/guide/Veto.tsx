import { useEffect, useRef, useState } from "react";
import { RotateCcw, Shuffle } from "lucide-react";
import { useLocale } from "../../i18n";
import { maps, teams, type Team } from "./data";
import { TeamMark, usePreviewActivity } from "./shared";

type Step = { map: string; action: "ban" | "pick"; team: Team };
const orders = {
  BO1: ["ban", "ban", "ban", "ban", "ban", "ban"],
  BO3: ["ban", "ban", "pick", "pick", "ban", "ban"],
} as const;

export function Veto() {
  const { t, number, locale } = useLocale();
  const [pair, setPair] = useState<[Team, Team]>(["Atlas", "Orbit"]);
  const [format, setFormat] = useState<keyof typeof orders>("BO3");
  const [steps, setSteps] = useState<Step[]>([]);
  const [auto, setAuto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { visible, motion } = usePreviewActivity(ref);
  const order = orders[format];
  const complete = steps.length === order.length;
  const remaining = maps.filter(
    (map) => !steps.some((step) => step.map === map),
  );
  const series = complete
    ? [
        ...steps
          .filter((step) => step.action === "pick")
          .map((step) => step.map),
        remaining[0],
      ]
    : [];
  useEffect(() => {
    if (!auto || complete || !visible) return;
    const timer = window.setTimeout(
      () => {
        setSteps((current) => {
          if (current.length >= order.length) return current;
          const next = maps.find(
            (map) => !current.some((step) => step.map === map),
          )!;
          return [
            ...current,
            {
              map: next,
              action: order[current.length],
              team: pair[current.length % 2],
            },
          ];
        });
      },
      motion ? 320 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [auto, complete, visible, motion, steps, order, pair]);
  function reset() {
    setAuto(false);
    setSteps([]);
  }
  function chooseTeam(index: number, name: Team) {
    reset();
    setPair((current) =>
      index === 0
        ? [name, name === current[1] ? current[0] : current[1]]
        : [name === current[0] ? current[1] : current[0], name],
    );
  }
  return (
    <div className="guide-veto" ref={ref}>
      <div
        className="guide-veto-options"
        role="group"
        aria-label={t("guide.veto.options")}
      >
        <label>
          <TeamMark name={pair[0]} />
          <span className="sr-only">{t("guide.veto.teamA")}</span>
          <select
            value={pair[0]}
            onChange={(event) => chooseTeam(0, event.target.value as Team)}
          >
            {teams.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <b>{t("guide.versus")}</b>
        <label>
          <TeamMark name={pair[1]} />
          <span className="sr-only">{t("guide.veto.teamB")}</span>
          <select
            value={pair[1]}
            onChange={(event) => chooseTeam(1, event.target.value as Team)}
          >
            {teams.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <div
          className="guide-tabs"
          role="group"
          aria-label={t("guide.veto.format")}
        >
          {(["BO1", "BO3"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={format === value}
              onClick={() => {
                reset();
                setFormat(value);
              }}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <p className="guide-veto-turn" role="status">
        {complete
          ? t("guide.veto.selectedSeries", {
              maps: new Intl.ListFormat(locale, { type: "conjunction" }).format(
                series,
              ),
            })
          : t(
              order[steps.length] === "pick"
                ? "guide.veto.pickTurn"
                : "guide.veto.turn",
              { team: pair[steps.length % 2] },
            )}
      </p>
      <p className="guide-note">
        {t("guide.veto.progress", { count: steps.length, total: order.length })}
      </p>
      <div className="guide-maps">
        {maps.map((map) => {
          const step = steps.find((item) => item.map === map);
          const state = step
            ? step.action === "ban"
              ? "is-banned"
              : "is-picked"
            : complete
              ? "is-selected"
              : "";
          return (
            <button
              className={`guide-map ${state}`}
              data-map={map}
              key={map}
              disabled={auto || complete || Boolean(step)}
              aria-label={
                step
                  ? t(
                      step.action === "ban"
                        ? "guide.veto.banned"
                        : "guide.veto.picked",
                      { map },
                    )
                  : complete
                    ? t("guide.veto.selected", { map })
                    : t(
                        order[steps.length] === "pick"
                          ? "guide.veto.pick"
                          : "guide.veto.ban",
                        { map },
                      )
              }
              onClick={() =>
                setSteps((current) =>
                  current.length >= order.length ||
                  current.some((item) => item.map === map)
                    ? current
                    : [
                        ...current,
                        {
                          map,
                          action: order[current.length],
                          team: pair[current.length % 2],
                        },
                      ],
                )
              }
            >
              <span className="guide-map-name">{map}</span>
              <span className="guide-map-state">
                {step
                  ? t(
                      step.action === "ban"
                        ? "guide.veto.byTeam"
                        : "guide.veto.pickByTeam",
                      { team: step.team },
                    )
                  : complete
                    ? t("guide.veto.decider")
                    : t("guide.veto.available")}
              </span>
            </button>
          );
        })}
      </div>
      {complete && (
        <ol className="guide-series" aria-label={t("guide.veto.seriesTitle")}>
          {series.map((map, index) => (
            <li key={map}>
              <span>{number(index + 1)}</span>
              <div>
                <strong>{map}</strong>
                <small>
                  {index === series.length - 1
                    ? t("guide.veto.decider")
                    : t("guide.veto.pickByTeam", { team: pair[index] })}
                </small>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="guide-veto-footer">
        <ol className="guide-veto-log" aria-label={t("guide.veto.logTitle")}>
          {steps.map((step) => (
            <li key={step.map}>
              {t(
                step.action === "ban"
                  ? "guide.veto.logBan"
                  : "guide.veto.logPick",
                { team: step.team, map: step.map },
              )}
            </li>
          ))}
        </ol>
        <div className="guide-veto-actions">
          <button
            className="button button-secondary"
            disabled={auto || complete}
            onClick={() => setAuto(true)}
          >
            <Shuffle size={16} />
            {t(auto && !complete ? "guide.veto.autoBusy" : "guide.veto.auto")}
          </button>
          <button
            className="button button-secondary"
            disabled={!steps.length && !auto}
            onClick={reset}
          >
            <RotateCcw size={16} />
            {t("guide.reset")}
          </button>
        </div>
      </div>
    </div>
  );
}
