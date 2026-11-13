import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlockCatalogSidebar } from './BlockCatalogSidebar';

describe('BlockCatalogSidebar Component', () => {
  const onAddNodeMock = jest.fn();
  const onToggleMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve renderizar o catálogo com suas categorias principais', () => {
    render(
      <BlockCatalogSidebar
        isOpen={true}
        onToggle={onToggleMock}
        onAddNode={onAddNodeMock}
      />,
    );

    expect(screen.getByText('Catálogo de Blocos')).toBeInTheDocument();
    expect(screen.getByText('Gatilhos')).toBeInTheDocument();
    expect(screen.getByText('Mensagens WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Interações & Perguntas')).toBeInTheDocument();
    expect(screen.getByText('Lógica & Condições')).toBeInTheDocument();
    expect(screen.getByText('Ações & CRM')).toBeInTheDocument();
  });

  it('deve filtrar os blocos ao digitar no campo de busca', () => {
    render(
      <BlockCatalogSidebar
        isOpen={true}
        onToggle={onToggleMock}
        onAddNode={onAddNodeMock}
      />,
    );

    const searchInput = screen.getByPlaceholderText('Pesquisar bloco ou ação...');
    fireEvent.change(searchInput, { target: { value: 'Botões' } });

    expect(screen.getByText('Botões de Resposta')).toBeInTheDocument();
    expect(screen.queryByText('Qualquer Mensagem')).not.toBeInTheDocument();
  });

  it('deve disparar onAddNode ao clicar em um bloco', () => {
    render(
      <BlockCatalogSidebar
        isOpen={true}
        onToggle={onToggleMock}
        onAddNode={onAddNodeMock}
      />,
    );

    const textBlock = screen.getByText('Mensagem de Texto');
    fireEvent.click(textBlock);

    expect(onAddNodeMock).toHaveBeenCalledWith('message.text');
  });
});
