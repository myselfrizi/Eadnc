const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const [,, mode, ...rest] = process.argv; // mode: stills t1 t2 ... | all
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + __dirname + '/video.html');
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode())); });
  const snap = async (t, path) => { await page.evaluate((t) => window.render(t), t); await page.screenshot({ path, type: 'jpeg', quality: 92 }); };
  if (mode === 'stills') { fs.mkdirSync(__dirname + '/stills', { recursive: true }); for (const t of rest) await snap(+t, `${__dirname}/stills/t${t}.jpg`); }
  else { fs.mkdirSync(__dirname + '/frames', { recursive: true }); const N = Math.round(21.5 * 30); for (let f = 0; f < N; f++) await snap(f / 30, `${__dirname}/frames/f${String(f).padStart(4, '0')}.jpg`); }
  await browser.close();
})();
