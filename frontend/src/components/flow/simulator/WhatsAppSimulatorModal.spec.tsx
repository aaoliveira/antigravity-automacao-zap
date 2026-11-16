import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WhatsAppSimulatorModal } from './WhatsAppSimulatorModal';
import { CustomFlowNode, CustomFlowEdge } from '../../../types/flow';

describe('WhatsAppSimulatorModal Component', () => {
  const onCloseMock = jest.fn();
  const onHighlightNodeMock = jest.fn();

  const nodes: CustomFlowNode[] = [
    {
      id: 'trigger-1',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: 'trigger.keyword',
        category: 'trigger',
        config: { keywords: ['olá', 'preço'] },
      },
    },
    {
      id: 'msg-1',
      type: 'custom',
      position: { x: 0, y: 100 },
      data: {
        label: 'message.buttons',
        category: 'message',
        config: {
          description: 'Escolha uma opção:',
          buttons: [
            { id: 'btn_vendas', displayText: 'Comprar' },
            { id: 'btn_suporte', displayText: 'Suporte' },
          ],
        },
      },
    },
    {
      id: 'msg-vendas',
      type: 'custom',
      position: { x: 0, y: 200 },
      data: {
        label: 'message.text',
        category: 'message',
        config: { text: 'Ótimo! O plano custa R$ 99/mês.' },
      },
    },
  ];

  const edges: CustomFlowEdge[] = [
    { id: 'e1', source: 'trigger-1', target: 'msg-1' },
    { id: 'e2', source: 'msg-1', target: 'msg-vendas', sourceHandle: 'btn_vendas' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve renderizar a interface do simulador aguardando a interação e palavra-chave inicial do cliente', () => {
    render(
      <WhatsAppSimulatorModal
        isOpen={true}
        onClose={onCloseMock}
        nodes={nodes}
        edges={edges}
        onHighlightNode={onHighlightNodeMock}
      />,
    );

    expect(screen.getByText('WhatsApp Simulator')).toBeInTheDocument();
    expect(screen.getByText('Simulação de Interação do Cliente')).toBeInTheDocument();
    expect(screen.getByText('"olá"')).toBeInTheDocument();
    expect(screen.getByText('"preço"')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Envie uma palavra do gatilho/i)).toBeInTheDocument();
  });

  it('deve alertar o usuário quando a mensagem enviada não corresponder a nenhum gatilho', async () => {
    render(
      <WhatsAppSimulatorModal
        isOpen={true}
        onClose={onCloseMock}
        nodes={nodes}
        edges={edges}
        onHighlightNode={onHighlightNodeMock}
      />,
    );

    const input = screen.getByPlaceholderText(/Envie uma palavra do gatilho/i);
    fireEvent.change(input, { target: { value: 'mensagem aleatoria desconhecida' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(
        screen.getByText(/Nenhum gatilho ativado para "mensagem aleatoria desconhecida"/i),
      ).toBeInTheDocument();
    });
  });

  it('deve disparar o fluxo quando o cliente envia a palavra-chave configurada', async () => {
    render(
      <WhatsAppSimulatorModal
        isOpen={true}
        onClose={onCloseMock}
        nodes={nodes}
        edges={edges}
        onHighlightNode={onHighlightNodeMock}
      />,
    );

    // Clica na sugestão de palavra-chave "olá"
    const keywordButton = screen.getByText('"olá"');
    fireEvent.click(keywordButton);

    // Aguarda o bot responder com as opções configuradas
    await waitFor(
      () => {
        expect(screen.getByText('Escolha uma opção:')).toBeInTheDocument();
        expect(screen.getByText('Comprar')).toBeInTheDocument();
        expect(screen.getByText('Suporte')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    expect(onHighlightNodeMock).toHaveBeenCalledWith('trigger-1');
  });

  it('deve simular resposta ao clicar em um botão interativo e avançar para o próximo nó', async () => {
    render(
      <WhatsAppSimulatorModal
        isOpen={true}
        onClose={onCloseMock}
        nodes={nodes}
        edges={edges}
        onHighlightNode={onHighlightNodeMock}
      />,
    );

    // Dispara com a palavra-chave
    fireEvent.click(screen.getByText('"preço"'));

    await waitFor(() => expect(screen.getByText('Comprar')).toBeInTheDocument(), {
      timeout: 3000,
    });

    const buyButton = screen.getByText('Comprar');
    fireEvent.click(buyButton);

    // O simulador deve disparar o próximo nó ("Ótimo! O plano custa R$ 99/mês.")
    await waitFor(
      () => {
        expect(screen.getByText('Ótimo! O plano custa R$ 99/mês.')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
