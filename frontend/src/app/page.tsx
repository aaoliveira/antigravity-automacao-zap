'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Plus,
  Play,
  Layers,
  ArrowRight,
  Workflow,
  MessageSquare,
  Bot,
  Zap,
} from 'lucide-react';

export default function HomePage() {
  const defaultFlowId = '00000000-0000-4000-b000-000000000001';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Navbar Superior */}
      <nav className="flex h-16 items-center justify-between border-b border-slate-800/80 px-8 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/20">
            <Zap className="h-5 w-5" />
          </div>
          <span className="text-base font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            ZapFlow SaaS
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/automations/${defaultFlowId}`}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20"
          >
            <Plus className="h-4 w-4" />
            <span>Abrir Construtor Visual</span>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400 mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Visual Flow Builder para WhatsApp & Evolution API</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
          Crie fluxos conversacionais inteligentes{' '}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            estilo Typebot e n8n
          </span>
        </h1>

        <p className="text-base text-slate-400 max-w-2xl mb-8 leading-relaxed">
          Arraste e conecte gatilhos, mensagens multimídia, botões com saídas nomeadas, perguntas com captura de variáveis,
          condições e inteligência artificial diretamente no seu WhatsApp Business.
        </p>

        {/* Card de Ação Principal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-xl text-left">
          <Link
            href={`/automations/${defaultFlowId}`}
            className="group relative flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-slate-900/80 p-6 hover:border-emerald-500/60 transition shadow-xl hover:shadow-emerald-500/10"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 mb-4">
                <Workflow className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                Atendimento Comercial
              </h3>
              <p className="text-xs text-slate-400 pt-1">
                Fluxo completo com menu de opções, captura de nome e confirmação.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 pt-4">
              <span>Abrir no Editor</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            href={`/automations/00000000-0000-4000-b000-000000000002`}
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-6 hover:border-slate-700 transition shadow-xl"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-400 mb-4">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100 group-hover:text-violet-400 transition-colors">
                Novo Fluxo em Branco
              </h3>
              <p className="text-xs text-slate-400 pt-1">
                Inicie do zero arrastando novos blocos pelo catálogo lateral.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 pt-4">
              <span>Criar Rascunho</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
