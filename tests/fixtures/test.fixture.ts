import { test as base, expect } from '@playwright/test';
import { AppShellPage } from '../pages/app-shell.page';
import { AgendaPage } from '../pages/agenda.page';
import { LoginPage } from '../pages/login.page';
import { NotFoundPage } from '../pages/not-found.page';
import { PacienteFormPage } from '../pages/paciente-form.page';
import { PacientesListPage } from '../pages/pacientes-list.page';
import { ProntuarioPage } from '../pages/prontuario.page';
import { captureFailureScreenshot } from '../support/screenshot-helper';
import { installAllPaymentMocks, installAllPaymentMocksOnContext } from '../support/billing-mocks';
import { installFeatureMocks, installFeatureMocksOnContext } from '../support/feature-mocks';
import { instrumentVideoCursorOnContext } from '../support/video-cursor';

type AppFixtures = {
  loginPage: LoginPage;
  appShell: AppShellPage;
  agendaPage: AgendaPage;
  notFoundPage: NotFoundPage;
  pacientesListPage: PacientesListPage;
  pacienteFormPage: PacienteFormPage;
  prontuarioPage: ProntuarioPage;
};

export const test = base.extend<AppFixtures>({
  context: async ({ context }, use) => {
    await installAllPaymentMocksOnContext(context);
    await installFeatureMocksOnContext(context);
    await instrumentVideoCursorOnContext(context);
    await use(context);
  },
  page: async ({ page }, use) => {
    await installAllPaymentMocks(page);
    await installFeatureMocks(page);
    await use(page);
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  appShell: async ({ page }, use) => {
    await use(new AppShellPage(page));
  },
  agendaPage: async ({ page }, use) => {
    await use(new AgendaPage(page));
  },
  notFoundPage: async ({ page }, use) => {
    await use(new NotFoundPage(page));
  },
  pacientesListPage: async ({ page }, use) => {
    await use(new PacientesListPage(page));
  },
  pacienteFormPage: async ({ page }, use) => {
    await use(new PacienteFormPage(page));
  },
  prontuarioPage: async ({ page }, use) => {
    await use(new ProntuarioPage(page));
  },
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await captureFailureScreenshot(page, testInfo);
  }
});

export { expect };
