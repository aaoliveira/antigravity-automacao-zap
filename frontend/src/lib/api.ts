import axios from 'axios';
import {
  WorkflowDefinition,
  AutomationDetails,
  FlowValidationResult,
  FlowVersionSummary,
} from '../types/flow';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para injetar x-tenant-id padrão
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const tenantId =
      localStorage.getItem('zap_tenant_id') ||
      '00000000-0000-4000-a000-000000000001';
    config.headers['x-tenant-id'] = tenantId;
  } else {
    config.headers['x-tenant-id'] = '00000000-0000-4000-a000-000000000001';
  }
  return config;
});

export const FlowApi = {
  // Automações
  async listAutomations(status?: string): Promise<AutomationDetails[]> {
    const res = await apiClient.get<AutomationDetails[]>('/automations', {
      params: status ? { status } : undefined,
    });
    return res.data;
  },

  async createAutomation(name: string, description?: string): Promise<AutomationDetails> {
    const res = await apiClient.post<AutomationDetails>('/automations', {
      name,
      description,
    });
    return res.data;
  },

  async getAutomation(id: string): Promise<AutomationDetails> {
    const res = await apiClient.get<AutomationDetails>(`/automations/${id}`);
    return res.data;
  },

  async updateDraft(id: string, definition: WorkflowDefinition, name?: string): Promise<AutomationDetails> {
    const payload: any = { currentDraft: definition };
    if (name) payload.name = name;
    const res = await apiClient.put<AutomationDetails>(`/automations/${id}`, payload);
    return res.data;
  },

  async pauseAutomation(id: string): Promise<AutomationDetails> {
    const res = await apiClient.post<AutomationDetails>(`/automations/${id}/pause`);
    return res.data;
  },

  async activateAutomation(id: string): Promise<AutomationDetails> {
    const res = await apiClient.post<AutomationDetails>(`/automations/${id}/activate`);
    return res.data;
  },

  async deleteAutomation(id: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete<{ success: boolean; message: string }>(`/automations/${id}`);
    return res.data;
  },

  async validateFlow(id: string, definition?: WorkflowDefinition): Promise<FlowValidationResult> {
    const res = await apiClient.post<FlowValidationResult>(`/automations/${id}/validate`, {
      definition,
    });
    return res.data;
  },

  async publishFlow(
    id: string,
    releaseNotes?: string,
    definition?: WorkflowDefinition,
  ): Promise<{ message: string; version: any }> {
    const res = await apiClient.post(`/automations/${id}/publish`, {
      releaseNotes,
      definition,
    });
    return res.data;
  },

  async getVersions(id: string): Promise<FlowVersionSummary[]> {
    const res = await apiClient.get<FlowVersionSummary[]>(`/automations/${id}/versions`);
    return res.data;
  },

  async listInstances(): Promise<any[]> {
    try {
      const res = await apiClient.get('/whatsapp/instances');
      return res.data;
    } catch {
      return [];
    }
  },

  async getInstanceCapabilities(instanceId: string): Promise<any> {
    try {
      const res = await apiClient.get(`/whatsapp/instances/${instanceId}/capabilities`);
      return res.data;
    } catch {
      return null;
    }
  },
};
