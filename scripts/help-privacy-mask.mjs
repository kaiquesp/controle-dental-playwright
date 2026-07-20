/**
 * Aplica mascaramento de dados pessoais antes do screenshot.
 */
export async function applyPrivacyMask(page) {
  await page.addStyleTag({
    content: `
      .privacy-mask,
      .app-header__user-name,
      .header-user-menu__name,
      .header__clinic-name,
      .patients-rel tbody td,
      .p-datatable-tbody td,
      table tbody td,
      input:not([type="password"]):not([type="checkbox"]):not([type="radio"]),
      textarea,
      [class*="patient-name"],
      [class*="cpf"],
      [class*="telefone"],
      [class*="email"] {
        filter: blur(6px) !important;
      }
    `,
  });

  await page.evaluate(() => {
    const maskText = (selector, replacement) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (el instanceof HTMLElement) {
          el.classList.add('privacy-mask');
          if (el.childElementCount === 0 && el.textContent?.trim()) {
            el.textContent = replacement;
            el.style.filter = 'none';
          }
        }
      });
    };

    maskText('.app-header__user-name, .header-user-menu__name', 'Usuário Exemplo');
    maskText('.header__clinic-name', 'Clínica Exemplo');
    maskText('.patients-rel tbody td:nth-child(2)', 'Paciente Exemplo');
  });
}

export async function waitForShell(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);
}
