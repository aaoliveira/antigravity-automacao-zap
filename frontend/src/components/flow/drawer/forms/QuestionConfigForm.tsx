'use client';

import React from 'react';
import { HelpCircle, Variable, ShieldAlert, Clock } from 'lucide-react';

interface QuestionConfigFormProps {
  config: Record<string, any>;
  onChange: (updatedConfig: Record<string, any>) => void;
}

export function QuestionConfigForm({ config, onChange }: QuestionConfigFormProps) {
  const questionText = config.questionText || config.question || '';
  const targetVariable = config.targetVariable || config.saveVariable || '';
  const expectedType = config.expectedType || 'text';
  const customErrorMessage = config.customErrorMessage || '';
  const timeoutSeconds = config.timeoutSeconds || 300;

  return (
    <div className="space-y-4 text-xs">
      {/* Texto da Pergunta */}
      <div>
        <label className="block pb-1 font-semibold text-slate-200">
          Pergunta Enviada ao Cliente *
        </label>
        <textarea
          rows={3}
          value={questionText}
          onChange={(e) =>
            onChange({ ...config, questionText: e.target.value, question: e.target.value })
          }
          placeholder="Ex: Qual o seu nome completo?"
          className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-slate-200 outline-none focus:border-cyan-500/50"
        />
      </div>

      {/* Variável de Destino */}
      <div>
        <label className="block pb-1 font-semibold text-slate-200">
          Nome da Variável para Armazenar a Resposta *
        </label>
        <div className="relative">
          <span className="absolute left-3 top-2.5 font-mono text-cyan-400">{'{{'}</span>
          <input
            type="text"
            value={targetVariable}
            onChange={(e) =>
              onChange({
                ...config,
                targetVariable: e.target.value.replace(/[^a-zA-Z0-9_]/g, ''),
                saveVariable: e.target.value.replace(/[^a-zA-Z0-9_]/g, ''),
              })
            }
            placeholder="nome_cliente"
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 pl-8 pr-8 font-mono text-cyan-300 outline-none focus:border-cyan-500/50"
          />
          <span className="absolute right-3 top-2.5 font-mono text-cyan-400">{'}}'}</span>
        </div>
        <p className="pt-1 text-[11px] text-slate-400">
          Use apenas letras, números e underlines.
        </p>
      </div>

      {/* Tipo de Validação Esperada */}
      <div>
        <label className="block pb-1 font-semibold text-slate-200">
          Tipo de Dado Esperado
        </label>
        <select
          value={expectedType}
          onChange={(e) => onChange({ ...config, expectedType: e.target.value })}
          className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-200 outline-none focus:border-cyan-500/50"
        >
          <option value="text">Texto Livre (Qualquer resposta)</option>
          <option value="number">Número (Inteiro ou Decimal)</option>
          <option value="email">E-mail Válido</option>
          <option value="phone">Telefone / WhatsApp</option>
          <option value="regex">Expressão Regular (Regex Customizado)</option>
        </select>
      </div>

      {/* Expressão Regular se for regex */}
      {expectedType === 'regex' && (
        <div>
          <label className="block pb-1 font-semibold text-slate-200">Padrão Regex</label>
          <input
            type="text"
            value={config.validationRegex || ''}
            onChange={(e) => onChange({ ...config, validationRegex: e.target.value })}
            placeholder="^[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}$"
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-2 font-mono text-cyan-300 outline-none focus:border-cyan-500/50"
          />
        </div>
      )}

      {/* Mensagem de Erro Customizada */}
      <div>
        <label className="block pb-1 font-semibold text-slate-200">
          Mensagem de Erro em Resposta Inválida
        </label>
        <input
          type="text"
          value={customErrorMessage}
          onChange={(e) => onChange({ ...config, customErrorMessage: e.target.value })}
          placeholder="Ex: Resposta inválida. Por favor, tente novamente."
          className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-200 outline-none focus:border-cyan-500/50"
        />
        <p className="pt-1 text-[11px] text-slate-400">
          Enviada automaticamente caso o cliente envie um dado fora do formato esperado.
        </p>
      </div>

      {/* Timeout de Espera */}
      <div>
        <label className="block pb-1 font-semibold text-slate-200">
          Tempo Limite de Espera (Segundos)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={10}
            max={86400}
            value={timeoutSeconds}
            onChange={(e) => onChange({ ...config, timeoutSeconds: Number(e.target.value) })}
            className="w-28 rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-200 outline-none focus:border-cyan-500/50"
          />
          <span className="text-[11px] text-slate-400">
            {Math.round(timeoutSeconds / 60)} minutos de espera máxima
          </span>
        </div>
      </div>
    </div>
  );
}
