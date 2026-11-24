import { useState } from "react";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { useLocale } from "../../i18n";
import { PageHeading } from "../../components/ui";

type RankingView = "global" | "tournament";

export function RankingsPage() {
  const { t } = useLocale();
  const [view, setView] = useState<RankingView>("global");
  const [tournament, setTournament] = useState("");
  return (
    <div className="page-container section-page">
      <PageHeading eyebrow="nav.rankings" title="rankings.title" />
      <p className="section-description">{t("rankings.help")}</p>
      <div className="tabs">
        <button
          className={view === "global" ? "active" : ""}
          onClick={() => setView("global")}
        >
          {t("rankings.global")}
        </button>
        <button
          className={view === "tournament" ? "active" : ""}
          onClick={() => setView("tournament")}
        >
          {t("rankings.tournament")}
        </button>
      </div>
      <section className="panel">
        {view === "tournament" && (
          <label className="inline-label rankings-select">
            {t("rankings.pickTournament")}
            <select
              value={tournament}
              onChange={(event) => setTournament(event.target.value)}
            >
              <option value="">{t("rankings.noTournaments")}</option>
            </select>
          </label>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("rankings.place")}</th>
                <th>{t("rankings.team")}</th>
                <th>{t("rankings.played")}</th>
                <th>{t("rankings.won")}</th>
                <th>{t("rankings.lost")}</th>
                <th>{t("rankings.diff")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6}>
                  <div className="empty-state compact">
                    <ChartNoAxesColumnIncreasing size={28} />
                    <h3>
                      {t(
                        view === "global"
                          ? "rankings.emptyGlobal"
                          : "rankings.emptyTournament",
                      )}
                    </h3>
                    <p>{t("rankings.emptyHelp")}</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
