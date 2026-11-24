// Teste opcional de navegador. Requer playwright-core e Chromium fornecidos
// pelo ambiente, sem adicioná-los às dependências de produção do projeto.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

if (!process.env.HORIZONTE_PLAYWRIGHT || !process.env.HORIZONTE_CHROMIUM) {
  throw new Error('Defina HORIZONTE_PLAYWRIGHT (arquivo index.mjs) e HORIZONTE_CHROMIUM (executável).');
}
const { chromium } = await import(pathToFileURL(resolve(process.env.HORIZONTE_PLAYWRIGHT)).href);
const browser = await chromium.launch({
  executablePath: process.env.HORIZONTE_CHROMIUM,
  headless: true,
  args: ['--no-sandbox']
});
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'allow' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.HORIZONTE_URL || 'http://127.0.0.1:8080/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.locator('#resultado-contagem').getByText('564 materiais encontrados').waitFor({ timeout: 30000 });
  assert.equal(await page.locator('.resource-row').count(), 12);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: resolve(tmpdir(), 'horizonte-livre-desktop.png'), fullPage: true });
  await page.locator('#busca').fill('Bernoulli');
  assert.match(await page.locator('#resultado-contagem').textContent(), /147 materiais encontrados/);
  await page.locator('.favorite-button').first().click();
  await page.locator('#apenas-favoritos').check();
  assert.match(await page.locator('#resultado-contagem').textContent(), /1 material encontrado/);
  await page.locator('#tarefa').fill('Revisar matemática');
  await page.locator('#tarefa-form button').click();
  assert.equal(await page.getByText('Revisar matemática').count(), 1);
  await page.locator('#minutos').fill('1');
  await page.locator('#minutos').dispatchEvent('change');
  await page.locator('#iniciar').click();
  assert.equal(await page.locator('#pausar').isEnabled(), true);
  await page.locator('#pausar').click();
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.getByText('Revisar matemática').count(), 1);
  await page.locator('#apenas-favoritos').check();
  assert.match(await page.locator('#resultado-contagem').textContent(), /1 material encontrado/);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: resolve(tmpdir(), 'horizonte-livre-mobile.png'), fullPage: true });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#resultado-contagem').getByText('564 materiais encontrados').waitFor({ timeout: 10000 });
  assert.deepEqual(errors, []);
  console.log('Navegador: busca, paginação, favoritos, tarefas, cronômetro, mobile e modo offline verificados.');
} finally {
  await browser.close();
}
