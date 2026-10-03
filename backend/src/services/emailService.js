const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const dns = require('dns').promises;
const net = require('net');

class EmailService {
  constructor() {
    this.resendClient = null;
    this.cachedResendApiKey = null;
    this.transporter = null;
    this.resolvedIPv4 = null;
    this.resolvedAt = 0;
    this.DNS_TTL_MS = 5 * 60 * 1000; // 5 minute IPv4 DNS cache
    this.currentConfig = null;
  }

  /**
   * Identifies the active email delivery provider based on environment configuration.
   * Defaults to 'resend' (HTTPS API) for production.
   * @returns {'resend' | 'smtp'}
   */
  getProvider() {
    const configuredProvider = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
    if (configuredProvider === 'smtp') {
      return 'smtp';
    }
    if (configuredProvider === 'resend' || process.env.RESEND_API_KEY) {
      return 'resend';
    }
    // If SMTP credentials are provided without RESEND_API_KEY and provider wasn't explicitly set to resend
    if ((process.env.SMTP_PASS || process.env.EMAIL_PASS) && !process.env.RESEND_API_KEY && configuredProvider !== 'resend') {
      return 'smtp';
    }
    return 'resend';
  }

  /**
   * Initializes or returns the cached Resend API client.
   * @returns {Resend | null}
   */
  getResendClient() {
    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    if (!apiKey) {
      this.resendClient = null;
      this.cachedResendApiKey = null;
      return null;
    }
    if (!this.resendClient || this.cachedResendApiKey !== apiKey) {
      this.resendClient = new Resend(apiKey);
      this.cachedResendApiKey = apiKey;
    }
    return this.resendClient;
  }

  /**
   * Returns the configured sender (FROM) address.
   * Priority: EMAIL_FROM -> SMTP_FROM -> provider default.
   * Note: With Resend, sender domain must be verified in Resend dashboard, or onboarding@resend.dev used during testing.
   * @returns {string}
   */
  getDefaultFromAddress() {
    const rawFrom = (process.env.EMAIL_FROM || process.env.SMTP_FROM || '').trim();
    if (rawFrom) {
      return rawFrom;
    }

    const provider = this.getProvider();
    if (provider === 'resend') {
      // Default placeholder for Resend until custom domain is verified in Resend dashboard
      return 'NEXA Security <onboarding@resend.dev>';
    }

    const smtpUser = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
    if (smtpUser) {
      return `"NEXA Security" <${smtpUser}>`;
    }
    return '"NEXA Security" <noreply@nexa.chat>';
  }

  /**
   * Resolves hostname strictly to an IPv4 address for legacy SMTP connections.
   * @param {string} hostname
   * @returns {Promise<{ ip: string, source: string, family: number, hostname: string }>}
   */
  async resolveIPv4(hostname) {
    if (!hostname) {
      return { ip: '127.0.0.1', source: 'default', family: 4, hostname: 'localhost' };
    }
    if (net.isIP(hostname)) {
      return { ip: hostname, source: 'ip_literal', family: net.isIPv4(hostname) ? 4 : 6, hostname };
    }

    const now = Date.now();
    if (this.resolvedIPv4 && this.resolvedIPv4.hostname === hostname && (now - this.resolvedAt) < this.DNS_TTL_MS) {
      return this.resolvedIPv4;
    }

    // 1. Primary resolution: Query DNS A records explicitly (IPv4 only)
    try {
      const addresses = await dns.resolve4(hostname);
      if (addresses && addresses.length > 0) {
        const ip = addresses[Math.floor(Math.random() * addresses.length)];
        this.resolvedIPv4 = { ip, all: addresses, source: 'dns.resolve4', family: 4, hostname };
        this.resolvedAt = now;
        return this.resolvedIPv4;
      }
    } catch (resolveErr) {
      // Fallback to dns.lookup
    }

    // 2. Fallback resolution: dns.lookup with explicit family: 4 (AF_INET)
    try {
      const lookupRes = await dns.lookup(hostname, { family: 4 });
      if (lookupRes && lookupRes.address) {
        this.resolvedIPv4 = { ip: lookupRes.address, source: 'dns.lookup', family: 4, hostname };
        this.resolvedAt = now;
        return this.resolvedIPv4;
      }
    } catch (lookupErr) {
      console.error(`[Email Service] Failed to resolve IPv4 for ${hostname}:`, lookupErr.message);
    }

    return { ip: hostname, source: 'fallback_hostname', family: 4, hostname };
  }

  /**
   * Initializes or returns the configured Nodemailer transporter for optional/legacy SMTP delivery.
   * @param {boolean} [forceRefresh=false]
   */
  async getTransporter(forceRefresh = false) {
    const rawHost = (process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
    let rawPort = (process.env.SMTP_PORT || process.env.EMAIL_PORT || '587').trim();
    let port = parseInt(rawPort, 10) || 587;
    if (port === 465) {
      port = 587;
    }
    const rawUser = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
    const rawPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || '').replace(/\s+/g, '');

    if (!rawHost || !rawUser || !rawPass) {
      this.transporter = null;
      return null;
    }

    if (!forceRefresh && this.transporter) {
      return this.transporter;
    }

    try {
      const dnsResult = await this.resolveIPv4(rawHost);

      this.transporter = nodemailer.createTransport({
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        host: dnsResult.ip,
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: rawUser, pass: rawPass },
        tls: {
          servername: rawHost,
          rejectUnauthorized: process.env.NODE_ENV === 'production',
          minVersion: 'TLSv1.2'
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000
      });

      this.currentConfig = {
        host: rawHost,
        resolvedAddress: dnsResult.ip,
        port: 587,
        secure: false,
        requireTLS: true,
        family: 4,
        source: dnsResult.source
      };

      return this.transporter;
    } catch (transporterErr) {
      console.error('[Email Service] Failed to initialize nodemailer transporter:', transporterErr.message);
      this.transporter = null;
      return null;
    }
  }

  /**
   * Tests raw TCP socket connectivity (used for diagnostics).
   * @param {string} targetIp
   * @param {number} targetPort
   * @param {number} [timeoutMs=5000]
   */
  async testTcpConnectivity(targetIp, targetPort, timeoutMs = 5000) {
    const startTime = Date.now();
    return new Promise((resolve) => {
      let isSettled = false;
      const socket = new net.Socket();

      const finish = (success, error = null, code = null) => {
        if (isSettled) return;
        isSettled = true;
        const elapsedMs = Date.now() - startTime;
        socket.destroy();
        resolve({
          success,
          targetIp,
          targetPort,
          elapsedMs,
          error: error ? (error.message || String(error)) : null,
          code: code || error?.code || null
        });
      };

      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        finish(true);
      });

      socket.on('timeout', () => {
        finish(false, new Error(`TCP connection timed out after ${timeoutMs}ms`), 'ETIMEDOUT');
      });

      socket.on('error', (err) => {
        finish(false, err, err?.code);
      });

      try {
        socket.connect(targetPort, targetIp);
      } catch (err) {
        finish(false, err, err?.code);
      }
    });
  }

  /**
   * Core unified email dispatcher supporting Resend HTTPS API and SMTP fallback.
   * @param {Object} options
   * @param {string} [options.from]
   * @param {string | string[]} options.to
   * @param {string} options.subject
   * @param {string} options.html
   * @param {string} [options.text]
   * @returns {Promise<{ success: boolean, messageId?: string, provider: string, fallback?: boolean, [key: string]: any }>}
   */
  async sendMail({ from, to, subject, html, text }) {
    const provider = this.getProvider();
    const fromAddress = from || this.getDefaultFromAddress();

    if (provider === 'resend') {
      const resend = this.getResendClient();
      if (!resend) {
        const err = new Error('[Email Service Error]: Cannot dispatch email via Resend HTTPS API. RESEND_API_KEY is not configured in environment variables.');
        err.code = 'NO_EMAIL_CONFIG';
        err.provider = 'resend';
        console.error('[Email Service] Missing RESEND_API_KEY. Configure RESEND_API_KEY in environment.');
        throw err;
      }

      const recipients = Array.isArray(to) ? to : [to];
      console.log(`[Email Service] Dispatching email via Resend HTTPS API to recipient: ${recipients.join(', ')}...`);

      try {
        const { data, error } = await resend.emails.send({
          from: fromAddress,
          to: recipients,
          subject,
          html,
          text
        });

        if (error) {
          const safeError = new Error(`Resend API Error: ${error.message || error.name || 'Email delivery failed'}`);
          safeError.name = error.name || 'ResendApiError';
          safeError.statusCode = error.statusCode;
          safeError.provider = 'resend';
          console.error('[Email Service] Resend HTTPS API Error:', {
            name: error.name,
            statusCode: error.statusCode,
            message: error.message
          });
          throw safeError;
        }

        console.log(`[Email Service] Email successfully sent via Resend HTTPS API (Message ID: ${data?.id || 'OK'})`);
        return {
          success: true,
          messageId: data?.id || null,
          provider: 'resend',
          data
        };
      } catch (err) {
        if (err.provider !== 'resend') {
          console.error('[Email Service] Unexpected Resend delivery error:', err.message);
        }
        throw err;
      }
    }

    // SMTP Fallback (Development / Legacy)
    const transporter = await this.getTransporter();
    if (!transporter) {
      const err = new Error('[Email Service Error]: Cannot dispatch email via SMTP. No SMTP credentials configured in environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS).');
      err.code = 'NO_SMTP_CONFIG';
      err.provider = 'smtp';
      console.error('[Email Service] Missing SMTP credentials.');
      throw err;
    }

    console.log(`[Email Service] Dispatching email via SMTP to recipient: ${Array.isArray(to) ? to.join(', ') : to}...`);
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text,
        html
      });

      console.log(`[Email Service] Email sent via SMTP (Message ID: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
        provider: 'smtp',
        accepted: info.accepted,
        response: info.response
      };
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ESOCKET' || err.code === 'ENETUNREACH') {
        this.resolvedIPv4 = null;
        this.transporter = null;
      }
      console.error('[Email Service] SMTP Delivery Error:', {
        name: err.name,
        code: err.code,
        message: err.message
      });
      throw err;
    }
  }

  /**
   * Diagnostic summary without exposing secrets.
   */
  async diagnoseEnvironment() {
    const provider = this.getProvider();
    const emailFrom = (process.env.EMAIL_FROM || process.env.SMTP_FROM || '').trim();
    const effectiveFrom = this.getDefaultFromAddress();

    if (provider === 'resend') {
      const apiKey = (process.env.RESEND_API_KEY || '').trim();
      const apiKeyConfigured = Boolean(apiKey && apiKey.length > 5);

      console.log('[Email Diagnostic] Resend HTTPS Email Settings:');
      console.log(`  Email Provider: Resend`);
      console.log(`  Email API: HTTPS`);
      console.log(`  EMAIL_FROM: ${emailFrom ? emailFrom : `Using default (${effectiveFrom})`}`);
      console.log(`  RESEND_API_KEY: ${apiKeyConfigured ? 'configured [REDACTED]' : 'NOT CONFIGURED'}`);

      return {
        provider: 'resend',
        transport: 'https',
        configured: apiKeyConfigured,
        apiKeyConfigured,
        senderConfigured: Boolean(emailFrom),
        from: effectiveFrom
      };
    }

    // SMTP Diagnostic
    const rawHost = (process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
    const rawUser = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
    const rawPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || '').replace(/\s+/g, '');

    console.log('[Email Diagnostic] SMTP Settings:');
    console.log(`  Email Provider: SMTP`);
    console.log(`  SMTP host: ${rawHost}`);
    console.log(`  SMTP port: 587`);
    console.log(`  SMTP secure: false`);
    console.log(`  STARTTLS required: true`);
    console.log(`  SMTP user: ${rawUser ? rawUser : 'NOT CONFIGURED'}`);
    console.log(`  SMTP pass: ${rawPass ? 'configured [REDACTED]' : 'NOT CONFIGURED'}`);
    console.log(`  EMAIL_FROM: ${emailFrom ? emailFrom : 'NOT CONFIGURED'}`);

    return {
      provider: 'smtp',
      transport: 'smtp',
      host: rawHost,
      port: 587,
      secure: false,
      requireTLS: true,
      userConfigured: Boolean(rawUser),
      passwordConfigured: Boolean(rawPass),
      senderConfigured: Boolean(emailFrom),
      from: effectiveFrom
    };
  }

  /**
   * Health and verification check without generating test emails.
   */
  async verifyConnection() {
    const provider = this.getProvider();

    if (provider === 'resend') {
      const apiKey = (process.env.RESEND_API_KEY || '').trim();
      const apiKeyConfigured = Boolean(apiKey && apiKey.length > 5);
      const emailFrom = (process.env.EMAIL_FROM || process.env.SMTP_FROM || '').trim();

      return {
        status: apiKeyConfigured ? 'configured' : 'pending_configuration',
        provider: 'resend',
        transport: 'https',
        configured: apiKeyConfigured,
        verified: apiKeyConfigured,
        senderConfigured: Boolean(emailFrom),
        apiKeyConfigured
      };
    }

    // Legacy SMTP check
    const transporter = await this.getTransporter();
    if (!transporter) {
      return {
        status: 'pending_configuration',
        provider: 'smtp',
        transport: 'smtp',
        configured: false,
        verified: false,
        error: 'SMTP credentials not configured in environment'
      };
    }

    try {
      await transporter.verify();
      return {
        status: 'configured',
        provider: 'smtp',
        transport: 'smtp',
        configured: true,
        verified: true
      };
    } catch (err) {
      return {
        status: 'error',
        provider: 'smtp',
        transport: 'smtp',
        configured: true,
        verified: false,
        error: err.message
      };
    }
  }

  /**
   * Safe startup diagnostics check.
   */
  async verifyOnStartup() {
    try {
      const provider = this.getProvider();
      console.log('\n========================================================================');
      console.log('              NEXA BACKEND EMAIL SERVICE STARTUP CHECK                  ');
      console.log('========================================================================');
      console.log(`Email service file/version: emailService.js (v2.0.0)`);
      console.log(`Email provider: ${provider === 'resend' ? 'Resend' : 'SMTP'}`);
      console.log(`Email API: ${provider === 'resend' ? 'HTTPS' : 'SMTP STARTTLS'}`);

      if (provider === 'resend') {
        const apiKey = (process.env.RESEND_API_KEY || '').trim();
        const apiKeyConfigured = Boolean(apiKey && apiKey.length > 5);
        const emailFrom = (process.env.EMAIL_FROM || process.env.SMTP_FROM || '').trim();
        const effectiveFrom = this.getDefaultFromAddress();

        console.log(`Email sender configured: ${Boolean(emailFrom)}`);
        console.log(`Sender address: ${effectiveFrom}`);
        console.log(`API key configured: ${apiKeyConfigured}`);

        if (!apiKeyConfigured) {
          console.log('ℹ️  Resend Status: AWAITING RESEND_API_KEY in environment.');
          console.log('👉 Obtain an API key from https://resend.com/api-keys and configure RESEND_API_KEY in Render.');
        } else {
          console.log('✅ Resend HTTPS provider configured and ready for email delivery.');
        }
      } else {
        const host = (process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
        const user = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
        const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || '').replace(/\s+/g, '');

        console.log(`SMTP host: ${host}`);
        console.log(`SMTP port: 587`);
        console.log(`SMTP user configured: ${Boolean(user)}`);
        console.log(`SMTP pass configured: ${Boolean(pass)}`);
      }
      console.log('========================================================================\n');
    } catch (startupErr) {
      console.error('[Email Service] Unexpected error during email startup check:', startupErr?.message || startupErr);
    }
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
    const fromAddress = this.getDefaultFromAddress();
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
        Hi <strong style="color: #ffffff;">${recipientName}</strong>, we received a request to reset your NEXA account password. Click below to choose a new password.
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

    return await this.sendMail({
      from: fromAddress,
      to,
      subject: 'NEXA Password Reset',
      text: textContent,
      html: htmlContent
    });
  }

  /**
   * Send Email Verification email
   * @param {Object} options
   * @param {string} options.to - Recipient email
   * @param {string} options.name - User name
   * @param {string} options.verificationUrl - Full email verification URL
   */
  async sendVerificationEmail({ to, name, verificationUrl }) {
    const fromAddress = this.getDefaultFromAddress();
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

    try {
      const result = await this.sendMail({
        from: fromAddress,
        to,
        subject: 'Verify Your NEXA Email Address',
        text: textContent,
        html: htmlContent
      });
      return result;
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('\n================== [NEXA EMAIL VERIFICATION FALLBACK] ==================');
        console.log(`To: ${to} (${recipientName})`);
        console.log(`Subject: Verify Your NEXA Email Address`);
        console.log(`Verification URL: ${verificationUrl}`);
        console.log('========================================================================\n');
        return { success: true, fallback: true };
      }
      throw err;
    }
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
    const fromAddress = this.getDefaultFromAddress();
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

    return await this.sendMail({
      from: fromAddress,
      to,
      subject: 'Confirm Your New NEXA Account Email Address',
      text: textContent,
      html: htmlContent
    });
  }

  /**
   * Send Security Notification email (e.g. 2FA enabled/disabled, password changed)
   * @param {Object} options
   */
  async sendSecurityNotificationEmail({ to, name, alertTitle, details, timestamp = new Date() }) {
    const fromAddress = this.getDefaultFromAddress();
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

    try {
      return await this.sendMail({
        from: fromAddress,
        to,
        subject: `NEXA Security Alert: ${alertTitle}`,
        text: textContent,
        html: htmlContent
      });
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('\n================== [NEXA SECURITY ALERT FALLBACK] ==================');
        console.log(`To: ${to} (${recipientName})`);
        console.log(`Alert: ${alertTitle}`);
        console.log(`Details: ${details}`);
        console.log('====================================================================\n');
        return { success: true, fallback: true };
      }
      return { success: false, error: err.message };
    }
  }
}

module.exports = new EmailService();
