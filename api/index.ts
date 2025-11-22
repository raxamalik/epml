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
      console.log("Setting up routes...");
      
      // registerRoutes creates and returns a Server, but we don't need it for Vercel
      await registerRoutes(app);
      console.log("Routes registered successfully");
      
      // Error handler must be registered AFTER routes
      app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        console.error("Express error:", err);
        console.error("Error stack:", err?.stack);
        if (!res.headersSent) {
          res.status(status).json({ 
            message, 
            error: process.env.NODE_ENV === 'development' ? err.stack : undefined 
          });
        }
      });
      
      routesRegistered = true;
      console.log("App setup complete");
    } catch (error: any) {
      console.error("Failed to setup app:", error);
      console.error("Error message:", error?.message);
      console.error("Error stack:", error?.stack);
      console.error("Error name:", error?.name);
      setupError = error as Error;
      throw error;
    }
  }
}

// Vercel serverless function handler
export default async function handler(req: Request, res: Response) {
  // Add timeout to prevent hanging
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error("Request timeout");
      res.status(504).json({ message: "Request timeout" });
    }
  }, 30000); // 30 second timeout

  try {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    
    // If setup failed previously, return error immediately
    if (setupError) {
      console.error("App setup failed previously:", setupError);
      clearTimeout(timeout);
      if (!res.headersSent) {
        return res.status(500).json({ 
          message: "Server initialization failed", 
          error: process.env.NODE_ENV === 'development' ? setupError.message : undefined,
          stack: process.env.NODE_ENV === 'development' ? setupError.stack : undefined
        });
      }
      return;
    }

    // Setup app if not already done
    await setupApp();
    
    // Handle the request through Express
    // Wrap in promise to catch errors
    return new Promise<void>((resolve) => {
      // Handle response finish
      res.on('finish', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      // Handle response close
      res.on('close', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      // Handle Express errors
      app(req, res, (err: any) => {
        clearTimeout(timeout);
        if (err) {
          console.error("Express error in handler:", err);
          if (!res.headersSent) {
            res.status(500).json({ 
              message: err.message || "Internal Server Error",
              error: process.env.NODE_ENV === 'development' ? err.stack : undefined
            });
          }
        }
        resolve();
      });
    });
  } catch (error: any) {
    clearTimeout(timeout);
    console.error("Handler error:", error);
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    if (!res.headersSent) {
      return res.status(500).json({ 
        message: error?.message || "Internal Server Error",
        error: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  }
}

