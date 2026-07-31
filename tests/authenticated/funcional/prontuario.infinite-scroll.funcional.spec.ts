import { test, expect } from '../../fixtures/test.fixture';
import type { PatientFormTab } from '../../data/routes';
import { PRONTUARIO_TAB_LABELS } from '../../data/pacientes';
import { createAuthenticatedE2eContext, readAccessToken } from '../../support/crud-helpers';
import { createE2ePatientByApi, deleteE2ePatient } from '../../support/pacientes-helpers';
import {
  expectInfiniteScrollLoadsMore,
  seedDocumentosForInfiniteScroll,
  seedOrcamentosForInfiniteScroll,
  seedPagamentosForInfiniteScroll,
  seedReceituariosForInfiniteScroll,
  seedTratamentosForInfiniteScroll,
} from '../../support/prontuario-list-helpers';

test.describe.configure({ mode: 'serial' });

type InfiniteScrollTabCase = {
  id: string;
  tab: PatientFormTab;
  footerPattern: RegExp;
  loadingPattern: RegExp;
  seed: (
    request: import('@playwright/test').APIRequestContext,
    token: string,
    patientId: string
  ) => Promise<void>;
};

const INFINITE_SCROLL_TAB_CASES: InfiniteScrollTabCase[] = [
  {
    id: 'PAC-PRONT-INF-01',
    tab: 'orcamentos',
    footerPattern: /Exibindo \d+ de \d+ orçamentos/i,
    loadingPattern: /Carregando mais orçamentos/i,
    seed: seedOrcamentosForInfiniteScroll,
  },
  {
    id: 'PAC-PRONT-INF-02',
    tab: 'tratamentos',
    footerPattern: /Exibindo \d+ de \d+ tratamentos/i,
    loadingPattern: /Carregando mais tratamentos/i,
    seed: seedTratamentosForInfiniteScroll,
  },
  {
    id: 'PAC-PRONT-INF-03',
    tab: 'receituario',
    footerPattern: /Exibindo \d+ de \d+ documentos/i,
    loadingPattern: /Carregando mais documentos/i,
    seed: seedReceituariosForInfiniteScroll,
  },
  {
    id: 'PAC-PRONT-INF-04',
    tab: 'documentos',
    footerPattern: /Exibindo \d+ de \d+ documentos/i,
    loadingPattern: /Carregando mais documentos/i,
    seed: seedDocumentosForInfiniteScroll,
  },
  {
    id: 'PAC-PRONT-INF-05',
    tab: 'pagamentos',
    footerPattern: /Exibindo \d+ de \d+ pagamentos/i,
    loadingPattern: /Carregando mais pagamentos/i,
    seed: seedPagamentosForInfiniteScroll,
  },
];

test.describe('Prontuário — scroll infinito nas listagens', () => {
  let patientId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const patient = await createE2ePatientByApi(browser, 'Pront-Inf');
    patientId = patient.id;
  });

  test.afterAll(async ({ browser }) => {
    if (patientId) {
      await deleteE2ePatient(browser, patientId);
    }
  });

  for (const tabCase of INFINITE_SCROLL_TAB_CASES) {
    test(`[${tabCase.id}] carrega mais itens ao rolar na aba ${tabCase.tab}`, async ({
      browser,
      appShell,
      prontuarioPage,
      page,
    }) => {
      test.skip(!patientId, 'Paciente E2E não criado');
      test.setTimeout(120_000);

      const context = await createAuthenticatedE2eContext(browser);
      const authPage = await context.newPage();
      await authPage.goto('/');
      const token = await readAccessToken(authPage);
      if (!token) {
        await context.close();
        test.skip(true, 'Token ausente para seed da aba');
      }
      await tabCase.seed(context.request, token!, patientId!);
      await context.close();

      await prontuarioPage.goToTab(patientId!, 'informacoes');
      await appShell.dismissBlockingModals();

      const tabButton = page.getByRole('tab', { name: PRONTUARIO_TAB_LABELS[tabCase.tab] });
      test.skip(
        !(await tabButton.isVisible().catch(() => false)),
        `Aba ${tabCase.tab} indisponível no plano/permissões da conta E2E`
      );

      await tabButton.click();
      await expect(page).toHaveURL(new RegExp(`/pacientes/${patientId}/edit/${tabCase.tab}`), {
        timeout: 30_000,
      });
      await appShell.dismissBlockingModals();
      await prontuarioPage.expectNoPaginatorOnTab();

      await expectInfiniteScrollLoadsMore(page, {
        footerPattern: tabCase.footerPattern,
        loadingPattern: tabCase.loadingPattern,
      });
    });
  }
});
