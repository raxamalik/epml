import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-for-development';
const SALT_ROUNDS = 10;

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET || 'dev-session-secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Login endpoint
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Check if user exists
      let user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Check if this email belongs to a company
        const companies = await storage.getAllCompanies();
        const company = companies.find(c => c.email === email);
        
        if (company) {
          // Create user account for company email
          const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
          user = await storage.createUser({
            email,
            firstName: company.contactPerson.split(' ')[0] || 'Company',
            lastName: company.contactPerson.split(' ').slice(1).join(' ') || 'Admin',
            role: 'store_owner',
            passwordHash: hashedPassword,
            companyId: company.id,
          });
        } else {
          // Create default demo users
          if (email === 'admin@epml.com') {
            const hashedPassword = await bcrypt.hash('admin123', SALT_ROUNDS);
            user = await storage.createUser({
              email,
              firstName: 'Super',
              lastName: 'Admin',
              role: 'super_admin',
              passwordHash: hashedPassword,
            });
          } else {
            return res.status(401).json({ message: "Invalid credentials. Please use a registered company email or demo credentials." });
          }
        }
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash || '');
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Store user in session
      (req.session as any).userId = user.id;
      (req.session as any).user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      };

      // Log activity
      await storage.createActivity({
        type: 'user_login',
        description: `User logged in: ${user.email}`,
        userId: user.id,
        metadata: { email: user.email }
      });

      res.json({ 
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Register endpoint
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password || !firstName) {
        return res.status(400).json({ message: "Email, password, and first name are required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user
      const user = await storage.createUser({
        email,
        firstName,
        lastName,
        role: 'manager', // Default role
        passwordHash: hashedPassword,
      });

      // Store user in session
      (req.session as any).userId = user.id;
      (req.session as any).user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      };

      // Log activity
      await storage.createActivity({
        type: 'user_registered',
        description: `New user registered: ${user.email}`,
        userId: user.id,
        metadata: { email: user.email }
      });

      res.json({ 
        message: "Registration successful",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        }
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ message: "Logout successful" });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const userId = (req.session as any)?.userId;
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};