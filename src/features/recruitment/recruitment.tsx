import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, UserRoundSearch } from "lucide-react";
import { gamingRoles } from "../../../shared/contracts";
import { useLocale } from "../../i18n";
import { useSession } from "../../app/contexts";
import { Dialog, PageHeading } from "../../components/ui";

export function RecruitmentPage() {
  const { t } = useLocale();
  const { account, requireLogin } = useSession();
  const [role, setRole] = useState("");
  const [level, setLevel] = useState("");
  const [availability, setAvailability] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const filteredEmpty = useMemo(
    () => Boolean(role || level || availability),
    [role, level, availability],
  );
  function openPreview() {
    if (!account) {
      requireLogin();
      return;
    }
    setPreviewOpen(true);
  }
  return (
    <div className="page-container section-page">
      <PageHeading eyebrow="nav.recruitment" title="recruitment.title" />
      <div className="section-toolbar">
        <p className="muted">{t("recruitment.help")}</p>
        <button className="button" onClick={openPreview}>
          <Plus size={17} />
          {t("recruitment.create")}
        </button>
      </div>
      <section className="panel">
        <div
          className="filter-bar"
          role="group"
          aria-label={t("recruitment.filters")}
        >
          <label>
            {t("recruitment.role")}
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="">{t("recruitment.anyRole")}</option>
              {gamingRoles.map((item) => (
                <option key={item} value={item}>
                  {t(`gaming.role.${item}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("recruitment.level")}
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            >
              <option value="">{t("recruitment.anyLevel")}</option>
              <option value="1-4">1–4</option>
              <option value="5-7">5–7</option>
              <option value="8-10">8–10</option>
            </select>
          </label>
          <label>
            {t("recruitment.availability")}
            <select
              value={availability}
              onChange={(event) => setAvailability(event.target.value)}
            >
              <option value="">{t("recruitment.anyTime")}</option>
              <option value="daytime">{t("gaming.time.daytime")}</option>
              <option value="evenings">{t("gaming.time.evenings")}</option>
              <option value="nights">{t("gaming.time.nights")}</option>
              <option value="weekends">{t("gaming.time.weekends")}</option>
            </select>
          </label>
        </div>
        <div className="empty-state compact">
          <UserRoundSearch size={28} />
          <h3>
            {t(filteredEmpty ? "recruitment.noMatches" : "recruitment.empty")}
          </h3>
          <p>
            {t(
              filteredEmpty
                ? "recruitment.noMatchesHelp"
                : "recruitment.emptyHelp",
            )}
          </p>
          {!filteredEmpty && (
            <div className="button-row">
              <Link to="/teams" className="button button-secondary">
                {t("recruitment.seeTeams")}
              </Link>
              <Link to="/guide" className="button button-secondary">
                {t("recruitment.seeGuide")}
              </Link>
            </div>
          )}
        </div>
      </section>
      {previewOpen && (
        <Dialog
          title={t("recruitment.create")}
          close={() => setPreviewOpen(false)}
        >
          <form
            className="form-stack"
            onSubmit={(event) => event.preventDefault()}
          >
            <p className="muted">{t("recruitment.previewHelp")}</p>
            <label>
              {t("recruitment.type")}
              <select defaultValue="player">
                <option value="player">{t("recruitment.playerWanted")}</option>
                <option value="team">{t("recruitment.teamWanted")}</option>
              </select>
            </label>
            <label>
              {t("recruitment.role")}
              <select defaultValue="entry">
                {gamingRoles.map((item) => (
                  <option key={item} value={item}>
                    {t(`gaming.role.${item}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("recruitment.level")}
              <input type="number" min={1} max={10} defaultValue={6} required />
            </label>
            <label>
              {t("recruitment.description")}
              <textarea rows={4} maxLength={500} required minLength={10} />
            </label>
            <p className="alert alert-success" role="status">
              {t("recruitment.previewReady")}
            </p>
            <button
              className="button"
              type="button"
              onClick={() => setPreviewOpen(false)}
            >
              {t("common.close")}
            </button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
