import type { Catalog } from "./index";
import { serverPt } from "./server.pt";
import { uiPt } from "./ui.pt";

export const pt: Catalog = { ...serverPt, ...uiPt };
