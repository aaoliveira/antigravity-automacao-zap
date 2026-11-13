'use client';

import React from 'react';
import { Plus, Trash2, LayoutGrid, Info, ArrowRight } from 'lucide-react';

interface ButtonsMessageConfigFormProps {
  config: Record<string, any>;
  onChange: (updatedConfig: Record<string, any>) => void;
}

export function ButtonsMessageConfigForm({
  config,
  onChange,
}: ButtonsMessageConfigFormProps) {
  const title = config.title || '';
  const description = config.description || config.text || '';
  const footer = config.footer || '';
  const buttons: Array<{ id: string; displayText: string }> = config.buttons || [];

  const handleAddButton = () => {
    if (buttons.length >= 3) return; // Limite oficial do WhatsApp de 3 botões
    const index = buttons.length + 1;
    const newButton = {
      id: `btn_opcao_${index}`,
      displayText: `Opção ${index}`,
    };
    onChange({
      ...config,
      buttons: [...buttons, newButton],
    });
  };

  const handleUpdateButton = (index: number, field: string, val: string) => {
    const updated = [...buttons];
    updated[index] = { ...updated[index], [field]: val };
    onChange({ ...config, buttons: updated });
  };

  const handleRemoveButton = (index: number) => {
    const updated = buttons.filter((_, i) => i !== index);
    onChange({ ...config, buttons: updated });
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Título e Texto Principal */}
      <div>
        <label className="block pb-1 font-semibold text-slate-200">
          Título da Mensagem (Opcional)
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          placeholder="Ex: Menu Principal"
          className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-200 outline-none focus:border-emerald-500/50"
        />
      </div>

      <div>
        <label className="block pb-1 font-semibold text-slate-200">
          Texto Principal (Descrição) *
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => onChange({ ...config, description: e.target.value, text: e.target.value })}
          placeholder="Digite a instrução ou pergunta para o cliente..."
          className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-200 outline-none focus:border-emerald-500/50"
        />
      </div>

      <div>
        <label className="block pb-1 font-semibold text-slate-200">
          Texto de Rodapé (Footer)
        </label>
        <input
          type="text"
          value={footer}
          onChange={(e) => onChange({ ...config, footer: e.target.value })}
          placeholder="Ex: Selecione uma opção para continuar"
          className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-200 outline-none focus:border-emerald-500/50"
        />
      </div>

      {/* Lista de Botões Configuráveis */}
      <div>
        <div className="flex items-center justify-between pb-2">
          <label className="font-semibold text-slate-200">
            Botões de Resposta Rápida ({buttons.length}/3)
          </label>
          {buttons.length < 3 && (
            <button
              type="button"
              onClick={handleAddButton}
              className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/30 transition"
            >
              <Plus className="h-3 w-3" /> Adicionar Botão
            </button>
          )}
        </div>

        <div className="space-y-2">
          {buttons.map((btn, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  <LayoutGrid className="h-3 w-3" /> Botão #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveButton(idx)}
                  className="rounded p-1 text-slate-500 hover:text-rose-400 transition"
                  title="Remover botão"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div>
                <label className="text-[10px] text-slate-400">Texto Visível no Botão</label>
                <input
                  type="text"
                  value={btn.displayText}
                  onChange={(e) => handleUpdateButton(idx, 'displayText', e.target.value)}
                  placeholder="Ex: Falar com Suporte"
                  className="w-full rounded border border-slate-800 bg-slate-900 p-1.5 text-xs text-slate-100 outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400">Identificador Interno (ID)</label>
                <input
                  type="text"
                  value={btn.id}
                  onChange={(e) => handleUpdateButton(idx, 'id', e.target.value)}
                  placeholder="Ex: btn_suporte"
                  className="w-full rounded border border-slate-800 bg-slate-900 p-1.5 text-xs font-mono text-slate-300 outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="flex items-center gap-1 text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                <ArrowRight className="h-3 w-3 text-emerald-400" />
                <span>Gera uma saída conectável exclusiva no bloco.</span>
              </div>
            </div>
          ))}

          {buttons.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-800 p-4 text-center text-slate-500">
              Nenhum botão adicionado. Clique no botão acima para adicionar até 3 opções.
            </div>
          )}
        </div>
      </div>

      {/* Alerta de Compatibilidade Baileys vs Cloud API */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-300">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold">Compatibilidade Automática:</span>
            <p className="text-amber-300/90 leading-relaxed">
              Em conexões <strong>Meta Cloud API</strong>, os botões serão exibidos nativamente.
              Em conexões <strong>Baileys</strong>, o motor aplicará fallback para menu de texto numerado,
              reconhecendo tanto números quanto os nomes das opções digitadas pelo cliente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
