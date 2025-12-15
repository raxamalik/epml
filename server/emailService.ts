import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import sgMail from '@sendgrid/mail';
import { 
  getCompanyInvitationTemplate, 
  getPasswordResetTemplate,
  getPlainTextTemplate 
} from './templates/emailTemplates';

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
  const htmlBody = getCompanyInvitationTemplate({
    companyName,
    activationUrl,
    email
  });
  
  const textBody = getPlainTextTemplate('companyInvitation', {
    companyName,
    activationUrl,
    email
  });

  try {
    await sgMail.send({
      to: email,
      from: FROM_EMAIL,
      subject,
      html: htmlBody,
      text: textBody,
    });
    console.log(`Company invitation email sent successfully to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending company invitation email:', error);
    
    // Fallback: Log the activation link to console for development/testing
    console.log("=== EMAIL SENDING FAILED - DEVELOPMENT FALLBACK ===");
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Activation Link: ${activationUrl}`);
    console.log("=== Copy the activation link above to manually send to the company ===");
    
    return { success: false, error: "Email service unavailable", activationUrl };
  }
}

export async function sendPasswordResetEmail({ email, resetToken, userType }: SendResetEmailParams) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  
  const subject = "Password Reset Request";
  const htmlBody = getPasswordResetTemplate({
    email,
    resetUrl,
    userType
  });
  
  const textBody = getPlainTextTemplate('passwordReset', {
    email,
    resetUrl,
    userType
  });

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