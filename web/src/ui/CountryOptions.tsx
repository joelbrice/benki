import { AFRICAN_COUNTRIES, type Country, type MessageKey, type Region } from "@benki/shared";
import { useI18n } from "../i18n";

const REGIONS: Region[] = ["CENTRAL", "WEST", "EAST", "SOUTHERN", "NORTH"];

/**
 * <option>s for a country <select>, grouped by region with Central Africa first
 * (Cameroon at the top) — the order of AFRICAN_COUNTRIES.
 */
export function CountryOptions({ countries, detail = false }: { countries: Country[]; detail?: boolean }) {
  const { t } = useI18n();
  const ordered = AFRICAN_COUNTRIES.filter((c) => countries.includes(c));
  return (
    <>
      {REGIONS.map((region) => {
        const inRegion = ordered.filter((c) => c.region === region);
        if (inRegion.length === 0) return null;
        return (
          <optgroup key={region} label={t(`region.${region}`)}>
            {inRegion.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {t(`country.${c.code}` as MessageKey)} {detail ? `· ${c.currency} · ${c.callingCode}` : `(${c.currency})`}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}
