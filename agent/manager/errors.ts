/** The managed child survived SIGKILL: a server-side failure, not a bad request. */
export class ManagedProcessStuckError extends Error {
  override name = 'ManagedProcessStuckError';
}
