import jwt from 'jsonwebtoken';

export function signToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || /replace_with|change_this/i.test(secret)) {
    throw new Error('JWT_SECRET must be a unique secret of at least 32 characters.');
  }

  return jwt.sign(
    { sub: String(userId) },
    secret,
    { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
}
