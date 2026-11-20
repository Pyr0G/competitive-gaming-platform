import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Globe2,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  Settings,
  Shield,
  Trophy,
  Users,
  UserRound,
  UserRoundSearch,
  ChartNoAxesColumnIncreasing,
} from "lucide-react";
import { useLocale } from "../i18n";
import { BrandLogo } from "../components/BrandLogo";
import { useSession, useChat } from "./contexts";
import {
  Avatar,
  Dialog,
  Alert,
  useAction,
  Loading,
  RequireAccount,
} from "../components/ui";
import {
  AuthPage,
  AccountPage,
  LocaleSettings,
} from "../features/accounts/accounts";
import { SearchDialog } from "../features/search/search";
import { ProfilePage } from "../features/players/profile";
import { AdminPage } from "../features/admin/admin";
import { GuidePage } from "../features/guide/guide";

const futureNavigation = [
  { key: "nav.tournaments", icon: Trophy },
  { key: "nav.teams", icon: Users },
  { key: "nav.recruitment", icon: UserRoundSearch },
  { key: "nav.rankings", icon: ChartNoAxesColumnIncreasing },
] as const;

export function Navigation({ close }: { close?: () => void }) {
  const { t } = useLocale();
  return (
    <>
      <Link to="/" className="brand" onClick={close} aria-label={t("nav.home")}>
        <BrandLogo variant="wordmark" />
      </Link>
      <nav aria-label={t("nav.main")} className="navigation">
        {futureNavigation.map(({ key, icon: Icon }) => (
          <button key={key} disabled title={t("nav.future")}>
            <Icon size={19} />
            <span>{t(key)}</span>
            <span className="future-dot" aria-label={t("nav.future")} />
          </button>
        ))}
        <NavLink to="/guide" onClick={close}>
          <BookOpen size={19} />
          <span>{t("nav.guide")}</span>
        </NavLink>
      </nav>
    </>
  );
}

export function Shell() {
  const { t } = useLocale();
  const { account, logout, loading } = useSession();
  const chat = useChat();
  const [search, setSearch] = useState(false);
  const [locale, setLocale] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [navigation, setNavigation] = useState(false);
  const accountMenu = useRef<HTMLDetailsElement>(null);
  const action = useAction();
  const location = useLocation();
  useEffect(() => {
    function outside(event: PointerEvent) {
      const menu = accountMenu.current;
      if (
        menu?.open &&
        event.target instanceof Node &&
        !menu.contains(event.target)
      ) {
        menu.open = false;
      }
    }
    function escape(event: KeyboardEvent) {
      const menu = accountMenu.current;
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        menu?.open &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearch((value) => !value);
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        {t("nav.skip")}
      </a>
      <aside className="sidebar">
        <Navigation />
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setNavigation(true)}
            aria-label={t("nav.menu")}
          >
            <Menu size={22} />
          </button>
          <Link to="/" className="mobile-brand" aria-label={t("nav.home")}>
            <BrandLogo variant="mark" />
          </Link>
          <button className="search-trigger" onClick={() => setSearch(true)}>
            <Search size={18} />
            <span>{t("search.placeholder")}</span>
          </button>
          <div className="topbar-actions">
            <button
              className={`icon-button ${notifications ? "is-active" : ""}`}
              onClick={() => {
                if (account) setNotifications(true);
              }}
              aria-label={t("notifications.open")}
              disabled={!account}
            >
              <Bell size={20} />
              {chat.unread > 0 && <span className="unread-dot" />}
            </button>
            <button
              className="icon-button"
              onClick={chat.show}
              aria-label={
                chat.unread
                  ? t("chat.unread", { count: chat.unread })
                  : t("chat.open")
              }
            >
              <MessageCircle size={20} />
              {chat.unread > 0 && (
                <span className="badge">
                  {chat.unread > 99 ? "99+" : chat.unread}
                </span>
              )}
            </button>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              onClick={() => setLocale(true)}
              aria-label={t("locale.title")}
            >
              <Globe2 size={20} />
            </button>
            {account ? (
              <details className="account-menu" ref={accountMenu}>
                <summary aria-label={t("account.title")}>
                  <Avatar name={account.username} />
                  <ChevronDown size={14} />
                </summary>
                <div className="menu-panel">
                  <div className="menu-identity">
                    <strong>{account.username}</strong>
                    <small>
                      {account.isAdmin ? t("admin.admin") : t("admin.member")}
                    </small>
                  </div>
                  <Link
                    to="/account"
                    onClick={(event) =>
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open")
                    }
                  >
                    <Settings size={17} />
                    {t("account.title")}
                  </Link>
                  <Link
                    to={`/players/${account.id}`}
                    onClick={(event) =>
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open")
                    }
                  >
                    <UserRound size={17} />
                    {t("account.publicProfile")}
                  </Link>
                  {account.isAdmin && (
                    <Link
                      to="/admin"
                      onClick={(event) =>
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open")
                      }
                    >
                      <Shield size={17} />
                      {t("admin.title")}
                    </Link>
                  )}
                  <button
                    onClick={() => void action.run(logout)}
                    disabled={action.busy}
                  >
                    <LogOut size={17} />
                    {t("auth.logout")}
                  </button>
                  <Alert code={action.error} />
                </div>
              </details>
            ) : (
              <Link className="button button-small login-button" to="/login">
                <LogIn size={16} />
                <span>{t("auth.login")}</span>
              </Link>
            )}
          </div>
        </header>
        <main
          id="main-content"
          className={
            location.pathname === "/"
              ? "main-content empty-home"
              : "main-content"
          }
          tabIndex={-1}
        >
          {loading ? (
            <Loading />
          ) : (
            <Routes>
              <Route path="/" element={null} />
              <Route path="/guide" element={<GuidePage />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/register" element={<AuthPage register />} />
              <Route
                path="/account"
                element={
                  <RequireAccount>
                    <AccountPage />
                  </RequireAccount>
                }
              />
              <Route
                path="/players/:id"
                element={<ProfilePage key={location.pathname} />}
              />
              <Route
                path="/admin"
                element={
                  <RequireAccount admin>
                    <AdminPage />
                  </RequireAccount>
                }
              />
              <Route
                path="*"
                element={
                  <div className="empty-state">
                    <CircleHelp size={32} />
                    <h1>{t("error.not_found")}</h1>
                    <Link to="/" className="button">
                      {t("nav.home")}
                    </Link>
                  </div>
                }
              />
            </Routes>
          )}
        </main>
        <footer className="app-footer">
          <div className="footer-identity">
            <Link to="/" className="footer-brand" aria-label={t("nav.home")}>
              <BrandLogo variant="mark" />
              {t("app.title")}
            </Link>
            <span>{t("app.tagline")}</span>
          </div>
          <nav aria-label={t("footer.navigation")} className="footer-links">
            <Link to="/guide">{t("nav.guide")}</Link>
            <button onClick={() => setSearch(true)}>{t("search.label")}</button>
            <button onClick={() => setLocale(true)}>{t("locale.title")}</button>
          </nav>
          <small>
            {t("footer.copyright", { year: String(new Date().getFullYear()) })}
          </small>
        </footer>
      </div>
      {search && <SearchDialog close={() => setSearch(false)} />}
      {locale && (
        <Dialog
          title={t("locale.title")}
          close={() => setLocale(false)}
          className="locale-dialog"
        >
          <LocaleSettings />
          <button
            className="button dialog-done"
            onClick={() => setLocale(false)}
          >
            <Check size={16} />
            {t("common.close")}
          </button>
        </Dialog>
      )}
      {notifications && (
        <Dialog
          title={t("notifications.title")}
          close={() => setNotifications(false)}
          className="notification-dialog"
        >
          <div className="notification-list">
            {chat.conversations
              .filter((item) => item.unreadCount > 0)
              .map((item) => (
                <button
                  className="notification-item"
                  key={item.id}
                  onClick={() => {
                    setNotifications(false);
                    chat.select(item.id);
                  }}
                >
                  <Avatar name={item.player.username} />
                  <span>
                    <strong>
                      {t("notifications.from", { name: item.player.username })}
                    </strong>
                    <small>{item.lastMessage?.body}</small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))}
            {!chat.unread && (
              <div className="empty-state compact">
                <Bell size={28} />
                <h3>{t("notifications.empty")}</h3>
                <p>{t("notifications.help")}</p>
              </div>
            )}
          </div>
        </Dialog>
      )}
      {navigation && (
        <Dialog
          title={t("nav.main")}
          close={() => setNavigation(false)}
          className="navigation-dialog"
        >
          <Navigation close={() => setNavigation(false)} />
        </Dialog>
      )}
    </div>
  );
}
