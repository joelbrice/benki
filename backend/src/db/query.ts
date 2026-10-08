import type { StatementSync } from "node:sqlite";
import type { Db } from "./database";

export type Param = null | number | bigint | string | Uint8Array;

const cache = new WeakMap<Db, Map<string, StatementSync>>();

function stmt(db: Db, sql: string): StatementSync {
  let byDb = cache.get(db);
  if (!byDb) {
    byDb = new Map();
    cache.set(db, byDb);
  }
  let s = byDb.get(sql);
  if (!s) {
    s = db.prepare(sql);
    byDb.set(sql, s);
  }
  return s;
}

export function one<T>(db: Db, sql: string, ...params: Param[]): T | undefined {
  return stmt(db, sql).get(...params) as T | undefined;
}

export function all<T>(db: Db, sql: string, ...params: Param[]): T[] {
  return stmt(db, sql).all(...params) as T[];
}

export function run(db: Db, sql: string, ...params: Param[]): number {
  return Number(stmt(db, sql).run(...params).changes);
}
