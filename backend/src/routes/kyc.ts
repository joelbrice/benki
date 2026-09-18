import { Router } from "express";
import type { KycStatusResponse, KycTier } from "@benki/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

export const kycRouter = Router();
kycRouter.use(requireAuth);

kycRouter.get("/status", (req: AuthedRequest, res) => {
  const response: KycStatusResponse = { kycTier: req.user!.kycTier };
  res.json(response);
});

function upgrade(tier: KycTier) {
  return (req: AuthedRequest, res: import("express").Response) => {
    // Mutate in place: usersByPhone and usersById hold the same object
    // reference, so this keeps both indexes consistent without a second write.
    req.user!.kycTier = tier;
    const response: KycStatusResponse = { kycTier: tier };
    res.json(response);
  };
}

// docs/API_SPECIFICATION.md lists /kyc/tier1 and /kyc/tier2 as the progression
// endpoints; tier0 is the default state assigned at signup in routes/auth.ts.
kycRouter.post("/tier1", upgrade("TIER_1"));
kycRouter.post("/tier2", upgrade("TIER_2"));
