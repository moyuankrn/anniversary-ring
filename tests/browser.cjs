const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = 18973;
const url = `http://127.0.0.1:${port}/`;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(url)).ok) return; } catch { /* starting */ }
    await pause(100);
  }
  throw new Error('Static server did not start');
}

async function add(page, name, date, repeat, main = false) {
  await page.locator('#add-event').click();
  await page.locator('[name=name]').fill(name);
  await page.locator('[name=date]').fill(date);
  await page.locator(`[name=repeat][value=${repeat}]`).check();
  if (main) await page.locator('[name=main]').check();
  await page.getByRole('button', { name: '保存这个日子' }).click();
}

async function run() {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, acceptDownloads: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('requestfailed', request => errors.push(request.url()));
      page.on('dialog', dialog => dialog.accept());
      await page.goto(url, { waitUntil: 'networkidle' });
      assert.match(await page.locator('#feature').textContent(), /先记下一个/);
      await add(page, '我们第一次见面', '2023-11-20', 'yearly');
      await add(page, '每月的小纪念', '2024-03-31', 'monthly', true);
      await add(page, '冬天的旅行', '2026-12-05', 'once');
      assert.equal(await page.locator('.event-row').count(), 3);
      assert.match(await page.locator('#feature').textContent(), /每月的小纪念/);
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.locator('.event-row').count(), 3, 'records should survive reload');
      if (viewport.width === 1280) await page.screenshot({ path: path.join(root, 'assets', 'preview.png'), fullPage: true });
      const downloadPromise = page.waitForEvent('download');
      await page.locator('#export-data').click();
      const download = await downloadPromise;
      assert.match(download.suggestedFilename(), /^anniversary-ring-.*\.json$/);
      const backupPath = await download.path();
      await page.locator('.event-row').first().click();
      await page.locator('[name=name]').fill('修改过的名字');
      await page.getByRole('button', { name: '保存这个日子' }).click();
      assert.match(await page.locator('#events').textContent(), /修改过的名字/);
      await page.locator('#import-data').setInputFiles(backupPath);
      await page.getByText('我们第一次见面').waitFor();
      assert.doesNotMatch(await page.locator('#events').textContent(), /修改过的名字/);
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await context.close();
      process.stdout.write(`Passed ${viewport.width}px browser flow\n`);
    }
  } finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.kill());
