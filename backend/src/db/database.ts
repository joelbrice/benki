import { mkdirSync } from "fs";
import { dirname } from "path";
import { DatabaseSync } from "node:sqlite";
import { MIGRATIONS } from "./schema";

export type Db = DatabaseSync;

export function openDatabase(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;");
  migrate(db);
  return db;
}

function migrate(db: Db) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)");
  const row = db.prepare("SELECT MAX(version) AS version FROM schema_version").get() as { version: number | null };
  const current = row.version ?? 0;
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    withTx(db, () => {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(migration.version);
    });
  }
}

const depths = new WeakMap<Db, number>();

/**
 * Runs fn atomically. Nested calls become savepoints, so a service can be
 * atomic on its own and still compose into a larger unit of work. fn must be
 * synchronous: an await inside would let other requests interleave mid-tx.
 */
export function withTx<T>(db: Db, fn: () => T): T {
  const depth = depths.get(db) ?? 0;
  const savepoint = `sp_${depth}`;
  db.exec(depth === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${savepoint}`);
  depths.set(db, depth + 1);
  try {
    const result = fn();
    if (result instanceof Promise) throw new Error("withTx callbacks must be synchronous");
    db.exec(depth === 0 ? "COMMIT" : `RELEASE ${savepoint}`);
    return result;
  } catch (error) {
    if (depth === 0) {
      db.exec("ROLLBACK");
    } else {
      db.exec(`ROLLBACK TO ${savepoint}`);
      db.exec(`RELEASE ${savepoint}`);
    }
    throw error;
  } finally {
    depths.set(db, depth);
  }
}

export function inTx(db: Db): boolean {
  return (depths.get(db) ?? 0) > 0;
}
