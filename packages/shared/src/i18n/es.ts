import type { Catalog } from "./index";
import { serverEs } from "./server.es";
import { uiEs } from "./ui.es";

export const es: Catalog = { ...serverEs, ...uiEs };
