import type { PatientFormTab } from './routes';

export const PACIENTES_SELECTORS = {
  listRoot: '.patients-rel, .patients-buscar-tab',
  patientRow: 'article.patients-buscar-tab__row',
  deleteDialog: '.p-dialog.patients-delete-dialog:visible',
  formRoot: 'app-paciente-form-content, app-paciente-form-layout',
  prontuarioTabs: '[role="tablist"]',
} as const;

export const PACIENTE_FORM_IDS = {
  nome: '#np-nome',
  celular: '#np-cel',
  semCpf: '#np-sem-cpf',
  cpf: '#np-cpf, #paciente-cpf, input[name*="cpf" i]',
  email: '#np-email, input[type="email"]',
  observacoes: '#np-obs, textarea[name*="obs" i]',
} as const;

export const PRONTUARIO_TAB_LABELS: Record<PatientFormTab, RegExp> = {
  informacoes: /^Informações$/i,
  'plano-ficha': /^Plano e Ficha Clínica$/i,
  orcamentos: /^Orçamentos$/i,
  tratamentos: /^Tratamentos$/i,
  arquivos: /^Arquivos$/i,
  anamneses: /^Anamneses$/i,
  receituario: /^Receituário$/i,
  documentos: /^Documentos$/i,
  pagamentos: /^Pagamentos$/i,
};

/** Baseline de elementos visíveis — reutilizado em todos os testes da tela. */
export const PACIENTES_LIST_SCREEN_MAP = {
  headings: [/Pacientes/i],
  texts: [/Acompanhe cadastros/i],
  buttons: [/Atenção da semana/i, /Novo paciente/i, /Aniversariantes/i, /Retornos semestrais/i, /Em débito/i],
  links: [/Gerenciar modelos de mensagem/i],
  placeholders: [/Buscar por nome, CPF ou telefone/i],
} as const;

export const PACIENTE_NOVO_SCREEN_MAP = {
  headings: [
    /Novo Paciente|Cadastrar informações do paciente/i,
    /Informações Pessoais/i,
    /Contato/i,
    /Comunicação de relacionamento/i,
  ],
  texts: [/Consentimento LGPD/i],
  buttons: [/Cancelar/i, /Salvar Paciente/i],
} as const;

/** Visualização do prontuário (aba Informações em modo leitura — não é o formulário /novo). */
export const PRONTUARIO_INFORMACOES_SCREEN_MAP = {
  headings: [
    /Informações Pessoais/i,
    /Contato.*Endereço/i,
    /Odontograma Inicial/i,
    /Anamnese.*Alertas/i,
    /Próximas Consultas/i,
  ],
  buttons: [/Editar/i, /Mais ações/i],
} as const;

export const PRONTUARIO_PLANO_FICHA_SCREEN_MAP = {
  tabs: [/^Plano e Ficha Clínica$/i],
  headings: [/Plano|Ficha|Odontograma/i],
  buttons: [/Novo registro|Nova ficha|Adicionar/i],
} as const;

export const PRONTUARIO_ORCAMENTOS_SCREEN_MAP = {
  tabs: [/^Orçamentos$/i],
  headings: [/Orçamento/i],
  buttons: [/Novo orçamento|Novo Orçamento|Criar orçamento/i],
} as const;

export const PRONTUARIO_CONTRATO_SCREEN_MAP = {
  headings: [/Contrato|Orçamento|paciente/i],
  buttons: [/Fechar|Voltar|Imprimir/i],
} as const;

export const PRONTUARIO_DOCUMENTO_SCREEN_MAP = {
  headings: [/Documento|Contrato|Orçamento/i],
  buttons: [/Fechar|Voltar|Imprimir|Download/i],
} as const;

export const PRONTUARIO_TRATAMENTOS_SCREEN_MAP = {
  tabs: [/^Tratamentos$/i],
  headings: [/Tratamento|Odontograma/i, /^Anotações$/],
  buttons: [/Novo tratamento|Adicionar tratamento/i],
} as const;

export const PRONTUARIO_RECEITUARIO_SCREEN_MAP = {
  tabs: [/^Receituário$/i],
  headings: [/Receituário/i],
  buttons: [/Novo documento/i, /Filtros/i],
} as const;

export const PRONTUARIO_ARQUIVOS_SCREEN_MAP = {
  tabs: [/^Arquivos$/i],
  headings: [/Arquivo|arquivos do paciente/i],
  buttonsAny: [/Fazer Upload|Enviar|Upload|Adicionar arquivo|Enviar arquivos/i],
} as const;

export const PRONTUARIO_ANAMNESES_SCREEN_MAP = {
  tabs: [/^Anamneses$/i],
  headings: [/Anamneses do paciente|Anamnese/i],
  buttons: [/Nova anamnese|Modelos|Criar primeira anamnese/i],
} as const;

export const PRONTUARIO_DOCUMENTOS_SCREEN_MAP = {
  tabs: [/^Documentos$/i],
  headings: [/Documento/i],
  buttons: [/Importar documento|Novo documento|Enviar|Upload/i],
} as const;

export const PRONTUARIO_PAGAMENTOS_SCREEN_MAP = {
  tabs: [/^Pagamentos$/i],
  headings: [/Pagamento|Financeiro|Receita|Despesa/i],
  buttons: [/Novo lançamento|Adicionar|Pagar|Extrato/i],
} as const;

export const ORCAMENTO_MODAL_OPTIONS = {
  gerarContrato: /gerar contrato automaticamente/i,
  aprovarImediato: /aprovar orçamento imediatamente/i,
} as const;
