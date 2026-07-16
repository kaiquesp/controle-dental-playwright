# Mapa de Testes E2E — Controle Dental

Documento de rastreabilidade entre specs Playwright, rotas e cenários.

**Última execução (funcional):** 58 testes em `tests/**/funcional/` · smoke + CRUD E2E

---

## Helpers E2E

| Arquivo | Função |
|---------|--------|
| `tests/support/billing-mocks.ts` | Mock `/api/billing/**` + checkout paciente (`E2E_ALLOW_REAL_BILLING=false`) |
| `tests/support/google-calendar-mocks.ts` | Mock `/api/integracoes/google-calendar/**` + overlay `agenda/eventos` |
| `tests/support/crud-helpers.ts` | Prefixo `E2E-`, cleanup via API, CPF válido |
| `tests/support/toast-helpers.ts` | Assert `.p-toast-message` |
| `tests/support/interaction-helpers.ts` | Modais, config tabs, Ifta select |

## Specs funcionais (`tests/**/funcional/`)

| Arquivo | Cenários |
|---------|----------|
| `agenda.funcional.spec.ts` | AG-05–08, AG-14–16 — filtros, modais, visualização |
| `google-calendar.funcional.spec.ts` | **GC-01–13** — sync Perfil / Agenda / Integrações (mock) |
| `pacientes.funcional.spec.ts` | PAC-LIST/Novo + **PAC-CRUD-01** create/delete |
| `financeiro.funcional.spec.ts` | FIN-PAIN/FIN-FLUX modais e busca |
| `modulos.funcional.spec.ts` | REL, EST, PRO, PRO-LAB |
| `configuracoes.funcional.spec.ts` | CFG-FUNC perfil, equipe, convênios, assinatura |
| `shell.funcional.spec.ts` | SHELL-FUNC menu, notificações, sidebar |
| `billing.funcional.spec.ts` | BILL assinatura mockada |
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

## Projeto: chromium — Financeiro (10 testes)

| IDs | Escopo |
|-----|--------|
| FIN-PAIN-01, 03 | Painel principal e novo lançamento |
| FIN | Navegação entre seções (comissões/boletos/NF conforme plano) |
| FIN-FLUX-01–03 | Fluxo de caixa: totais, busca, novo lançamento |

---

## Projeto: chromium — Shell (4 testes)

| IDs | Escopo |
|-----|--------|
| SHELL-02–05 | Logo, menu do usuário, notificações, chat |

---

## Projeto: chromium — Módulos (18 testes)

| Describe | IDs | Escopo |
|----------|-----|--------|
| Configurações | CFG-01, 02, 04 | Hub, abas, perfil, dados da clínica |
| Relatórios | REL-01, 02, 04, 05 | Hub, busca, exportar, gráfico |
| Estoque | EST-01–03 | Tela, novo material, exportar |
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
4. **Financeiro** — seletores atualizados (`nav[aria-label="Seções do financeiro"]`); sem `test.skip()`; módulos ausentes no plano são assertados explicitamente.
5. **Navegação** — sidebar e rotas validam URL final.

---

## Total mapeado

| Projeto | Testes |
|---------|--------|
| setup | 1 |
| chromium-public | 22 |
| chromium | 73 |
| **Total** | **96** |

Cenários funcionais detalhados: [`CENARIOS-CONTROLE-DENTAL.md`](./CENARIOS-CONTROLE-DENTAL.md)
