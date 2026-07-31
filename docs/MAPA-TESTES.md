# Mapa de Testes E2E — Controle Dental

Documento de rastreabilidade entre specs Playwright, rotas e cenários.

**Última execução (funcional):** 58 testes em `tests/**/funcional/` · smoke + CRUD E2E

---

## Helpers E2E

| Arquivo | Função |
|---------|--------|
| `tests/support/agenda-helpers.ts` | API agenda (eventos, tarefas, compromissos), slots únicos, cleanup `E2E-*` |
| `tests/pages/agenda.page.ts` | Page Object da agenda (modal, filtros, grade, navegação) |
| `tests/data/agenda.ts` | Constantes, seletores e IDs de formulário da agenda |
| `tests/data/pacientes.ts` | Seletores, screen maps e labels das abas do prontuário |
| `tests/pages/pacientes-list.page.ts` | Page Object da listagem `/pacientes/buscar` |
| `tests/pages/paciente-form.page.ts` | Page Object do formulário/edição de paciente |
| `tests/pages/prontuario.page.ts` | Page Object do prontuário (abas, orçamentos, tratamentos, etc.) |
| `tests/support/pacientes-helpers.ts` | Provisionamento/cleanup de paciente E2E, upload de arquivo |
| `tests/support/prontuario-list-helpers.ts` | Seed via API e assertivas de scroll infinito nas listas do prontuário |
| `tests/support/screen-map.ts` | Validação de screen maps e baseline de textos visíveis |
| `tests/support/billing-mocks.ts` | Mock `/api/billing/**`, pagamentos do paciente (Asaas/boleto/link/baixa) e bloqueio de domínios externos (`E2E_ALLOW_REAL_BILLING=false`) |
| `tests/support/google-calendar-mocks.ts` | Mock `/api/integracoes/google-calendar/**` + overlay `agenda/eventos` |
| `tests/support/crud-helpers.ts` | Prefixo `E2E-`, cleanup via API, CPF válido |
| `tests/support/toast-helpers.ts` | Assert `.p-toast-message` |
| `tests/support/interaction-helpers.ts` | Modais, config tabs, Ifta select |
| `tests/data/financeiro.ts` | Seletores, indicadores painel/fluxo, paths gated do financeiro |
| `tests/pages/financeiro.page.ts` | Page Object do financeiro (abas, período, busca, modal lançamento, CRUD, export) |
| `tests/support/financeiro-helpers.ts` | API transações (seed/cleanup), `isFinanceiroSectionAvailable` |
| `tests/data/estoque.ts` | Seletores, KPIs, screen map e IDs do formulário de material |
| `tests/pages/estoque.page.ts` | Page Object do estoque (KPIs, filtros, modal, CRUD) |
| `tests/support/estoque-helpers.ts` | API materiais (seed/cleanup), assertivas de listagem |
| `tests/data/configuracoes.ts` | Seletores, form IDs `#cfg-*`, CTAs, toasts, endpoints API |
| `tests/pages/configuracoes.page.ts` | Page Object do hub Configurações (abas, modais, CRUD UI) |
| `tests/support/configuracoes-helpers.ts` | API seed/cleanup (fornecedores, salas, profissionais, medicamentos, tratamentos) |

## Specs funcionais (`tests/**/funcional/`)

| Arquivo | Cenários |
|---------|----------|
| `agenda.funcional.spec.ts` | AG-05–08, AG-14–16 — smoke de filtros, modais, visualização |
| `agenda.crud.funcional.spec.ts` | **AG-CRUD-01–08** — CRUD Consulta/Compromisso/Tarefa |
| `agenda.status-etiquetas.funcional.spec.ts` | **AG-STS-01–04**, **AG-LBL-01–03** |
| `agenda.filtros.funcional.spec.ts` | **AG-FLT-01–07** — profissional, status, sala |
| `agenda.visualizacao.funcional.spec.ts` | **AG-VIEW-01–06** — Dia/Semana/Mês, navegação |
| `agenda.avancado.funcional.spec.ts` | **AG-ADV-01–05**, **AG-PRT-01–02** |
| `google-calendar.funcional.spec.ts` | **GC-01–13** — sync Perfil / Agenda / Integrações (mock) |
| `pacientes.funcional.spec.ts` | PAC-LIST/Novo + **PAC-CRUD-01** create/delete |
| `pacientes.listagem.funcional.spec.ts` | **PAC-LIST-MAP-01**, **PAC-LIST-12–21** — CRUD listagem, filtros, atalhos, modelos, consulta |
| `pacientes.crud.funcional.spec.ts` | **PAC-CRUD-02** — cadastro/edição/exclusão via UI |
| `prontuario.informacoes.funcional.spec.ts` | **PAC-PRONT-INFO-MAP/01** — mapeamento e edição |
| `prontuario.plano-ficha.funcional.spec.ts` | **PAC-PRONT-PLANO-MAP/01–02** — plano aprovado e ficha clínica |
| `prontuario.orcamentos.funcional.spec.ts` | **PAC-PRONT-ORC-MAP/01–07** — CRUD orçamento, contrato, documento, boleto |
| `prontuario.tratamentos.funcional.spec.ts` | **PAC-PRONT-TRAT-MAP/01–05** — CRUD tratamento e odontograma |
| `prontuario.infinite-scroll.funcional.spec.ts` | **PAC-PRONT-INF-01–05** — scroll infinito nas abas orçamentos, tratamentos, receituário, documentos e pagamentos |
| `prontuario.receituario.funcional.spec.ts` | **PAC-PRONT-REC-MAP/01–07** — prescrição, atestado, declaração, encaminhamento |
| `prontuario.arquivos.funcional.spec.ts` | **PAC-PRONT-ARQ-MAP/01–04** — upload, visualizar, download, excluir |
| `prontuario.anamneses.funcional.spec.ts` | **PAC-PRONT-ANAM-MAP/01–05** — CRUD, pesquisa, modelos |
| `prontuario.documentos.funcional.spec.ts` | **PAC-PRONT-DOC-MAP/01–04** — mesmo fluxo de arquivos |
| `prontuario.pagamentos.funcional.spec.ts` | **PAC-PRONT-PAG-MAP/01–09** — lançamentos, pagar, filtros, extrato, cobrança |
| `financeiro.funcional.spec.ts` | **FIN-PAIN-02–04**, **FIN-FLUX-02–03** — período, modal, link fluxo, busca |
| `financeiro.fluxo-crud.funcional.spec.ts` | **FIN-CRUD-01**, **FIN-CRUD-UI-01**, **FIN-FLUX-04–05** — CRUD lançamentos (serial) |
| `financeiro.comissoes.funcional.spec.ts` | **FIN-COM-01–03** — listagem, configuração, marcar paga *(condicional)* |
| `financeiro.boletos.funcional.spec.ts` | **FIN-BOL-01–04** — listagem, novo boleto, filtros, reenvio *(condicional)* |
| `financeiro.notas-fiscais.funcional.spec.ts` | **FIN-NF-01–03** — histórico, emissão, cancelamento *(condicional)* |
| `estoque.funcional.spec.ts` | **EST-02**, **EST-FLT-01–02**, **EST-CRUD-UI-01** — modal, filtros |
| `estoque.crud.funcional.spec.ts` | **EST-CRUD-01–02**, **EST-04–07** — CRUD material, entrada/saída (serial) |
| `modulos.funcional.spec.ts` | REL, PRO, PRO-LAB |
| `configuracoes.perfil.funcional.spec.ts` | **CFG-FUNC-01**, **CFG-02**, **CFG-03** — perfil, restaurar nome, validação senha |
| `configuracoes.clinica.funcional.spec.ts` | **CFG-04**, **CFG-FUNC-CLINICA-01** — campos e save reversível |
| `configuracoes.notificacoes.funcional.spec.ts` | **CFG-22**, **CFG-FUNC-NOTIF-01** — preferências e toggle |
| `configuracoes.equipe.funcional.spec.ts` | **CFG-05**, **CFG-FUNC-EQUIPE-01** — modal membro + validação |
| `configuracoes.cadastros.funcional.spec.ts` | **CFG-07–11** — dentistas, convênios, fornecedores, salas, pagamentos |
| `configuracoes.cadastros.crud.funcional.spec.ts` | **CFG-CRUD-01–07** — CRUD fornecedor/sala/medicamento (serial + API cleanup) |
| `configuracoes.clinico.funcional.spec.ts` | **CFG-18–21** — tratamentos, anamnese, medicamentos, encaminhamento |
| `configuracoes.comunicacao.funcional.spec.ts` | **CFG-12–13** — modelos e créditos de mensagens |
| `configuracoes.contratos.funcional.spec.ts` | **CFG-16**, **CFG-FUNC-CONTRATO-01** — modelos de contrato |
| `configuracoes.integracoes.funcional.spec.ts` | **CFG-14**, **CFG-15**, **CFG-17** — integrações, plano, comissões |
| `configuracoes.feedback.funcional.spec.ts` | **CFG-FB-01–06** — validação, toast sucesso, erro API interceptado |
| `shell.funcional.spec.ts` | SHELL-FUNC menu, notificações, sidebar |
| `billing.funcional.spec.ts` | BILL assinatura mockada |
| `billing.patient-payments.funcional.spec.ts` | **BILL-PAY-01–03** — mock Asaas/boleto/link/baixa do paciente |
| `prontuario.funcional.spec.ts` | PAC-PRONT-* — 9 abas do prontuário |
| `public/funcional/publico.funcional.spec.ts` | PUB-LOGIN/REC/REG/PORT validações |

---

## Como executar

```bash
# Suíte completa
npx playwright test --workers=1

# Com UI aberta
npx playwright test --headed --workers=1

# Por projeto
npx playwright test --project=chromium-public   # rotas públicas
npx playwright test --project=chromium          # autenticado
```

---

## Autenticação (globalSetup + `test:auth`)

| Mecanismo | Comando | Objetivo |
|-----------|---------|----------|
| `tests/global-setup.ts` | `npm test` (automático) | Valida/regenera `playwright/.auth/user.json` antes da suíte |
| `tests/auth.setup.ts` | `npm run test:auth` ou `npm run test:auth:headed` | Reauth manual (reCAPTCHA) via `playwright.auth.config.ts` |

> Não existe mais `--project=setup`. O projeto único é **`e2e`**.

---

## Projeto: chromium-public (22 testes)

| Arquivo | IDs de cenário | Escopo |
|---------|----------------|--------|
| `login.spec.ts` | PUB-LOGIN-01, 03, 07, 08 | Carregamento de rotas + formulário, credenciais inválidas, links |
| `cookie-consent.spec.ts` | PUB-COOKIE-01–05 | Banner de cookies: exibição, aceite, link da política, persistência |
| `recuperar-senha.spec.ts` | PUB-REC-01, 03 | Formulário e retorno ao login |
| `registro.spec.ts` | PUB-REG-01, 02, 04 | Formulário trial, validação de senha, link para login |
| `portal-titular.spec.ts` | PUB-LGPD-01 | Portal LGPD e abas de direitos |
| `not-found.spec.ts` | PUB-404-01–04 | Tela 404 amigável, foguete, home e voltar |
| `telas-publicas.spec.ts` | PUB-POL/VAL | Política, validar documento/receita |

---

## Projeto: authenticated — Agenda + Google Calendar

| IDs | Escopo |
|-----|--------|
| AG-01, AG-13 | Carregamento e persistência de sessão |
| AG-02 | Alternância Dia / Semana / Mês |
| AG-03, AG-04 | Botão Hoje e navegação entre períodos |
| AUTH-404-01–03 | Tela 404 autenticada, home e atalho Agenda |
| AG-05–08, AG-12, AG-14–16 | Filtros, modais, visualização, imprimir |
| GC-01–07 | Perfil: conectar/sync/alertas/desconectar (mock) |
| GC-08–11, GC-13 | Agenda: atalho, overlay, ocultar, OAuth return |
| GC-12 | Integrações → Ir para Perfil |

---

## Projeto: chromium — Pacientes (9 testes)

| IDs | Escopo |
|-----|--------|
| PAC-LIST-01–09 | Listagem, busca, atalhos, navegação para novo |
| PAC-NOVO-01, 03, 06 | Formulário, validação e cancelamento |
| PAC-PRONT | Rotas de abas do prontuário mapeadas |

---

## Projeto: authenticated — Financeiro (35 testes · 29 pass / 6 skip)

### Smoke — `financeiro.spec.ts` (15 testes)

| IDs | Escopo |
|-----|--------|
| FIN-PAIN-01 | Painel: indicadores, receitas em aberto, seções analíticas |
| FIN-PAIN-03 | Botão novo lançamento abre dialog |
| FIN-TABS-01 | Abas internas visíveis e navegação (Painel, Fluxo, Comissões, Boletos, NF) |
| FIN-FLUX-01–03 | Fluxo: totais, busca, novo lançamento |
| FIN-COM-01, FIN-BOL-01, FIN-NF-01 | Abas condicionais: listagem ou redirect seguro |

### Funcional — `funcional/financeiro*.spec.ts` (20 testes)

| Arquivo | IDs | Escopo |
|---------|-----|--------|
| `financeiro.funcional.spec.ts` | FIN-PAIN-02–04, FIN-FLUX-02–03 | Período, modal, link fluxo, busca |
| `financeiro.fluxo-crud.funcional.spec.ts` | FIN-CRUD-01, FIN-CRUD-UI-01, FIN-FLUX-04–05 | Criar/editar/excluir lançamento; exportar relatório |
| `financeiro.comissoes.funcional.spec.ts` | FIN-COM-01–03 | Comissões por profissional, config, marcar paga |
| `financeiro.boletos.funcional.spec.ts` | FIN-BOL-01–04 | Listagem, novo boleto via paciente, filtros, reenvio |
| `financeiro.notas-fiscais.funcional.spec.ts` | FIN-NF-01–03 | Histórico, emissão, cancelamento |

**Skips esperados (plano/ambiente):** FIN-COM-03 (sem comissão pendente), FIN-BOL-04 (sem boleto na lista), FIN-NF-01–03 (módulo NF indisponível), FIN-FLUX-05 (export indisponível).

```bash
node scripts/e2e-run.mjs app -- --project=authenticated financeiro
```

---

## Projeto: chromium — Shell (4 testes)

| IDs | Escopo |
|-----|--------|
| SHELL-02–05 | Logo, menu do usuário, notificações, chat |

---

## Projeto: chromium — Módulos (18 testes)

| Describe | IDs | Escopo |
|----------|-----|--------|
| Configurações | CFG-01–22, CFG-CRUD, CFG-FB | Hub, todas as abas, CRUD cadastros, feedback |
| Relatórios | REL-01, 02, 04, 05 | Hub, busca, exportar, gráfico |
| Estoque | EST-01–04, EST-MAP | Dashboard, modal, exportar *(condicional)*, tabela |

---

## Projeto: authenticated — Estoque (16 testes · 15 pass · 1 skip)

### Smoke — `estoque.spec.ts` (5 testes)

| IDs | Escopo |
|-----|--------|
| EST-MAP | Mapeamento da tela (KPIs, heading, botão novo material) |
| EST-01 | Dashboard: KPIs e listagem |
| EST-02 | Novo material abre modal |
| EST-03 | Exportar inventário *(skip se botão ausente)* |
| EST-04 | Colunas da tabela ou estado vazio |

### Funcional — `funcional/estoque*.spec.ts` (10 testes)

| Arquivo | IDs | Escopo |
|---------|-----|--------|
| `estoque.funcional.spec.ts` | EST-02, EST-FLT-01–02, EST-CRUD-UI-01 | Modal, filtros categoria/status |
| `estoque.crud.funcional.spec.ts` | EST-CRUD-01–02, EST-04–07 | Criar, alerta baixo, entrada, saída, editar, excluir |

```bash
node scripts/e2e-run.mjs app -- --project=authenticated estoque
```

---

## Projeto: chromium — Módulos (15 testes)

| Describe | IDs | Escopo |
|----------|-----|--------|
| Configurações | CFG-01–22, CFG-CRUD, CFG-FB | Hub, todas as abas, CRUD cadastros, feedback |
| Relatórios | REL-01, 02, 04, 05 | Hub, busca, exportar, gráfico |
| Controle de prótese | PRO-01–03, 06 | Quadro, nova solicitação, busca, laboratórios |
| Laboratórios | PRO-LAB-01, 02, 04 | Listagem, novo, busca |

---

## Projeto: chromium — Navegação sidebar (7 testes)

| Teste | Destino sidebar | Padrão URL |
|-------|----------------|------------|
| navega para Agenda via sidebar | Agenda | `/agenda` |
| navega para Pacientes via sidebar | Pacientes | `/pacientes` |
| navega para Controle de prótese via sidebar | Controle de prótese | `/controle-protese` |
| navega para Financeiro via sidebar | Financeiro | `/financeiro` |
| navega para Estoque via sidebar | Estoque | `/estoque` |
| navega para Relatorios via sidebar | Relatorios | `/relatorios` |
| navega para Configurações via sidebar | Configurações | `/configuracoes` |

---

## Projeto: chromium — Rotas autenticadas (15 testes)

Cada rota em `tests/data/routes.ts` → `AUTHENTICATED_ROUTES`:

| Rota | Nome do teste |
|------|---------------|
| `/agenda` | carrega Agenda |
| `/pacientes/buscar` | carrega Pacientes — Buscar |
| `/pacientes/novo` | carrega Pacientes — Novo |
| `/controle-protese` | carrega Controle de prótese |
| `/controle-protese/laboratorios` | carrega Controle de prótese — Laboratórios |
| `/financeiro` | carrega Financeiro — Painel |
| `/financeiro/fluxo-caixa` | carrega Financeiro — Fluxo de caixa |
| `/financeiro/comissoes` | carrega Financeiro — Comissões *(módulo opcional)* |
| `/financeiro/boletos` | carrega Financeiro — Boletos |
| `/financeiro/notas-fiscais` | carrega Financeiro — Notas fiscais |
| `/estoque` | carrega Estoque |
| `/relatorios` | carrega Relatórios |
| `/configuracoes` | carrega Configurações |
| `/configuracoes/comissoes-profissionais` | carrega Configurações — Comissões profissionais *(opcional)* |
| `/configuracoes/modelos-contrato` | carrega Configurações — Modelos de contrato |

---

## Correções aplicadas nesta rodada

1. **Auth setup** — valida `accessToken` no localStorage antes de reutilizar sessão; evita sobrescrever `user.json` sem credenciais.
2. **Onboarding** — tour guiado marcado como concluído (`controleDentalOnboardingV1`) para impedir redirect forçado para `/agenda`.
3. **Sidebar** — `waitForShellReady()` aguarda renderização assíncrona do menu.
4. **Financeiro** — cobertura completa FIN-PAIN a FIN-NF: Page Object, helpers API (`/financeiro/transacoes`), abas gated com `isFinanceiroSectionAvailable`; CRUD com seed/cleanup via API; boletos via fluxo paciente.
5. **Navegação** — sidebar e rotas validam URL final.

---

## Total mapeado

| Projeto | Testes |
|---------|--------|
| setup | 1 |
| chromium-public | 22 |
| chromium / authenticated | 98+ |
| **Total** | **121+** |

Cenários funcionais detalhados: [`CENARIOS-CONTROLE-DENTAL.md`](./CENARIOS-CONTROLE-DENTAL.md)
