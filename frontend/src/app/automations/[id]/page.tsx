'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FlowBuilder } from '../../../components/flow/FlowBuilder';
import { FlowApi } from '../../../lib/api';
import { AutomationDetails } from '../../../types/flow';
import { RotateCcw, AlertTriangle } from 'lucide-react';

export default function AutomationEditorPage() {
  const params = useParams();
  const id = params?.id as string;

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
      .catch((err) => {
        // Se a automação ainda não existir no banco (ex: ID demonstrativo), cria um estado padrão
        console.warn(`Automação ${id} não encontrada no banco ou backend offline:`, err.message);
        setAutomation({
          id,
          tenantId: '00000000-0000-4000-a000-000000000001',
          name: 'Atendimento Comercial e Vendas',
          status: 'DRAFT',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setLoading(false);
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
    />
  );
}
