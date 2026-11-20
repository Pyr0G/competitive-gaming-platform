import { useEffect, useRef, useState } from "react";
import { Trophy } from "lucide-react";
import { useLocale } from "../../i18n";
import { type Event, winner } from "./data";
import { usePreviewActivity } from "./shared";

export function Events({
  events,
  choose,
}: {
  events: Event[];
  choose: (id: Event["id"]) => void;
}) {
  const { t, date, number, locale } = useLocale();
  const [filter, setFilter] = useState<"all" | Event["status"]>("all");
  const ref = useRef<HTMLDivElement>(null);
  const { visible } = usePreviewActivity(ref);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!visible) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [visible]);
  const digits = new Intl.NumberFormat(locale, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  return (
    <div ref={ref}>
      <div
        className="guide-tabs"
        role="group"
        aria-label={t("guide.events.filters")}
      >
        {(["all", "open", "live", "done"] as const).map((status) => (
          <button
            key={status}
            aria-pressed={filter === status}
            onClick={() => setFilter(status)}
          >
            {status !== "all" && (
              <i
                className={`guide-status-dot is-${status}`}
                aria-hidden="true"
              />
            )}
            {t(`guide.events.${status}`)}
            <span>
              {number(
                events.filter(
                  (event) => status === "all" || event.status === status,
                ).length,
              )}
            </span>
          </button>
        ))}
      </div>
      <div className="guide-event-grid">
        {events
          .filter((event) => filter === "all" || event.status === filter)
          .map((event) => {
            const matches = event.rounds.flatMap((round) => round.matches);
            const finished = matches.filter(
              (match) => match.status === "done",
            ).length;
            const champion =
              event.status === "done" ? winner(matches.at(-1)!) : null;
            const seconds = Math.max(
              0,
              Math.floor((event.deadline - now) / 1000),
            );
            return (
              <article
                className="guide-event-card"
                data-status={event.status}
                key={event.id}
              >
                <div className="guide-event-image">
                  <img
                    src={`/guide/${event.image}-sm.jpg`}
                    width="640"
                    height="360"
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  <span>Counter-Strike 2</span>
                </div>
                <div className="guide-event-content">
                  <div className="guide-event-top">
                    <span className="guide-format">{event.format}</span>
                    <span className={`guide-status is-${event.status}`}>
                      <i
                        className={`guide-status-dot is-${event.status}`}
                        aria-hidden="true"
                      />
                      {t(`guide.events.${event.status}`)}
                    </span>
                  </div>
                  <h3>{t(`guide.events.${event.id}`)}</h3>
                  <dl className="guide-facts">
                    <div>
                      <dt>{t("guide.events.start")}</dt>
                      <dd>
                        {date(event.start, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("guide.events.slots")}</dt>
                      <dd>
                        {number(event.registered.length)} /{" "}
                        {number(event.slots)}
                      </dd>
                    </div>
                    {event.status === "open" ? (
                      <div>
                        <dt>{t("guide.events.free")}</dt>
                        <dd>{number(event.slots - event.registered.length)}</dd>
                      </div>
                    ) : (
                      <div>
                        <dt>{t("guide.events.matches")}</dt>
                        <dd>
                          {number(finished)} / {number(matches.length)}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <div className="guide-slots" aria-hidden="true">
                    {Array.from({ length: event.slots }, (_, index) => (
                      <i
                        key={index}
                        data-filled={index < event.registered.length}
                      />
                    ))}
                  </div>
                  {event.status === "open" && (
                    <div
                      className="guide-countdown"
                      aria-label={t("guide.events.deadline")}
                    >
                      {(["days", "hours", "minutes", "seconds"] as const).map(
                        (unit, index) => (
                          <div key={unit}>
                            <b>
                              {digits.format(
                                [
                                  Math.floor(seconds / 86400),
                                  Math.floor(seconds / 3600) % 24,
                                  Math.floor(seconds / 60) % 60,
                                  seconds % 60,
                                ][index],
                              )}
                            </b>
                            <span>{t(`guide.events.${unit}`)}</span>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                  {champion && (
                    <div className="guide-event-winner">
                      <Trophy size={24} />
                      <span>
                        {t("guide.events.champion")}
                        <strong>{champion}</strong>
                      </span>
                    </div>
                  )}
                  <div className="guide-event-actions">
                    <a
                      className={`button ${event.status === "live" ? "" : "button-secondary"}`}
                      href="#guide-bracket"
                      onClick={() => choose(event.id)}
                    >
                      {t(
                        event.status === "open"
                          ? "guide.events.registered"
                          : "guide.events.bracket",
                      )}
                    </a>
                    {event.status === "open" && (
                      <button
                        className="button"
                        disabled
                        title={t("guide.events.unavailable")}
                      >
                        {t("guide.events.register")}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
      </div>
    </div>
  );
}
