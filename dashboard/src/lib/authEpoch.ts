// Bumped on every login/logout transition so in-flight requests started
// before the transition can detect they're stale once they resolve.
let epoch = 0;

export function getAuthEpoch() {
  return epoch;
}

export function bumpAuthEpoch() {
  return ++epoch;
}
