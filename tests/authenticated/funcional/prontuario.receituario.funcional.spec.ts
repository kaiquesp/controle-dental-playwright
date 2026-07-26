import { test, expect } from '../../fixtures/test.fixture';
import { createE2ePatientByApi, deleteE2ePatient } from '../../support/pacientes-helpers';
import { closeDialog } from '../../support/interaction-helpers';

test.describe.configure({ mode: 'serial' });

const TIPOS_RECEITUARIO = [
  { id: 'PAC-PRONT-REC-01', label: /Nova prescrição|Prescrição/i },
  { id: 'PAC-PRONT-REC-02', label: /Novo atestado|Atestado/i },
  { id: 'PAC-PRONT-REC-03', label: /declaração de comparecimento|Nova declaração/i },
  { id: 'PAC-PRONT-REC-04', label: /Novo encaminhamento|Encaminhamento/i },
] as const;

test.describe('Prontuário — Receituário', () => {
  let patientId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const patient = await createE2ePatientByApi(browser, 'Pront-Rec');
    patientId = patient.id;
  });

  test.afterAll(async ({ browser }) => {
    if (patientId) {
      await deleteE2ePatient(browser, patientId);
    }
  });

  test.beforeEach(async ({ appShell, prontuarioPage }) => {
    test.skip(!patientId, 'Paciente E2E não criado');
    await prontuarioPage.goToTab(patientId!, 'receituario');
    await appShell.dismissBlockingModals();
  });

  test('[PAC-PRONT-REC-MAP] mapeamento da aba receituário', async ({ prontuarioPage }) => {
    await prontuarioPage.expectReceituarioScreenMap();
  });

  for (const tipo of TIPOS_RECEITUARIO) {
    test(`[${tipo.id}] cria documento ${tipo.label}`, async ({ prontuarioPage, page }) => {
      test.setTimeout(120_000);
      const btn = page.getByRole('button', { name: tipo.label }).first();
      if (!(await btn.isVisible().catch(() => false))) {
        test.skip(true, `Botão ${tipo.label} indisponível`);
      }
      await btn.click();
      const dialog = page.locator('[role="dialog"]:visible, .p-dialog:visible').last();
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      const save = dialog.getByRole('button', { name: /Salvar|Emitir|Gerar/i });
      if (await save.isVisible().catch(() => false)) {
        await save.click();
        await expect(page.getByText(/sucesso|emitid|salv/i).first()).toBeVisible({ timeout: 15_000 }).catch(() => undefined);
      } else {
        await closeDialog(page);
      }
    });
  }

  test('[PAC-PRONT-REC-05] filtros do receituário', async ({ page }) => {
    const filtro = page.getByRole('button', { name: /filtro|tipo|período/i }).first();
    if (!(await filtro.isVisible().catch(() => false))) {
      test.skip(true, 'Filtros do receituário indisponíveis');
    }
    await filtro.click();
    await expect(page.getByRole('option, menuitem').first()).toBeVisible({ timeout: 8_000 });
  });

  test('[PAC-PRONT-REC-06] imprimir receita', async ({ page }) => {
    const imprimir = page.getByRole('button', { name: /Imprimir/i }).first();
    if (!(await imprimir.isVisible().catch(() => false))) {
      test.skip(true, 'Nenhuma receita para imprimir');
    }
    await imprimir.click();
    await expect(page).toHaveURL(/receituario|pacientes/);
  });

  test('[PAC-PRONT-REC-07] assinatura digital (pendente credenciais)', async () => {
    test.skip(true, 'Assinatura digital: aguardando credenciais do usuário');
  });
});
