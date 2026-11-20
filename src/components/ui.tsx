import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Link } from "react-router-dom";
import { X, LoaderCircle, UserRound, ShieldBan } from "lucide-react";
import { RequestError } from "../lib/api";
import { errorKey, useLocale, type MessageKey } from "../i18n";
import { useSession } from "../app/contexts";

export function Avatar({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  const color =
    [...name].reduce((value, char) => value + char.charCodeAt(0), 0) % 5;
  return (
    <span
      className={`avatar avatar-${color}${large ? " avatar-large" : ""}`}
      aria-hidden="true"
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function Dialog({
  children,
  title,
  close,
  className = "",
  initialFocus,
}: {
  children: ReactNode;
  title: string;
  close: () => void;
  className?: string;
  initialFocus?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useLocale();
  useEffect(() => {
    const element = ref.current!;
    if (!element.open) element.showModal();
    initialFocus?.current?.focus();
    return () => {
      if (element.open) element.close();
    };
  }, [initialFocus]);
  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="dialog-inner">
        <header className="dialog-header">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={close}
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function Alert({
  code,
  success = false,
}: {
  code: string;
  success?: boolean;
}) {
  const { t } = useLocale();
  if (!code) return null;
  return (
    <p
      className={`alert ${success ? "alert-success" : "alert-error"}`}
      role={success ? "status" : "alert"}
    >
      {t(success ? (code as MessageKey) : errorKey(code))}
    </p>
  );
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function run(action: () => Promise<void>, message = "") {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await action();
      if (message) setSuccess(message);
    } catch (failure) {
      setError(failure instanceof RequestError ? failure.code : "generic");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, success, setError, run };
}

export function Loading() {
  const { t } = useLocale();
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spinner" size={22} />
      <span>{t("common.loading")}</span>
    </div>
  );
}

export function RequireAccount({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const { account } = useSession();
  const { t } = useLocale();
  if (!account)
    return (
      <div className="empty-state">
        <UserRound size={32} />
        <h1>{t("auth.required")}</h1>
        <Link to="/login" className="button">
          {t("auth.login")}
        </Link>
      </div>
    );
  if (admin && !account.isAdmin)
    return (
      <div className="empty-state">
        <ShieldBan size={32} />
        <h1>{t("admin.noAccess")}</h1>
      </div>
    );
  return children;
}

export function PageHeading({
  eyebrow,
  title,
}: {
  eyebrow: MessageKey;
  title: MessageKey;
}) {
  const { t } = useLocale();
  return (
    <header className="page-heading">
      <div className="section-eyebrow">
        <span className="accent-line" />
        {t(eyebrow)}
      </div>
      <h1>{t(title)}</h1>
    </header>
  );
}
