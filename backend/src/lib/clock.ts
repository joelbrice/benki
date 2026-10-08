export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Deterministic clock for tests — time only moves when told to. */
export class ManualClock implements Clock {
  private current: number;

  constructor(start: Date | string = "2026-01-01T09:00:00.000Z") {
    this.current = new Date(start).getTime();
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number) {
    this.current += ms;
  }

  set(at: Date | string) {
    this.current = new Date(at).getTime();
  }
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
