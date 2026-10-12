import type { Catalog } from "./index";
import { serverFr } from "./server.fr";
import { uiFr } from "./ui.fr";

export const fr: Catalog = { ...serverFr, ...uiFr };
