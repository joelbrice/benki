import { LANGUAGES_BY_COUNTRY, LOCALES, type Locale } from "@benki/shared";
import { useI18n } from "../i18n";
import { Icon } from "./icons";

/** Languages for the customer's market first, then the rest. */
export function LanguageSelect({ countryCode, onChange, compact = false }: { countryCode?: string; onChange?: (l: Locale) => void; compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  const first = countryCode ? (LANGUAGES_BY_COUNTRY[countryCode] ?? []) : [];
  const ordered = [...LOCALES].sort((a, b) => {
    const ia = first.indexOf(a.code);
    const ib = first.indexOf(b.code);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return (
    <label className={`language-select${compact ? " compact" : ""}`}>
      <Icon name="language" size={16} />
      <span className="sr-only">{t("nav.language")}</span>
      <select
        aria-label={t("nav.language")}
        value={locale}
        onChange={(e) => {
          const next = e.target.value as Locale;
          setLocale(next);
          onChange?.(next);
        }}
      >
        {ordered.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
