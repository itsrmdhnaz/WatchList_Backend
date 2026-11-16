import { env } from '../../config/env.js';

const priorities = Object.freeze({
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
});

const activePriority = priorities[env.logLevel];

function write(level, message, context) {
  if (priorities[level] > activePriority) {
    return;
  }

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context !== undefined) {
    entry.context = context;
  }

  const output = JSON.stringify(entry);
  const writeToConsole = level === 'error'
    ? console.error
    : level === 'warn'
      ? console.warn
      : console.log;

  writeToConsole(output);
}

export const logger = Object.freeze({
  debug: (message, context) => write('debug', message, context),
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
  error: (message, context) => write('error', message, context),
});
