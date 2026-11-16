import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlowHeader } from './FlowHeader';

describe('FlowHeader Component', () => {
  const defaultProps = {
    flowName: 'Fluxo de Vendas',
    onUpdateFlowName: jest.fn(),
    saveStatus: 'saved' as const,
    onSave: jest.fn(),
    onValidate: jest.fn(),
    onTest: jest.fn(),
    onPublish: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    canUndo: true,
    canRedo: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Modo Edição (Padrão)', () => {
    it('deve renderizar botões de edição como Salvar, Validar, Publicar e Testar', () => {
      render(<FlowHeader {...defaultProps} isViewMode={false} />);

      expect(screen.getByText('Fluxo de Vendas')).toBeInTheDocument();
      expect(screen.getByText('Salvar')).toBeInTheDocument();
      expect(screen.getByText('Validar')).toBeInTheDocument();
      expect(screen.getByText('Publicar')).toBeInTheDocument();
      expect(screen.getByText('Simular Conversa')).toBeInTheDocument();
    });

    it('deve disparar onSave ao clicar em Salvar', () => {
      render(<FlowHeader {...defaultProps} isViewMode={false} />);
      fireEvent.click(screen.getByText('Salvar'));
      expect(defaultProps.onSave).toHaveBeenCalled();
    });
  });

  describe('Modo Visualização (isViewMode = true)', () => {
    const viewProps = {
      ...defaultProps,
      isViewMode: true,
      flowStatus: 'PUBLISHED' as const,
      onEdit: jest.fn(),
      onInactivate: jest.fn(),
      onActivate: jest.fn(),
      onDelete: jest.fn(),
      onBack: jest.fn(),
    };

    it('deve exibir badge de Modo Visualização e status Ativo', () => {
      render(<FlowHeader {...viewProps} />);

      expect(screen.getByText('Modo Visualização')).toBeInTheDocument();
      expect(screen.getByText('Ativo')).toBeInTheDocument();
    });

    it('deve renderizar botões de ação: Inativar, Editar, Excluir e Simular quando PUBLISHED', () => {
      render(<FlowHeader {...viewProps} />);

      expect(screen.getByText('Inativar')).toBeInTheDocument();
      expect(screen.getByText('Editar')).toBeInTheDocument();
      expect(screen.getByText('Excluir')).toBeInTheDocument();
      expect(screen.getByText('Simular Conversa')).toBeInTheDocument();

      // Botões de edição direta como Salvar e Publicar não devem aparecer
      expect(screen.queryByText('Salvar')).not.toBeInTheDocument();
      expect(screen.queryByText('Publicar')).not.toBeInTheDocument();
    });

    it('deve exibir botão Ativar quando o fluxo estiver PAUSED', () => {
      render(<FlowHeader {...viewProps} flowStatus="PAUSED" />);

      expect(screen.getByText('Inativo / Pausado')).toBeInTheDocument();
      expect(screen.getByText('Ativar')).toBeInTheDocument();
      expect(screen.queryByText('Inativar')).not.toBeInTheDocument();
    });

    it('deve acionar as callbacks de ações ao clicar nos botões', () => {
      render(<FlowHeader {...viewProps} />);

      fireEvent.click(screen.getByText('Inativar'));
      expect(viewProps.onInactivate).toHaveBeenCalled();

      fireEvent.click(screen.getByText('Editar'));
      expect(viewProps.onEdit).toHaveBeenCalled();

      fireEvent.click(screen.getByText('Excluir'));
      expect(viewProps.onDelete).toHaveBeenCalled();
    });
  });
});
