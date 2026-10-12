import type { Country, LimitsResponse, UserProfile, WalletAccount } from "@benki/shared";
import type { CustomerApi } from "../api";

export type Section = "home" | "send" | "requests" | "pay" | "cash" | "savings" | "groups" | "loans" | "currencies" | "activity" | "profile";

/** Optional starting mode when one screen links to another (e.g. Home → Pay → Airtime). */
export type Preset = "benki" | "momo" | "bank" | "abroad" | "bills" | "merchant" | "airtime";

export interface Session {
  api: CustomerApi;
  user: UserProfile;
  wallet: WalletAccount;
  limits: LimitsResponse;
  country: Country;
  refresh: () => Promise<void>;
  go: (section: Section, preset?: Preset) => void;
  preset?: Preset;
}
