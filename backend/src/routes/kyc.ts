import { Router } from "express";
import type { KycStatusResponse, KycTier1Request, KycTier2Request } from "@benki/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { badRequest } from "../errors";

export const kycRouter = Router();
kycRouter.use(requireAuth);

kycRouter.get("/status", (req: AuthedRequest, res) => {
  const response: KycStatusResponse = { kycTier: req.user!.kycTier };
  res.json(response);
});

// docs/KYC_AML_POLICY_AND_RISK.md: Tier 1 requires national ID validation,
// Tier 2 requires proof of address/liveness on top of an existing Tier 1.
kycRouter.post("/tier1", (req: AuthedRequest, res) => {
  const body = req.body as Partial<KycTier1Request>;
  if (!body.nationalId?.trim()) throw badRequest("nationalId is required for Tier 1");

  const user = req.user!;
  // Mutate in place: usersByPhone and usersById hold the same object
  // reference, so this keeps both indexes consistent without a second write.
  user.nationalId = body.nationalId.trim();
  user.kycTier = "TIER_1";
  const response: KycStatusResponse = { kycTier: "TIER_1" };
  res.json(response);
});

kycRouter.post("/tier2", (req: AuthedRequest, res) => {
  const body = req.body as Partial<KycTier2Request>;
  const user = req.user!;
  if (user.kycTier === "TIER_0") throw badRequest("Complete Tier 1 before upgrading to Tier 2");
  if (body.proofOfAddressConfirmed !== true) {
    throw badRequest("proofOfAddressConfirmed must be true for Tier 2");
  }

  user.proofOfAddressConfirmed = true;
  user.kycTier = "TIER_2";
  const response: KycStatusResponse = { kycTier: "TIER_2" };
  res.json(response);
});
