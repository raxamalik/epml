import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

// Simple token-based auth using localStorage
const sessions = new Map<string, { userId: number; expires: number }>();

function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function setupAuthMiddleware(app: Express) {

  // Login endpoint
  app.post("/api/auth/login", async (req, res) => {
    // Force JSON response
    res.setHeader('Content-Type', 'application/json');
    console.log("=== LOGIN API HIT ===", req.body);
    
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).end(JSON.stringify({ message: "Email and password required" }));
      }

      // Check if it's a regular user login
      const user = await storage.getUserByEmail(email);
      let authUser = null;
      let isValid = false;

      if (user && user.passwordHash) {
        const bcrypt = await import("bcrypt");
        isValid = await bcrypt.compare(password, user.passwordHash);
        if (isValid) {
          authUser = { id: user.id, email: user.email, role: user.role, type: 'user' };
        }
      }

      // If user login failed, check company login
      if (!isValid) {
        const companies = await storage.getAllCompanies();
        const company = companies.find(c => c.email === email && c.password);
        
        if (company && company.password) {
          const bcrypt = await import("bcrypt");
          isValid = await bcrypt.compare(password, company.password);
          if (isValid) {
            authUser = { id: company.id, email: company.email, role: 'company_admin', type: 'company', companyName: company.name };
          }
        }
      }

      if (!isValid || !authUser) {
        return res.status(401).end(JSON.stringify({ message: "Invalid credentials" }));
      }

      // Create session token
      const token = generateToken();
      const expires = Date.now() + (24 * 60 * 60 * 1000);
      sessions.set(token, { userId: authUser.id, expires, userType: authUser.type });

      console.log("Login successful, token created:", token);
      
      const response = { 
        success: true,
        token,
        user: authUser
      };
      
      return res.status(200).end(JSON.stringify(response));
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).end(JSON.stringify({ message: "Login failed" }));
    }
  });

  // Register endpoint
  app.post("/api/auth/register", async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    console.log("=== REGISTER API HIT ===", req.body);
    
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).end(JSON.stringify({ message: "Email and password required" }));
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).end(JSON.stringify({ message: "User already exists" }));
      }

      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(password, 10);

      // First user is super admin
      const allUsers = await storage.getAllUsers();
      const role = allUsers.length === 0 ? "super_admin" : "manager";

      const newUser = await storage.createUser({
        email,
        firstName,
        lastName,
        passwordHash,
        role
      });

      // Create session token
      const token = generateToken();
      const expires = Date.now() + (24 * 60 * 60 * 1000);
      sessions.set(token, { userId: newUser.id, expires });

      console.log("Registration successful, token created:", token);
      
      const response = { 
        success: true,
        token,
        user: { id: newUser.id, email: newUser.email, role: newUser.role }
      };
      
      return res.status(200).end(JSON.stringify(response));
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).end(JSON.stringify({ message: "Registration failed" }));
    }
  });

  // User info endpoint
  app.get("/api/auth/user", async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      console.log("Auth check - token:", token);
      console.log("Auth check - active sessions:", Array.from(sessions.keys()));

      if (!token) {
        return res.status(401).end(JSON.stringify({ message: "No token provided" }));
      }

      const session = sessions.get(token);
      if (!session) {
        return res.status(401).end(JSON.stringify({ message: "Invalid token" }));
      }

      if (session.expires < Date.now()) {
        sessions.delete(token);
        return res.status(401).end(JSON.stringify({ message: "Token expired" }));
      }

      const user = await storage.getUser(session.userId);
      if (!user) {
        sessions.delete(token);
        return res.status(401).end(JSON.stringify({ message: "User not found" }));
      }

      console.log("User authenticated:", user.email);
      return res.status(200).end(JSON.stringify(user));
    } catch (error) {
      console.error("Auth check error:", error);
      return res.status(500).end(JSON.stringify({ message: "Authentication failed" }));
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (token) {
      sessions.delete(token);
    }
    
    return res.json({ success: true });
  });
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const session = sessions.get(token);
    if (!session || session.expires < Date.now()) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = await storage.getUser(session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Authentication failed" });
  }
};