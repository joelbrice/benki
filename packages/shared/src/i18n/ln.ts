import type { Catalog } from "./index";
import { serverLn } from "./server.ln";
import { uiLn } from "./ui.ln";

export const ln: Catalog = { ...serverLn, ...uiLn };
