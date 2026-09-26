import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { ACCOUNTS, STATE_DIR } from './global-setup';

const as = (role: string) => ({ storageState: join(STATE_DIR, `${role}.json`) });

// Every journey also fails on an uncaught script error or a server error behind the screen.
test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 500) problems.push(`${r.status()} ${r.url()}`);
  });
  (page as Page & { problems: string[] }).problems = problems;
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { problems: string[] }).problems).toStrictEqual([]);
});

test.describe('F-01 sign in', () => {
  test('a wrong PIN is refused on screen, the right one opens the producer home', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel('Numéro de téléphone').fill(ACCOUNTS.producer.phone);
    await page.getByLabel('Code PIN (4 chiffres)').fill('9999');
    await page.getByRole('button', { name: 'Entrer' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/connexion$/);

    await page.getByLabel('Code PIN (4 chiffres)').fill('1234');
    await page.getByRole('button', { name: 'Entrer' }).click();
    await expect(page).toHaveURL(/\/producteur$/);
    await expect(page.getByText('Awa Dossou')).toBeVisible();
  });

  test('a protected screen says who it is for and leads to sign in', async ({ page }) => {
    await page.goto('/tableau');
    await expect(page.getByText(/^Espace réservé : agents de l’ATDA/)).toBeVisible();
    await page.getByRole('link', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/connexion$/);
  });

  test.describe('with a producer account', () => {
    test.use(as('producer'));
    test('the local revenue screen is refused before any call is made', async ({ page }) => {
      const calls: string[] = [];
      page.on('request', (r) => {
        if (r.url().includes('/tax/revenue')) calls.push(r.url());
      });
      await page.goto('/recettes');
      await expect(page.getByText('Votre compte n’a pas accès à cet écran.', { exact: false })).toBeVisible();
      expect(calls).toStrictEqual([]);
    });
  });
});

test.describe('F-05 sowing advice, anonymous', () => {
  test('a verdict with its source is shown, and follows the commune', async ({ page }) => {
    await page.goto('/semis');
    const verdict = page.getByText(/^(Vous pouvez semer|Attendez|Hors saison)$/);
    await expect(verdict).toBeVisible();
    await page.getByLabel('Commune').selectOption({ label: 'Natitingou (Atacora)' });
    await expect(verdict).toBeVisible();
    await expect(page.getByText(/Open-Meteo/).first()).toBeVisible();
  });

  test('crops are chosen with the arrow keys, as a radio group', async ({ page }) => {
    await page.goto('/semis');
    const group = page.getByRole('radiogroup', { name: 'Culture' });
    const checked = group.getByRole('radio', { checked: true });
    const first = await checked.textContent();
    await checked.focus();
    await page.keyboard.press('ArrowRight');
    await expect(group.getByRole('radio', { checked: true })).not.toHaveText(first ?? '');
    await expect(group.getByRole('radio', { checked: true })).toBeFocused();
    await expect(group.locator('[tabindex="0"]')).toHaveCount(1);
  });
});

test.describe('F-09 pesticide check', () => {
  test('a banned product and an unknown one get distinct verdicts', async ({ page }) => {
    await page.goto('/pesticide');
    await page.getByLabel('Nom écrit sur le bidon').fill('SNIPER');
    await page.getByRole('button', { name: 'Vérifier' }).click();
    await expect(page.getByText('Non homologué : ne l’utilisez pas')).toBeVisible();
    await page.getByLabel('Nom écrit sur le bidon').fill('Produit miracle');
    await page.getByRole('button', { name: 'Vérifier' }).click();
    await expect(page.getByText('Produit inconnu', { exact: true })).toBeVisible();
  });
});

test.describe('F-06 pest report to validated alert', () => {
  test.describe.configure({ mode: 'serial' });

  test.describe('producer', () => {
    test.use(as('producer'));
    test('reports caterpillars on maize', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: 9.337, longitude: 2.63 });
      await page.goto('/signaler');
      const send = page.getByRole('button', { name: 'Envoyer le signalement' });
      await expect(send).toBeDisabled();
      await page.getByRole('radiogroup', { name: 'Culture' }).getByRole('radio', { name: 'Maïs' }).click();
      await page.getByRole('radiogroup', { name: 'Symptôme' }).getByRole('radio', { name: 'Chenilles' }).click();
      await send.click();
      await expect(page.getByText('Signalement envoyé')).toBeVisible();
    });
  });

  test.describe('agent', () => {
    test.use(as('agent'));
    test('sees it among the reports and validates it', async ({ page }) => {
      await page.goto('/tableau');
      const tab = page.getByRole('tab', { name: /^Signalements \(\d+\)$/ });
      await tab.click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
      const reports = page.getByRole('tabpanel').getByRole('article').filter({ hasText: 'Maïs · Chenilles' });
      await expect(reports.first()).toBeVisible();
      const before = await reports.count();
      await reports.first().getByRole('button', { name: 'Valider' }).click();
      await expect(reports).toHaveCount(before - 1);
    });

    test('dashboard tabs follow the keyboard pattern', async ({ page }) => {
      await page.goto('/tableau');
      const selected = page.getByRole('tab', { selected: true });
      await expect(selected).toHaveText('Vue d’ensemble');
      await selected.focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('tab', { selected: true })).toHaveText(/^Signalements/);
      await expect(page.getByRole('tab', { selected: true })).toBeFocused();
      await page.keyboard.press('End');
      await expect(page.getByRole('tab', { selected: true })).toHaveText('Interopérabilité');
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('tab', { selected: true })).toHaveText('Vue d’ensemble');
      const labelledBy = await page.getByRole('tabpanel').getAttribute('aria-labelledby');
      expect(await page.locator(`#${labelledBy}`).textContent()).toBe('Vue d’ensemble');
    });
  });
});

test.describe('F-15 offline queue', () => {
  test.use(as('producer'));
  test('a report made without network is kept, then sent when the network returns', async ({ page, context }) => {
    await page.goto('/signaler');
    await page.getByRole('radiogroup', { name: 'Symptôme' }).getByRole('radio', { name: 'Feuilles trouées' }).click();
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Envoyer le signalement' }).click();
    await expect(page.getByText('Signalement enregistré')).toBeVisible();
    const queued = () => page.evaluate(() => JSON.parse(localStorage.getItem('alerteagri:queue') ?? '[]').length);
    expect(await queued()).toBe(1);
    await context.setOffline(false);
    await expect.poll(queued).toBe(0);
  });
});

test.describe('F-10 USSD demo phone', () => {
  test.use(as('producer'));
  test('dials the menu and follows an answer', async ({ page }) => {
    await page.goto('/telephone');
    await page.getByRole('button', { name: 'Composer' }).click();
    const answer = page.getByLabel('Réponse');
    await expect(answer).toBeFocused();
    const screen = page.locator('pre');
    await expect(screen).toContainText('1');
    const menu = await screen.textContent();
    expect(menu!.length).toBeLessThanOrEqual(182);
    await answer.fill('1');
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(screen).not.toHaveText(menu!);
  });
});

test.describe('F-12 / F-13 public verification', () => {
  test('an unknown receipt is declared invalid without any detail', async ({ page }) => {
    await page.goto('/recu/inconnu');
    await expect(page.getByText(/invalide|introuvable/i).first()).toBeVisible();
    await expect(page.getByText(/FCFA/)).toHaveCount(0);
  });

  test('a lot page shows its origin and never a phone number', async ({ page }) => {
    await page.goto('/lot/LOT-DEMO0001');
    await expect(page.getByText('LOT-DEMO0001').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/\+229/);
  });
});

test.describe('F-08 local-language voices', () => {
  test('only a person\'s recording is offered; a synthetic voice is never played, and nothing speaks by itself', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { spoken: number }).spoken = 0;
      window.speechSynthesis.speak = () => {
        (window as unknown as { spoken: number }).spoken += 1;
      };
    });
    await page.route('**/contents', async (route) => {
      const res = await route.fetch();
      const list = await res.json();
      list[0].audios = [
        { lang: 'fon', bytes: 1000, origin: 'SYNTHETIC', transcript: 'Wema', machineTranslated: true, provider: '229langues' },
        { lang: 'bariba', bytes: 1000, origin: 'RECORDED', transcript: null, machineTranslated: false, provider: null },
      ];
      await route.fulfill({ response: res, json: list });
    });
    await page.goto('/fiches');
    const sheet = page.getByRole('article').first();
    await expect(sheet.getByRole('button', { name: 'Écouter en Bariba' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Écouter en Fon' })).toHaveCount(0);
    await expect(page.getByText('229langues')).toHaveCount(0);
    await page.goto('/semis');
    await expect(page.getByText(/^(Vous pouvez semer|Attendez|Hors saison)$/)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { spoken: number }).spoken)).toBe(0);
  });
});

test.describe('F-17 from advice to reminders', () => {
  test.use(as('producer'));
  test('a producer declares a sowing right under the advice, and finds the parcel sown on the home screen', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 9.34, longitude: 2.62 });
    await page.goto('/semis');
    await page.getByRole('radiogroup', { name: 'Culture' }).getByRole('radio', { name: 'Niébé' }).click();
    await expect(page.getByRole('heading', { name: 'Vous avez semé ?' })).toBeVisible();
    await page.getByLabel('Surface semée (hectares)').fill('1.5');
    await page.getByRole('button', { name: 'J’ai semé : enregistrer ma parcelle' }).click();
    await expect(page.getByText('Semis enregistré')).toBeVisible();
    await page.getByRole('link', { name: 'Voir mon champ' }).click();
    await expect(page).toHaveURL(/\/producteur$/);
    await expect(page.getByText(/^Niébé · 1,5 ha$/).first()).toBeVisible();
  });
});

test.describe('Onboarding without an advisor', () => {
  test('a buyer creates an account with a 10-digit number and lands on the market', async ({ page }) => {
    const n = String(Math.floor(1e7 + Math.random() * 8.9e7));
    await page.goto('/connexion');
    await page.getByRole('link', { name: 'Créer mon compte' }).click();
    await page.getByRole('radiogroup', { name: 'Vous êtes' }).getByRole('radio', { name: 'J’achète' }).click();
    await page.getByLabel('Votre nom ou celui de la coopérative').fill('Coopérative Test');
    await page.getByLabel('Numéro de téléphone').fill(`01 ${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 6)} ${n.slice(6)}`);
    await page.getByLabel('Votre commune').selectOption({ label: 'Bohicon (Zou)' });
    await page.getByLabel('Code PIN (4 chiffres)').fill('4821');
    await page.getByLabel('Répétez le code').fill('4821');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page).toHaveURL(/\/marche$/);
  });

  test('two different PINs are caught before anything is sent', async ({ page }) => {
    await page.goto('/inscription');
    await page.getByLabel('Votre nom').fill('Test');
    await page.getByLabel('Numéro de téléphone').fill('01 90 00 00 99');
    await page.getByLabel('Code PIN (4 chiffres)').fill('1111');
    await page.getByLabel('Répétez le code').fill('2222');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.getByRole('alert')).toContainText('pas identiques');
  });
});
