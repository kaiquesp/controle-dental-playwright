import { expect, type Locator, type Page } from '@playwright/test';
import { dismissAppModals } from '../support/onboarding';

export class AppShellPage {
  readonly sidebar: Locator;
  readonly financeiroNav: Locator;

  constructor(private readonly page: Page) {
    this.sidebar = page.locator('app-sidebar');
    this.financeiroNav = page.locator('nav[aria-label="Seções do financeiro"], .financeiro__tabs');
  }

  async waitForShellReady(): Promise<void> {
    const shell = this.page.locator('app-sidebar, app-dc-mobile-bottom-nav').first();
    await shell.waitFor({ state: 'attached', timeout: 30_000 });
    await expect(this.page.locator('a.side-nav__menu-item, app-dc-mobile-bottom-nav a').first()).toBeAttached({
      timeout: 15_000,
    });
  }

  async expectAuthenticatedShell(): Promise<void> {
    await expect(this.page).not.toHaveURL(/\/login/);
    await this.waitForShellReady();
    await expect(this.page.locator('app-header, app-sidebar, app-dc-mobile-bottom-nav').first()).toBeVisible({
      timeout: 15_000,
    });
  }

  async navigateViaSidebar(label: string): Promise<void> {
    await this.sidebarLink(label).click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async navigateTo(path: string): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.page.goto(path, { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(800);
        await dismissAppModals(this.page);
        return;
      } catch (error) {
        lastError = error;
        await this.page.waitForTimeout(1_000 * attempt);
      }
    }
    throw lastError;
  }

  async expectRouteLoaded(path: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(path.replace(/\//g, '\\/')));
    await this.expectAuthenticatedShell();
  }

  async dismissBlockingModals(): Promise<void> {
    await dismissAppModals(this.page);
  }

  async clickSidebarItem(label: string, pathPattern: RegExp): Promise<void> {
    await this.dismissBlockingModals();
    const link = this.sidebarLink(label).first();
    await expect(link).toBeVisible({ timeout: 15_000 });
    await link.click();
    await this.page.waitForURL(pathPattern, { timeout: 30_000 });
    await this.dismissBlockingModals();
  }

  async openFinanceiroSection(tabLabel: string, path: string): Promise<void> {
    const tab = this.financeiroTab(tabLabel);
    if ((await tab.count()) > 0) {
      await tab.first().click();
      try {
        await this.page.waitForURL(new RegExp(path.replace(/\//g, '\\/')), { timeout: 10_000 });
        return;
      } catch {
        /* fallback para goto */
      }
    }
    await this.navigateTo(path);
  }

  configTab(label: string | RegExp): Locator {
    return this.page.locator('nav[aria-label="Seções"]').getByRole('button', { name: label });
  }

  sidebarLink(label: string): Locator {
    return this.sidebar.locator('a.side-nav__menu-item').filter({ hasText: label });
  }

  financeiroTab(label: string): Locator {
    return this.financeiroNav.getByRole('link', { name: label });
  }
}
