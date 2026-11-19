import { randomUUID } from 'node:crypto';

const table = 'findelio_customer_reviews';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function reviewInput(body) {
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!Number.isInteger(body?.rating) || body.rating < 1 || body.rating > 5 || text.length < 10 || text.length > 3000) return null;
  return { rating: body.rating, body: text };
}
export function validVersion(value) { return Number.isSafeInteger(value) && value > 0; }
const fail = (status, code) => { throw Object.assign(new Error(code), { status, code }); };
const member = (db, organization, user) => db('organization_members').where({ organization, user, status: 'active' }).forShare().first();

export function registerCustomerReviews(router, { database, env, services, getSchema, logger }, consumeLimit) {
  const wrap = (fn) => async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { await fn(req, res); } catch (error) {
      if (!error.status) logger.error(error, 'Customer review operation failed');
      res.status(error.status || 503).json({ error: error.status ? error.code : 'unavailable' });
    }
  };
  const actor = async (req) => {
    if (!req.accountability?.user) fail(401, 'unauthorized');
    const user = await database('directus_users').where({ id: req.accountability.user, status: 'active' }).first();
    if (!user) fail(403, 'forbidden');
    return user;
  };
  router.get('/customer-reviews', wrap(async (req, res) => {
    const listing = req.query.listing;
    if (typeof listing !== 'string' || !uuid.test(listing)) fail(400, 'invalid_data');
    const company = await database('listings').where({ id: listing, status: 'published' }).first();
    if (!company) fail(404, 'not_found');
    const page = Math.max(0, Math.min(100000, Number.parseInt(req.query.page, 10) || 0));
    const summaryOnly = req.query.summary === "1";
    const [reviews, summary] = await Promise.all([
      summaryOnly ? Promise.resolve([]) : database(table).where({ listing, status: 'approved' }).select('id', 'author_name', 'rating', 'body', 'response', 'responded_at', 'created_at').orderBy('created_at', 'desc').orderBy('id').limit(20).offset(page * 20),
      database(table).where({ listing, status: 'approved' }).count('* as count').avg('rating as average').first(),
    ]);
    let own = null;
    let canReview = false;
    if (!summaryOnly && req.accountability?.user) {
      const user = await actor(req);
      own = await database(table).where({ listing, author: user.id }).select('id', 'rating', 'body', 'status', 'version').first() || null;
      canReview = !await member(database, company.organization, user.id);
    }
    res.json({ data: { reviews, count: Number(summary.count), average: Number(summary.average || 0), own, canReview, authenticated: Boolean(req.accountability?.user) } });
  }));
  router.get('/customer-reviews/mine', wrap(async (req, res) => {
    const user = await actor(req);
    const page = Math.max(0, Math.min(100000, Number.parseInt(req.query.page, 10) || 0));
    const reviews = await database(`${table} as r`).join('listings as l', 'l.id', 'r.listing')
      .where('r.author', user.id)
      .select('r.id', 'r.author_name', 'r.rating', 'r.body', 'r.status', 'r.response', 'r.created_at', 'l.name as listing_name', 'l.slug as listing_slug', 'l.status as listing_status')
      .orderBy('r.created_at', 'desc').orderBy('r.id').limit(21).offset(page * 20);
    res.json({ data: { reviews: reviews.slice(0, 20), more: reviews.length > 20 } });
  }));
  router.get('/customer-reviews/manage', wrap(async (req, res) => {
    const user = await actor(req);
    const admin = req.accountability.admin === true;
    const page = Math.max(0, Math.min(100000, Number.parseInt(req.query.page, 10) || 0));
    let query = database(`${table} as r`).join('listings as l', 'l.id', 'r.listing');
    if (admin) query = query.where('r.status', 'pending');
    else query = query.where('r.status', 'approved').whereExists(database('organization_members as m').select(database.raw('1')).whereRaw('m.organization = l.organization').where({ 'm.user': user.id, 'm.status': 'active' }));
    const reviews = await query.select('r.id', 'r.author_name', 'r.rating', 'r.body', 'r.status', 'r.version', 'r.response', 'r.created_at', 'l.name as listing_name', 'l.slug as listing_slug').orderBy('r.updated_at', 'desc').orderBy('r.id').limit(21).offset(page * 20);
    res.json({ data: { admin, reviews: reviews.slice(0, 20), more: reviews.length > 20 } });
  }));
  router.post('/customer-reviews', wrap(async (req, res) => {
    const user = await actor(req);
    const input = reviewInput(req.body);
    const listing = req.body?.listing;
    if (!input || typeof listing !== 'string' || !uuid.test(listing)) fail(400, 'invalid_data');
    if (!await consumeLimit(`customer-review:${user.id}`, 10, 3600)) fail(429, 'rate_limited');
    const recipient = String(env.ADMIN_NOTIFICATION_EMAIL || '').trim();
    const site = String(env.FINDELIO_SITE_URL || '').replace(/\/$/, '');
    if (!recipient || !site) fail(503, 'unavailable');
    const mail = new services.MailService({ schema: await getSchema(), accountability: req.accountability, knex: database });
    await database.transaction(async trx => {
      // Serialize creation/edits for this author, including concurrent first submissions.
      const currentUser = await trx('directus_users').where({ id: user.id }).forUpdate().first();
      if (currentUser?.status !== 'active') fail(403, 'forbidden');
      const company = await trx('listings').where({ id: listing, status: 'published' }).first();
      if (!company) fail(404, 'not_found');
      if (await member(trx, company.organization, user.id)) fail(403, 'own_company');
      const existing = await trx(table).where({ listing, author: user.id }).forUpdate().first();
      if (existing && (!validVersion(req.body.version) || existing.version !== req.body.version)) fail(409, 'conflict');
      if (existing && existing.rating === input.rating && existing.body === input.body) return;
      const values = { ...input, status: 'pending', updated_at: trx.fn.now(), reviewed_at: null, reviewed_by: null, response: null, response_by: null, responded_at: null };
      if (existing) await trx(table).where({ id: existing.id }).update({ ...values, version: existing.version + 1 });
      else await trx(table).insert({ ...values, id: randomUUID(), listing, author: user.id, author_name: String(user.first_name || 'Mitglied').slice(0, 100) });
      // A rejected mail submission rolls the write back, so the user can retry.
      await mail.send({ to: recipient, subject: `Neue Bewertung: ${company.name}`, template: { name: "customer-review-notification", data: { listingName: company.name, rating: input.rating, reviewBody: input.body, reviewUrl: `${site}/de-ch/dashboard/bewertungen` } }, text: `Eine Bewertung wartet auf Freigabe.\n\nFirma: ${company.name}\nSterne: ${input.rating}/5\n\n${input.body}\n\nPrüfen: ${site}/de-ch/dashboard/bewertungen` });
    });
    res.json({ data: { success: true } });
  }));
  router.patch('/customer-reviews/:id', wrap(async (req, res) => {
    const user = await actor(req);
    if (!uuid.test(req.params.id) || !validVersion(req.body?.version)) fail(400, 'invalid_data');
    if (!await consumeLimit(`customer-review-action:${user.id}`, 120, 3600)) fail(429, 'rate_limited');
    await database.transaction(async trx => {
      const review = await trx(table).where({ id: req.params.id }).forUpdate().first();
      if (!review) fail(404, 'not_found');
      const company = await trx('listings').where({ id: review.listing }).first();
      const action = req.body?.action;
      if (action === 'approve' || action === 'reject') {
        if (req.accountability.admin !== true) fail(403, 'forbidden');
        if (review.status !== 'pending' || review.version !== req.body.version) fail(409, 'conflict');
        await trx(table).where({ id: review.id }).update({ status: action === 'approve' ? 'approved' : 'rejected', reviewed_by: user.id, reviewed_at: trx.fn.now(), version: review.version + 1 });
      } else if (action === 'reply') {
        if (!await member(trx, company.organization, user.id)) fail(403, 'forbidden');
        if (review.status !== 'approved' || review.version !== req.body.version) fail(409, 'conflict');
        const response = typeof req.body.response === 'string' ? req.body.response.trim() : '';
        if (response.length < 1 || response.length > 3000) fail(400, 'invalid_data');
        await trx(table).where({ id: review.id }).update({ response, response_by: user.id, responded_at: trx.fn.now(), version: review.version + 1 });
      } else fail(400, 'invalid_data');
    });
    res.json({ data: { success: true } });
  }));
}
