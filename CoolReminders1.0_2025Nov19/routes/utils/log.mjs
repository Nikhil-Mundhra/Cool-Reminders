/* routes/utils/log.mjs */
/* Simple logger with env based toggles */

export const IS_DEBUG = process.env.DEBUG === '1' || process.env.NODE_ENV === 'development';
export const IS_MONGO_DEBUG = process.env.MONGOOSE_DEBUG === '1';

/*
  info

  Logs messages prefixed with [INFO] only when debug mode is enabled,
  so noisy diagnostics can be turned off in production.
*/
export function info(...args) {
  if (IS_DEBUG) console.log('[INFO]', ...args);
}

/*
  warn

  Logs warnings prefixed with [WARN] only when debug mode is enabled,
  for non fatal conditions that are still useful during development.
*/
export function warn(...args) {
  if (IS_DEBUG) console.warn('[WARN]', ...args);
}

/*
  err

  Always logs errors prefixed with [ERROR] regardless of debug flags,
  so important failures are never suppressed.
*/
export function err(...args) {
  console.error('[ERROR]', ...args);
}

/*
  makeReqId

  Generates a very short request id string by combining the current
  timestamp and a random suffix, both encoded in base36.
*/
export function makeReqId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
