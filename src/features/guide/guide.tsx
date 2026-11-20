import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ArrowUpRight } from "lucide-react";
import { useLocale } from "../../i18n";
import { useSession } from "../../app/contexts";
import { createExamples, type Event } from "./data";
import { Chapter } from "./shared";
import { Tutorial } from "./Tutorial";
import { Events } from "./Events";
import { Recruitment } from "./Recruitment";
import { Competition, Rankings } from "./Competition";
import { Veto } from "./Veto";

const chapters = [
  ["how", "guide.how.title"],
  ["events", "guide.tournaments.title"],
  ["recruitment", "guide.recruitment.title"],
  ["bracket", "guide.bracket.title"],
  ["rankings", "guide.rankings.title"],
  ["veto", "guide.veto.title"],
] as const;

export function GuidePage() {
  const { t, number } = useLocale();
  const { account } = useSession();
  const [events, setEvents] = useState(createExamples);
  const [selected, setSelected] = useState<Event["id"]>("community");
  const [used, setUsed] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  function commit(eventId: Event["id"], matchId: string, reference: string) {
    if (used.includes(reference)) return;
    setEvents((current) =>
      current.map((event) => {
        if (event.id !== eventId) return event;
        const roundIndex = event.rounds.findIndex((round) =>
          round.matches.some(
            (match) =>
              match.id === matchId && match.status === "pending" && match.b,
          ),
        );
        if (roundIndex < 0) return event;
        const matchIndex = event.rounds[roundIndex].matches.findIndex(
          (match) => match.id === matchId,
        );
        const match = event.rounds[roundIndex].matches[matchIndex];
        const rounds = event.rounds.map((round, index) => ({
          ...round,
          matches: round.matches.map((item, itemIndex) => {
            if (item.id === matchId)
              return {
                ...item,
                status: "done" as const,
                scoreA: 13,
                scoreB: 9,
                reference,
              };
            if (
              index === roundIndex + 1 &&
              itemIndex === Math.floor(matchIndex / 2)
            ) {
              const next = {
                ...item,
                [matchIndex % 2 === 0 ? "a" : "b"]: match.a,
              };
              return {
                ...next,
                status: next.b ? ("pending" as const) : ("scheduled" as const),
                map: next.b ? "Mirage" : null,
              };
            }
            return item;
          }),
        }));
        return {
          ...event,
          rounds,
          status:
            roundIndex === rounds.length - 1 ? ("done" as const) : event.status,
        };
      }),
    );
    setUsed((current) => [...current, reference]);
  }
  function reset() {
    setEvents(createExamples());
    setUsed([]);
    setSelected("community");
    setRevision((current) => current + 1);
  }
  return (
    <div className="guide-page">
      <h1 className="sr-only">{t("nav.guide")}</h1>
      <div className="guide-notice">
        <BookOpen size={22} />
        <p>
          <strong>{t("guide.preview")}</strong>
          {t("guide.notice")}
        </p>
      </div>
      <nav className="guide-chapters" aria-label={t("guide.chapters")}>
        {chapters.map(([id, title], index) => (
          <a key={id} href={`#guide-${id}`}>
            <span>{number(index + 1)}</span>
            {t(title)}
          </a>
        ))}
      </nav>
      <Chapter
        id="how"
        number="01"
        title="guide.how.title"
        description="guide.how.description"
      >
        <Tutorial />
      </Chapter>
      <Chapter
        id="events"
        number="02"
        title="guide.tournaments.title"
        description="guide.events.description"
      >
        <Events events={events} choose={setSelected} />
      </Chapter>
      <Chapter
        id="recruitment"
        number="03"
        title="guide.recruitment.heading"
        description="guide.recruitment.description"
      >
        <Recruitment />
      </Chapter>
      <Chapter
        id="bracket"
        number="04"
        title="guide.bracket.title"
        description="guide.bracket.description"
      >
        <Competition
          key={revision}
          events={events}
          selectedId={selected}
          choose={setSelected}
          used={used}
          commit={commit}
          reset={reset}
        />
      </Chapter>
      <Chapter
        id="rankings"
        number="05"
        title="guide.rankings.title"
        description="guide.rankings.description"
      >
        <Rankings events={events} />
      </Chapter>
      <Chapter
        id="veto"
        number="06"
        title="guide.veto.title"
        description="guide.veto.newDescription"
      >
        <Veto />
      </Chapter>
      <section className="guide-cta" aria-labelledby="guide-cta-title">
        <h2 id="guide-cta-title">{t("guide.cta.title")}</h2>
        <p>{t("guide.cta.description")}</p>
        <Link className="button" to={account ? "/account" : "/register"}>
          {t(account ? "account.title" : "auth.register")}
          <ArrowUpRight size={18} />
        </Link>
      </section>
    </div>
  );
}
