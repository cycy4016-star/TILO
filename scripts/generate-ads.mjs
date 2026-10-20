import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function getOption(name) {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
}

const templatePath = path.join(root, 'scripts', 'ads', 'template.html');
const samplesDir = path.join(root, 'public', 'samples');
const outDir = path.resolve(root, getOption('out') ?? path.join('_shots', 'ads'));

const mimeByExtension = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

function inlineSampleImages(html) {
  const samples = new Map(
    readdirSync(samplesDir).map((file) => [file, path.join(samplesDir, file)]),
  );

  return html.replace(
    /(?:https?:\/\/localhost:3000\/)?samples\/([A-Za-z0-9._-]+)/g,
    (_match, name) => {
      const file = samples.get(name);
      const mime = mimeByExtension.get(path.extname(name).toLowerCase());
      if (!file || !mime) throw new Error(`Unknown sample image: ${name}`);
      return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
    },
  );
}

const html = inlineSampleImages(readFileSync(templatePath, 'utf8'));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 2400 },
    deviceScaleFactor: 1,
  });

  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            }),
      ),
    );
  });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );

  const targets = page.locator('[data-export]');
  const count = await targets.count();
  if (count === 0) throw new Error('No [data-export] targets found in the ad template.');

  for (let index = 0; index < count; index += 1) {
    const target = targets.nth(index);
    const name = await target.getAttribute('data-export');
    if (!name) throw new Error(`Ad target ${index} is missing data-export.`);
    const file = path.join(outDir, name);
    const png = await target.screenshot({ type: 'png' });
    writeFileSync(file, png);
    process.stdout.write(`${path.relative(root, file)}\n`);
  }
} finally {
  await browser.close();
}
