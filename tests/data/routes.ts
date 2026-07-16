/** Authenticated app routes mapped from `app.routes.ts` in the frontend. */
export const AUTHENTICATED_ROUTES = [
  { path: '/agenda', name: 'Agenda', moduleId: 'agenda' },
  { path: '/pacientes/buscar', name: 'Pacientes — Buscar', moduleId: 'pacientes' },
  { path: '/pacientes/novo', name: 'Pacientes — Novo', moduleId: 'pacientes' },
  { path: '/controle-protese', name: 'Controle de prótese', moduleId: 'controle_protese' },
  {
    path: '/controle-protese/laboratorios',
    name: 'Controle de prótese — Laboratórios',
    moduleId: 'controle_protese',
  },
  { path: '/financeiro', name: 'Financeiro — Painel', moduleId: 'financeiro' },
  { path: '/financeiro/fluxo-caixa', name: 'Financeiro — Fluxo de caixa', moduleId: 'financeiro' },
  { path: '/financeiro/comissoes', name: 'Financeiro — Comissões', moduleId: 'comissoes' },
  { path: '/financeiro/boletos', name: 'Financeiro — Boletos', moduleId: 'financeiro' },
  { path: '/financeiro/notas-fiscais', name: 'Financeiro — Notas fiscais', moduleId: 'financeiro' },
  { path: '/estoque', name: 'Estoque', moduleId: 'estoque' },
  { path: '/relatorios', name: 'Relatórios', moduleId: 'relatorios' },
  { path: '/configuracoes', name: 'Configurações', moduleId: 'configuracoes' },
  {
    path: '/configuracoes/comissoes-profissionais',
    name: 'Configurações — Comissões profissionais',
    moduleId: 'comissoes',
  },
  { path: '/configuracoes/modelos-contrato', name: 'Configurações — Modelos de contrato', moduleId: 'configuracoes' },
] as const;

export const PUBLIC_ROUTES = [
  { path: '/login', name: 'Login', expectHeading: 'Acesse sua conta' },
  { path: '/recuperar-senha', name: 'Recuperar senha' },
  { path: '/registro', name: 'Registro trial' },
  { path: '/politica-de-privacidade', name: 'Política de privacidade' },
  { path: '/portal-titular', name: 'Portal do titular' },
  { path: '/validar-documento', name: 'Validar documento' },
  { path: '/validar-receita', name: 'Validar receita' },
] as const;

/** Rota inexistente para validar a tela 404 (`**` em `app.routes.ts`). */
export const UNKNOWN_ROUTE_404 = '/rota-inexistente-e2e-404';

export const SIDEBAR_MENU_ITEMS = [
  { label: 'Agenda', pathPattern: /\/agenda/ },
  { label: 'Pacientes', pathPattern: /\/pacientes/ },
  { label: 'Controle de prótese', pathPattern: /\/controle-protese/ },
  { label: 'Financeiro', pathPattern: /\/financeiro/ },
  { label: 'Estoque', pathPattern: /\/estoque/ },
  { label: 'Relatorios', pathPattern: /\/relatorios/ },
  { label: 'Configurações', pathPattern: /\/configuracoes/ },
] as const;

export const FINANCEIRO_SECTIONS = [
  {
    tabLabel: 'Painel',
    path: '/financeiro',
    expectPattern: /Painel|Visão geral do financeiro/,
  },
  {
    tabLabel: 'Fluxo de caixa',
    path: '/financeiro/fluxo-caixa',
    expectPattern: /Fluxo de caixa/,
  },
  {
    tabLabel: 'Comissões',
    path: '/financeiro/comissoes',
    moduleId: 'comissoes',
    expectPattern: /Comiss/i,
  },
  {
    tabLabel: 'Boletos',
    path: '/financeiro/boletos',
    expectPattern: /Boleto/i,
  },
  {
    tabLabel: 'Notas fiscais',
    path: '/financeiro/notas-fiscais',
    expectPattern: /Notas fiscais|nota fiscal/i,
  },
] as const;

/** @deprecated Use FINANCEIRO_SECTIONS */
export const FINANCEIRO_TABS = FINANCEIRO_SECTIONS.map((section) => section.tabLabel);

export const PATIENT_FORM_TABS = [
  'informacoes',
  'plano-ficha',
  'orcamentos',
  'tratamentos',
  'arquivos',
  'anamneses',
  'receituario',
  'documentos',
  'pagamentos',
] as const;

/** Seções internas do hub `/configuracoes` (exploração UI). */
export const CONFIG_SECTIONS = [
  { id: 'CFG-02', label: 'Meu perfil', expectPattern: /Informações pessoais|Segurança|cfg-nome/i },
  { id: 'CFG-04', label: 'Dados da clínica', expectPattern: /Informações da clínica|Nome da clínica/i },
  { id: 'CFG-12', label: 'Modelos de mensagens', expectPattern: /modelos de mensagem|mensagem/i },
  { id: 'CFG-13', label: 'Créditos de mensagens', expectPattern: /crédito|mensagem/i },
  { id: 'CFG-05', label: 'Equipe e permissões', expectPattern: /equipe|permiss|convidar|membro/i },
  { id: 'CFG-07', label: 'Dentistas', expectPattern: /dentista|CRO/i },
  { id: 'CFG-08', label: 'Convênios', expectPattern: /convênio|plano/i },
  { id: 'CFG-09', label: 'Fornecedores', expectPattern: /fornecedor/i },
  { id: 'CFG-10', label: 'Salas e cadeiras', expectPattern: /sala|cadeira/i },
  { id: 'CFG-11', label: 'Formas de Pagamento', expectPattern: /forma.*pagamento|pagamento/i },
  { id: 'CFG-18', label: 'Tratamentos / Procedimentos', expectPattern: /tratamento|procedimento/i },
  { id: 'CFG-19', label: 'Modelos de Anamnese', expectPattern: /anamnese/i },
  { id: 'CFG-20', label: 'Medicamentos', expectPattern: /medicamento/i },
  { id: 'CFG-21', label: 'Modelos de encaminhamento', expectPattern: /encaminhamento/i },
  { id: 'CFG-14', label: 'Integrações', expectPattern: /integração|conectar|integrac/i },
  { id: 'CFG-15', label: 'Plano e cobrança', expectPattern: /assinatura|plano|faturamento|cobrança/i },
  { id: 'CFG-03', label: 'Notificações', expectPattern: /notifica/i },
] as const;

export const CONFIG_DIRECT_ROUTES = [
  {
    id: 'CFG-17',
    path: '/configuracoes/comissoes-profissionais',
    name: 'Comissões profissionais',
    moduleId: 'comissoes' as const,
    expectPattern: /comiss/i,
  },
  {
    id: 'CFG-16',
    path: '/configuracoes/modelos-contrato',
    name: 'Modelos de contrato',
    expectPattern: /contrato|modelo/i,
  },
] as const;
