import type { Catalog } from "./index";
import { serverAr } from "./server.ar";
import { uiAr } from "./ui.ar";

export const ar: Catalog = { ...serverAr, ...uiAr };
