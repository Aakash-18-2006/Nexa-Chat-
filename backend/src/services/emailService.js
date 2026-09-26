const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    const rawHost = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com';
    const rawPort = process.env.SMTP_PORT || process.env.EMAIL_PORT || '587';
    const rawUser = process.env.SMTP_USER || process.env.EMAIL_USER || 'akasuran6@gmail.com';
    const rawPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || '';

    const host = rawHost.trim();
    const port = parseInt(rawPort, 10) || 587;
    const user = rawUser.trim();
    // Strip all spaces from app password (handles Google's 'xxxx xxxx xxxx xxxx' 16-char format)
    const pass = rawPass.replace(/\s+/g, '');

    if (host && user && pass) {
      try {
        const isPort465 = port === 465;
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: isPort465, // false for port 587 (uses STARTTLS), true for 465
          auth: { user, pass },
          tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production'
          }
        });
        console.log(`[Email Service] Configured Gmail SMTP transporter (${host}:${port})`);
      } catch (transporterErr) {
        console.error('[Email Service] Failed to initialize nodemailer transporter:', transporterErr.message);
        this.transporter = null;
      }
    } else {
      this.transporter = null;
      console.warn('[Email Service] Notice: SMTP credentials are not fully configured. Provide your 16-char Google App Password in SMTP_PASS to enable real email dispatch.');
    }
  }

  diagnoseEnvironment() {
    const host = (process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
    const port = (process.env.SMTP_PORT || process.env.EMAIL_PORT || '587').trim();
    const user = (process.env.SMTP_USER || process.env.EMAIL_USER || 'akasuran6@gmail.com').trim();
    const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || '').replace(/\s+/g, '');
    const from = (process.env.EMAIL_FROM || process.env.SMTP_FROM || '"NEXA Security" <akasuran6@gmail.com>').trim();

    console.log('[Email Diagnostic] Gmail SMTP Settings:');
    console.log(`  SMTP_HOST: ${host}`);
    console.log(`  SMTP_PORT: ${port}`);
    console.log(`  SMTP_USER: ${user}`);
    console.log(`  SMTP_PASS: ${pass ? 'configured [REDACTED]' : 'NOT CONFIGURED (Waiting for Google App Password)'}`);
    console.log(`  EMAIL_FROM: ${from}`);

    return {
      hostConfigured: !!host,
      userConfigured: !!user,
      passwordConfigured: !!pass,
      fromConfigured: !!from
    };
  }

  async verifyConnection() {
    if (!this.transporter) {
      this.initTransporter();
    }
    if (!this.transporter) {
      return {
        configured: false,
        error: 'SMTP credentials not configured in environment (SMTP_HOST, SMTP_USER, SMTP_PASS)'
      };
    }
    try {
      await this.transporter.verify();
      console.log('[Email Service] Gmail SMTP transporter verified: Connected and authenticated successfully');
      return { configured: true, verified: true };
    } catch (err) {
      console.error('[Email Service] Gmail SMTP verification error:', err.message);
      return { configured: true, verified: false, error: err.message, code: err.code, responseCode: err.responseCode };
    }
  }

  async verifyOnStartup() {
    console.log('\n========================================================================');
    console.log('              NEXA BACKEND GMAIL SMTP STARTUP CHECK                     ');
    console.log('========================================================================');
    const user = (process.env.SMTP_USER || 'akasuran6@gmail.com').trim();
    const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

    if (!pass) {
      console.log('ℹ️  Gmail SMTP Status: AWAITING GOOGLE APP PASSWORD');
      console.log(`   Account: ${user}`);
      console.log('   SMTP_PASS is currently empty in backend/.env.');
      console.log('👉 Follow Step 3 in instructions to create a 16-character App Password');
      console.log('   at https://myaccount.google.com/apppasswords and paste it into backend/.env.');
      console.log('========================================================================\n');
      return;
    }

    console.log('ℹ️  Gmail SMTP Status: CONFIGURATION DETECTED');
    console.log(`   Account: ${user}`);
    console.log('   Testing Gmail SMTP connection...');

    const res = await this.verifyConnection();
    if (res.verified) {
      console.log('✅ SMTP connection successful! Ready to send real verification and reset emails.');
    } else {
      if (res.code === 'EAUTH' || res.responseCode === 535) {
        console.error('❌ SMTP Authentication Failure:');
        console.error('   Gmail rejected credentials (535 BadCredentials).');
        console.error('   Please ensure you generate a 16-character Google App Password (not your regular Gmail password).');
      } else {
        console.error(`❌ SMTP Connection Error: ${res.error}`);
      }
    }
    console.log('========================================================================\n');
  }

  /**
   * Send password reset email
   * @param {Object} options
   * @param {string} options.to - Recipient email
   * @param {string} options.name - User name
   * @param {string} options.resetUrl - Full reset password URL
   * @param {number} [options.expiresInMinutes=30] - Expiration duration in minutes
   */
  async sendPasswordResetEmail({ to, name, resetUrl, expiresInMinutes = 30 }) {
    const fromAddress = process.env.EMAIL_FROM || '"NEXA Security" <akasuran6@gmail.com>';
    const recipientName = name || 'NEXA User';

    const textContent = `
Hello ${recipientName},

You requested a password reset for your NEXA account.

Reset your password by following this link:
${resetUrl}

This link is valid for ${expiresInMinutes} minutes and can only be used once.

If you did not request this password reset, please ignore this email. Your password will remain unchanged.

Best regards,
The NEXA Team
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NEXA Password Reset</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #05070d;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #05070d;
      padding: 40px 0;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #0a0a0f;
      border: 1px solid rgba(64, 201, 255, 0.25);
      border-radius: 24px;
      padding: 36px 32px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
    }
    .logo-badge {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: linear-gradient(135deg, #fc00ff 0%, #8b5cf6 50%, #40c9ff 100%);
      margin: 0 auto 20px auto;
      text-align: center;
      line-height: 48px;
      font-size: 24px;
      font-weight: 900;
      color: #ffffff;
      box-shadow: 0 0 25px rgba(64, 201, 255, 0.35);
    }
    .title {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      text-align: center;
      margin: 0 0 12px 0;
      letter-spacing: -0.5px;
    }
    .lead {
      font-size: 14px;
      line-height: 1.6;
      color: #94a3b8;
      text-align: center;
      margin: 0 0 28px 0;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(90deg, #fc00ff 0%, #8b5cf6 50%, #40c9ff 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      border-radius: 12px;
      box-shadow: 0 0 25px rgba(64, 201, 255, 0.4);
    }
    .fallback {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px;
      font-size: 11px;
      color: #64748b;
      word-break: break-all;
      margin-top: 24px;
    }
    .fallback a {
      color: #40c9ff;
      text-decoration: none;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
    .divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
      margin: 28px 0 20px 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="logo-badge">N</div>
      <h1 class="title">Reset Your Password</h1>
      <p class="lead">
        Hi <strong style="color: #ffffff;">${recipientName}</strong>, we received a request to reset your password for your NEXA account. Click the button below to choose a new password.
      </p>

      <div class="btn-container">
        <a href="${resetUrl}" target="_blank" class="btn">Reset Password</a>
      </div>

      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
        This password reset link expires in <strong>${expiresInMinutes} minutes</strong> and can only be used once.
      </p>

      <div class="fallback">
        If the button above does not work, copy and paste this URL into your browser:<br>
        <a href="${resetUrl}" target="_blank">${resetUrl}</a>
      </div>

      <div class="divider"></div>

      <div class="footer">
        If you did not request a password reset, you can safely ignore this email.<br>
        Your password will not change until you access the link above and create a new one.
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    // 1. Check if SMTP transporter is configured
    if (!this.transporter) {
      this.initTransporter();
    }
    if (!this.transporter) {
      const errMessage = '[Email Service Error]: Cannot dispatch password reset email. No SMTP email provider credentials configured in environment variables (EMAIL_HOST / SMTP_HOST, EMAIL_USER / SMTP_USER, EMAIL_PASSWORD / SMTP_PASS).';
      console.error(errMessage);
      throw new Error(errMessage);
    }

    // 2. Dispatch email via configured SMTP transporter
    console.log(`[Email Service] Attempting to dispatch password reset email to ${to}...`);
    try {
      const info = await this.transporter.sendMail({
        from: fromAddress,
        to,
        subject: 'NEXA Password Reset',
        text: textContent,
        html: htmlContent
      });

      const isAccepted = Array.isArray(info.accepted) && info.accepted.length > 0;
      const isRejected = Array.isArray(info.rejected) && info.rejected.length > 0;

      console.log('[Email Service] Email provider response received:');
      console.log(`  Message ID: ${info.messageId}`);
      console.log(`  Accepted by provider: ${isAccepted ? info.accepted.join(', ') : 'none'}`);
      console.log(`  Rejected by provider: ${isRejected ? info.rejected.join(', ') : 'none'}`);
      console.log(`  Provider server response: ${info.response || 'OK'}`);

      if (isRejected && !isAccepted) {
        throw new Error(`Email provider rejected delivery to ${info.rejected.join(', ')}. Provider response: ${info.response}`);
      }

      return {
        success: true,
        accepted: isAccepted,
        messageId: info.messageId,
        providerResponse: info.response
      };
    } catch (err) {
      console.error('[Email Service] SMTP Provider Delivery Error:', {
        code: err.code,
        command: err.command,
        response: err.response,
        responseCode: err.responseCode,
        message: err.message
      });
      throw err;
    }
  }

  /**
   * Send Email Verification email
   * @param {Object} options
   * @param {string} options.to - Recipient email
   * @param {string} options.name - User name
   * @param {string} options.verificationUrl - Full email verification URL
   */
  async sendVerificationEmail({ to, name, verificationUrl }) {
    const fromAddress = process.env.EMAIL_FROM || '"NEXA Security" <akasuran6@gmail.com>';
    const recipientName = name || 'NEXA User';

    const textContent = `
Hello ${recipientName},

Welcome to NEXA! Please verify your email address to confirm your account:
${verificationUrl}

This verification link expires in 24 hours.

If you did not sign up for a NEXA account, please disregard this email.

Best regards,
The NEXA Team
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your NEXA Email</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #05070d;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #05070d;
      padding: 40px 0;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #0a0a0f;
      border: 1px solid rgba(64, 201, 255, 0.25);
      border-radius: 24px;
      padding: 36px 32px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
    }
    .logo-badge {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: linear-gradient(135deg, #fc00ff 0%, #8b5cf6 50%, #40c9ff 100%);
      margin: 0 auto 20px auto;
      text-align: center;
      line-height: 48px;
      font-size: 24px;
      font-weight: 900;
      color: #ffffff;
      box-shadow: 0 0 25px rgba(64, 201, 255, 0.35);
    }
    .title {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      text-align: center;
      margin: 0 0 12px 0;
      letter-spacing: -0.5px;
    }
    .lead {
      font-size: 14px;
      line-height: 1.6;
      color: #94a3b8;
      text-align: center;
      margin: 0 0 28px 0;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(90deg, #fc00ff 0%, #8b5cf6 50%, #40c9ff 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      border-radius: 12px;
      box-shadow: 0 0 25px rgba(64, 201, 255, 0.4);
    }
    .fallback {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px;
      font-size: 11px;
      color: #64748b;
      word-break: break-all;
      margin-top: 24px;
    }
    .fallback a {
      color: #40c9ff;
      text-decoration: none;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
    .divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
      margin: 28px 0 20px 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="logo-badge">N</div>
      <h1 class="title">Verify Your Email Address</h1>
      <p class="lead">
        Hi <strong style="color: #ffffff;">${recipientName}</strong>, thank you for joining NEXA! Please verify your email to confirm your account.
      </p>

      <div class="btn-container">
        <a href="${verificationUrl}" target="_blank" class="btn">Verify Email Address</a>
      </div>

      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
        This verification link expires in <strong>24 hours</strong>.
      </p>

      <div class="fallback">
        If the button above does not work, copy and paste this URL into your browser:<br>
        <a href="${verificationUrl}" target="_blank">${verificationUrl}</a>
      </div>

      <div class="divider"></div>

      <div class="footer">
        If you did not create a NEXA account, please disregard this email.
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: fromAddress,
          to,
          subject: 'Verify Your NEXA Email Address',
          text: textContent,
          html: htmlContent
        });
        console.log(`[Email Service] Verification email sent to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
      } catch (err) {
        console.error('[Email Service] Failed to send verification email via SMTP:', err.message);
      }
    }

    console.log('\n================== [NEXA EMAIL VERIFICATION] ==================');
    console.log(`To: ${to} (${recipientName})`);
    console.log(`Subject: Verify Your NEXA Email Address`);
    console.log(`Verification URL: ${verificationUrl}`);
    console.log('=================================================================\n');

    return { success: true, fallback: true };
  }

  /**
   * Send Email Change Confirmation to new email address
   * @param {Object} options
   * @param {string} options.to - New recipient email address
   * @param {string} options.name - User display name
   * @param {string} options.confirmationUrl - Secure confirmation link
   * @param {number} [options.expiresInMinutes=30] - Token expiration in minutes
   */
  async sendEmailChangeConfirmation({ to, name, confirmationUrl, expiresInMinutes = 30 }) {
    const fromAddress = process.env.EMAIL_FROM || '"NEXA Security" <akasuran6@gmail.com>';
    const recipientName = name || 'NEXA User';

    const textContent = `
Hello ${recipientName},

You recently requested to change the email address associated with your NEXA account to this address.

To confirm this email change and update your account, click the link below:
${confirmationUrl}

This link is valid for ${expiresInMinutes} minutes and can only be used once.

If you did not make this request, you can safely ignore this email. Your NEXA account will remain associated with its current email address.

Best regards,
NEXA Security Team
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Your New NEXA Email Address</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #05070d;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #05070d;
      padding: 40px 0;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #0a0a0f;
      border: 1px solid rgba(64, 201, 255, 0.25);
      border-radius: 24px;
      padding: 36px 32px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
    }
    .logo-badge {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: linear-gradient(135deg, #fc00ff 0%, #8b5cf6 50%, #40c9ff 100%);
      margin: 0 auto 20px auto;
      text-align: center;
      line-height: 48px;
      font-size: 24px;
      font-weight: 900;
      color: #ffffff;
      box-shadow: 0 0 25px rgba(64, 201, 255, 0.35);
    }
    .title {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      text-align: center;
      margin: 0 0 12px 0;
      letter-spacing: -0.5px;
    }
    .lead {
      font-size: 14px;
      line-height: 1.6;
      color: #94a3b8;
      text-align: center;
      margin: 0 0 28px 0;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(90deg, #fc00ff 0%, #8b5cf6 50%, #40c9ff 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      border-radius: 12px;
      box-shadow: 0 0 25px rgba(64, 201, 255, 0.4);
    }
    .fallback {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px;
      font-size: 11px;
      color: #64748b;
      word-break: break-all;
      margin-top: 24px;
    }
    .fallback a {
      color: #40c9ff;
      text-decoration: none;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
    .divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
      margin: 28px 0 20px 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="logo-badge">N</div>
      <h1 class="title">Confirm Your New Email Address</h1>
      <p class="lead">
        Hi <strong style="color: #ffffff;">${recipientName}</strong>, we received a request to change the primary email address on your NEXA account to <strong style="color: #40c9ff;">${to}</strong>.
      </p>

      <div class="btn-container">
        <a href="${confirmationUrl}" target="_blank" class="btn">Confirm Email Change</a>
      </div>

      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
        This confirmation link expires in <strong>${expiresInMinutes} minutes</strong> and can only be used once.
      </p>

      <div class="fallback">
        If the button above does not work, copy and paste this link into your browser:<br>
        <a href="${confirmationUrl}" target="_blank">${confirmationUrl}</a>
      </div>

      <div class="divider"></div>

      <div class="footer">
        If you did not request this change, you can safely ignore this email.<br>
        Your NEXA account will remain associated with its current email address.
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    if (!this.transporter) {
      this.initTransporter();
    }
    if (!this.transporter) {
      const errMessage = '[Email Service Error]: Cannot dispatch email change confirmation. No SMTP email provider credentials configured in environment variables.';
      console.error(errMessage);
      throw new Error(errMessage);
    }

    try {
      const info = await this.transporter.sendMail({
        from: fromAddress,
        to,
        subject: 'Confirm Your New NEXA Account Email Address',
        text: textContent,
        html: htmlContent
      });

      console.log(`[Email Service] Email change confirmation sent to ${to}: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted
      };
    } catch (err) {
      console.error('[Email Service] Failed to send email change confirmation via SMTP:', err.message);
      throw err;
    }
  }

  /**
   * Send Security Notification email (e.g. 2FA enabled/disabled, password changed)
   * @param {Object} options
   */
  async sendSecurityNotificationEmail({ to, name, alertTitle, details, timestamp = new Date() }) {
    const fromAddress = process.env.EMAIL_FROM || '"NEXA Security" <akasuran6@gmail.com>';
    const recipientName = name || 'NEXA User';

    const textContent = `
Hello ${recipientName},

Security Alert for your NEXA Account:
${alertTitle}

Details: ${details}
Time: ${timestamp.toISOString()}

If this was you, you can safely ignore this email.
If you did not perform this action, please reset your password and review your active sessions immediately.

Best regards,
NEXA Security Team
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>NEXA Security Notification</title>
</head>
<body style="margin: 0; padding: 40px 0; background-color: #05070d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e2e8f0;">
  <div style="max-width: 500px; margin: 0 auto; background: #0a0a0f; border: 1px solid rgba(64, 201, 255, 0.25); border-radius: 20px; padding: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.6);">
    <h2 style="color: #40c9ff; margin-top: 0;">Security Notification</h2>
    <p style="color: #e2e8f0; font-size: 14px;">Hi <strong>${recipientName}</strong>,</p>
    <div style="background: rgba(255, 255, 255, 0.05); border-left: 4px solid #40c9ff; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 6px 0; color: #ffffff; font-size: 15px;">${alertTitle}</h3>
      <p style="margin: 0; color: #94a3b8; font-size: 13px;">${details}</p>
      <p style="margin: 6px 0 0 0; color: #64748b; font-size: 11px;">${timestamp.toUTCString()}</p>
    </div>
    <p style="color: #94a3b8; font-size: 12px; line-height: 1.5;">
      If you authorized this change, no further action is needed. If you did not perform this action, please secure your account immediately.
    </p>
    <div style="border-top: 1px solid rgba(255,255,255,0.08); margin-top: 24px; padding-top: 16px; font-size: 11px; color: #64748b; text-align: center;">
      NEXA Security Team
    </div>
  </div>
</body>
</html>
    `.trim();

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: fromAddress,
          to,
          subject: `NEXA Security Alert: ${alertTitle}`,
          text: textContent,
          html: htmlContent
        });
        return { success: true };
      } catch (err) {
        console.error('[Email Service] Failed to send security email via SMTP:', err.message);
      }
    }

    console.log('\n================== [NEXA SECURITY ALERT] ==================');
    console.log(`To: ${to} (${recipientName})`);
    console.log(`Alert: ${alertTitle}`);
    console.log(`Details: ${details}`);
    console.log('===========================================================\n');

    return { success: true, fallback: true };
  }
}

module.exports = new EmailService();
