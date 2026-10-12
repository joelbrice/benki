import type { Catalog } from "./index";
import { serverSw } from "./server.sw";
import { uiSw } from "./ui.sw";

export const sw: Catalog = { ...serverSw, ...uiSw };
