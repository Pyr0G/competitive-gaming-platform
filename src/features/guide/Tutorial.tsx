import { useRef, useState } from "react";
import { Check, Pause, Play } from "lucide-react";
import { useLocale } from "../../i18n";
import { TeamMark, usePreviewActivity } from "./shared";

const steps = ["register", "recruit", "chat", "results"] as const;

export function Tutorial() {
  const { t, number } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const { visible, motion } = usePreviewActivity(ref);
  const [step, setStep] = useState(0);
  const [replay, setReplay] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const active = visible && motion && playing && !hovered && !focused;
  return (
    <div
      className="guide-tutorial"
      ref={ref}
      data-playing={active}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <div className="guide-screen">
        <div className="guide-screen-bar">
          <span className="guide-window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="guide-screen-path">
            {t("app.title")} / <b>{t(`guide.how.${steps[step]}`)}</b>
          </span>
          <button
            className="icon-button"
            disabled={!motion}
            onClick={() => setPlaying((value) => !value)}
            aria-label={t(
              !motion
                ? "guide.how.reduced"
                : playing
                  ? "guide.how.pause"
                  : "guide.how.play",
            )}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>
        <div
          className="guide-screen-body"
          id="guide-tutorial-screen"
          key={`${step}-${replay}`}
          role="region"
          aria-label={t("guide.how.path", {
            screen: t(`guide.how.${steps[step]}`),
          })}
        >
          {step === 0 && (
            <div className="guide-mock-card">
              <h3>{t("auth.register")}</h3>
              {[
                ["auth.username", "Aster"],
                ["auth.email", "aster@example.com"],
                ["auth.password", "••••••••"],
              ].map(([label, value], index) => (
                <div className="guide-mock-field" key={label}>
                  <span>
                    {t(
                      label as "auth.username" | "auth.email" | "auth.password",
                    )}
                  </span>
                  <div className="guide-mock-input">
                    <span
                      className="guide-typing"
                      style={{ animationDelay: `${index * 0.9}s` }}
                    >
                      {value}
                    </span>
                  </div>
                </div>
              ))}
              <div className="guide-mock-button">{t("auth.register")}</div>
              <p
                className="guide-mock-success"
                style={{ animationDelay: "3.5s" }}
              >
                <Check size={16} />
                {t("guide.how.ready")}
              </p>
            </div>
          )}
          {step === 1 && (
            <div className="guide-mock-recruit">
              <div className="guide-chips">
                <span>{t("guide.role.entry")}</span>
                <span>FACEIT 6+</span>
                <span>{t("guide.recruitment.evenings")}</span>
              </div>
              <div className="guide-mock-listing">
                <TeamMark name="Atlas" />
                <div>
                  <strong>Atlas</strong>
                  <p>{t("guide.recruitment.entryDescription")}</p>
                </div>
                <span className="guide-mock-button">
                  {t("guide.recruitment.message")}
                  <span className="guide-mock-cursor" aria-hidden="true" />
                </span>
              </div>
              <div className="guide-mock-listing is-muted">
                <TeamMark name="Echo" />
                <div>
                  <strong>Echo</strong>
                  <p>{t("guide.role.support")}</p>
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="guide-mock-chat">
              <div className="guide-chat-heading">
                <TeamMark name="Atlas" />
                <strong>Atlas</strong>
                <span className="guide-live-dot" aria-hidden="true" />
              </div>
              {(["opening", "reply", "schedule"] as const).map((key, index) => (
                <p
                  key={key}
                  className={`guide-bubble ${index === 1 ? "is-mine" : ""}`}
                  style={{ animationDelay: `${0.3 + index * 0.8}s` }}
                >
                  {t(`guide.how.${key}`)}
                </p>
              ))}
              <p
                className="guide-mock-success"
                style={{ animationDelay: "2.9s" }}
              >
                {t("guide.how.followup")}
              </p>
            </div>
          )}
          {step === 3 && (
            <div className="guide-mock-card">
              <h3>{t("guide.results.title")}</h3>
              <div className="guide-mock-input">
                <span className="guide-typing">faceit.com/en/cs2/room/1-…</span>
              </div>
              <ul className="guide-mock-checks">
                {(["link", "finished", "roster", "advance"] as const).map(
                  (key, index) => (
                    <li
                      key={key}
                      style={{ animationDelay: `${1.2 + index * 0.5}s` }}
                    >
                      <Check size={16} />
                      {t(`guide.results.${key}`)}
                    </li>
                  ),
                )}
              </ul>
              <p
                className="guide-mock-success"
                style={{ animationDelay: "3.5s" }}
              >
                Atlas <strong>13–9</strong>
              </p>
              <small>{t("guide.import.help")}</small>
            </div>
          )}
        </div>
      </div>
      <ol className="guide-tutorial-steps" aria-label={t("guide.how.steps")}>
        {steps.map((key, index) => (
          <li key={key}>
            <button
              aria-pressed={step === index}
              aria-controls="guide-tutorial-screen"
              onClick={() => {
                setStep(index);
                setReplay((current) => current + 1);
              }}
            >
              <span className="guide-step-number">{number(index + 1)}</span>
              <span>
                <strong>{t(`guide.how.${key}`)}</strong>
                <span>{t(`guide.how.${key}Help`)}</span>
              </span>
              {step === index && (
                <span
                  className="guide-step-progress"
                  key={replay}
                  aria-hidden="true"
                >
                  <i
                    onAnimationEnd={() => {
                      if (active)
                        setStep((current) => (current + 1) % steps.length);
                    }}
                  />
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
