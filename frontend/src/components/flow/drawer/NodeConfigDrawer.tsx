'use client';

import React from 'react';
import { CustomFlowNode } from '../../../types/flow';
import { getCatalogItemByType } from '../../../lib/default-nodes';
import { TextMessageConfigForm } from './forms/TextMessageConfigForm';
import { ButtonsMessageConfigForm } from './forms/ButtonsMessageConfigForm';
import { QuestionConfigForm } from './forms/QuestionConfigForm';
import { ConditionConfigForm } from './forms/ConditionConfigForm';
import { MediaMessageConfigForm } from './forms/MediaMessageConfigForm';
import { GenericConfigForm } from './forms/GenericConfigForm';
import { X, Trash2, Copy, AlertTriangle, Layers } from 'lucide-react';

interface NodeConfigDrawerProps {
  selectedNode: CustomFlowNode | null;
  onClose: () => void;
  onUpdateConfig: (nodeId: string, updatedConfig: Record<string, any>) => void;
  onUpdateLabel?: (nodeId: string, label: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
}

export function NodeConfigDrawer({
  selectedNode,
  onClose,
  onUpdateConfig,
  onUpdateLabel,
  onDeleteNode,
  onDuplicateNode,
}: NodeConfigDrawerProps) {
  if (!selectedNode) return null;

  const type = selectedNode.data?.label || selectedNode.type || '';
  const catalogItem = getCatalogItemByType(type);
  const Icon = catalogItem?.icon || Layers;
  const color = catalogItem?.color || '#3b82f6';
  const config = selectedNode.data?.config || {};
  const errorMessage = selectedNode.data?.errorMessage;

  const handleConfigChange = (newConfig: Record<string, any>) => {
    onUpdateConfig(selectedNode.id, newConfig);
  };

  const renderForm = () => {
    if (type === 'message.text') {
      return <TextMessageConfigForm config={config} onChange={handleConfigChange} />;
    }
    if (type === 'message.buttons') {
      return <ButtonsMessageConfigForm config={config} onChange={handleConfigChange} />;
    }
    if (type === 'interaction.question' || type === 'interaction.capture') {
      return <QuestionConfigForm config={config} onChange={handleConfigChange} />;
    }
    if (type === 'logic.condition') {
      return <ConditionConfigForm config={config} onChange={handleConfigChange} />;
    }
    if (
      [
        'message.image',
        'message.video',
        'message.audio',
        'message.document',
        'message.sticker',
      ].includes(type)
    ) {
      return (
        <MediaMessageConfigForm
          type={type}
          config={config}
          onChange={handleConfigChange}
        />
      );
    }

    return (
      <GenericConfigForm
        type={type}
        config={config}
        onChange={handleConfigChange}
      />
    );
  };

  return (
    <aside className="absolute right-4 top-20 z-10 flex h-[calc(100vh-6.5rem)] w-96 flex-col rounded-2xl border border-slate-800/90 bg-slate-900/95 shadow-2xl backdrop-blur-md">
      {/* Cabeçalho do Drawer */}
      <div className="border-b border-slate-800/80 p-4">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl shadow"
              style={{ backgroundColor: `${color}25`, color }}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {catalogItem?.label || 'Configurar Bloco'}
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                ID: {selectedNode.id}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onDuplicateNode && (
              <button
                type="button"
                onClick={() => onDuplicateNode(selectedNode.id)}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
                title="Duplicar bloco"
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
            {onDeleteNode && (
              <button
                type="button"
                onClick={() => onDeleteNode(selectedNode.id)}
                className="rounded p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition"
                title="Excluir bloco"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
              title="Fechar painel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Alerta de Erro de Validação se houver */}
        {errorMessage && (
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <span className="font-semibold block">Atenção na Validação:</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}
      </div>

      {/* Formulário de Configuração Específico */}
      <div className="flex-1 overflow-y-auto p-4">{renderForm()}</div>
    </aside>
  );
}
