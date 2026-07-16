import { expect, type Locator, type Page } from '@playwright/test';

/** Rota inexistente usada nos cenários E2E de 404. */
export const UNKNOWN_ROUTE = '/rota-inexistente-e2e-404';

export class NotFoundPage {
  readonly root: Locator;
  readonly title: Locator;
  readonly description: Locator;
  readonly rocketImage: Locator;
  readonly goHomeButton: Locator;
  readonly goBackButton: Locator;
  readonly quickLinks: Locator;

  constructor(private readonly page: Page) {
    this.root = page.locator('.not-found-page');
    this.title = page.getByRole('heading', {
      name: /Ops, essa página não apareceu por aqui/i,
    });
    this.description = page.getByText(/link esteja desatualizado|caminho conhecido/i);
    this.rocketImage = page.locator('.not-found-page__illustration-img');
    this.goHomeButton = page.getByRole('button', { name: /Ir para a página inicial/i });
    this.goBackButton = page.getByRole('button', { name: /Voltar para a página anterior/i });
    this.quickLinks = page.getByRole('navigation', { name: /Atalhos úteis/i });
  }

  async goto(path = UNKNOWN_ROUTE): Promise<void> {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(this.root).toBeVisible({ timeout: 30_000 });
  }

  async expectVisible(): Promise<void> {
    await expect(this.root).toBeVisible();
    await expect(this.title).toBeVisible();
    await expect(this.description).toBeVisible();
    await expect(this.goHomeButton).toBeVisible();
    await expect(this.goBackButton).toBeVisible();
  }

  async expectRocketIllustration(): Promise<void> {
    await expect(this.rocketImage).toBeVisible();
    await expect(this.rocketImage).toHaveAttribute('src', /\/svgs\/foguete\.svg/);
  }

  async expectGuestQuickLinks(): Promise<void> {
    await expect(this.quickLinks.getByRole('button', { name: /Entrar/i })).toBeVisible();
    await expect(this.quickLinks.getByRole('button', { name: /Criar conta/i })).toBeVisible();
  }

  async expectAuthenticatedQuickLinks(): Promise<void> {
    await expect(this.quickLinks.getByRole('button', { name: /Agenda/i })).toBeVisible();
    await expect(this.quickLinks.getByRole('button', { name: /Pacientes/i })).toBeVisible();
  }
}
