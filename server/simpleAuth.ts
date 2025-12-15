import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import { sendPasswordResetEmail, verifySendGridConfiguration } from "./emailService";
import { AuditLogger } from "./auditLogger";
import crypto from "crypto";
import { generateToken, verifyToken, extractTokenFromHeader, type JWTPayload } from "./jwt-utils";

function generateResetToken(): string {
  // Use crypto for cryptographically secure random tokens
  return crypto.randomBytes(32).toString('hex');
}

function generateTempToken(userId: string | number): string {
  // Use crypto for cryptographically secure random tokens
  return crypto.randomBytes(32).toString('hex');
}

function generateDeviceToken(): string {
  return 'device_' + Math.random().toString(36).substring(2) + '_' + Date.now().toString(36);
}

async function checkTrustedDevice(deviceToken: string): Promise<boolean> {
  if (!deviceToken) return false;
  
  try {
    const device = await storage.getTrustedDevice(deviceToken);
    if (!device) return false;
    
    // Check if device is expired
    if (device.expiresAt < new Date()) {
      await storage.deleteTrustedDevice(deviceToken);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error checking trusted device:", error);
    return false;
  }
}

// 2FA status check function - now checks database
async function check2FAStatus(email: string): Promise<boolean> {
  try {
    // First check if regular user exists with 2FA enabled
    const user = await storage.getUserByEmail(email);
    if (user && user.twoFactorEnabled) {
      return true;
    }
    
    // If not found, check if this is a company email
    const companies = await storage.getAllCompanies();
    const company = companies.find(c => c.email === email);
    if (company) {
      // For companies, create a pseudo user ID and check 2FA status
      const companyUserId = `company_${company.id}`;
      const companyUser = await storage.getUserById(companyUserId);
      return companyUser?.twoFactorEnabled || false;
    }
    
    return false;
  } catch (error) {
    console.error("Error checking 2FA status:", error);
    return false;
  }
}

async function get2FASecret(email: string): Promise<string | null> {
  try {
    // First check if regular user exists with 2FA secret
    const user = await storage.getUserByEmail(email);
    if (user && user.twoFactorSecret) {
      return user.twoFactorSecret;
    }
    
    // If not found, check if this is a company email
    const companies = await storage.getAllCompanies();
    const company = companies.find(c => c.email === email);
    if (company) {
      // For companies, create a pseudo user ID and get 2FA secret
      const companyUserId = `company_${company.id}`;
      const companyUser = await storage.getUserById(companyUserId);
      return companyUser?.twoFactorSecret || null;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting 2FA secret:", error);
    return null;
  }
}

async function store2FASecret(email: string, secret: string): Promise<void> {
  try {
    // First check if regular user exists
    const user = await storage.getUserByEmail(email);
    if (user) {
      await storage.enable2FA(user.id, secret);
      return;
    }
    
    // If not found, check if this is a company email
    const companies = await storage.getAllCompanies();
    const company = companies.find(c => c.email === email);
    if (company) {
      // For companies, create a pseudo user if doesn't exist
      const companyUserId = `company_${company.id}`;
      const existingCompanyUser = await storage.getUserById(companyUserId);
      
      if (existingCompanyUser) {
        await storage.enable2FA(companyUserId, secret);
      } else {
        // Create a pseudo user record for company 2FA
        await storage.createUser({
          id: companyUserId,
          email: email,
          firstName: company.contactPerson.split(' ')[0] || 'Company',
          lastName: company.contactPerson.split(' ').slice(1).join(' ') || 'Admin',
          role: 'company_admin',
          companyId: company.id,
          twoFactorSecret: secret,
          twoFactorEnabled: true,
          isActive: true
        });
      }
      return;
    }
    
    throw new Error("User not found for 2FA setup");
  } catch (error) {
    console.error("Error storing 2FA secret:", error);
    throw error;
  }
}

export { store2FASecret, check2FAStatus, get2FASecret };

export function setupAuth(app: Express) {
  // JWT-based authentication - no sessions needed
  // Verify SendGrid configuration on startup
  verifySendGridConfiguration();

  // Login route
  app.post("/api/auth/login", async (req, res) => {
    try {
      console.log("=== LOGIN ROUTE HIT ===");
      console.log("Request body:", req.body);
      
      const { email, password, twoFactorToken, rememberDevice } = req.body;
      const deviceToken = req.headers['x-device-token'] as string;

      console.log("=== LOGIN API HIT ===", { email, password, twoFactorToken });
      
      let authenticatedUser = null;
      let userType = 'user'; // 'user' or 'company'
      
      // First, try to find a regular user
      const user = await storage.getUserByEmail(email);
      console.log("User found:", user ? { 
        id: user.id, 
        email: user.email, 
        hasPassword: !!user.passwordHash, 
        passwordStart: user.passwordHash ? user.passwordHash.substring(0, 10) + '...' : 'none'
      } : "No user found");
      
      const bcrypt = await import("bcrypt");
      
      if (user && user.passwordHash) {
        
        
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        console.log("User password comparison result:", isValidPassword);
        
        if (isValidPassword) {
          // Check if user is a manager and if they are active
          if (user.role === 'manager' && !user.isActive) {
            return res.status(403).json({ 
              message: "Your account has been deactivated. Please contact your administrator." 
            });
          }
          authenticatedUser = user;
          userType = 'user';
        }
      }
      
      // If user login failed, try company login
      if (!authenticatedUser) {
        console.log("User login failed, trying company login...");
        const companies = await storage.getAllCompanies();
        const company = companies.data.find(c => c.email === email);
        
        if (company && company.password) {
          
          const isValidCompanyPassword = await bcrypt.compare(password, company.password);
          console.log("Company password comparison result:", isValidCompanyPassword);
          console.log("Company status check:", { 
            isActive: company.isActive, 
            licenseStatus: company.licenseStatus,
            email: company.email 
          });
          
          if (isValidCompanyPassword) {
            // Check if company is suspended - this check MUST come before profile completion check
            // A suspended company has: isActive=false AND licenseStatus="suspended"
            const isSuspended = !company.isActive && company.licenseStatus === "suspended";
            
            console.log("Company status check:", {
              companyId: company.id,
              email: company.email,
              isActive: company.isActive,
              licenseStatus: company.licenseStatus,
              isSuspended: isSuspended
            });
            
            if (isSuspended) {
              console.log("Company login blocked: Company is suspended");
              return res.status(403).json({ 
                message: "Access denied: Your company account has been suspended. Please contact support." 
              });
            }
            
            // Check if company profile is complete (isActive)
            // Only check this if company is NOT suspended
            if (!company.isActive) {
              console.log("Company login successful but profile incomplete - requiring profile completion");
              
              // Generate a cryptographically secure temporary token for profile completion
              const tempToken = crypto.randomBytes(32).toString('hex');
              const tempTokenExpires = Date.now() + (30 * 60 * 1000); // 30 minutes
              
              // Store the temp token in memory (in production, use Redis or database)
              (global as any).profileCompletionTokens = (global as any).profileCompletionTokens || new Map();
              (global as any).profileCompletionTokens.set(tempToken, {
                companyId: company.id,
                email: company.email,
                expires: tempTokenExpires
              });
              
              console.log("Generated secure profile completion token for company:", company.id);
              
              // Return special response requiring profile completion
              return res.status(200).json({
                requiresProfileCompletion: true,
                message: "Please complete your company profile to continue",
                profileToken: tempToken,
                email: company.email,
                companyName: company.name
              });
            }
            
            // Create a user-like object for company
            authenticatedUser = {
              id: `company_${company.id}`,
              email: company.email,
              role: 'company_admin',
              firstName: company.contactPerson.split(' ')[0] || 'Company',
              lastName: company.contactPerson.split(' ').slice(1).join(' ') || 'Admin',
              companyId: company.id,
              companyName: company.name
            };
            userType = 'company';
          }
        }
      }
      
      if (!authenticatedUser) {
        console.log("Both user and company login failed");
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if 2FA is enabled for this user
      console.log("Checking 2FA status for user:", authenticatedUser.email);
      
      // First check if device is trusted and skip 2FA if so
      const isTrustedDevice = await checkTrustedDevice(deviceToken);
      console.log("Is trusted device:", isTrustedDevice);
      
      // Get the secret from database
      let twoFactorSecret = null;
      let twoFactorEnabled = false;
      
      if (userType === 'user') {
        const userRecord = await storage.getUserByEmail(authenticatedUser.email);
        twoFactorSecret = userRecord?.twoFactorSecret;
        twoFactorEnabled = userRecord?.twoFactorEnabled || false;
      } else if (userType === 'company') {
        // For company accounts, check if a pseudo user record exists for 2FA
        const companyUserId = `company_${(authenticatedUser as any).companyId}`;
        const companyUserRecord = await storage.getUserById(companyUserId);
        twoFactorSecret = companyUserRecord?.twoFactorSecret;
        twoFactorEnabled = companyUserRecord?.twoFactorEnabled || false;
      }
      
      console.log("2FA Status:", { enabled: twoFactorEnabled, hasSecret: !!twoFactorSecret });
      
      if (twoFactorEnabled && twoFactorSecret && !isTrustedDevice) {
        console.log("2FA is enabled for user and device not trusted - checking token");
        if (!twoFactorToken) {
          console.log("No 2FA token provided - requiring 2FA");
          return res.status(200).json({ 
            requires2FA: true, 
            message: "Two-factor authentication required",
            tempUserId: authenticatedUser.id
          });
        }
        
        console.log("Verifying 2FA token...");
        const { TwoFactorAuthService } = await import("./twoFactorAuth");
        const isValidToken = TwoFactorAuthService.verifyToken(twoFactorSecret, twoFactorToken);
        if (!isValidToken) {
          console.log("Invalid 2FA token");
          return res.status(400).json({ message: "Invalid 2FA verification code" });
        }
        console.log("2FA token verified successfully");
        
        // If rememberDevice is true, create a trusted device
        if (rememberDevice) {
          try {
            const newDeviceToken = generateDeviceToken();
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
            
            await storage.createTrustedDevice({
              userId: authenticatedUser.id,
              deviceToken: newDeviceToken,
              deviceName: req.headers['user-agent']?.substring(0, 100) || 'Unknown Device',
              userAgent: req.headers['user-agent']?.substring(0, 500) || null,
              ipAddress: req.ip || req.connection.remoteAddress || null,
              expiresAt
            });
            
            // Set device token in response header
            res.setHeader('X-Device-Token', newDeviceToken);
            console.log("Created trusted device with token:", newDeviceToken);
          } catch (error) {
            console.error("Error creating trusted device:", error);
          }
        }
      } else if (twoFactorEnabled && twoFactorSecret && isTrustedDevice) {
        console.log("2FA enabled but device is trusted - skipping 2FA verification");
      } else {
        console.log("2FA not enabled for this user - allowing login");
      }

      // Generate JWT token
      const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        userId: authenticatedUser.id,
        email: authenticatedUser.email,
        role: authenticatedUser.role,
        type: userType,
        companyId: (authenticatedUser as any).companyId || null,
        companyName: (authenticatedUser as any).companyName || null
      };
      
      let token: string;
      try {
        token = generateToken(tokenPayload);
        console.log("JWT token generated successfully");
      } catch (tokenError) {
        console.error("Error generating JWT token:", tokenError);
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ message: "Failed to generate authentication token" });
      }
      
      console.log("Login successful for:", userType === 'company' ? 'company' : 'user', authenticatedUser.id);
      
      // Log audit trail for successful login
      try {
        await AuditLogger.logLogin(authenticatedUser, req);
      } catch (error) {
        console.error("Failed to log login audit:", error);
      }
      
      // Prepare user object for response
      const userResponse = { 
        id: authenticatedUser.id, 
        email: authenticatedUser.email, 
        role: authenticatedUser.role,
        type: userType,
        companyId: (authenticatedUser as any).companyId || null,
        companyName: (authenticatedUser as any).companyName || null
      };
      
      // Force content type to JSON
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ 
        message: "Login successful", 
        token,
        user: userResponse
      });
    } catch (error) {
      console.error("Login error:", error);
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ message: "Login failed" });
    }
  });

  // Register route
  app.post("/api/auth/register", async (req, res) => {
    try {
      console.log("Register route hit with body:", req.body);
      const { email, password, firstName, lastName } = req.body;

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(password, 10);

      const allUsers = await storage.getAllUsers();
      const role = allUsers.length === 0 ? "super_admin" : "manager";

      // Generate unique user ID
      const { nanoid } = await import("nanoid");
      const userId = nanoid();

      console.log("Creating user with ID:", userId);

      const newUser = await storage.createUser({
        id: userId,
        email,
        firstName,
        lastName,
        passwordHash,
        role
      } as any); // Type assertion needed because InsertUser omits id

      // Generate JWT token
      const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        type: 'user'
      };
      
      const token = generateToken(tokenPayload);
      
      console.log("Registration successful for user:", newUser.id);
      console.log("JWT token generated successfully");
      
      // Return user data matching login response format
      res.json({ 
        message: "Registration successful", 
        token,
        user: { 
          id: newUser.id, 
          email: newUser.email, 
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role,
          type: 'user',
          companyId: newUser.companyId || null
        } 
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Company Profile Completion route
  app.post("/api/auth/complete-profile", async (req, res) => {
    try {
      console.log("=== COMPLETE PROFILE ROUTE HIT ===");
      const { profileToken, contactPerson, phone, address } = req.body;
      
      if (!profileToken) {
        return res.status(400).json({ message: "Profile completion token is required" });
      }
      
      // Validate the temporary token
      const profileCompletionTokens = (global as any).profileCompletionTokens || new Map();
      const tokenData = profileCompletionTokens.get(profileToken);
      
      if (!tokenData) {
        return res.status(401).json({ message: "Invalid or expired profile completion token" });
      }
      
      if (tokenData.expires < Date.now()) {
        profileCompletionTokens.delete(profileToken);
        return res.status(401).json({ message: "Profile completion token has expired. Please login again." });
      }
      
      // Get the company using the validated token data
      const companies = await storage.getAllCompanies();
      const company = companies.data.find(c => c.id === tokenData.companyId && c.email === tokenData.email);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      // Check if company is suspended - prevent profile completion for suspended companies
      if (!company.isActive && company.licenseStatus === "suspended") {
        profileCompletionTokens.delete(profileToken);
        return res.status(403).json({ 
          message: "Access denied: Your company account has been suspended. Please contact support." 
        });
      }
      
      // Delete the used token
      profileCompletionTokens.delete(profileToken);
      
      // Update company profile and set isActive to true
      await storage.updateCompany(company.id, {
        contactPerson: contactPerson || company.contactPerson,
        phone: phone || company.phone,
        address: address || company.address,
        isActive: true
      });
      
      console.log("Company profile completed for company:", company.id);
      
      // Create authenticated user object
      const authenticatedUser = {
        id: `company_${company.id}`,
        email: company.email,
        role: 'company_admin',
        firstName: (contactPerson || company.contactPerson).split(' ')[0] || 'Company',
        lastName: (contactPerson || company.contactPerson).split(' ').slice(1).join(' ') || 'Admin',
        companyId: company.id,
        companyName: company.name
      };
      
      // Generate JWT token
      const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        userId: authenticatedUser.id,
        email: authenticatedUser.email,
        role: authenticatedUser.role,
        type: 'company',
        companyId: authenticatedUser.companyId,
        companyName: authenticatedUser.companyName
      };
      
      const token = generateToken(tokenPayload);
      
      // Log audit trail
      try {
        await AuditLogger.log(authenticatedUser, {
          action: "profile_completed",
          entityType: "company",
          entityId: company.id.toString(),
          description: `Company profile completed: ${company.name}`,
          severity: "info"
        }, req);
      } catch (error) {
        console.error("Failed to log profile completion audit:", error);
      }
      
      res.json({ 
        message: "Profile completed successfully",
        token,
        user: {
          id: authenticatedUser.id,
          email: authenticatedUser.email,
          role: authenticatedUser.role,
          type: 'company',
          companyId: authenticatedUser.companyId,
          companyName: authenticatedUser.companyName
        }
      });
    } catch (error) {
      console.error("Profile completion error:", error);
      res.status(500).json({ message: "Failed to complete profile" });
    }
  });

  // Logout route
  app.post("/api/auth/logout", isAuthenticated, async (req, res) => {
    console.log("=== LOGOUT ROUTE HIT ===");
    
    // Get user info for audit log (already set by isAuthenticated middleware)
    const currentUser = (req as any).user;
    
    // Log audit trail for logout
    if (currentUser) {
      try {
        await AuditLogger.logLogout(currentUser, req);
      } catch (error) {
        console.error("Failed to log logout audit:", error);
      }
    }
    
    // JWT tokens are stateless, so we just return success
    // The client is responsible for removing the token
    console.log("Logout successful for user:", currentUser?.email);
    res.setHeader('Content-Type', 'application/json');
    res.json({ message: "Logged out successfully" });
  });

  // Forgot password route
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      // Validate email is provided
      if (!email) {
        return res.status(400).json({ 
          success: false,
          message: "Email is required" 
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ 
          success: false,
          message: "Please enter a valid email address" 
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      console.log("Forgot password request for:", normalizedEmail);

      let userExists = false;
      let userType = 'user';

      // Check if it's a regular user
      const user = await storage.getUserByEmail(normalizedEmail);
      if (user) {
        userExists = true;
        userType = 'user';
      } else {
        // Check if it's a company account
        const companiesResponse = await storage.getAllCompanies();
        const company = companiesResponse.data.find((c: any) => c.email?.toLowerCase() === normalizedEmail);
        if (company) {
          userExists = true;
          userType = 'company';
        }
      }

      // Return error if user doesn't exist
      if (!userExists) {
        return res.status(404).json({ 
          success: false,
          message: "No account found with this email address. Please check your email and try again." 
        });
      }

      // User exists, proceed with password reset
      res.json({ 
        message: "Password reset link has been sent to your email address.",
        success: true 
      });

      // Create reset token (user exists, validated above)
      const resetToken = generateResetToken();
      // 24 hours expiration (matching email template)
      const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000));
      
      try {
        // Store token in database
        await storage.createPasswordResetToken({
          email: normalizedEmail,
          resetToken,
          userType: userType as 'user' | 'company',
          expiresAt
        });

        console.log("Password reset token created:", resetToken, "for", userType, normalizedEmail);
        
        // Send password reset email
        try {
          const emailResult = await sendPasswordResetEmail({
            email: normalizedEmail,
            resetToken,
            userType: userType as 'user' | 'company'
          });
          if (emailResult.success) {
            console.log("Password reset email sent successfully to:", normalizedEmail);
          } else {
            console.log("Password reset email failed, but reset token created. Check console for reset link.");
          }
        } catch (emailError) {
          console.error("Failed to send password reset email:", emailError);
          // Log error but don't fail the request - token is still valid
        }
      } catch (dbError) {
        console.error("Failed to create password reset token:", dbError);
        return res.status(500).json({ 
          success: false,
          message: "Failed to process password reset request. Please try again later." 
        });
      }

    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  // Reset password route
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      // Validate password strength
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }

      // Get token from database
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(newPassword, 10);

      if (resetToken.userType === 'user') {
        // Update user password
        const user = await storage.getUserByEmail(resetToken.email);
        if (user) {
          await storage.updateUserPassword(user.id, passwordHash);
          console.log("User password updated for:", resetToken.email);
        } else {
          return res.status(404).json({ message: "User not found" });
        }
      } else if (resetToken.userType === 'company') {
        // Update company password
        await storage.updateCompanyPassword(resetToken.email, passwordHash);
        console.log("Company password updated for:", resetToken.email);
      }

      // Mark token as used
      await storage.markPasswordResetTokenAsUsed(token);

      res.json({ message: "Password has been reset successfully" });

    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
}

// JWT-based authentication middleware
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      console.log("Authentication failed: No token provided");
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    // Verify the JWT token
    const payload = verifyToken(token);
    
    if (!payload) {
      console.log("Authentication failed: Invalid or expired token");
      return res.status(401).json({ message: "Unauthorized - Invalid or expired token" });
    }

    // Get user data from token payload
    let user: any = null;
    
    if (payload.type === 'company' || payload.userId.startsWith('company_')) {
      // For company users, reconstruct the user object
      const companyId = payload.companyId || parseInt(payload.userId.replace('company_', ''));
      const companies = await storage.getAllCompanies();
      const company = companies.data.find((c: any) => c.id === companyId);
      
      if (company) {
        // Check if company is suspended
        if (!company.isActive && company.licenseStatus === "suspended") {
          console.log("Authentication failed: Company is suspended");
          return res.status(403).json({ 
            message: "Access denied: Your company account has been suspended. Please contact support." 
          });
        }

        user = {
          id: payload.userId,
          email: payload.email,
          role: payload.role || 'company_admin',
          firstName: company.contactPerson.split(' ')[0] || 'Company',
          lastName: company.contactPerson.split(' ').slice(1).join(' ') || 'Admin',
          companyId: company.id,
          companyName: company.name,
          type: 'company'
        };
      }
    } else {
      // For regular users, fetch from database
      const dbUser = await storage.getUserById(payload.userId);
      if (dbUser) {
        // Check if user belongs to a suspended company
        if (dbUser.companyId) {
          const companies = await storage.getAllCompanies();
          const company = companies.data.find((c: any) => c.id === dbUser.companyId);
          if (company && !company.isActive && company.licenseStatus === "suspended") {
            console.log("Authentication failed: User's company is suspended");
            return res.status(403).json({ 
              message: "Access denied: Your company account has been suspended. Please contact support." 
            });
          }
        }

        // Check if user is suspended
        if (!dbUser.isActive) {
          console.log("Authentication failed: User is suspended");
          return res.status(403).json({ 
            message: "Access denied: Your account has been suspended. Please contact support." 
          });
        }

        user = {
          ...dbUser,
          type: 'user'
        };
      }
    }
    
    if (!user) {
      console.log("Authentication failed: User not found");
      return res.status(401).json({ message: "User not found" });
    }

    console.log("User authenticated successfully:", user.email);
    (req as any).user = user;
    return next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ message: "Authentication failed" });
  }
};