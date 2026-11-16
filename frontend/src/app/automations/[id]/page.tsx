'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { FlowBuilder } from '../../../components/flow/FlowBuilder';
import { FlowApi } from '../../../lib/api';
import { AutomationDetails } from '../../../types/flow';
import { RotateCcw } from 'lucide-react';

export default function AutomationEditorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const isViewMode = searchParams?.get('mode') === 'view';

  const [automation, setAutomation] = useState<AutomationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    FlowApi.getAutomation(id)
      .then((data) => {
        setAutomation(data);
        setLoading(false);
      })
      .catch(async (err) => {
        // Se a automação ainda não existir no banco, auto-provisiona no backend
        console.warn(`Automação ${id} não encontrada no banco. Provisionando rascunho inicial:`, err.message);
        const fallbackName =
          id === '00000000-0000-4000-b000-000000000002'
            ? 'Novo Fluxo em Branco'
            : 'Atendimento Comercial e Vendas';
        const fallbackDraft: any = {
          schemaVersion: '1.0.0',
          flowId: id,
          name: fallbackName,
          nodes: [
            {
              id: 'node-trigger-init',
              type: 'custom',
              position: { x: 250, y: 150 },
              data: {
                nodeType: 'trigger.message_received',
                label: 'Mensagem Recebida',
                category: 'triggers',
                config: { matchType: 'any' },
              },
            },
          ],
          edges: [],
        };

        try {
          const created = await FlowApi.updateDraft(id, fallbackDraft, fallbackName);
          setAutomation(created);
        } catch {
          setAutomation({
            id,
            tenantId: '00000000-0000-4000-a000-000000000001',
            name: fallbackName,
            status: 'DRAFT',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            currentDraft: fallbackDraft,
          });
        } finally {
          setLoading(false);
        }
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <RotateCcw className="h-8 w-8 animate-spin text-emerald-500" />
          <span className="text-sm font-medium">Carregando Construtor Visual...</span>
        </div>
      </div>
    );
  }

  return (
    <FlowBuilder
      automationId={id}
      initialDefinition={automation?.currentDraft}
      initialName={automation?.name || 'Fluxo WhatsApp'}
      initialStatus={automation?.status}
      isViewMode={isViewMode}
    />
  );
}
