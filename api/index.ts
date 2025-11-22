import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes";
import cookieParser from "cookie-parser";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      console.log(logLine);
    }
  });

  next();
});

// Register all API routes (only once)
let routesRegistered = false;
let setupError: Error | null = null;

async function setupApp() {
  if (!routesRegistered) {
    try {
      // registerRoutes creates and returns a Server, but we don't need it for Vercel
      await registerRoutes(app);
      
      // Error handler must be registered AFTER routes
      app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        console.error("Express error:", err);
        if (!res.headersSent) {
          res.status(status).json({ message, error: process.env.NODE_ENV === 'development' ? err.stack : undefined });
        }
      });
      
      routesRegistered = true;
    } catch (error) {
      console.error("Failed to setup app:", error);
      setupError = error as Error;
      throw error;
    }
  }
}

// Vercel serverless function handler
export default async function handler(req: Request, res: Response) {
  try {
    // If setup failed previously, return error immediately
    if (setupError) {
      console.error("App setup failed previously:", setupError);
      if (!res.headersSent) {
        return res.status(500).json({ 
          message: "Server initialization failed", 
          error: process.env.NODE_ENV === 'development' ? setupError.message : undefined 
        });
      }
      return;
    }

    await setupApp();
    
    // Handle the request through Express
    app(req, res);
  } catch (error) {
    console.error("Handler error:", error);
    if (!res.headersSent) {
      const err = error as Error;
      return res.status(500).json({ 
        message: err.message || "Internal Server Error",
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  }
}

