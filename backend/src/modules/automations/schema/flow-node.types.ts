// ============================================================================
// TIPOS ESTRUTURADOS E ESQUEMA DO GRAFO DO FLOW BUILDER
// ============================================================================

export type FlowNodeType =
  | 'trigger'
  | 'message_text'
  | 'message_media'
  | 'buttons'
  | 'list_interactive'
  | 'question_input'
  | 'condition'
  | 'switch'
  | 'delay'
  | 'wait_reply'
  | 'set_variable'
  | 'human_transfer'
  | 'end_flow';

// ----------------------------------------------------------------------------
// 1. Configurações Específicas por Tipo de Nó
// ----------------------------------------------------------------------------

export type TriggerKind =
  | 'exact_keyword'
  | 'contains_keyword'
  | 'regex'
  | 'first_interaction'
  | 'any_message';

export interface TriggerNodeConfig {
  triggerType: TriggerKind;
  keywords?: string[];
  regexPattern?: string;
  caseSensitive?: boolean;
}

export interface MessageTextNodeConfig {
  text: string;
  previewUrl?: boolean;
}

export interface MessageMediaNodeConfig {
  mediaType: 'image' | 'audio' | 'video' | 'document';
  mediaUrl: string;
  caption?: string;
  fileName?: string;
}

export interface ButtonOption {
  id: string; // Handle de saída
  label: string; // Rótulo (máx 20 caracteres)
}

export interface ButtonsNodeConfig {
  title?: string;
  body: string;
  footer?: string;
  buttons: ButtonOption[];
  fallbackToTextList?: boolean;
}

export interface ListRowOption {
  id: string; // Handle de saída
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  rows: ListRowOption[];
}

export interface ListInteractiveNodeConfig {
  title: string;
  body: string;
  footer?: string;
  buttonText: string;
  sections: ListSection[];
  fallbackToTextList?: boolean;
}

export interface QuestionInputNodeConfig {
  questionText: string;
  targetVariable: string;
  expectedType: 'text' | 'number' | 'email' | 'phone' | 'regex';
  validationRegex?: string;
  customErrorMessage?: string;
  maxRetries?: number;
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'regex_match'
  | 'is_empty'
  | 'is_not_empty';

export interface ConditionRule {
  variable: string;
  operator: ConditionOperator;
  value?: string;
}

export interface ConditionNodeConfig {
  logicalOperator: 'AND' | 'OR';
  rules: ConditionRule[];
}

export interface SwitchCaseOption {
  id: string; // Handle de saída
  value: string;
}

export interface SwitchNodeConfig {
  variable: string;
  cases: SwitchCaseOption[];
}

export interface DelayNodeConfig {
  durationSeconds: number;
  simulatePresence?: 'composing' | 'recording' | 'none';
}

export interface WaitReplyNodeConfig {
  timeoutMinutes: number;
}

export interface SetVariableNodeConfig {
  variableName: string;
  operation: 'set' | 'increment' | 'decrement' | 'clear';
  expression: string;
}

export interface HumanTransferNodeConfig {
  department?: string;
  queueId?: string;
  internalNote?: string;
  closingMessage?: string;
}

export interface EndFlowNodeConfig {
  farewellMessage?: string;
  clearSessionVariables?: boolean;
}

// ----------------------------------------------------------------------------
// 2. Estrutura Polimórfica de Nó
// ----------------------------------------------------------------------------

export interface FlowNodePosition {
  x: number;
  y: number;
}

export interface FlowNode<TConfig = any> {
  id: string;
  type: FlowNodeType;
  position?: FlowNodePosition;
  config: TConfig;
  data?: Record<string, any>;
}

// ----------------------------------------------------------------------------
// 3. Conexões (Edges)
// ----------------------------------------------------------------------------

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// ----------------------------------------------------------------------------
// 4. Declaração de Variáveis e Viewport
// ----------------------------------------------------------------------------

export interface FlowVariableDeclaration {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  defaultValue?: any;
}

export interface FlowViewport {
  x: number;
  y: number;
  zoom: number;
}

// ----------------------------------------------------------------------------
// 5. Definição Completa do Fluxo (WorkflowDefinition)
// ----------------------------------------------------------------------------

export interface WorkflowDefinition {
  schemaVersion: string; // ex: "1.0.0"
  flowId?: string;
  name?: string;
  viewport?: FlowViewport;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables?: FlowVariableDeclaration[];
}
