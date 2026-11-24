import { useState, type FormEvent } from "react";
import { Crosshair } from "lucide-react";
import {
  availabilityTimes,
  gamingRoles,
  maxSpokenLanguages,
  spokenLanguages,
} from "../../../shared/contracts";
import type {
  Account,
  GamingProfile,
  GamingRole,
} from "../../../shared/contracts";
import { json } from "../../lib/api";
import { useLocale } from "../../i18n";
import { useSession } from "../../app/contexts";
import { Alert, useAction } from "../../components/ui";

const levels = Array.from({ length: 10 }, (_, index) => index + 1);

function useLanguageName() {
  const { language } = useLocale();
  const names = new Intl.DisplayNames([language], { type: "language" });
  return (code: string) => {
    const name = names.of(code) || code;
    return name.charAt(0).toLocaleUpperCase(language) + name.slice(1);
  };
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function GamingProfileForm() {
  const { account, request, updateAccount, captureSession } = useSession();
  const { t, number } = useLocale();
  const languageName = useLanguageName();
  const [gaming, setGaming] = useState<GamingProfile>(account!.gaming);
  const action = useAction();
  function save(event: FormEvent) {
    event.preventDefault();
    void action.run(async () => {
      const isCurrentSession = captureSession();
      const result = await request<{ account: Account }>(
        "/account/gaming",
        json("PUT", gaming),
      );
      if (!isCurrentSession()) return;
      updateAccount(result.account);
      setGaming(result.account.gaming);
    }, "gaming.saved");
  }
  return (
    <section className="panel gaming-panel">
      <div className="form-section-heading">
        <Crosshair size={20} />
        <h2>{t("gaming.title")}</h2>
      </div>
      <p className="muted">{t("gaming.help")}</p>
      <form className="form-stack" onSubmit={save}>
        <label>
          {t("gaming.role")}
          <select
            value={gaming.role ?? ""}
            disabled={action.busy}
            onChange={(event) =>
              setGaming({
                ...gaming,
                role: (event.target.value || null) as GamingRole | null,
              })
            }
          >
            <option value="">{t("gaming.notSet")}</option>
            {gamingRoles.map((role) => (
              <option key={role} value={role}>
                {t(`gaming.role.${role}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("gaming.level")}
          <select
            value={gaming.level ?? ""}
            disabled={action.busy}
            onChange={(event) =>
              setGaming({
                ...gaming,
                level: event.target.value ? Number(event.target.value) : null,
              })
            }
          >
            <option value="">{t("gaming.notSet")}</option>
            {levels.map((level) => (
              <option key={level} value={level}>
                {number(level)}
              </option>
            ))}
          </select>
          <small>{t("gaming.levelHelp")}</small>
        </label>
        <fieldset className="choice-group" disabled={action.busy}>
          <legend>{t("gaming.availability")}</legend>
          <div className="choice-list">
            {availabilityTimes.map((time) => (
              <label key={time} className="choice">
                <input
                  type="checkbox"
                  checked={gaming.availability.includes(time)}
                  onChange={() =>
                    setGaming({
                      ...gaming,
                      availability: toggle(gaming.availability, time),
                    })
                  }
                />
                {t(`gaming.time.${time}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="choice-group" disabled={action.busy}>
          <legend>{t("gaming.languages")}</legend>
          <div className="choice-list">
            {spokenLanguages.map((code) => {
              const checked = gaming.languages.includes(code);
              return (
                <label key={code} className="choice">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={
                      !checked && gaming.languages.length >= maxSpokenLanguages
                    }
                    onChange={() =>
                      setGaming({
                        ...gaming,
                        languages: toggle(gaming.languages, code),
                      })
                    }
                  />
                  {languageName(code)}
                </label>
              );
            })}
          </div>
          <small>
            {t("gaming.languagesHelp", { count: maxSpokenLanguages })}
          </small>
        </fieldset>
        <Alert code={action.error} />
        <Alert success code={action.success} />
        <button className="button" disabled={action.busy}>
          {t(action.busy ? "common.saving" : "gaming.save")}
        </button>
      </form>
    </section>
  );
}

export function GamingProfileDetails({ gaming }: { gaming: GamingProfile }) {
  const { t, number } = useLocale();
  const languageName = useLanguageName();
  const empty =
    !gaming.role &&
    !gaming.level &&
    !gaming.availability.length &&
    !gaming.languages.length;
  const facts = [
    {
      label: t("gaming.role"),
      values: gaming.role ? [t(`gaming.role.${gaming.role}`)] : [],
    },
    {
      label: t("gaming.level"),
      values: gaming.level ? [number(gaming.level)] : [],
    },
    {
      label: t("gaming.availability"),
      values: gaming.availability.map((time) => t(`gaming.time.${time}`)),
      tags: true,
    },
    {
      label: t("gaming.languages"),
      values: gaming.languages.map(languageName),
      tags: true,
    },
  ];
  return (
    <div className="profile-gaming">
      <div className="profile-gaming-heading">
        <h2>{t("gaming.title")}</h2>
        {!empty && (
          <span className="status-pill status-declared">
            {t("gaming.declared")}
          </span>
        )}
      </div>
      {empty ? (
        <p className="muted">{t("gaming.empty")}</p>
      ) : (
        <dl className="gaming-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              {!fact.values.length ? (
                <dd className="muted">{t("gaming.notSet")}</dd>
              ) : fact.tags ? (
                <dd className="gaming-tags">
                  {fact.values.map((value) => (
                    <span key={value}>{value}</span>
                  ))}
                </dd>
              ) : (
                <dd>{fact.values[0]}</dd>
              )}
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
