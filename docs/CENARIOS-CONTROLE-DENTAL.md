# Cenários e Fluxos — Controle Dental

Documento gerado a partir de exploração automatizada da aplicação em **https://app.controledental.com.br** com navegador visível (`HEADED=1`) e execução dos testes E2E com `--headed`.

**Data da exploração:** 04/07/2026  
**Clínica de teste:** Clinica miguel yunes (Matriz)  
**Usuário de teste:** admin

---

## Sumário

1. [Visão geral da aplicação](#visão-geral-da-aplicação)
2. [Fluxos públicos (sem autenticação)](#fluxos-públicos-sem-autenticação)
3. [Autenticação e sessão](#autenticação-e-sessão)
4. [Shell autenticado (layout global)](#shell-autenticado-layout-global)
5. [Módulo: Agenda](#módulo-agenda)
6. [Módulo: Pacientes](#módulo-pacientes)
7. [Módulo: Controle de prótese](#módulo-controle-de-prótese)
8. [Módulo: Financeiro](#módulo-financeiro)
9. [Módulo: Estoque](#módulo-estoque)
10. [Módulo: Relatórios](#módulo-relatórios)
11. [Módulo: Configurações](#módulo-configurações)
12. [Modais e fluxos transversais](#modais-e-fluxos-transversais)
13. [Resultado dos testes E2E (UI aberta)](#resultado-dos-testes-e2e-ui-aberta)
14. [Como reproduzir a exploração](#como-reproduzir-a-exploração)

---

## Visão geral da aplicação

O Controle Dental é um sistema de gestão para clínicas odontológicas com módulos principais acessíveis via sidebar:

| Seção   | Módulo              | Rota base           |
|---------|---------------------|---------------------|
| PRINCIPAL | Agenda            | `/agenda`           |
| PRINCIPAL | Pacientes         | `/pacientes`        |
| PRINCIPAL | Controle de prótese | `/controle-protese` |
| GESTÃO  | Financeiro        | `/financeiro`       |
| GESTÃO  | Estoque           | `/estoque`          |
| GESTÃO  | Relatórios        | `/relatorios`       |
| SISTEMA | Configurações     | `/configuracoes`    |

---

## Fluxos públicos (sem autenticação)

### Login (`/login`)

**Elementos identificados:**
- Campos: E-mail, Senha, checkbox "Lembrar"
- Botões: Entrar na Plataforma, Continuar com Google
- Links: Esqueci a senha, Cadastre-se, Fale com o suporte

**Cenários possíveis:**

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| PUB-LOGIN-01 | Acessar `/login` | Exibe heading "Acesse sua conta" e formulário |
| PUB-LOGIN-02 | Login com credenciais válidas | Redireciona para `/agenda`, `/setup-inicial` ou `/aceitar-documentos` |
| PUB-LOGIN-03 | Login com credenciais inválidas | Permanece em `/login` |
| PUB-LOGIN-04 | Login via Google | Fluxo OAuth (Continuar com Google) |
| PUB-LOGIN-05 | Marcar "Lembrar" e fazer login | Sessão persistida no localStorage |
| PUB-LOGIN-06 | reCAPTCHA exigido (produção) | Exige resolução manual antes do redirecionamento |
| PUB-LOGIN-07 | Clicar em "Esqueci a senha" | Navega para `/recuperar-senha` |
| PUB-LOGIN-08 | Clicar em "Cadastre-se" | Navega para `/registro` |

---

### Recuperar senha (`/recuperar-senha`)

**Elementos:** campo e-mail, botão Continuar, links Voltar para o Login e Fale com o suporte.

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| PUB-REC-01 | Informar e-mail cadastrado | Envia código de 6 dígitos por e-mail |
| PUB-REC-02 | Informar e-mail não cadastrado | Feedback de e-mail não encontrado |
| PUB-REC-03 | Voltar para login | Retorna a `/login` |

---

### Registro trial (`/registro`)

**Campos:** Nome da clínica, Nome do admin, E-mail, Celular, Senha (mín. 8 caracteres).

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| PUB-REG-01 | Preencher formulário válido e submeter | Cria conta trial e inicia onboarding |
| PUB-REG-02 | Senha com menos de 8 caracteres | Validação impede envio |
| PUB-REG-03 | E-mail já existente | Erro de duplicidade |
| PUB-REG-04 | Clicar em "Entrar" | Navega para `/login` |

---

### Política de privacidade (`/politica-de-privacidade`)

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| PUB-POL-01 | Acessar página | Exibe conteúdo legal, links para login |

---

### Portal do titular — LGPD (`/portal-titular`)

**Abas:** Meus Direitos, Dados Coletados, Compartilhamento, Segurança, Contato.

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| PUB-LGPD-01 | Navegar entre abas | Conteúdo de cada direito LGPD exibido |
| PUB-LGPD-02 | Solicitar confirmação/acesso aos dados | Fluxo de requisição ao titular |
| PUB-LGPD-03 | Solicitar correção/eliminação/portabilidade | Fluxos específicos por direito |

---

### Validar documento (`/validar-documento`)

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| PUB-VAL-DOC-01 | Acessar com token/código válido | Confirma autenticidade do documento |
| PUB-VAL-DOC-02 | Token inválido ou expirado | Mensagem de erro |

---

### Validar receita (`/validar-receita`)

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| PUB-VAL-REC-01 | Acessar com código válido | Confirma autenticidade da receita |
| PUB-VAL-REC-02 | Código inválido | Mensagem de erro |

---

### Erro 404 (rota inexistente)

Tela amigável com foguete animado (`/svgs/foguete.svg`), CTAs e atalhos. Rota coringa `**` no frontend.

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| PUB-404-01 | Acessar rota inexistente sem sessão | Exibe "Erro 404", título amigável e foguete |
| PUB-404-02 | Clicar em "Ir para a página inicial" | Navega para `/login` |
| PUB-404-03 | Clicar no atalho Entrar | Navega para `/login` |
| PUB-404-04 | Clicar em Voltar após vir do login | Retorna a `/login` |
| AUTH-404-01 | Rota inexistente com sessão | Exibe 404 com atalhos Agenda/Pacientes |
| AUTH-404-02 | Ir para a página inicial autenticado | Volta à agenda (ou home pós-login) |
| AUTH-404-03 | Atalho Agenda | Navega para `/agenda` |

---

## Autenticação e sessão

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| AUTH-01 | Login via API (`POST /api/auth/login`) | Token injetado em `localStorage` (`accessToken`, `controleDentalSession`) |
| AUTH-02 | Sessão salva em `playwright/.auth/user.json` | Reutilizada por até 12h nos testes |
| AUTH-03 | Recarregar página autenticada | Mantém sessão (não redireciona para login) |
| AUTH-04 | Sessão expirada | Redireciona para `/login` |
| AUTH-05 | Acesso a rota autenticada sem permissão | Exibe 403 ou redireciona conforme plano |
| AUTH-06 | Módulo não habilitado no plano | Item ausente na sidebar ou rota bloqueada |

---

## Shell autenticado (layout global)

**Header:**
- Notificações
- WhatsApp (contador)
- Menu do usuário (nome + perfil, ex.: "Kaique Paes admin")

**Sidebar:** Agenda, Pacientes, Controle de prótese, Financeiro, Estoque, Relatórios, Configurações

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| SHELL-01 | Navegar via sidebar para cada módulo | Carrega rota correspondente sem erro 403 |
| SHELL-02 | Clicar no logo "Controle Dental" | Retorna ao início |
| SHELL-03 | Abrir menu do usuário | Opções de perfil/logout |
| SHELL-04 | Abrir notificações | Lista de alertas da clínica |
| SHELL-05 | Abrir chat de suporte | Widget de atendimento |

---

## Módulo: Agenda

**Rota:** `/agenda`

**Funcionalidades identificadas:**
- Visualizações: Dia, Semana, Mês
- Navegação temporal: Hoje, Anterior, Próximo
- Filtros: Outros filtros (Status, Sala), Todos os profissionais
- Ações: Novo agendamento (botão e slots horários), Configurações da agenda, Visualização da agenda

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| AG-01 | Carregar tela da agenda | Grade semanal visível com botão "Novo agendamento" |
| AG-02 | Alternar visualização Dia/Semana/Mês | Atualiza layout do calendário |
| AG-03 | Clicar em "Hoje" | Retorna ao período atual |
| AG-04 | Navegar Anterior/Próximo | Altera intervalo de datas exibido |
| AG-05 | Filtrar por profissional | Exibe apenas agendamentos do profissional selecionado |
| AG-06 | Filtrar por status/sala | Filtra eventos na grade |
| AG-07 | Criar novo agendamento via botão | Abre formulário/modal de agendamento |
| AG-08 | Criar agendamento clicando em slot horário | Pré-preenche data/hora do slot |
| AG-09 | Agendamento fora do expediente | Exibe alertdialog "Confirmar agendamento fora do expediente" |
| AG-10 | Editar agendamento existente | Abre detalhes para alteração |
| AG-11 | Cancelar/excluir agendamento | Remove ou marca como cancelado |
| AG-12 | Configurações da agenda | Abre preferências (horários, salas, etc.) |
| AG-13 | Recarregar página | Mantém sessão e permanece em `/agenda` |
| AG-14 | Alternar abas do modal (Consulta / Compromisso / Tarefa) | Conteúdo da aba ativa muda |
| AG-15 | Painel Visualização da agenda | Lista opções (compacta, sábado, domingo…) |
| AG-16 | Botão Imprimir agenda | Visível sem sair de `/agenda` |

### Google Calendar (sync por profissional)

**UI principal:** Configurações → Meu perfil · **Atalho:** Agenda → Configurações da grade · **Ponte:** Configurações → Integrações

Mocks: `tests/support/google-calendar-mocks.ts` (sem OAuth real).

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| GC-01 | Status desconectado no Perfil | Botão "Conectar Google Calendar" |
| GC-02 | Status conectado no Perfil | E-mail, switch sync, chips de alerta, Desconectar |
| GC-03 | Desligar "Espelhar consultas no Google" | PUT `/settings` e chips somem |
| GC-04 | Selecionar chip de alerta | PUT com `alertas_minutos_antes` |
| GC-05 | Desconectar com confirmação | POST `/disconnect` → UI desconectada |
| GC-06 | `habilitadoNoServidor: false` | Callout "Indisponível no servidor" |
| GC-07 | `precisaReconectarParaEscrita` | Callout + switch sync desabilitado |
| GC-08 | Atalho na grade da agenda | "Sincronizar Google Calendar" (se profissional vinculado) |
| GC-09 | Overlay `tipo: google` no feed | Card `.agenda-screen__event-card--google` |
| GC-10 | Ocultar eventos do Google Calendar | Cards Google somem |
| GC-11 | `?google_calendar=connected` | Toast de sucesso e query limpa |
| GC-12 | Card em Integrações | Badge "Por profissional" + Ir para Perfil |
| GC-13 | Conectar (mock) | Não abre `accounts.google.com`; redirect E2E in-app |

---

## Módulo: Pacientes

### Listagem (`/pacientes/buscar`)

**Elementos:** busca por nome/CPF/telefone, cards Atenção da semana, Novo paciente, Aniversariantes, Retornos semestrais, Em débito.

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| PAC-LIST-01 | Carregar listagem | Heading "Pacientes" e tabela `.patients-rel` visíveis |
| PAC-LIST-02 | Buscar por nome | Filtra pacientes correspondentes |
| PAC-LIST-03 | Buscar por CPF | Filtra por documento |
| PAC-LIST-04 | Buscar por telefone | Filtra por contato |
| PAC-LIST-05 | Busca sem resultados | Lista vazia ou mensagem informativa |
| PAC-LIST-06 | Clicar "Novo paciente" | Navega para `/pacientes/novo` |
| PAC-LIST-07 | Filtrar aniversariantes | Exibe pacientes com aniversário no período |
| PAC-LIST-08 | Filtrar retornos semestrais | Exibe pacientes pendentes de retorno |
| PAC-LIST-09 | Filtrar em débito | Exibe pacientes com pendências financeiras |
| PAC-LIST-10 | Abrir paciente existente | Navega para prontuário do paciente |
| PAC-LIST-11 | Gerenciar modelos de mensagem | Abre configuração de templates |

---

### Novo paciente (`/pacientes/novo`)

**Seções do formulário:** Informações Pessoais, Contato, Comunicação de relacionamento, Consentimento LGPD.

**Campos identificados:** Nome, CPF, RG, Data nascimento, Profissão, Celular, Telefone fixo, E-mail, consentimento WhatsApp.

**Abas do prontuário (paciente existente):**

| Aba | Rota slug |
|-----|-----------|
| Informações | `informacoes` |
| Plano / Ficha | `plano-ficha` |
| Orçamentos | `orcamentos` |
| Tratamentos | `tratamentos` |
| Arquivos | `arquivos` |
| Anamneses | `anamneses` |
| Receituário | `receituario` |
| Documentos | `documentos` |
| Pagamentos | `pagamentos` |

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| PAC-NOVO-01 | Acessar formulário novo | Layout `app-paciente-form-content` visível |
| PAC-NOVO-02 | Salvar com dados obrigatórios | Paciente criado, redireciona ao prontuário |
| PAC-NOVO-03 | Salvar sem campos obrigatórios | Validação impede envio |
| PAC-NOVO-04 | CPF inválido ou duplicado | Erro de validação |
| PAC-NOVO-05 | Marcar "sem CPF" | Campo CPF desabilitado/ignorado |
| PAC-NOVO-06 | Cancelar cadastro | Retorna à listagem sem salvar |
| PAC-NOVO-07 | Consentimento LGPD WhatsApp | Registra preferência de comunicação |
| PAC-PRONT-01 | Aba Informações — editar dados | Atualiza cadastro |
| PAC-PRONT-02 | Aba Plano/Ficha — odontograma | Registra condições dentárias |
| PAC-PRONT-03 | Aba Orçamentos — criar orçamento | Novo orçamento vinculado ao paciente |
| PAC-PRONT-04 | Aba Orçamentos — aprovar/rejeitar | Altera status do orçamento |
| PAC-PRONT-05 | Aba Tratamentos — registrar procedimento | Histórico clínico atualizado |
| PAC-PRONT-06 | Aba Arquivos — upload | Anexo salvo no prontuário |
| PAC-PRONT-07 | Aba Anamneses — preencher formulário | Anamnese registrada |
| PAC-PRONT-08 | Aba Receituário — emitir receita | Receita gerada (validável em `/validar-receita`) |
| PAC-PRONT-09 | Aba Documentos — gerar contrato/termo | Documento a partir de modelo |
| PAC-PRONT-10 | Aba Pagamentos — registrar/lançar | Integração com financeiro |

---

## Módulo: Controle de prótese

### Quadro principal (`/controle-protese`)

**Fluxo da prótese:** Solicitação → Enviado para laboratório → (demais etapas do pipeline)

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| PRO-01 | Carregar quadro | Kanban/fluxo de solicitações visível |
| PRO-02 | Nova solicitação | Formulário de nova prótese |
| PRO-03 | Buscar por paciente/profissional/tipo | Filtra solicitações |
| PRO-04 | Mover card entre colunas | Atualiza status no fluxo |
| PRO-05 | Abrir detalhe da solicitação | Exibe histórico e anexos |
| PRO-06 | Navegar para Laboratórios | Abre `/controle-protese/laboratorios` |

---

### Laboratórios (`/controle-protese/laboratorios`)

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| PRO-LAB-01 | Listar laboratórios | Tabela com contatos e status |
| PRO-LAB-02 | Novo laboratório | Formulário de cadastro |
| PRO-LAB-03 | Filtrar Ativos/Todos | Filtra por status |
| PRO-LAB-04 | Buscar por nome/telefone/e-mail | Filtra resultados |
| PRO-LAB-05 | Editar laboratório existente | Atualiza dados |
| PRO-LAB-06 | Inativar laboratório | Remove das opções ativas |

---

## Módulo: Financeiro

**Sub-rotas:**

| Rota | Nome |
|------|------|
| `/financeiro` | Painel |
| `/financeiro/fluxo-caixa` | Fluxo de caixa |
| `/financeiro/comissoes` | Comissões |
| `/financeiro/boletos` | Boletos |
| `/financeiro/notas-fiscais` | Notas fiscais |

**Abas internas (quando habilitadas no plano):** Painel, Fluxo de caixa, Comissões, Boletos, Notas fiscais

### Painel (`/financeiro`)

**Indicadores:** Entradas do período, Saídas do período, Receitas em aberto.

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| FIN-PAIN-01 | Carregar painel | Cards de resumo e seletor de período |
| FIN-PAIN-02 | Alterar período | Atualiza indicadores |
| FIN-PAIN-03 | Novo lançamento | Abre formulário de entrada/saída |
| FIN-PAIN-04 | Navegar para Fluxo de caixa | Abre `/financeiro/fluxo-caixa` |

---

### Fluxo de caixa (`/financeiro/fluxo-caixa`)

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| FIN-FLUX-01 | Exibir saldo inicial, entradas e saídas | Totais do período corretos |
| FIN-FLUX-02 | Buscar por descrição/paciente/categoria | Filtra lançamentos |
| FIN-FLUX-03 | Novo lançamento manual | Registra movimentação |
| FIN-FLUX-04 | Editar/excluir lançamento | Atualiza fluxo |
| FIN-FLUX-05 | Exportar relatório | Download do período |

---

### Comissões (`/financeiro/comissoes`)

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| FIN-COM-01 | Visualizar comissões por profissional | Lista calculada no período |
| FIN-COM-02 | Configurar percentuais | Integração com `/configuracoes/comissoes-profissionais` |
| FIN-COM-03 | Marcar comissão como paga | Atualiza status |

---

### Boletos (`/financeiro/boletos`)

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| FIN-BOL-01 | Listar boletos emitidos | Status: aberto, pago, vencido |
| FIN-BOL-02 | Emitir novo boleto | Gera cobrança vinculada a paciente |
| FIN-BOL-03 | Cancelar boleto | Status atualizado |
| FIN-BOL-04 | Reenviar boleto | Nova via de pagamento |

---

### Notas fiscais (`/financeiro/notas-fiscais`)

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| FIN-NF-01 | Listar notas emitidas | Histórico fiscal |
| FIN-NF-02 | Emitir nota fiscal | Integração com serviço fiscal |
| FIN-NF-03 | Cancelar nota | Processo de cancelamento |

---

## Módulo: Estoque

**Rota:** `/estoque`

**Indicadores:** Total de itens, Estoque baixo, Valor em estoque.

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| EST-01 | Carregar tela de estoque | Dashboard e listagem visíveis |
| EST-02 | Novo material | Formulário de cadastro de item |
| EST-03 | Exportar inventário | Download da listagem |
| EST-04 | Alerta estoque baixo | Destaca itens abaixo do mínimo |
| EST-05 | Entrada de material | Incrementa quantidade |
| EST-06 | Saída/consumo de material | Decrementa quantidade |
| EST-07 | Editar item existente | Atualiza dados e estoque mínimo |

---

## Módulo: Relatórios

**Rota:** `/relatorios`

**Relatórios identificados:** Faturamento x custos (6 meses), Origem de pacientes (+ outros com botão "Gerar").

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| REL-01 | Carregar hub de relatórios | Gráficos e cards de relatório |
| REL-02 | Buscar relatório | Filtra por nome |
| REL-03 | Gerar relatório individual | Exibe/download do relatório |
| REL-04 | Exportar tudo | Download em lote |
| REL-05 | Faturamento x custos | Gráfico comparativo mensal |
| REL-06 | Origem de pacientes | Distribuição por canal de captação |

---

## Módulo: Configurações

**Rota:** `/configuracoes`

**Seções identificadas:**

| Grupo | Itens |
|-------|-------|
| Conta e sistema | Meu perfil, Dados da clínica, Notificações, Integrações, Assinatura |
| Gestão da clínica | Equipe e permissões, Dentistas, Convênios, Fornecedores, Salas e cadeiras, Formas de Pagamento |
| Prontuário e clínico | (procedimentos, modelos clínicos) |
| Comunicação | Modelos de mensagens, Créditos de mensagens |
| Contratos | Modelos de contrato (`/configuracoes/modelos-contrato`) |
| Comissões | Comissões profissionais (`/configuracoes/comissoes-profissionais`) |

| ID | Cenário | Resultado esperado |
|----|---------|-------------------|
| CFG-01 | Carregar hub | Abas internas de configuração visíveis |
| CFG-02 | Meu perfil — alterar nome/e-mail | Dados atualizados |
| CFG-03 | Meu perfil — alterar senha | Senha atual + nova + confirmação |
| CFG-04 | Dados da clínica | Razão social, CNPJ, endereço |
| CFG-05 | Equipe e permissões — convidar usuário | Novo membro com perfil |
| CFG-06 | Equipe — alterar permissões | Restringe/libera módulos |
| CFG-07 | Dentistas — CRUD | Cadastro com CRO e especialidade |
| CFG-08 | Convênios — CRUD | Planos aceitos pela clínica |
| CFG-09 | Fornecedores — CRUD | Cadastro de fornecedores |
| CFG-10 | Salas e cadeiras — CRUD | Recursos para agenda |
| CFG-11 | Formas de pagamento — CRUD | Métodos aceitos |
| CFG-12 | Modelos de mensagens | Templates WhatsApp/SMS |
| CFG-13 | Créditos de mensagens | Saldo e recarga |
| CFG-14 | Integrações | Conectores externos |
| CFG-15 | Assinatura | Plano, faturamento, pendências |
| CFG-16 | Modelos de contrato — novo | Template reutilizável em orçamentos |
| CFG-17 | Comissões profissionais | Percentuais por dentista/procedimento |

---

## Modais e fluxos transversais

Identificados durante a exploração com UI aberta:

| ID | Modal / fluxo | Gatilho | Ação esperada |
|----|---------------|---------|---------------|
| MOD-01 | Tour guiado da plataforma (19 passos) | Primeiro acesso / onboarding | Pular tour / Próximo / Voltar |
| MOD-02 | Acesso bloqueado por pendência na assinatura | Assinatura inadimplente | Bloqueia funcionalidades até regularização |
| MOD-03 | Confirmar agendamento fora do expediente | Agendar fora do horário configurado | Confirmar ou cancelar |
| MOD-04 | Modais genéricos | Vários fluxos | Fechar / Entendi / Continuar |

---

## Resultado dos testes E2E (UI aberta)

Comando executado:

```bash
npx playwright test --workers=1
```

| Resultado | Quantidade |
|-----------|------------|
| Passou    | 49         |
| Falhou    | 0          |
| Ignorado  | 0          |

Mapa completo teste a teste: [`MAPA-TESTES.md`](./MAPA-TESTES.md)

---

## Como reproduzir a exploração

### Testes E2E com navegador visível

```bash
npm run test:headed
# ou módulo específico:
npx playwright test --project=chromium --headed --workers=1
```

### Exploração automatizada de fluxos

```bash
HEADED=1 node scripts/explore-flows.mjs
```

Gera `docs/exploration-report.json` com botões, links, campos e abas capturados em cada rota.

### Autenticação manual (quando reCAPTCHA exigir)

```bash
npm run test:auth:headed
```

---

## Observações

- Algumas rotas (`/financeiro/comissoes`, `/configuracoes/comissoes-profissionais`) podem redirecionar ou exibir conteúdo diferente conforme **plano e permissões** da clínica.
- Módulos ausentes na sidebar indicam funcionalidade não habilitada no plano atual.
- O documento `exploration-report.json` contém o dump bruto da exploração para referência técnica dos seletores e elementos UI.
