import { useLocale } from "../i18n";

const logos = {
  wordmark: { src: "/brand/logo-wordmark.png", width: 360, height: 217 },
  mark: { src: "/brand/logo-mark.png", width: 256, height: 256 },
  full: { src: "/brand/logo.png", width: 632, height: 467 },
} as const;

export function BrandLogo({ variant }: { variant: keyof typeof logos }) {
  const { t } = useLocale();
  return (
    <img
      {...logos[variant]}
      className={`brand-logo brand-logo-${variant}`}
      alt={t("app.title")}
      decoding="async"
    />
  );
}
