export type FlowNodeType =
  // Gatilhos
  | 'trigger.message_received'
  | 'trigger.keyword'
  | 'trigger'
  // Mensagens
  | 'message.text'
  | 'message.image'
  | 'message.video'
  | 'message.audio'
  | 'message.document'
  | 'message.sticker'
  | 'message.location'
  | 'message.contact'
  | 'message.buttons'
  | 'message.list'
  | 'message.template'
  // Interações
  | 'interaction.question'
  | 'interaction.capture'
  | 'interaction.choice'
  // Lógica
  | 'logic.condition'
  | 'logic.switch'
  | 'logic.delay'
  | 'logic.wait_for_input'
  // Ações
  | 'action.add_tag'
  | 'action.remove_tag'
  | 'action.update_contact'
  | 'action.start_flow'
  | 'action.human_handoff'
  | 'action.end';

export interface FlowNodeData {
  nodeType?: FlowNodeType;
  type?: FlowNodeType;
  label: string;
  category: 'trigger' | 'message' | 'interaction' | 'logic' | 'action';
  config: Record<string, any>;
  isValid?: boolean;
  errorMessage?: string;
  isSimulatedActive?: boolean;
}

export interface CustomFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: FlowNodeData;
}

export interface CustomFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  animated?: boolean;
  style?: React.CSSProperties;
}

export interface FlowVariable {
  id?: string;
  name: string;
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  defaultValue?: string;
  description?: string;
}

export interface WorkflowDefinition {
  schemaVersion: string;
  flowId?: string;
  name?: string;
  viewport?: { x: number; y: number; zoom: number };
  nodes: CustomFlowNode[];
  edges: CustomFlowEdge[];
  variables?: FlowVariable[];
}

export interface AutomationDetails {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
  activeVersionId?: string;
  currentDraft?: WorkflowDefinition;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationErrorDetail {
  nodeId?: string;
  edgeId?: string;
  field?: string;
  message: string;
  code: string;
}

export interface FlowValidationResult {
  isValid: boolean;
  errors: ValidationErrorDetail[];
  warnings: ValidationErrorDetail[];
}

export interface FlowVersionSummary {
  id: string;
  versionNumber: number;
  name: string;
  description?: string;
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
}
