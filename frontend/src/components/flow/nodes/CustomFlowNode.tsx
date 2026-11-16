'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { getCatalogItemByType } from '../../../lib/default-nodes';
import { FlowNodeData } from '../../../types/flow';
import { AlertCircle, CheckCircle2, Copy, Trash2, ArrowRight } from 'lucide-react';

export const CustomFlowNode = memo((props: any) => {
  const { id, data, selected } = props;
  const nodeData = data as FlowNodeData;
  const rawType =
    nodeData?.nodeType ||
    (data as any)?.type ||
    getCatalogItemByType(nodeData?.label || '')?.type ||
    nodeData?.label ||
    props.type ||
    '';
  const catalogItem = getCatalogItemByType(rawType) || getCatalogItemByType(nodeData?.label || '');
  const Icon = catalogItem?.icon;
  const color = catalogItem?.color || '#3b82f6';
  const isTrigger = catalogItem?.category === 'trigger' || rawType.startsWith('trigger');

  // Configuração e prévias
  const config = nodeData?.config || {};
  const errorMessage = nodeData?.errorMessage;
  const isSimulatedActive = nodeData?.isSimulatedActive;

  return (
    <div
      className={`relative min-w-[260px] max-w-[320px] rounded-xl border bg-slate-900 shadow-xl transition-all duration-150 ${
        selected
          ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-emerald-500/10'
          : 'border-slate-800 hover:border-slate-700'
      } ${isSimulatedActive ? 'border-amber-400 ring-4 ring-amber-400/50 shadow-amber-400/20' : ''}`}
    >
      {/* Handle de Entrada Superior (Apenas nós que não são gatilhos) */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-slate-400 hover:!bg-emerald-400 !w-3 !h-3 !border-slate-900"
        />
      )}

      {/* Cabeçalho do Nó */}
      <div
        className="flex items-center justify-between border-b border-slate-800/80 px-3.5 py-2.5 rounded-t-xl"
        style={{ borderTop: `3px solid ${color}` }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {Icon && <Icon className="h-4 w-4" />}
          </div>
          <div className="truncate">
            <span className="block truncate text-xs font-semibold text-slate-100">
              {catalogItem?.label || nodeData?.label || 'Bloco'}
            </span>
            <span className="block text-[10px] text-slate-400 capitalize">
              {catalogItem?.category || 'Ação'}
            </span>
          </div>
        </div>

        {/* Indicadores de Status e Erros */}
        <div className="flex items-center gap-1">
          {errorMessage ? (
            <div
              className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 animate-pulse"
              title={errorMessage}
            >
              <AlertCircle className="h-3.5 w-3.5" />
            </div>
          ) : (
            <div className="text-emerald-500/70" title="Configuração válida">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo / Prévia Visual do Nó */}
      <div className="px-3.5 py-3 text-xs text-slate-300">
        {renderNodePreview(rawType, config)}
      </div>

      {/* Handles de Saída Dinâmicos por Tipo */}
      {renderOutputHandles(rawType, config)}
    </div>
  );
});

CustomFlowNode.displayName = 'CustomFlowNode';

/**
 * Renderiza prévia descritiva do conteúdo configurado no nó
 */
function renderNodePreview(type: string, config: Record<string, any>) {
  const catalogItem = getCatalogItemByType(type);
  switch (type) {
    case 'trigger.keyword':
      return (
        <div className="flex flex-wrap gap-1">
          {(config.keywords || []).map((k: string, i: number) => (
            <span
              key={i}
              className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[11px] font-mono text-violet-300 border border-violet-500/30"
            >
              {k}
            </span>
          ))}
          {(!config.keywords || config.keywords.length === 0) && (
            <span className="italic text-slate-500">Nenhuma palavra-chave configurada</span>
          )}
        </div>
      );

    case 'message.text':
      return (
        <div className="line-clamp-3 rounded-lg bg-slate-950/60 p-2 font-sans text-slate-300 border border-slate-800/60">
          {config.text || <span className="italic text-slate-500">Mensagem vazia...</span>}
        </div>
      );

    case 'message.image':
      return (
        <div className="space-y-1">
          {config.url && (
            <div className="h-20 w-full overflow-hidden rounded bg-slate-950 border border-slate-800">
              <img src={config.url} alt="Preview" className="h-full w-full object-cover" />
            </div>
          )}
          {config.caption && <p className="truncate text-slate-400 italic">"{config.caption}"</p>}
        </div>
      );

    case 'message.buttons':
      return (
        <div className="space-y-1.5">
          <p className="line-clamp-2 text-slate-300">{config.description || 'Escolha uma opção:'}</p>
          <div className="space-y-1 pt-1">
            {(config.buttons || []).map((b: any, idx: number) => (
              <div
                key={b.id || idx}
                className="flex items-center justify-between rounded bg-slate-800/70 px-2 py-1 text-[11px] text-slate-200 border border-slate-700/50"
              >
                <span className="truncate">{b.displayText || b.id}</span>
                <span className="text-[10px] text-emerald-400 font-mono">Saída</span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'message.list':
      return (
        <div className="space-y-1">
          <p className="font-semibold text-slate-200">{config.title || 'Lista de Opções'}</p>
          <p className="text-[11px] text-slate-400">{config.description}</p>
          <span className="inline-block rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
            {config.buttonText || 'Ver Opções'}
          </span>
        </div>
      );

    case 'interaction.question':
      return (
        <div className="space-y-1.5">
          <p className="text-slate-200 font-medium">{config.questionText || 'Qual a sua resposta?'}</p>
          <div className="flex items-center gap-1.5 text-[11px] text-cyan-400">
            <span>Salva em:</span>
            <span className="font-mono bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/50">
              {`{{${config.targetVariable || 'resposta'}}}`}
            </span>
          </div>
        </div>
      );

    case 'logic.condition':
      return (
        <div className="space-y-1">
          <div className="rounded bg-amber-500/10 p-1.5 text-[11px] text-amber-300 border border-amber-500/20">
            Regra: <span className="font-mono">{config.rules?.[0]?.variable || 'var'}</span>{' '}
            {config.rules?.[0]?.operator || 'EQUALS'}{' '}
            <span className="font-semibold">{config.rules?.[0]?.value || '""'}</span>
          </div>
        </div>
      );

    case 'logic.delay':
      return (
        <div className="flex items-center gap-2 text-amber-300">
          <span>Aguardar:</span>
          <span className="font-mono font-bold text-sm bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
            {config.delaySeconds || 3}s
          </span>
        </div>
      );

    case 'action.add_tag':
      return (
        <div className="flex items-center gap-1.5 text-pink-300">
          <span>Tag:</span>
          <span className="rounded bg-pink-500/20 px-2 py-0.5 font-mono text-[11px] border border-pink-500/30">
            +{config.tag || 'nova_tag'}
          </span>
        </div>
      );

    case 'action.human_handoff':
      return (
        <div className="text-slate-300">
          <p className="text-[11px] text-pink-400 font-medium">Encaminha para Atendente</p>
          <p className="truncate text-slate-400 italic">"{config.message || 'Transferindo...'}"</p>
        </div>
      );

    case 'action.end':
      return <div className="text-rose-400 font-medium">Finaliza a conversa</div>;

    default:
      return (
        <div className="text-slate-400 italic">
          {catalogItem?.description || 'Bloco de fluxo configurável'}
        </div>
      );
  }
}

/**
 * Renderiza Handles de Saída especializados para cada tipo de nó
 */
function renderOutputHandles(type: string, config: Record<string, any>) {
  // 1. Botões de Resposta Rápida: Um handle por botão
  if (type === 'message.buttons') {
    const buttons = config.buttons || [];
    if (buttons.length > 0) {
      return (
        <div className="border-t border-slate-800/80 bg-slate-950/40 p-2 space-y-1.5 rounded-b-xl">
          {buttons.map((b: any, index: number) => (
            <div key={b.id || index} className="relative flex items-center justify-between py-0.5">
              <span className="text-[11px] font-medium text-slate-300 truncate max-w-[200px]">
                {b.displayText || b.id}
              </span>
              <Handle
                type="source"
                id={b.id || `btn_${index}`}
                position={Position.Right}
                className="!bg-emerald-400 !w-3 !h-3 hover:!scale-125 !border-slate-900"
              />
            </div>
          ))}
        </div>
      );
    }
  }

  // 2. Condição Se / Senão: Handle Verdadeiro e Handle Falso
  if (type === 'logic.condition') {
    return (
      <div className="flex justify-between border-t border-slate-800/80 bg-slate-950/40 px-3 py-2 rounded-b-xl">
        <div className="relative flex items-center gap-1">
          <span className="text-[11px] font-semibold text-emerald-400">Verdadeiro</span>
          <Handle
            type="source"
            id="true"
            position={Position.Bottom}
            className="!left-8 !bg-emerald-400 !w-3 !h-3 hover:!scale-125"
          />
        </div>
        <div className="relative flex items-center gap-1">
          <span className="text-[11px] font-semibold text-rose-400">Falso</span>
          <Handle
            type="source"
            id="false"
            position={Position.Bottom}
            className="!left-auto !right-6 !bg-rose-500 !w-3 !h-3 hover:!scale-125"
          />
        </div>
      </div>
    );
  }

  // 3. Switch: Handle para cada caso + default
  if (type === 'logic.switch') {
    const cases = config.cases || [];
    return (
      <div className="border-t border-slate-800/80 bg-slate-950/40 p-2 space-y-1 rounded-b-xl">
        {cases.map((c: any, idx: number) => (
          <div key={c.id || idx} className="relative flex items-center justify-between">
            <span className="text-[11px] text-amber-300">Caso: {c.label || c.value}</span>
            <Handle
              type="source"
              id={c.id || `case_${idx}`}
              position={Position.Right}
              className="!bg-amber-400 !w-3 !h-3 hover:!scale-125"
            />
          </div>
        ))}
        <div className="relative flex items-center justify-between pt-1 border-t border-slate-800/40">
          <span className="text-[11px] text-slate-400 italic">Padrão (Default)</span>
          <Handle
            type="source"
            id="default"
            position={Position.Right}
            className="!bg-slate-400 !w-3 !h-3 hover:!scale-125"
          />
        </div>
      </div>
    );
  }

  // 4. Nós terminais (action.end) não possuem handles de saída
  if (type === 'action.end') {
    return null;
  }

  // 5. Demais nós: Handle de Saída inferior padrão
  return (
    <Handle
      type="source"
      position={Position.Bottom}
      id="default"
      className="!bg-slate-400 hover:!bg-emerald-400 !w-3 !h-3 !border-slate-900"
    />
  );
}
