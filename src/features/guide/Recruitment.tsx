import { useState } from "react";
import { MessageCircle, Plus, Users, UserRoundSearch } from "lucide-react";
import { useLocale } from "../../i18n";
import { Dialog } from "../../components/ui";
import { TeamMark } from "./shared";

const listings = [
  {
    name: "Atlas",
    type: "team",
    role: "entry",
    level: 6,
    times: ["evenings"],
    age: 2,
  },
  {
    name: "Aster",
    type: "player",
    role: "entry",
    level: 7,
    times: ["evenings", "weekends"],
    age: 24,
  },
  {
    name: "Echo",
    type: "player",
    role: "support",
    level: 4,
    times: ["weekends"],
    age: 72,
  },
  {
    name: "Nova",
    type: "player",
    role: "awp",
    level: 9,
    times: ["nights"],
    age: 5,
  },
] as const;
const roles = ["entry", "support", "awp", "igl", "flex"] as const;

function ListingForm() {
  const { t } = useLocale();
  const [ready, setReady] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        setReady(true);
      }}
    >
      <p className="guide-note">{t("guide.recruitment.adHelp")}</p>
      <label>
        {t("guide.recruitment.adType")}
        <select>
          <option>{t("guide.recruitment.playerWanted")}</option>
          <option>{t("guide.recruitment.teamWanted")}</option>
        </select>
      </label>
      <label>
        {t("guide.recruitment.role")}
        <select>
          {roles.map((role) => (
            <option key={role}>{t(`guide.role.${role}`)}</option>
          ))}
        </select>
      </label>
      <label>
        {t("guide.recruitment.levelLabel")}
        <input type="number" min="1" max="10" defaultValue="6" required />
      </label>
      <label>
        {t("guide.recruitment.availability")}
        <select>
          {(["evenings", "weekends", "nights"] as const).map((time) => (
            <option key={time}>{t(`guide.recruitment.${time}`)}</option>
          ))}
        </select>
      </label>
      <label>
        {t("guide.recruitment.adDescription")}
        <textarea
          required
          minLength={10}
          maxLength={500}
          rows={3}
          onChange={() => setReady(false)}
        />
      </label>
      <button className="button">{t("guide.recruitment.adPreview")}</button>
      {ready && (
        <p className="alert alert-success" role="status">
          {t("guide.recruitment.adDone")}
        </p>
      )}
    </form>
  );
}

export function Recruitment() {
  const { t, number } = useLocale();
  const [role, setRole] = useState("");
  const [level, setLevel] = useState("");
  const [time, setTime] = useState("");
  const [dialog, setDialog] = useState<"listing" | string | null>(null);
  const [min, max] = level ? level.split("-").map(Number) : [1, 10];
  const visible = listings.filter(
    (item) =>
      (!role || item.role === role) &&
      item.level >= min &&
      item.level <= max &&
      (!time || item.times.some((value) => value === time)),
  );
  return (
    <>
      <div
        className="guide-filters"
        role="group"
        aria-label={t("guide.recruitment.filters")}
      >
        <label>
          {t("guide.recruitment.role")}
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="">{t("guide.recruitment.all")}</option>
            {roles.map((item) => (
              <option key={item} value={item}>
                {t(`guide.role.${item}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("guide.recruitment.levelLabel")}
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            <option value="">{t("guide.recruitment.anyLevel")}</option>
            {["1-3", "4-7", "8-10"].map((range) => (
              <option key={range} value={range}>
                {range
                  .split("-")
                  .map((value) => number(Number(value)))
                  .join("–")}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("guide.recruitment.availability")}
          <select
            value={time}
            onChange={(event) => setTime(event.target.value)}
          >
            <option value="">{t("guide.recruitment.anyTime")}</option>
            {(["evenings", "weekends", "nights"] as const).map((item) => (
              <option key={item} value={item}>
                {t(`guide.recruitment.${item}`)}
              </option>
            ))}
          </select>
        </label>
        <p role="status">
          {t("guide.recruitment.count", { count: visible.length })}
        </p>
        <button className="button" onClick={() => setDialog("listing")}>
          <Plus size={16} />
          {t("guide.recruitment.post")}
        </button>
      </div>
      <div className="guide-list">
        {visible.map((item) => (
          <article className="guide-row" key={item.name} data-role={item.role}>
            <span className="guide-listing-art" aria-hidden="true">
              {item.type === "team" ? (
                <Users size={90} strokeWidth={0.7} />
              ) : (
                <UserRoundSearch size={90} strokeWidth={0.7} />
              )}
            </span>
            <div className="guide-listing-top">
              <span
                className={`guide-status ${item.type === "team" ? "is-open" : "is-player"}`}
              >
                {t(
                  item.type === "team"
                    ? "guide.recruitment.playerWanted"
                    : "guide.recruitment.teamWanted",
                )}
              </span>
              <span>
                {t("guide.recruitment.age", { count: number(item.age) })}
              </span>
            </div>
            <div className="guide-listing-identity">
              <TeamMark name={item.name} />
              <div>
                <h3>{item.name}</h3>
                <p>
                  {t(
                    item.type === "team"
                      ? "guide.recruitment.teamListing"
                      : "guide.recruitment.playerListing",
                  )}
                </p>
              </div>
            </div>
            <p className="guide-listing-description">
              {t(`guide.recruitment.${item.role}Description`)}
            </p>
            <ul className="guide-chips">
              <li>{t(`guide.role.${item.role}`)}</li>
              <li>
                <b className={item.level >= 8 ? "is-high-level" : ""}>
                  {number(item.level)}
                  {item.type === "team" ? "+" : ""}
                </b>{" "}
                FACEIT
              </li>
              <li>
                {t(
                  `guide.recruitment.${item.times.length > 1 ? "both" : item.times[0]}`,
                )}
              </li>
            </ul>
            <button
              className="button full-width"
              onClick={() => setDialog(item.name)}
            >
              <MessageCircle size={16} />
              {t("guide.recruitment.message")}
            </button>
          </article>
        ))}
      </div>
      {!visible.length && (
        <p className="empty-state">{t("guide.recruitment.empty")}</p>
      )}
      {dialog && (
        <Dialog
          title={t(
            dialog === "listing"
              ? "guide.recruitment.adTitle"
              : "guide.recruitment.contactTitle",
          )}
          close={() => setDialog(null)}
          className="guide-example-dialog"
        >
          {dialog === "listing" ? (
            <ListingForm />
          ) : (
            <>
              <div className="guide-chat-heading">
                <TeamMark name={dialog} />
                <h3>{dialog}</h3>
              </div>
              <p className="guide-note">{t("guide.recruitment.contactHelp")}</p>
              <p className="guide-bubble">{t("guide.how.opening")}</p>
              <p className="guide-bubble is-mine">{t("guide.how.reply")}</p>
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
