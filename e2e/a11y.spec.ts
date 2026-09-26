import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { STATE_DIR, type Role } from './global-setup';

// WCAG 2.1 A and AA on every screen, per role, at 360 px and desktop, light and dark (see projects).
const PAGES: { path: string; role?: Role; ready: RegExp }[] = [
  { path: '/', ready: /AlerteAgri/ },
  { path: '/connexion', ready: /Connexion/ },
  { path: '/inscription', ready: /Créer mon compte/ },
  { path: '/semis', ready: /semis/i },
  { path: '/pesticide', ready: /pesticide|produit/i },
  { path: '/fiches', ready: /fiche/i },
  { path: '/telephone', ready: /\*|USSD|téléphone/i },
  { path: '/lot/LOT-DEMO0001', ready: /LOT-DEMO0001/ },
  { path: '/recu/inconnu', ready: /reçu/i },
  { path: '/producteur', role: 'producer', ready: /Awa/ },
  { path: '/signaler', role: 'producer', ready: /signal/i },
  { path: '/recolte', role: 'producer', ready: /récolte/i },
  { path: '/alertes', role: 'producer', ready: /alerte/i },
  { path: '/parcelles', role: 'producer', ready: /parcelle/i },
  { path: '/marche', role: 'buyer', ready: /march/i },
  { path: '/parcelles', role: 'advisor', ready: /parcelle/i },
  { path: '/tableau', role: 'agent', ready: /tableau|alertes/i },
  { path: '/cms', role: 'agent', ready: /fiche/i },
  { path: '/recettes', role: 'commune', ready: /TDL|recette/i },
];

async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  // A readable failure: rule, impact, and the first offending nodes.
  const report = violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n    ')}`);
  expect(report, report.join('\n')).toStrictEqual([]);
}

for (const p of PAGES) {
  test.describe(`${p.path}${p.role ? ` as ${p.role}` : ''}`, () => {
    if (p.role) test.use({ storageState: join(STATE_DIR, `${p.role}.json`) });

    test('has no WCAG 2.1 AA violation', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      // A screen that renders over a failed API call is not a passing screen.
      page.on('response', (r) => {
        if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
      });
      await page.goto(p.path);
      await expect(page.locator('body')).toContainText(p.ready);
      await page.waitForLoadState('networkidle');
      await audit(page);
      expect(errors, 'page errors and server errors').toStrictEqual([]);
    });

    test('does not scroll sideways', async ({ page }) => {
      await page.goto(p.path);
      await expect(page.locator('body')).toContainText(p.ready);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}
