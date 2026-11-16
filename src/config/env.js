import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dotenvResult = dotenv.config({ path: resolve(projectRoot, '.env') });

if (dotenvResult.error && dotenvResult.error.code !== 'ENOENT') {
  throw dotenvResult.error;
}

function readString(name, fallback) {
  return process.env[name] ?? fallback;
}

function readEnum(name, fallback, allowedValues) {
  const value = readString(name, fallback).toLowerCase();
  if (!allowedValues.includes(value)) {
    throw new Error(`Invalid ${name}; expected one of: ${allowedValues.join(', ')}.`);
  }
  return value;
}

function readInteger(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const rawValue = readString(name, String(fallback));
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${name}; expected an integer between ${min} and ${max}.`);
  }
  return value;
}

function readBoolean(name, fallback) {
  const value = readString(name, String(fallback)).toLowerCase();
  if (value !== 'true' && value !== 'false') {
    throw new Error(`Invalid ${name}; expected true or false.`);
  }
  return value === 'true';
}

function readUrl(name, fallback) {
  const value = readString(name, fallback);
  try {
    new URL(value);
  } catch {
    throw new Error(`Invalid ${name}; expected a valid URL.`);
  }
  return value;
}

function readUrlList(name, fallback) {
  const values = readString(name, fallback)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length === 0) {
    throw new Error(`Invalid ${name}; provide at least one HTTP(S) origin.`);
  }

  const origins = values.map((value) => {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`Invalid ${name}; expected comma-separated HTTP(S) origins.`);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)
      || parsed.username !== ''
      || parsed.password !== ''
      || parsed.pathname !== '/'
      || parsed.search !== ''
      || parsed.hash !== '') {
      throw new Error(`Invalid ${name}; values must be HTTP(S) origins without paths.`);
    }

    return parsed.origin;
  });

  return [...new Set(origins)];
}

const nodeEnv = readEnum('NODE_ENV', 'development', ['development', 'test', 'production']);
const cookieSecure = readBoolean('COOKIE_SECURE', false);
const cookieSameSite = readEnum('COOKIE_SAME_SITE', 'lax', ['lax', 'strict', 'none']);
const jwtAccessSecret = readString('JWT_ACCESS_SECRET', '');

if (nodeEnv === 'production' && jwtAccessSecret.length < 32) {
  throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters in production.');
}

if (nodeEnv === 'production' && !cookieSecure) {
  throw new Error('COOKIE_SECURE must be true in production.');
}

if (cookieSameSite === 'none' && !cookieSecure) {
  throw new Error('COOKIE_SECURE must be true when COOKIE_SAME_SITE is none.');
}

const defaultPageSize = readInteger('DEFAULT_PAGE_SIZE', 20);
const maxPageSize = readInteger('MAX_PAGE_SIZE', 50);
if (maxPageSize < defaultPageSize) {
  throw new Error('MAX_PAGE_SIZE must be greater than or equal to DEFAULT_PAGE_SIZE.');
}

const databasePath = readString('DATABASE_PATH', './database/movie_platform.sqlite');
const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`;
const corsOrigins = Object.freeze(readUrlList(
  'CORS_ORIGINS',
  readString('CORS_ORIGIN', 'http://localhost:5173'),
));

export const env = Object.freeze({
  nodeEnv,
  port: readInteger('PORT', 3000, { max: 65535 }),
  appUrl: readUrl('APP_URL', 'http://localhost:3000'),
  databasePath,
  databaseUrl,
  databaseWalMode: readBoolean('DATABASE_WAL_MODE', true),
  tmdbApiKey: readString('TMDB_API_KEY', ''),
  tmdbBaseUrl: readUrl('TMDB_BASE_URL', 'https://api.themoviedb.org/3'),
  tmdbLanguage: readString('TMDB_LANGUAGE', 'id-ID'),
  tmdbCacheTtlDays: readInteger('TMDB_CACHE_TTL_DAYS', 7),
  tmdbRequestTimeoutMs: readInteger('TMDB_REQUEST_TIMEOUT_MS', 10000),
  jwtAccessSecret,
  jwtAccessTtl: readString('JWT_ACCESS_TTL', '15m'),
  refreshTokenTtlDefaultDays: readInteger('REFRESH_TOKEN_TTL_DEFAULT_DAYS', 1),
  refreshTokenTtlRememberDays: readInteger('REFRESH_TOKEN_TTL_REMEMBER_DAYS', 30),
  defaultPageSize,
  maxPageSize,
  mostWatchedLimit: readInteger('MOST_WATCHED_LIMIT', 20),
  mostWatchedMinRecords: readInteger('MOST_WATCHED_MIN_RECORDS', 10),
  rateLimitWindowMs: readInteger('RATE_LIMIT_WINDOW_MS', 900000),
  rateLimitMaxRequests: readInteger('RATE_LIMIT_MAX_REQUESTS', 100),
  corsOrigins,
  // Keep the first configured origin for existing test and integration helpers.
  corsOrigin: corsOrigins[0],
  cookieSecure,
  cookieSameSite,
  logLevel: readEnum('LOG_LEVEL', 'debug', ['debug', 'info', 'warn', 'error']),
});

const DEVELOPMENT_LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isAllowedOrigin(origin) {
  if (typeof origin !== 'string') {
    return false;
  }

  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  if (env.corsOrigins.includes(parsed.origin)) {
    return true;
  }

  return env.nodeEnv !== 'production'
    && parsed.protocol === 'http:'
    && DEVELOPMENT_LOOPBACK_HOSTS.has(parsed.hostname);
}
