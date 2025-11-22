import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import sgMail from '@sendgrid/mail';

// Configure SendGrid API key (optional - email service will log to console if not configured)
if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your-sendgrid-api-key') {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_EMAIL = 'noreply@epml.cz';

interface SendResetEmailParams {
  email: string;
  resetToken: string;
  userType: 'user' | 'company';
}

interface SendInvitationEmailParams {
  email: string;
  companyName: string;
  invitationToken: string;
}

export async function sendCompanyInvitationEmail({ email, companyName, invitationToken }: SendInvitationEmailParams) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  const activationUrl = `${baseUrl}/company-activation?token=${invitationToken}`;
  
  const subject = `Welcome to ${companyName} - Activate Your Business Account`;
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Company Account Activation</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #059669, #0891b2); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: linear-gradient(135deg, #16a34a, #22d3ee); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3); border: 1px solid #15803d; }
        .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 14px; }
        .highlight { background: #e0f2fe; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0; border-radius: 0 6px 6px 0; }
        .steps { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0; }
        .step { margin: 10px 0; padding: 10px; background: #f1f5f9; border-radius: 6px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to EPML!</h1>
          <p>Your business management platform awaits</p>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>Congratulations! Your company <strong>${companyName}</strong> has been successfully registered in our Enterprise Platform Management system.</p>
          
          <div class="highlight">
            <strong>What's Next?</strong><br>
            Click the activation button below to set up your business account and start managing your operations.
          </div>
          
          <p style="text-align: center;">
            <a href="${activationUrl}" class="button">Activate Your Account</a>
          </p>
          
          <div class="steps">
            <h3>Here's what you'll do during activation:</h3>
            <div class="step"><strong>Step 1:</strong> Verify your company information</div>
            <div class="step"><strong>Step 2:</strong> Set up your secure password</div>
            <div class="step"><strong>Step 3:</strong> Configure your business preferences</div>
            <div class="step"><strong>Step 4:</strong> Access your company dashboard</div>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background: #e2e8f0; padding: 10px; border-radius: 4px; font-family: monospace;">
            ${activationUrl}
          </p>
          
          <div class="highlight">
            <strong>Important:</strong>
            <ul>
              <li>This invitation link expires in 7 days</li>
              <li>Once activated, you'll have full access to manage your business</li>
              <li>You can create stores, manage employees, and track analytics</li>
            </ul>
          </div>
          
          <p>If you have any questions during the setup process, our support team is here to help.</p>
          <p>Best regards,<br>EPML Team</p>
        </div>
        <div class="footer">
          <p>This invitation was sent to ${email}. If you didn't expect this email, please contact support.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await sgMail.send({
      to: email,
      from: FROM_EMAIL,
      subject,
      html: htmlBody,
    });
    console.log(`Company invitation email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending company invitation email:', error);
    throw error;
  }
}

export async function sendPasswordResetEmail({ email, resetToken, userType }: SendResetEmailParams) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  
  const subject = "Password Reset Request";
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Password Reset</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 14px; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>We received a request to reset the password for your ${userType === 'company' ? 'company' : 'user'} account associated with <strong>${email}</strong>.</p>
          <p>Click the button below to reset your password:</p>
          <p style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background: #e2e8f0; padding: 10px; border-radius: 4px;">
            ${resetUrl}
          </p>
          <div class="warning">
            <strong>Security Notice:</strong>
            <ul>
              <li>This link will expire in 1 hour for security reasons</li>
              <li>If you didn't request this password reset, please ignore this email</li>
              <li>Never share this reset link with anyone</li>
            </ul>
          </div>
          <p>If you have any questions or concerns, please contact our support team.</p>
          <p>Best regards,<br>EPML Support Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody = `
Password Reset Request

Hello,

We received a request to reset the password for your ${userType === 'company' ? 'company' : 'user'} account associated with ${email}.

To reset your password, please visit the following link:
${resetUrl}

Security Notice:
- This link will expire in 1 hour for security reasons
- If you didn't request this password reset, please ignore this email
- Never share this reset link with anyone

If you have any questions or concerns, please contact our support team.

Best regards,
EPML Support Team

This is an automated message. Please do not reply to this email.
  `;

  const mailOptions = {
    from: FROM_EMAIL,
    to: email,
    subject: subject,
    html: htmlBody,
    text: textBody,
  };

  try {
    const result = await sgMail.send(mailOptions);
    console.log(`Password reset email sent successfully to ${email} via SendGrid`);
    return { success: true, messageId: result[0].headers['x-message-id'] };
  } catch (error) {
    console.error("Failed to send password reset email via SendGrid:", error);
    
    // Fallback: Log the reset link to console for development/testing
    console.log("=== EMAIL SENDING FAILED - DEVELOPMENT FALLBACK ===");
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Reset Link: ${resetUrl}`);
    console.log("=== Copy the reset link above to reset the password ===");
    
    // Don't throw error to prevent breaking the flow
    return { success: false, error: "Email service unavailable" };
  }
}

// Function to verify SendGrid configuration
export async function verifySendGridConfiguration() {
  try {
    // Test if we have the required SendGrid API key
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey || apiKey === 'your-sendgrid-api-key') {
      console.log("Missing or placeholder SENDGRID_API_KEY - email service will use console fallback");
      return false;
    }
    
    // Test the SendGrid connection with a simple validation
    try {
      // Just verify the API key format (SendGrid keys start with 'SG.')
      if (!apiKey.startsWith('SG.')) {
        console.warn("Warning: SendGrid API key format appears invalid (should start with 'SG.')");
        return false;
      }
      console.log("SendGrid configuration verified successfully");
      console.log(`From Email: ${FROM_EMAIL}`);
      console.log("SendGrid API key is configured");
      return true;
    } catch (testError) {
      console.error("SendGrid API key validation failed:", testError);
      return false;
    }
  } catch (error) {
    console.error("SendGrid configuration error:", error);
    return false;
  }
}