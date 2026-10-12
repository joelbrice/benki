import type { Catalog } from "./index";
import { serverHa } from "./server.ha";
import { uiHa } from "./ui.ha";

export const ha: Catalog = { ...serverHa, ...uiHa };
