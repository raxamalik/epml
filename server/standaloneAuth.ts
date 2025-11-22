import type { Express, RequestHandler } from "express";
import session from "express-session";
import { storage } from "./storage";

export function setupAuth(app: Express) {
  // Simple session setup for standalone authentication
  app.use(session({
    secret: process.env.SESSION_SECRET || 'epml-admin-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const session = (req as any).session;
  
  console.log("Full session object:", JSON.stringify(session, null, 2));
  console.log("Session userId:", session?.userId);
  
  if (!session || !session.userId) {
    console.log("No session or userId found");
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const user = await storage.getUser(session.userId);
    if (!user) {
      console.log("User not found for ID:", session.userId);
      return res.status(401).json({ message: "User not found" });
    }
    
    console.log("User authenticated:", user.email);
    // Attach user to request for use in routes
    (req as any).user = user;
    return next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ message: "Authentication failed" });
  }
};