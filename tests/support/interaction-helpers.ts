import { expect, type Locator, type Page } from '@playwright/test';

/** Dialog/modal visível na tela (PrimeNG ou nativo). */
export function visibleDialog(page: Page): Locator {
  return page.locator('[role="dialog"]:visible, .p-dialog:visible, dialog:visible').last();
}

export async function expectDialogOpen(page: Page, contentPattern?: RegExp): Promise<Locator> {
  const dialog = visibleDialog(page);
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  if (contentPattern) {
    await expect(dialog.getByText(contentPattern).first()).toBeVisible();
  }
  return dialog;
}

export async function closeDialog(page: Page): Promise<void> {
  const dialog = visibleDialog(page);
  if (!(await dialog.isVisible().catch(() => false))) {
    return;
  }

  const closeBtn = dialog.getByRole('button', { name: /Cancelar|Fechar|Voltar|×/i }).first();
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }

  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

export async function expectDialogHasFormFields(dialog: Locator, minFields = 1): Promise<void> {
  const fields = dialog.locator('input:visible, textarea:visible, select:visible, [role="combobox"]:visible');
  await expect(fields.first()).toBeVisible({ timeout: 10_000 });
  expect(await fields.count()).toBeGreaterThanOrEqual(minFields);
}

export async function expectSubmitBlocked(
  page: Page,
  submitPattern: RegExp,
  scope: Page | Locator = page
): Promise<void> {
  const submit = scope.getByRole('button', { name: submitPattern }).first();
  await expect(submit).toBeVisible();
  const disabled = await submit.isDisabled().catch(() => false);
  if (disabled) {
    await expect(submit).toBeDisabled();
    return;
  }
  await submit.click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function fillFirstEmptyInput(dialog: Locator, value: string): Promise<void> {
  const input = dialog.locator('input:visible:not([type="hidden"]):not([disabled])').first();
  await expect(input).toBeVisible();
  await input.fill(value);
}

export async function expectMainText(page: Page, pattern: RegExp): Promise<void> {
  await expect(page.locator('main').getByText(pattern).and(page.locator(':visible')).first()).toBeVisible({
    timeout: 15_000,
  });
}

export async function selectIftaByInputId(
  page: Page,
  inputId: string,
  option: string | RegExp,
  scope?: Page | Locator
): Promise<void> {
  const root = scope ?? page;
  const fieldRoot = root.locator(`#${inputId}`).locator('xpath=ancestor::*[contains(@class,"p-iftalabel") or contains(@class,"ifta")][1]');
  const trigger = fieldRoot.locator('[role="combobox"], .p-select-dropdown, [data-pc-section="trigger"]').first();
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.click({ force: true });
  } else {
    await root.locator(`#${inputId}`).click({ force: true });
  }

  const panelOption = page
    .locator('.p-select-overlay .p-select-option, .p-select-list .p-select-option, [role="option"]')
    .filter({ hasText: option })
    .first();
  await panelOption.click({ timeout: 10_000 });
}

export async function selectIftaOption(
  page: Page,
  label: string | RegExp,
  option: string | RegExp,
  scope?: Page | Locator
): Promise<void> {
  const root = scope ?? page;
  const combobox = root.getByRole('combobox', { name: label });
  await combobox.click({ force: true });
  await page.getByRole('option', { name: option }).click();
}

export async function openConfigSection(page: Page, label: string): Promise<void> {
  const tab = page.locator('nav[aria-label="Seções"]').getByRole('button', { name: label });
  await tab.click();
  await expect(tab).toHaveClass(/config__tab--active/);
}
