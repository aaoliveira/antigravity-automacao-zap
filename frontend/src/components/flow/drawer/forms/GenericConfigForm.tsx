'use client';

import React from 'react';

interface GenericConfigFormProps {
  type: string;
  config: Record<string, any>;
  onChange: (updatedConfig: Record<string, any>) => void;
}

export function GenericConfigForm({ type, config, onChange }: GenericConfigFormProps) {
  // 1. Gatilho por palavra-chave
  if (type === 'trigger.keyword') {
    const keywords = (config.keywords || []).join(', ');
    return (
      <div className="space-y-4 text-xs">
        <div>
          <label className="block pb-1 font-semibold text-slate-200">
            Palavras-chave (Separadas por vírgula) *
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) =>
              onChange({
                ...config,
                keywords: e.target.value
                  .split(',')
                  .map((k) => k.trim())
                  .filter(Boolean),
              })
            }
            placeholder="olá, preco, suporte, comprar"
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-slate-200 outline-none focus:border-violet-500/50"
          />
          <p className="pt-1 text-[11px] text-slate-400">
            O fluxo será ativado quando a mensagem do cliente contiver qualquer um desses termos.
          </p>
        </div>
      </div>
    );
  }

  // 2. Atraso / Delay
  if (type === 'logic.delay') {
    const delaySeconds = config.delaySeconds || 3;
    return (
      <div className="space-y-4 text-xs">
        <div>
          <label className="block pb-1 font-semibold text-slate-200">
            Tempo de Atraso (Segundos) *
          </label>
          <input
            type="number"
            min={1}
            max={300}
            value={delaySeconds}
            onChange={(e) => onChange({ ...config, delaySeconds: Number(e.target.value) })}
            className="w-28 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-slate-200 outline-none focus:border-amber-500/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.showPresence ?? true}
            onChange={(e) => onChange({ ...config, showPresence: e.target.checked })}
            className="h-4 w-4 rounded accent-amber-500"
          />
          <span className="text-slate-300">Simular presença de "digitando..." durante o atraso</span>
        </div>
      </div>
    );
  }

  // 3. Adicionar / Remover Tag
  if (type === 'action.add_tag' || type === 'action.remove_tag') {
    const tag = config.tag || '';
    return (
      <div className="space-y-4 text-xs">
        <div>
          <label className="block pb-1 font-semibold text-slate-200">Nome da Etiqueta / Tag *</label>
          <input
            type="text"
            value={tag}
            onChange={(e) => onChange({ ...config, tag: e.target.value.trim().toLowerCase() })}
            placeholder="Ex: cliente_vip ou lead_qualificado"
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 font-mono text-pink-300 outline-none focus:border-pink-500/50"
          />
        </div>
      </div>
    );
  }

  // 4. Transferir Atendimento (Human Handoff)
  if (type === 'action.human_handoff') {
    return (
      <div className="space-y-4 text-xs">
        <div>
          <label className="block pb-1 font-semibold text-slate-200">
            Mensagem de Notificação ao Cliente
          </label>
          <textarea
            rows={3}
            value={config.message || ''}
            onChange={(e) => onChange({ ...config, message: e.target.value })}
            placeholder="Aguarde um momento enquanto conectamos você ao nosso time de suporte."
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-slate-200 outline-none focus:border-pink-500/50"
          />
        </div>
        <div>
          <label className="block pb-1 font-semibold text-slate-200">Setor / Departamento</label>
          <input
            type="text"
            value={config.department || ''}
            onChange={(e) => onChange({ ...config, department: e.target.value })}
            placeholder="Ex: Comercial, Financeiro, Nível 2"
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-200 outline-none focus:border-pink-500/50"
          />
        </div>
      </div>
    );
  }

  // 5. Encerrar Fluxo
  if (type === 'action.end') {
    return (
      <div className="space-y-4 text-xs">
        <div>
          <label className="block pb-1 font-semibold text-slate-200">
            Motivo do Encerramento (Auditoria Interna)
          </label>
          <input
            type="text"
            value={config.reason || ''}
            onChange={(e) => onChange({ ...config, reason: e.target.value })}
            placeholder="Ex: Atendimento concluído ou cliente cancelou"
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-slate-200 outline-none focus:border-rose-500/50"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="text-slate-400 italic text-xs">
      Este bloco não requer configurações adicionais obrigatórias.
    </div>
  );
}
