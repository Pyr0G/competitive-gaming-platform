import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import { useLocale } from "../../i18n";
import { PageHeading } from "../../components/ui";

export function TournamentsPage() {
  const { t } = useLocale();
  return (
    <div className="page-container section-page">
      <PageHeading eyebrow="nav.tournaments" title="tournaments.title" />
      <p className="section-description">{t("tournaments.help")}</p>
      <section className="panel">
        <div className="empty-state compact">
          <Trophy size={28} />
          <h3>{t("tournaments.empty")}</h3>
          <p>{t("tournaments.emptyHelp")}</p>
          <div className="ready-grid">
            <article>
              <h4>{t("tournaments.readyList")}</h4>
              <p className="muted">{t("tournaments.readyListHelp")}</p>
            </article>
            <article>
              <h4>{t("tournaments.readyRegister")}</h4>
              <p className="muted">{t("tournaments.readyRegisterHelp")}</p>
            </article>
            <article>
              <h4>{t("tournaments.readyBracket")}</h4>
              <p className="muted">{t("tournaments.readyBracketHelp")}</p>
            </article>
          </div>
          <Link to="/guide" className="button button-secondary">
            {t("tournaments.seeGuide")}
          </Link>
        </div>
      </section>
    </div>
  );
}
