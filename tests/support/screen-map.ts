import { expect, type Locator, type Page } from '@playwright/test';

export type ScreenMap = {
  headings?: readonly RegExp[];
  tabs?: readonly RegExp[];
  buttons?: readonly RegExp[];
  /** Pelo menos um botão visível que case com o padrão (OR). */
  buttonsAny?: readonly RegExp[];
  placeholders?: readonly RegExp[];
  links?: readonly RegExp[];
  texts?: readonly RegExp[];
};

export async function expectScreenMap(page: Page, map: ScreenMap, scope?: Locator): Promise<void> {
  const root = scope ?? page.locator('main, app-paciente-form-layout, app-paciente-form-content').first();
  const headingScope = scope ?? page.locator('main, app-paciente-form-content, [role="tabpanel"]').first();

  for (const pattern of map.tabs ?? []) {
    await expect(page.getByRole('tab', { name: pattern, selected: true })).toBeVisible({ timeout: 20_000 });
  }

  for (const pattern of map.headings ?? []) {
    await expect(
      headingScope.locator('h1:visible, h2:visible, h3:visible, h4:visible').filter({ hasText: pattern }).first()
    ).toBeVisible({
      timeout: 20_000,
    });
  }

  for (const pattern of map.buttons ?? []) {
    await expect(
      root.getByRole('button', { name: pattern }).or(root.getByRole('link', { name: pattern })).first()
    ).toBeVisible({ timeout: 20_000 });
  }

  if (map.buttonsAny?.length) {
    let anyButton = root.getByRole('button', { name: map.buttonsAny[0] });
    for (const pattern of map.buttonsAny.slice(1)) {
      anyButton = anyButton.or(root.getByRole('button', { name: pattern }));
    }
    await expect(anyButton.first()).toBeVisible({ timeout: 20_000 });
  }

  for (const pattern of map.placeholders ?? []) {
    await expect(root.getByPlaceholder(pattern).first()).toBeVisible({ timeout: 20_000 });
  }

  for (const pattern of map.links ?? []) {
    await expect(
      root.getByRole('link', { name: pattern }).or(root.getByRole('button', { name: pattern })).first()
    ).toBeVisible({ timeout: 20_000 });
  }

  for (const pattern of map.texts ?? []) {
    await expect(headingScope.getByText(pattern).first()).toBeVisible({ timeout: 20_000 });
  }
}

/** Captura textos visíveis para baseline dinâmico (ex.: contrato/documento). */
export async function captureVisibleTexts(page: Page, scope?: Locator): Promise<string[]> {
  const root = scope ?? page.locator('main, .p-dialog:visible').first();
  const texts = await root.locator('h1:visible, h2:visible, h3:visible, p:visible, span:visible, td:visible').evaluateAll(
    (els) =>
      els
        .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter((t) => t.length >= 2 && t.length <= 120)
  );
  return [...new Set(texts)];
}

export async function expectTextsInclude(captured: string[], patterns: RegExp[]): Promise<void> {
  const joined = captured.join(' | ');
  for (const pattern of patterns) {
    expect(joined).toMatch(pattern);
  }
}
