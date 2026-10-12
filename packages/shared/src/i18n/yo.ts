import type { Catalog } from "./index";
import { serverYo } from "./server.yo";
import { uiYo } from "./ui.yo";

export const yo: Catalog = { ...serverYo, ...uiYo };
