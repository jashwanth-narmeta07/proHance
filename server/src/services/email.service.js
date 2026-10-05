import env from '../config/env.js';
import logger from '../config/logger.js';

/**
 * All outbound email goes through this single function. Swapping providers
 * later (SMTP/Resend/SendGrid) means implementing one more case here -
 * nothing else in the codebase should ever construct an email transport
 * directly, per Section: Email service must be abstracted.
 */
async function send({ to, subject, html, text }) {
  switch (env.EMAIL_PROVIDER) {
    case 'console':
    default: {
      logger.info('Email (console transport - not actually sent)', { to, subject });
      // eslint-disable-next-line no-console
      console.log(`\n--- EMAIL to ${to} ---\nSubject: ${subject}\n\n${text || html}\n---\n`);
      return { provider: 'console', accepted: [to] };
    }
    // case 'smtp': return sendViaSmtp({ to, subject, html, text });
    // case 'resend': return sendViaResend({ to, subject, html, text });
    // case 'sendgrid': return sendViaSendgrid({ to, subject, html, text });
  }
}

export async function sendInvitationEmail({ to, organizationName, inviterName, role, acceptUrl }) {
  return send({
    to,
    subject: `You've been invited to join ${organizationName} on Workforce SaaS`,
    text: `${inviterName} invited you to join ${organizationName} as ${role}.\n\nAccept your invitation: ${acceptUrl}\n\nThis link expires in 7 days.`,
  });
}

export async function sendRequestStatusEmail({ to, requestType, status }) {
  return send({
    to,
    subject: `Your ${requestType} request was ${status.toLowerCase()}`,
    text: `Your ${requestType} request has been ${status.toLowerCase()}. Log in to see details.`,
  });
}

export default { send, sendInvitationEmail, sendRequestStatusEmail };
