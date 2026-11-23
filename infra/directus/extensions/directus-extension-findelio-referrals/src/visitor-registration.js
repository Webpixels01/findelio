import { createHmac } from 'node:crypto';
import { consumeVerificationBudget } from './verification-budget.js';
import { createRequestLimiter } from '../../directus-extension-findelio-review-notification/dist/request-security.js';
import { isUrlAllowed, emailFailsPublicRegistrationFilter, isCompetingEmailRegistrationError } from './referral-utils.js';
export const VISITOR_ROLE = '5ec800ba-a34e-4bd6-a910-6833e8c61301';
export function visitorInput(body) {
  const first_name = typeof body?.first_name === 'string' ? body.first_name.trim() : '';
  const last_name = typeof body?.last_name === 'string' ? body.last_name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body?.password;
  if (!first_name || first_name.length > 100 || !last_name || last_name.length > 100 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 8 || password.length > 1024 || !/[A-Za-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) return null;
  return { first_name, last_name, email, password };
}
export function registerVisitorRoute(router, { database, env, getSchema, services, logger }, { sendVerificationMail, validatePayload }) {
  const limit = createRequestLimiter(database);
  router.post('/register-visitor', async (req, res) => {
    const input = visitorInput(req.body);
    if (!input || typeof req.body.verification_url !== 'string' || !isUrlAllowed(req.body.verification_url, env.USER_REGISTER_URL_ALLOW_LIST)) return res.status(400).json({ error: 'invalid_data' });
    try {
      const settings = await database('directus_settings').select('public_registration', 'public_registration_email_filter').first();
      if (!settings?.public_registration || emailFailsPublicRegistrationFilter(settings.public_registration_email_filter, input.email, validatePayload)) return res.status(403).json({ error: 'forbidden' });
      const key = createHmac('sha256', String(env.SECRET)).update(String(req.ip || 'unknown')).digest('hex');
      if (!await limit(`visitor-register:${key}`, 30, 3600)) return res.status(429).json({ error: 'rate_limited' });
      const schema = await getSchema();
      let existing = await database('directus_users').whereRaw('lower(email) = ?', [input.email]).first();
      if (!existing) {
        const service = new services.UsersService({ schema, accountability: null, knex: database });
        await service.createOne({ ...input, role: VISITOR_ROLE, status: 'unverified' });
        existing = { role: VISITOR_ROLE, status: 'unverified' };
      }
      // Never change another account's role, password or verification state.
      if (existing.role === VISITOR_ROLE && existing.status === 'unverified' && await consumeVerificationBudget(database, input.email, env.SECRET)) {
        await sendVerificationMail({ MailService: services.MailService, schema, email: input.email, firstName: input.first_name, lastName: input.last_name, verificationUrl: req.body.verification_url, secret: env.SECRET, tokenTtl: env.EMAIL_VERIFICATION_TOKEN_TTL, logger, visitor: true });
      }
      return res.status(204).send();
    } catch (error) {
      if (isCompetingEmailRegistrationError(error)) return res.status(204).send();
      logger.error('Visitor registration failed');
      return res.status(error?.code === 'FAILED_VALIDATION' ? 400 : 503).json({ error: 'registration_failed' });
    }
  });
}
