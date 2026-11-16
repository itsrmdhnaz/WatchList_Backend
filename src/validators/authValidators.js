import AppError from '../core/errors/AppError.js';
import { env } from '../config/env.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const MIN_PASSWORD_LENGTH = env.minPasswordLength ?? 5;
const MAX_PASSWORD_LENGTH = env.maxPasswordLength ?? 128;
const MAX_PASSWORD_BYTES = env.maxPasswordBytes ?? 256;
const MAX_DISPLAY_NAME_LENGTH = env.maxDisplayNameLength ?? 80;

function invalidRequest() {
  return new AppError('Request data is invalid.', {
    statusCode: 400,
    code: 'VALIDATION_ERROR',
  });
}

function isValidEmail(email) {
  return typeof email === 'string'
    && email.length <= 254
    && EMAIL_PATTERN.test(email.trim());
}

function isValidPassword(password) {
  if (typeof password !== 'string') {
    return false;
  }

  const characterCount = Array.from(password).length;
  return characterCount >= MIN_PASSWORD_LENGTH
    && characterCount <= MAX_PASSWORD_LENGTH
    && Buffer.byteLength(password, 'utf8') <= MAX_PASSWORD_BYTES;
}

function readBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidRequest();
  }

  return body;
}

export function validateRegistration(req, _res, next) {
  try {
    const body = readBody(req.body);
    if (!isValidEmail(body.email)
      || !isValidPassword(body.password)
      || typeof body.displayName !== 'string'
      || body.displayName.trim().length === 0
      || Array.from(body.displayName.trim()).length > MAX_DISPLAY_NAME_LENGTH) {
      throw invalidRequest();
    }

    req.authInput = {
      email: body.email.trim().toLowerCase(),
      password: body.password,
      displayName: body.displayName.trim(),
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateLogin(req, _res, next) {
  try {
    const body = readBody(req.body);
    if (!isValidEmail(body.email)
      || !isValidPassword(body.password)
      || (body.rememberMe !== undefined && typeof body.rememberMe !== 'boolean')) {
      throw invalidRequest();
    }

    req.authInput = {
      email: body.email.trim().toLowerCase(),
      password: body.password,
      rememberMe: body.rememberMe ?? false,
    };
    return next();
  } catch (error) {
    return next(error);
  }
}
