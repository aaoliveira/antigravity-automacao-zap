'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Save,
  CheckCircle,
  Play,
  UploadCloud,
  Undo2,
  Redo2,
  Sparkles,
  Smartphone,
  AlertTriangle,
  RotateCcw,
  Eye,
  Pencil,
  Trash2,
  Pause,
} from 'lucide-react';

interface FlowHeaderProps {
  flowName: string;
  onUpdateFlowName: (name: string) => void;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  onSave: () => void;
  onValidate: () => void;
  onTest: () => void;
  onPublish: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  errorCount?: number;
  instances?: Array<{ id: string; instanceName: string; providerType: string }>;
  selectedInstanceId?: string;
  onSelectInstance?: (id: string) => void;
  // Propriedades para o Modo Visualização
  isViewMode?: boolean;
  flowStatus?: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
  onEdit?: () => void;
  onInactivate?: () => void;
  onActivate?: () => void;
  onDelete?: () => void;
  onBack?: () => void;
}

export function FlowHeader({
  flowName,
  onUpdateFlowName,
  saveStatus,
  onSave,
  onValidate,
  onTest,
  onPublish,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  errorCount = 0,
  instances = [],
  selectedInstanceId,
  onSelectInstance,
  isViewMode = false,
  flowStatus = 'DRAFT',
  onEdit,
  onInactivate,
  onActivate,
  onDelete,
  onBack,
}: FlowHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(flowName);

  const handleFinishName = () => {
    setIsEditingName(false);
    if (tempName.trim()) {
      onUpdateFlowName(tempName.trim());
    } else {
      setTempName(flowName);
    }
  };

  return (
    <header className="relative z-20 flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-slate-900/90 px-4 backdrop-blur-md">
      {/* Lado Esquerdo: Voltar e Nome da Automação */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack || (() => window.history.back())}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-100 transition-colors"
          title="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            {!isViewMode && isEditingName ? (
              <input
                type="text"
                autoFocus
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleFinishName}
                onKeyDown={(e) => e.key === 'Enter' && handleFinishName()}
                className="rounded border border-emerald-500 bg-slate-950 px-2 py-0.5 text-sm font-semibold text-slate-100 outline-none"
              />
            ) : (
              <span
                onClick={() => {
                  if (!isViewMode) {
                    setTempName(flowName);
                    setIsEditingName(true);
                  }
                }}
                className={`text-sm font-semibold text-slate-100 ${
                  !isViewMode ? 'cursor-pointer hover:text-emerald-400' : ''
                } transition-colors`}
                title={!isViewMode ? 'Clique para renomear' : undefined}
              >
                {flowName || 'Nova Automação'}
              </span>
            )}

            {/* Badges de Modo e Status */}
            {isViewMode && (
              <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                <Eye className="h-3 w-3" />
                <span>Modo Visualização</span>
              </span>
            )}

            {flowStatus === 'PUBLISHED' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Ativo
              </span>
            )}
            {flowStatus === 'PAUSED' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Inativo / Pausado
              </span>
            )}
            {flowStatus === 'DRAFT' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                Rascunho
              </span>
            )}
          </div>

          {/* Indicador de Salvamento (Apenas no Modo Edição) */}
          {!isViewMode && (
            <div className="flex items-center gap-1.5 text-[11px]">
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle className="h-3 w-3" /> Salvo na nuvem
                </span>
              )}
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-amber-400">
                  <RotateCcw className="h-3 w-3 animate-spin" /> Salvando rascunho...
                </span>
              )}
              {saveStatus === 'unsaved' && (
                <span className="text-slate-400">Alterações pendentes</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lado Central: Desfazer/Refazer (Edição) ou Informativo (Visualização) */}
      <div className="hidden items-center gap-2 md:flex">
        {!isViewMode ? (
          <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950/60 p-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Refazer (Ctrl+Y)"
            >
              <Redo2 className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/60 border border-slate-800/80 px-3 py-1 rounded-xl">
            <span>Visualizando fluxo em modo leitura</span>
          </div>
        )}

        {/* Seletor de Instância WhatsApp */}
        {instances.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-xs">
            <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
            <select
              value={selectedInstanceId}
              onChange={(e) => onSelectInstance?.(e.target.value)}
              className="bg-transparent text-xs text-slate-300 outline-none cursor-pointer"
            >
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id} className="bg-slate-900 text-slate-200">
                  {inst.instanceName} ({inst.providerType})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Lado Direito: Ações */}
      <div className="flex items-center gap-2">
        {isViewMode ? (
          <>
            {/* Botão Testar no Simulador WhatsApp */}
            <button
              onClick={onTest}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
              title="Testar fluxo no Simulador WhatsApp Web"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Simular Conversa</span>
            </button>

            {/* Botão Inativar (se ativo) */}
            {flowStatus === 'PUBLISHED' && onInactivate && (
              <button
                onClick={onInactivate}
                className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition"
                title="Inativar/Pausar fluxo"
              >
                <Pause className="h-3.5 w-3.5 fill-current" />
                <span>Inativar</span>
              </button>
            )}

            {/* Botão Ativar (se inativo) */}
            {flowStatus === 'PAUSED' && onActivate && (
              <button
                onClick={onActivate}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                title="Ativar fluxo em produção"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Ativar</span>
              </button>
            )}

            {/* Botão Editar */}
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/20"
                title="Editar este fluxo"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Editar</span>
              </button>
            )}

            {/* Botão Excluir */}
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
                title="Excluir fluxo"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                <span>Excluir</span>
              </button>
            )}
          </>
        ) : (
          <>
            {/* Botão Validar */}
            <button
              onClick={onValidate}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                errorCount > 0
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                  : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
              }`}
              title="Validar integridade do fluxo"
            >
              {errorCount > 0 ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                  <span>{errorCount} {errorCount === 1 ? 'Erro' : 'Erros'}</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Validar</span>
                </>
              )}
            </button>

            {/* Botão Testar no Simulador WhatsApp */}
            <button
              onClick={onTest}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
              title="Abrir Simulador WhatsApp Web"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Simular Conversa</span>
            </button>

            {/* Botão Salvar Rascunho */}
            <button
              onClick={onSave}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700 transition"
              title="Salvar rascunho manualmente"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Salvar</span>
            </button>

            {/* Botão Publicar Versão */}
            <button
              onClick={onPublish}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500 active:scale-95 transition"
              title="Publicar nova versão oficial em produção"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>Publicar</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
