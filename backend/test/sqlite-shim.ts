// Vite 5 doesn't know the node:sqlite builtin yet, so tests load it at runtime.
import { createRequire } from "module";

const nodeRequire = createRequire(`${process.cwd()}/`);
const sqlite = nodeRequire("node:sqlite") as typeof import("node:sqlite");

export const DatabaseSync = sqlite.DatabaseSync;
export type StatementSync = import("node:sqlite").StatementSync;
