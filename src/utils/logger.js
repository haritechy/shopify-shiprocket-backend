function safeError(error) {
  if (!error) return 'Unknown error';
  return error instanceof Error ? error.message : String(error);
}

function logInfo(message, meta = {}) {
  console.log(JSON.stringify({ level: 'info', time: new Date().toISOString(), message, ...meta }));
}

function logWarn(message, meta = {}) {
  console.warn(JSON.stringify({ level: 'warn', time: new Date().toISOString(), message, ...meta }));
}

function logError(message, error, meta = {}) {
  console.error(JSON.stringify({
    level: 'error',
    time: new Date().toISOString(),
    message,
    error: safeError(error),
    ...meta,
  }));
}

module.exports = { logInfo, logWarn, logError };
