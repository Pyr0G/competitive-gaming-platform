import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Newspaper,
  Trophy,
  Users,
  UserRoundSearch,
  ChartNoAxesColumnIncreasing,
} from "lucide-react";
import type { Post, PostsResponse } from "../../../shared/contracts";
import { RequestError } from "../../lib/api";
import { useLocale } from "../../i18n";
import { useSession } from "../../app/contexts";
import { Alert, Loading } from "../../components/ui";

const shortcuts = [
  { to: "/tournaments", key: "nav.tournaments", icon: Trophy },
  { to: "/teams", key: "nav.teams", icon: Users },
  { to: "/recruitment", key: "nav.recruitment", icon: UserRoundSearch },
  {
    to: "/rankings",
    key: "nav.rankings",
    icon: ChartNoAxesColumnIncreasing,
  },
] as const;

export function HomePage() {
  const { t, date } = useLocale();
  const { request, account } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    request<PostsResponse>("/posts", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setPosts(result.posts);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(failure instanceof RequestError ? failure.code : "generic");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [request]);
  const featured = posts[0] ?? null;
  const rest = posts.slice(1, 4);
  return (
    <div className="page-container home-page">
      <section className="home-hero panel">
        <div className="home-hero-copy">
          <p className="section-eyebrow">
            <span className="accent-line" />
            {t("home.eyebrow")}
          </p>
          <h1>{t("home.title")}</h1>
          <p className="section-description">{t("home.lead")}</p>
          <div className="home-actions">
            {account ? (
              <Link to="/teams" className="button">
                <Users size={17} />
                {t("home.ctaTeams")}
              </Link>
            ) : (
              <Link to="/register" className="button">
                <ArrowUpRight size={17} />
                {t("home.ctaJoin")}
              </Link>
            )}
            <Link to="/guide" className="button button-secondary">
              {t("home.ctaGuide")}
            </Link>
          </div>
        </div>
      </section>

      <section className="home-news panel">
        <header className="home-section-header">
          <div>
            <h2>{t("home.news")}</h2>
            <p className="muted">{t("home.newsHelp")}</p>
          </div>
          <Newspaper size={22} />
        </header>
        {loading ? (
          <Loading />
        ) : error ? (
          <Alert code={error} />
        ) : featured ? (
          <div className="home-news-grid">
            <article className="home-news-featured">
              <p className="muted">
                {date(featured.createdAt)} · {featured.authorUsername}
              </p>
              <h3>{featured.title}</h3>
              <p className="user-content">{featured.body}</p>
            </article>
            {rest.length > 0 && (
              <div className="home-news-list">
                {rest.map((post) => (
                  <article key={post.id}>
                    <p className="muted">{date(post.createdAt)}</p>
                    <h4>{post.title}</h4>
                    <p className="user-content">{post.body}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="home-news-empty">
            <Newspaper size={28} />
            <h3>{t("home.newsEmpty")}</h3>
            <p className="muted">{t("home.newsEmptyHelp")}</p>
          </div>
        )}
      </section>

      <section className="home-shortcuts">
        {shortcuts.map(({ to, key, icon: Icon }) => (
          <Link to={to} className="home-shortcut panel" key={to}>
            <Icon size={20} />
            <span>{t(key)}</span>
            <ChevronLabel />
          </Link>
        ))}
      </section>
    </div>
  );
}

function ChevronLabel() {
  const { t } = useLocale();
  return <small>{t("home.open")}</small>;
}
