/**
 * Pre-rebrand saved-settings location. `FileConfigStore` adopts a file here once
 * when the Qelay default path does not exist yet. This is the only place in
 * `agent/` that may spell the old product name.
 */
export const LEGACY_CONFIG_PATH = '.bunqueue-dashboard/config.json';
