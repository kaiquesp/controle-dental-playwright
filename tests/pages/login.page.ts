import { expect, type Locator, type Page } from '@playwright/test';

export class LoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly rememberCheckbox: Locator;
  readonly submitButton: Locator;
  readonly title: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByRole('textbox', { name: 'E-mail' });
    this.passwordInput = page.getByRole('textbox', { name: 'Senha' });
    this.rememberCheckbox = page.locator('#login-lembrar');
    this.submitButton = page.getByRole('button', { name: /Entrar na Plataforma/i });
    this.title = page.getByRole('heading', { name: 'Acesse sua conta' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await expect(this.title).toBeVisible({ timeout: 30_000 });
  }

  async fillCredentials(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async login(email: string, password: string, remember = true): Promise<void> {
    await this.goto();
    await this.fillCredentials(email, password);
    if (remember) {
      await this.rememberCheckbox.check();
    }
    await this.submit();
  }

  async waitForRecaptcha(): Promise<boolean> {
    const recaptchaFrame = this.page.frameLocator('iframe[title*="reCAPTCHA"], iframe[src*="recaptcha"]');
    try {
      await recaptchaFrame.locator('.recaptcha-checkbox-border').waitFor({ timeout: 5_000 });
      return true;
    } catch {
      return false;
    }
  }
}
