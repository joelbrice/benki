import type { Catalog } from "./index";
import { serverWo } from "./server.wo";
import { uiWo } from "./ui.wo";

export const wo: Catalog = { ...serverWo, ...uiWo };
