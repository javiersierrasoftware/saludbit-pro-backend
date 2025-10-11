import jwt from 'jsonwebtoken';

export function generateToken(userId: string): string {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '7d',
  });
}