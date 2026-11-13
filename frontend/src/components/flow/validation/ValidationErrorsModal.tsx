'use client';

import React from 'react';
import { ValidationErrorDetail } from '../../../types/flow';
import { AlertCircle, AlertTriangle, X, ArrowRight } from 'lucide-react';

interface ValidationErrorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  errors: ValidationErrorDetail[];
  warnings: ValidationErrorDetail[];
  onSelectNode: (nodeId: string) => void;
}

export function ValidationErrorsModal({
  isOpen,
  onClose,
  errors,
  warnings,
  onSelectNode,
}: ValidationErrorsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative flex max-h-[80vh] w-full max-w-xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Relatório de Validação da Automação
              </h3>
              <p className="text-xs text-slate-400">
                {errors.length} {errors.length === 1 ? 'erro impeditivo' : 'erros impeditivos'} e{' '}
                {warnings.length} {warnings.length === 1 ? 'aviso' : 'avisos'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lista de Erros e Avisos */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {errors.map((err, idx) => (
            <div
              key={`err_${idx}`}
              onClick={() => {
                if (err.nodeId) {
                  onSelectNode(err.nodeId);
                  onClose();
                }
              }}
              className="group flex cursor-pointer items-start justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 hover:border-rose-500/60 transition"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold text-xs text-rose-200 block">
                    {err.message}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-rose-400/80 font-mono">
                    {err.nodeId && <span>Nó: {err.nodeId}</span>}
                    {err.field && <span>Campo: {err.field}</span>}
                    <span>Código: {err.code}</span>
                  </div>
                </div>
              </div>

              {err.nodeId && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-rose-400 group-hover:text-rose-200 transition">
                  Corrigir <ArrowRight className="h-3 w-3" />
                </span>
              )}
            </div>
          ))}

          {warnings.map((warn, idx) => (
            <div
              key={`warn_${idx}`}
              className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-xs text-amber-200 block">
                  {warn.message}
                </span>
                <span className="text-[11px] text-amber-400/80 font-mono block">
                  {warn.nodeId ? `Nó: ${warn.nodeId}` : ''} ({warn.code})
                </span>
              </div>
            </div>
          ))}

          {errors.length === 0 && warnings.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              Nenhum problema encontrado. O fluxo está 100% válido para publicação!
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="border-t border-slate-800 p-3 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
