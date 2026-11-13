import { ExecutionStatus } from '@prisma/client';
import { FlowNode, WorkflowDefinition } from '../../automations/schema/flow-node.types';

export interface InboundInteraction {
  type: 'text' | 'button_click' | 'list_selection' | 'media' | 'timeout';
  value: string;
  buttonId?: string;
  buttonPayload?: string;
  rowId?: string;
  rowPayload?: string;
  mediaUrl?: string;
  mediaType?: string;
  rawPayload?: any;
}

export interface InboundEvent {
  messageId: string;
  tenantId: string;
  instanceName: string;
  contactPhone: string;
  contactName?: string;
  interaction: InboundInteraction;
  timestamp: Date;
}

export interface VariableContext {
  contact: {
    id?: string;
    phone: string;
    name?: string;
    tags: string[];
    customFields: Record<string, any>;
  };
  conversation: {
    id: string;
    lastMessage?: string;
    lastInteractionAt: Date;
  };
  execution: {
    id: string;
    status: ExecutionStatus;
    startedAt: Date;
    currentNodeId?: string;
    variables: Record<string, any>;
  };
  company: {
    id: string;
    name: string;
    slug?: string;
  };
  flow: {
    id: string;
    name: string;
    version: number;
    versionId: string;
  };
}

export interface NodeResult {
  success: boolean;
  nextHandle?: string; // ID da porta de saída (ex: 'true', 'false', 'default', 'btn_1', 'reply', etc.)
  nextNodeId?: string;
  statusTransition?: ExecutionStatus;
  waitingForInput?: boolean;
  waitingForDelaySeconds?: number;
  outputPayload?: any;
  variableUpdates?: Record<string, any>;
  error?: string;
}

export interface NodeExecutionContext {
  tenantId: string;
  executionId: string;
  node: FlowNode;
  flowDefinition: WorkflowDefinition;
  variables: VariableContext;
  incomingInteraction?: InboundInteraction;
  outboxMessage?: (messageType: string, recipient: string, payload: any) => Promise<any>;
}
