import { useEffect, useState, type RefObject, type ReactNode } from "react";
import { useLocale } from "../../i18n";
import type { MessageKey } from "../../i18n";

export function TeamMark({ name }: { name: string }) {
  const tone =
    [...name].reduce(
      (hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0,
      0,
    ) % 6;
  return (
    <span className="guide-team-mark" data-tone={tone} aria-hidden="true">
      {name.slice(0, 3).toUpperCase()}
    </span>
  );
}

export function Chapter({
  id,
  number,
  title,
  description,
  children,
}: {
  id: string;
  number: string;
  title: MessageKey;
  description: MessageKey;
  children: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <section
      id={`guide-${id}`}
      className="guide-chapter"
      aria-labelledby={`guide-${id}-title`}
    >
      <header className="guide-chapter-heading">
        <span className="guide-chapter-number" aria-hidden="true">
          {number}
        </span>
        <h2 id={`guide-${id}-title`}>{t(title)}</h2>
        <p>{t(description)}</p>
      </header>
      {children}
    </section>
  );
}

export function usePreviewActivity(ref: RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(false);
  const [motion, setMotion] = useState(false);
  useEffect(() => {
    let inView = false;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setVisible(inView && !document.hidden);
      setMotion(!preference.matches);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        update();
      },
      { threshold: 0.1 },
    );
    observer.observe(ref.current!);
    update();
    document.addEventListener("visibilitychange", update);
    preference.addEventListener("change", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      preference.removeEventListener("change", update);
    };
  }, [ref]);
  return { visible, motion };
}
