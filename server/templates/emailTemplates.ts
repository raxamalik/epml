/**
 * Email Templates
 * 
 * Centralized email templates for the EPML system.
 * All email templates are defined here for easy maintenance and updates.
 */

export interface EmailTemplateData {
  [key: string]: string | number | undefined;
}

/**
 * Base email template structure
 */
const baseTemplate = (content: string, title: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      margin: 0; 
      padding: 0; 
      background-color: #f4f4f4;
    }
    .email-wrapper {
      max-width: 600px; 
      margin: 0 auto; 
      background-color: #ffffff;
    }
    .header { 
      background: linear-gradient(135deg, #059669, #0891b2); 
      color: white; 
      padding: 40px 30px; 
      text-align: center; 
      border-radius: 8px 8px 0 0; 
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .header p {
      margin: 10px 0 0 0;
      opacity: 0.9;
      font-size: 16px;
    }
    .content { 
      background: #f8fafc; 
      padding: 40px 30px; 
      border-radius: 0 0 8px 8px; 
    }
    .content p {
      margin: 15px 0;
      color: #475569;
      font-size: 16px;
    }
    .button { 
      display: inline-block; 
      background: linear-gradient(135deg, #16a34a, #22d3ee); 
      color: white; 
      padding: 15px 35px; 
      text-decoration: none; 
      border-radius: 8px; 
      margin: 25px 0; 
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3); 
      border: none;
      transition: all 0.3s ease;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(22, 163, 74, 0.4);
    }
    .button-secondary {
      background: linear-gradient(135deg, #2563eb, #3b82f6);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }
    .button-secondary:hover {
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
    }
    .footer { 
      text-align: center; 
      margin-top: 30px; 
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      color: #64748b; 
      font-size: 14px; 
    }
    .highlight { 
      background: #e0f2fe; 
      border-left: 4px solid #0ea5e9; 
      padding: 20px; 
      margin: 25px 0; 
      border-radius: 0 6px 6px 0; 
    }
    .highlight strong {
      color: #0369a1;
      display: block;
      margin-bottom: 10px;
    }
    .warning { 
      background: #fef3c7; 
      border: 1px solid #f59e0b; 
      border-left: 4px solid #f59e0b;
      padding: 20px; 
      border-radius: 0 6px 6px 0; 
      margin: 25px 0; 
    }
    .warning strong {
      color: #d97706;
      display: block;
      margin-bottom: 10px;
    }
    .info-box {
      background: white;
      padding: 20px; 
      border-radius: 8px; 
      margin: 25px 0; 
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .steps { 
      background: white; 
      padding: 25px; 
      border-radius: 8px; 
      margin: 25px 0; 
      border: 1px solid #e2e8f0; 
    }
    .step { 
      margin: 15px 0; 
      padding: 15px; 
      background: #f1f5f9; 
      border-radius: 6px; 
      border-left: 3px solid #0ea5e9;
    }
    .step strong {
      color: #0369a1;
    }
    .link-box {
      word-break: break-all; 
      background: #e2e8f0; 
      padding: 15px; 
      border-radius: 6px; 
      font-family: 'Courier New', monospace;
      font-size: 14px;
      margin: 20px 0;
      color: #1e293b;
    }
    .text-center {
      text-align: center;
    }
    ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    ul li {
      margin: 8px 0;
      color: #475569;
    }
    @media only screen and (max-width: 600px) {
      .content {
        padding: 25px 20px;
      }
      .header {
        padding: 30px 20px;
      }
      .header h1 {
        font-size: 24px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    ${content}
  </div>
</body>
</html>
`;

/**
 * Replace template variables with actual values
 */
function replaceVariables(template: string, data: EmailTemplateData): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value || ''));
  }
  return result;
}

/**
 * Company Invitation Email Template
 */
export function getCompanyInvitationTemplate(data: {
  companyName: string;
  activationUrl: string;
  email: string;
}): string {
  const content = `
    <div class="header">
      <h1>🎉 Welcome to EPML!</h1>
      <p>Your business management platform awaits</p>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>Congratulations! Your company <strong>{{companyName}}</strong> has been successfully registered in our Enterprise Platform Management system.</p>
      
      <div class="highlight">
        <strong>What's Next?</strong><br>
        Click the activation button below to set up your business account and start managing your operations.
      </div>
      
      <p class="text-center">
        <a href="{{activationUrl}}" class="button">Activate Your Account</a>
      </p>
      
      <div class="steps">
        <h3 style="margin-top: 0; color: #1e293b;">Here's what you'll do during activation:</h3>
        <div class="step"><strong>Step 1:</strong> Verify your company information</div>
        <div class="step"><strong>Step 2:</strong> Set up your secure password</div>
        <div class="step"><strong>Step 3:</strong> Configure your business preferences</div>
        <div class="step"><strong>Step 4:</strong> Access your company dashboard</div>
      </div>
      
      <p>Or copy and paste this link into your browser:</p>
      <div class="link-box">{{activationUrl}}</div>
      
      <div class="highlight">
        <strong>Important:</strong>
        <ul>
          <li>This invitation link expires in 7 days</li>
          <li>Once activated, you'll have full access to manage your business</li>
          <li>You can create stores, manage employees, and track analytics</li>
        </ul>
      </div>
      
      <p>If you have any questions during the setup process, our support team is here to help.</p>
      <p>Best regards,<br><strong>EPML Team</strong></p>
    </div>
    <div class="footer">
      <p>This invitation was sent to {{email}}. If you didn't expect this email, please contact support.</p>
      <p style="margin-top: 10px; font-size: 12px;">© ${new Date().getFullYear()} EPML. All rights reserved.</p>
    </div>
  `;

  return baseTemplate(
    replaceVariables(content, data),
    'Company Account Activation'
  );
}

/**
 * Password Reset Email Template
 */
export function getPasswordResetTemplate(data: {
  email: string;
  resetUrl: string;
  userType: 'user' | 'company';
}): string {
  const accountType = data.userType === 'company' ? 'company' : 'user';
  const accountTypeText = data.userType === 'company' ? 'firemnímu' : 'uživatelskému';
  
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Obnova hesla</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f7;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f7; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
          
          <!-- Logo / Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #eaeaec;">
              <div style="width: 56px; height: 56px; background-color: #2563eb; border-radius: 12px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 28px; color: #ffffff; line-height: 56px;">🔐</span>
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #1a1a2e;">Obnova hesla</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #51545e;">
                Dobrý den,
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #51545e;">
                Obdrželi jsme žádost o obnovení hesla k vašemu ${accountTypeText} účtu ({{email}}). Klikněte na tlačítko níže pro nastavení nového hesla.
              </p>
              
              <!-- Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="{{resetUrl}}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 8px;">
                      Obnovit heslo
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #6b6e76;">
                Odkaz je platný po dobu <strong>24 hodin</strong>.
              </p>
              
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6b6e76;">
                Pokud jste o obnovu hesla nežádali, tento email můžete ignorovat. Vaše heslo zůstane nezměněno.
              </p>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #eaeaec;"></div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #9a9ea6;">
                Máte problém s tlačítkem? Zkopírujte tento odkaz do prohlížeče:
              </p>
              <p style="margin: 0 0 20px; font-size: 12px; color: #2563eb; word-break: break-all;">
                {{resetUrl}}
              </p>
              <p style="margin: 0; font-size: 13px; color: #9a9ea6;">
                © ${new Date().getFullYear()} EPML. Všechna práva vyhrazena.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return String(data[key as keyof typeof data] || '');
  });
}

/**
 * Welcome Email Template (for new users)
 */
export function getWelcomeEmailTemplate(data: {
  name: string;
  email: string;
  loginUrl: string;
}): string {
  const content = `
    <div class="header">
      <h1>👋 Welcome to EPML!</h1>
      <p>Your account has been created</p>
    </div>
    <div class="content">
      <p>Hello {{name}},</p>
      <p>Welcome to EPML! Your account has been successfully created and you're ready to get started.</p>
      
      <div class="info-box">
        <strong>Your Account Details:</strong>
        <p style="margin: 10px 0;"><strong>Email:</strong> {{email}}</p>
        <p style="margin: 10px 0;">You can now log in to access your dashboard and start managing your operations.</p>
      </div>
      
      <p class="text-center">
        <a href="{{loginUrl}}" class="button">Go to Dashboard</a>
      </p>
      
      <div class="highlight">
        <strong>Getting Started:</strong>
        <ul>
          <li>Complete your profile setup</li>
          <li>Explore the dashboard features</li>
          <li>Set up your preferences</li>
          <li>Contact support if you need assistance</li>
        </ul>
      </div>
      
      <p>If you have any questions, our support team is here to help.</p>
      <p>Best regards,<br><strong>EPML Team</strong></p>
    </div>
    <div class="footer">
      <p>This email was sent to {{email}}. If you didn't create this account, please contact support.</p>
      <p style="margin-top: 10px; font-size: 12px;">© ${new Date().getFullYear()} EPML. All rights reserved.</p>
    </div>
  `;

  return baseTemplate(
    replaceVariables(content, data),
    'Welcome to EPML'
  );
}

/**
 * Account Activation Success Template
 */
export function getActivationSuccessTemplate(data: {
  name: string;
  email: string;
  loginUrl: string;
}): string {
  const content = `
    <div class="header">
      <h1>✅ Account Activated Successfully!</h1>
      <p>You're all set to get started</p>
    </div>
    <div class="content">
      <p>Hello {{name}},</p>
      <p>Great news! Your account has been successfully activated. You can now access all features of the EPML platform.</p>
      
      <p class="text-center">
        <a href="{{loginUrl}}" class="button">Login to Your Account</a>
      </p>
      
      <div class="info-box">
        <strong>What's Next?</strong>
        <ul>
          <li>Log in with your credentials</li>
          <li>Complete your profile if needed</li>
          <li>Explore the dashboard and features</li>
          <li>Start managing your business operations</li>
        </ul>
      </div>
      
      <p>If you need any assistance, don't hesitate to reach out to our support team.</p>
      <p>Best regards,<br><strong>EPML Team</strong></p>
    </div>
    <div class="footer">
      <p>This email was sent to {{email}}.</p>
      <p style="margin-top: 10px; font-size: 12px;">© ${new Date().getFullYear()} EPML. All rights reserved.</p>
    </div>
  `;

  return baseTemplate(
    replaceVariables(content, data),
    'Account Activated'
  );
}

/**
 * Generate plain text version of email (for email clients that don't support HTML)
 */
export function getPlainTextTemplate(templateName: string, data: EmailTemplateData): string {
  const templates: Record<string, (data: EmailTemplateData) => string> = {
    companyInvitation: (d) => `
Welcome to EPML!

Congratulations! Your company ${d.companyName} has been successfully registered.

Activate your account by visiting:
${d.activationUrl}

This invitation link expires in 7 days.

Best regards,
EPML Team
    `.trim(),
    
    passwordReset: (d) => `
Obnova hesla

Dobrý den,

Obdrželi jsme žádost o obnovení hesla k vašemu účtu (${d.email}).

Obnovte své heslo kliknutím na následující odkaz:
${d.resetUrl}

Odkaz je platný po dobu 24 hodin.

Pokud jste o obnovu hesla nežádali, tento email můžete ignorovat. Vaše heslo zůstane nezměněno.

S pozdravem,
EPML Tým podpory
    `.trim(),
    
    welcome: (d) => `
Welcome to EPML!

Hello ${d.name},

Your account has been successfully created.

Login at: ${d.loginUrl}

Best regards,
EPML Team
    `.trim(),
  };

  const template = templates[templateName];
  if (!template) {
    return 'Email content not available in plain text format.';
  }

  return replaceVariables(template(data), data);
}

