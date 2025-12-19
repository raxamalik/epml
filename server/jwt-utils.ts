import jwt from 'jsonwebtoken';

// JWT secret - should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // Default 7 days

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  type?: string;
  companyId?: number | null;
  companyName?: string | null;
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      console.error('JWT verification error:', error.message);
    } else if (error instanceof jwt.TokenExpiredError) {
      console.error('JWT token expired');
    } else {
      console.error('JWT verification error:', error);
    }
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }
  
  // Support both "Bearer <token>" and just "<token>"
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return authHeader;
}

