const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const M = '/tmp/claude-0/mock/';
const { respond, uid } = require(M + 'data.cjs');
const session = { access_token: 'a.b.c', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 99999, refresh_token: 'r', user: { id: uid, aud: 'authenticated', email: 'sara@example.com' } };
const cookie = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url');
const BASE = 'http://localhost:3125';
const OUT = __dirname + '/shots/';
const REPLY = [
  'Evenings are your weak spot: reading got skipped 3 times this week. Two small changes:\n\n',
  '- Move reading to 22:00, after dinner settles\n- Add a 15-minute weekly budget check for your Emergency Fund\n\n',
  '```action\n{"type":"update_routine","routine":"R2","time":"22:00"}\n```\n',
  '```action\n{"type":"add_routine","activity":"Weekly budget check","time":"19:00","minutes":15,"routine_type":"work","goal":"G1"}\n```',
];
(async () => {
  const browser = await chromium.launch();
  const mk = async (vp, scale = 2.5) => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: scale, colorScheme: 'light', timezoneId: 'UTC' });
    await ctx.addCookies([{ name: 'sb-example-auth-token', value: cookie, url: BASE }]);
    await ctx.route('https://example.supabase.co/**', (route) => {
      const req = route.request();
      if (req.method() !== 'GET' && req.method() !== 'HEAD') {
        const u = req.url();
        const body = u.includes('coach_threads') ? { id: 't-new' } : u.includes('coach_messages') ? { id: 'msg-1' } : {};
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(body) });
      }
      const r = respond(req.url(), req.headers());
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r ? r.body : []) });
    });
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem('lifeos-setup-hidden', '1'));
    await page.clock.install({ time: new Date('2026-10-01T09:26:00Z') });
    page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
    return { ctx, page };
  };
  const phone = { width: 390, height: 844 };
  // Today
  {
    const { ctx, page } = await mk(phone);
    await page.goto(BASE + '/'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);
    await page.screenshot({ path: OUT + 'today.png' });
    const steps = await page.locator('section[aria-label="Next step"]').allInnerTexts();
    console.log('next step:', JSON.stringify(steps));
    const b = page.locator('section[aria-label="Next step"] button', { hasText: 'Mark done' });
    if (await b.count()) { const bb = await b.first().boundingBox(); console.log('markdone box', JSON.stringify(bb)); await b.first().click(); await page.waitForTimeout(900); }
    await page.screenshot({ path: OUT + 'today-after.png' });
    await ctx.close();
  }
  // Coach
  {
    const { ctx, page } = await mk(phone);
    await ctx.route('**/api/chat', async (route) => {
      const routines = respond('https://example.supabase.co/rest/v1/routines?select=*', {});
      const goals = respond('https://example.supabase.co/rest/v1/goals?select=*', {});
      const R = (routines && routines.body) || []; const G = (goals && goals.body) || [];
      const read = R.find((r) => /read/i.test(r.activity)) || R[0];
      route.fulfill({ status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Coach-Refs': encodeURIComponent(JSON.stringify({ G1: G[0] && G[0].id, R2: read && read.id })) }, body: REPLY.join('') });
    });
    await page.goto(BASE + '/'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'AI Coach', exact: true }).filter({ visible: true }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: OUT + 'coach-empty.png' });
    await page.getByPlaceholder('Ask your coach…').fill('I keep skipping my evening reading. Fix my week?');
    await page.screenshot({ path: OUT + 'coach-typed.png' });
    console.log('input box', JSON.stringify(await page.getByPlaceholder('Ask your coach…').boundingBox()));
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Approve' }).first().waitFor();
    await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelectorAll('*').forEach((el) => { if (el.scrollHeight > el.clientHeight + 4 && getComputedStyle(el).overflowY.match(/auto|scroll/)) el.scrollTop = 99999; }));
    await page.waitForTimeout(300);
    await page.screenshot({ path: OUT + 'coach-reply.png' });
    const ap = page.getByRole('button', { name: 'Approve' });
    console.log('approve box', JSON.stringify(await ap.first().boundingBox()));
    await ap.first().click(); await page.waitForTimeout(600);
    await page.screenshot({ path: OUT + 'coach-approved1.png' });
    await ctx.close();
  }
  // Calendar
  {
    const { ctx, page } = await mk(phone);
    await page.addInitScript(() => localStorage.setItem('lifeos-calendar-view', 'day'));
    await page.goto(BASE + '/'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Calendar', exact: true }).filter({ visible: true }).first().click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: OUT + 'cal-day.png' });
    await ctx.close();
  }
  {
    const { ctx, page } = await mk({ width: 820, height: 1180 }, 2);
    await page.addInitScript(() => localStorage.setItem('lifeos-calendar-view', 'month'));
    await page.goto(BASE + '/'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Calendar', exact: true }).filter({ visible: true }).first().click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: OUT + 'cal-month.png' });
    const box = await page.locator('.rounded-2xl.surface').first().boundingBox();
    console.log('cal box', JSON.stringify(box));
    await ctx.close();
  }
  await browser.close();
})();
