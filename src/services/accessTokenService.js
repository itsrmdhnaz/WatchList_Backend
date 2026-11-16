import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const ACCESS_TOKEN_AUDIENCE = 'movie-platform-api';
const textEncoder = new TextEncoder();

function getSigningKey() {
  const secret = textEncoder.encode(env.jwtAccessSecret);

  if (secret.byteLength < 32) {
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 bytes to sign access tokens.');
  }

  return secret;
}

export async function createAccessToken(userId) {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new TypeError('userId must be a positive safe integer.');
  }

  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(env.appUrl)
    .setAudience(ACCESS_TOKEN_AUDIENCE)
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(env.jwtAccessTtl)
    .sign(getSigningKey());
}

export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, getSigningKey(), {
    algorithms: ['HS256'],
    audience: ACCESS_TOKEN_AUDIENCE,
    issuer: env.appUrl,
    maxTokenAge: env.jwtAccessTtl,
    requiredClaims: ['exp'],
  });

  return payload;
}
