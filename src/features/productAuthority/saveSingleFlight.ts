export interface SingleFlightRef {
  current: boolean;
}

/**
 * Acquire a synchronous single-flight guard before any asynchronous save preflight begins.
 * Returns false when another save already owns the guard.
 */
export function tryAcquireSingleFlight(ref: SingleFlightRef): boolean {
  if (ref.current) return false;
  ref.current = true;
  return true;
}

export function releaseSingleFlight(ref: SingleFlightRef): void {
  ref.current = false;
}
