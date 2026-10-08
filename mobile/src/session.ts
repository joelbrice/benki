import type { Country, LimitsResponse, UserProfile, WalletAccount } from "@benki/shared";
import type { CustomerApi } from "./api";

export interface Session {
  api: CustomerApi;
  user: UserProfile;
  wallet: WalletAccount;
  limits: LimitsResponse;
  country: Country;
  refresh: () => Promise<void>;
}
