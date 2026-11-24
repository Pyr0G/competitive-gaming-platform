import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Globe2, LoaderCircle, Shield } from "lucide-react";
import type { Account, AuthResponse } from "../../../shared/contracts";
import { json } from "../../lib/api";
import { useLocale, type Preferences } from "../../i18n";
import { useSession } from "../../app/contexts";
import { Avatar, Alert, useAction, PageHeading } from "../../components/ui";
import { BrandLogo } from "../../components/BrandLogo";
import { FlagSelect, flagRegions } from "../../components/FlagSelect";
import { GamingProfileForm } from "../players/gaming";

export function AuthPage({ register = false }: { register?: boolean }) {
  const { t, preferences, language, locale } = useLocale();
  const { request, authenticate, account, captureSession } = useSession();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    username: "",
    email: "",
    identifier: "",
    password: "",
    confirmation: "",
  });
  const action = useAction();
  const pendingAuth = useRef<AbortController | null>(null);
  useEffect(() => () => pendingAuth.current?.abort(), [register]);
  useEffect(() => {
    if (account) navigate("/account", { replace: true });
  }, [account, navigate]);
  useEffect(() => {
    function dismiss(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !event.isComposing &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        navigate("/");
      }
    }
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [navigate]);
  function update(name: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (register && values.password !== values.confirmation) {
      action.setError("password_mismatch");
      return;
    }
    void action.run(async () => {
      const isCurrentSession = captureSession();
      const controller = new AbortController();
      pendingAuth.current?.abort();
      pendingAuth.current = controller;
      const result = await request<AuthResponse>(
        register ? "/auth/register" : "/auth/login",
        {
          ...json(
            "POST",
            register
              ? {
                  username: values.username,
                  email: values.email,
                  password: values.password,
                  passwordConfirmation: values.confirmation,
                  language,
                  locale,
                  timeZone:
                    preferences.timeZone ||
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
                }
              : { identifier: values.identifier, password: values.password },
          ),
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted || !isCurrentSession()) return;
      authenticate(result);
      setValues({
        username: "",
        email: "",
        identifier: "",
        password: "",
        confirmation: "",
      });
      navigate("/account");
    });
  }
  return (
    <div className="auth-layout">
      <section className="auth-card">
        <Link to="/" className="auth-brand" aria-label={t("nav.home")}>
          <BrandLogo variant="full" />
        </Link>
        <h1>{t(register ? "auth.register" : "auth.welcome")}</h1>
        <p className="section-description">
          {t(register ? "auth.registerHelp" : "auth.loginHelp")}
        </p>
        <form onSubmit={submit} className="form-stack">
          {register ? (
            <>
              <label>
                {t("auth.username")}
                <input
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={24}
                  value={values.username}
                  onChange={(event) => update("username", event.target.value)}
                />
                <small>{t("auth.usernameHint")}</small>
              </label>
              <label>
                {t("auth.email")}
                <input
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={values.email}
                  onChange={(event) => update("email", event.target.value)}
                />
                <small>{t("auth.emailHint")}</small>
              </label>
            </>
          ) : (
            <label>
              {t("auth.identifier")}
              <input
                autoComplete="username"
                required
                maxLength={254}
                value={values.identifier}
                onChange={(event) => update("identifier", event.target.value)}
              />
            </label>
          )}
          <label>
            {t("auth.password")}
            <input
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={register ? 8 : 1}
              maxLength={128}
              required
              value={values.password}
              onChange={(event) => update("password", event.target.value)}
            />
            {register && <small>{t("auth.passwordHint")}</small>}
          </label>
          {register && (
            <label>
              {t("auth.confirm")}
              <input
                type="password"
                autoComplete="new-password"
                required
                maxLength={128}
                value={values.confirmation}
                onChange={(event) => update("confirmation", event.target.value)}
              />
            </label>
          )}
          {action.error === "password_mismatch" ? (
            <p role="alert" className="alert alert-error">
              {t("auth.mismatch")}
            </p>
          ) : (
            <Alert code={action.error} />
          )}
          <button className="button full-width" disabled={action.busy}>
            {action.busy ? (
              <LoaderCircle size={17} className="spinner" />
            ) : (
              <ArrowUpRight size={17} />
            )}
            {t(
              action.busy
                ? register
                  ? "auth.creating"
                  : "auth.signingIn"
                : register
                  ? "auth.register"
                  : "auth.login",
            )}
          </button>
        </form>
        <p className="auth-switch">
          {t(register ? "auth.haveAccount" : "auth.needAccount")}{" "}
          <Link to={register ? "/login" : "/register"}>
            {t(register ? "auth.login" : "auth.register")}
          </Link>
        </p>
      </section>
    </div>
  );
}

export function LocaleSettings() {
  const { t, locale, preferences, setPreferences } = useLocale();
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const timeZones = Intl.supportedValuesOf("timeZone");
  function change(key: keyof Preferences, value: string) {
    setPreferences({ ...preferences, [key]: value });
  }
  return (
    <div className="form-stack locale-settings">
      <p className="muted">{t("locale.help")}</p>
      <FlagSelect
        label={t("locale.language")}
        value={preferences.language}
        onChange={(value) => change("language", value)}
        options={[
          { value: "", label: t("locale.automatic") },
          { value: "en", label: t("locale.english"), flag: "GB", lang: "en" },
          { value: "pl", label: t("locale.polish"), flag: "PL", lang: "pl" },
        ]}
      />
      <FlagSelect
        label={t("locale.region")}
        value={preferences.region}
        onChange={(value) => change("region", value)}
        options={[
          { value: "", label: t("locale.automatic") },
          ...(preferences.region && !flagRegions.includes(preferences.region)
            ? [
                {
                  value: preferences.region,
                  label: names.of(preferences.region) || preferences.region,
                },
              ]
            : []),
          ...flagRegions.map((region) => ({
            value: region,
            label: names.of(region) || region,
            flag: region,
          })),
        ]}
      />
      <label>
        {t("locale.timezone")}
        <select
          aria-label={t("locale.timezone")}
          value={preferences.timeZone}
          onChange={(event) => change("timeZone", event.target.value)}
        >
          <option value="">{t("locale.automatic")}</option>
          {preferences.timeZone &&
            !timeZones.includes(preferences.timeZone) && (
              <option value={preferences.timeZone}>
                {preferences.timeZone}
              </option>
            )}
          {timeZones.map((zone) => (
            <option value={zone} key={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <small className="muted">{t("locale.saved")}</small>
    </div>
  );
}

export function AccountPage() {
  const { account, request, updateAccount, authenticate, captureSession } =
    useSession();
  const { t, preferences, locale, language } = useLocale();
  const navigate = useNavigate();
  const [username, setUsername] = useState(account!.username);
  const [bio, setBio] = useState(account!.bio);
  const [password, setPassword] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const profile = useAction();
  const security = useAction();
  function save(event: FormEvent) {
    event.preventDefault();
    void profile.run(async () => {
      const isCurrentSession = captureSession();
      const result = await request<{ account: Account }>(
        "/account",
        json("PATCH", {
          username,
          bio,
          language,
          locale,
          timeZone:
            preferences.timeZone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      );
      if (!isCurrentSession()) return;
      updateAccount(result.account);
    }, "common.saved");
  }
  function changePassword(event: FormEvent) {
    event.preventDefault();
    if (password.next !== password.confirm) {
      security.setError("password_mismatch");
      return;
    }
    void security.run(async () => {
      const isCurrentSession = captureSession();
      await request(
        "/account/password",
        json("POST", {
          currentPassword: password.current,
          password: password.next,
          passwordConfirmation: password.confirm,
        }),
      );
      if (!isCurrentSession()) return;
      setPassword({ current: "", next: "", confirm: "" });
      authenticate({ account: null, csrfToken: null });
      navigate("/login");
    });
  }
  return (
    <div className="page-container account-page">
      <PageHeading eyebrow="account.profile" title="account.title" />
      <div className="account-grid">
        <section className="panel">
          <div className="profile-heading">
            <Avatar name={account!.username} large />
            <div>
              <h2>{account!.username}</h2>
              <Link className="text-link" to={`/players/${account!.id}`}>
                {t("account.publicProfile")}
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
          <form className="form-stack" onSubmit={save}>
            <label>
              {t("auth.username")}
              <input
                required
                minLength={3}
                maxLength={24}
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
              <small>{t("account.usernameHelp")}</small>
            </label>
            <label>
              {t("auth.email")}
              <input type="email" value={account!.email} readOnly />
              <small>{t("account.emailPrivate")}</small>
            </label>
            <label>
              {t("account.bio")}
              <textarea
                rows={5}
                maxLength={500}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
              />
              <small>{t("account.bioHint")}</small>
            </label>
            <div className="form-section-heading">
              <Globe2 size={19} />
              <h3>{t("account.preferences")}</h3>
            </div>
            <LocaleSettings />
            <Alert code={profile.error} />
            <Alert success code={profile.success} />
            <button className="button" disabled={profile.busy}>
              {t(profile.busy ? "common.saving" : "common.save")}
            </button>
          </form>
        </section>
        <div className="account-side">
          <GamingProfileForm />
          <section className="panel security-panel">
            <div className="form-section-heading">
              <Shield size={20} />
              <h2>{t("account.security")}</h2>
            </div>
            <h3>{t("account.changePassword")}</h3>
            <p className="muted">{t("account.passwordHelp")}</p>
            <form className="form-stack" onSubmit={changePassword}>
              <label>
                {t("auth.currentPassword")}
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  value={password.current}
                  onChange={(event) =>
                    setPassword({ ...password, current: event.target.value })
                  }
                />
              </label>
              <label>
                {t("auth.newPassword")}
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={password.next}
                  onChange={(event) =>
                    setPassword({ ...password, next: event.target.value })
                  }
                />
                <small>{t("auth.passwordHint")}</small>
              </label>
              <label>
                {t("auth.confirm")}
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  maxLength={128}
                  value={password.confirm}
                  onChange={(event) =>
                    setPassword({ ...password, confirm: event.target.value })
                  }
                />
              </label>
              {security.error === "password_mismatch" ? (
                <p role="alert" className="alert alert-error">
                  {t("auth.mismatch")}
                </p>
              ) : (
                <Alert code={security.error} />
              )}
              <button
                className="button button-secondary"
                disabled={security.busy}
              >
                {t("account.changePassword")}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
