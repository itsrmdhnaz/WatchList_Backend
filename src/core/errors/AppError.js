export default class AppError extends Error {
  constructor(message, { statusCode = 500, code } = {}) {
    super(message);

    if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
      throw new TypeError('AppError statusCode must be an HTTP error status from 400 to 599.');
    }

    const resolvedCode = code ?? (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'APPLICATION_ERROR');
    if (typeof resolvedCode !== 'string' || resolvedCode.trim() === '') {
      throw new TypeError('AppError code must be a non-empty string.');
    }

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = resolvedCode;
    this.isOperational = true;

    Error.captureStackTrace?.(this, AppError);
  }
}
