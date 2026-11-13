import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeConfigDrawer } from './NodeConfigDrawer';
import { CustomFlowNode } from '../../../types/flow';

describe('NodeConfigDrawer Component', () => {
  const onUpdateConfigMock = jest.fn();
  const onCloseMock = jest.fn();
  const onDeleteNodeMock = jest.fn();
  const onDuplicateNodeMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve renderizar o formulário de mensagem de texto e atualizar o conteúdo', () => {
    const node: CustomFlowNode = {
      id: 'node_text_1',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: 'message.text',
        category: 'message',
        config: { text: 'Olá cliente' },
      },
    };

    render(
      <NodeConfigDrawer
        selectedNode={node}
        onClose={onCloseMock}
        onUpdateConfig={onUpdateConfigMock}
        onDeleteNode={onDeleteNodeMock}
        onDuplicateNode={onDuplicateNodeMock}
      />,
    );

    expect(screen.getByText('Mensagem de Texto')).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText('Digite a mensagem que o cliente receberá no WhatsApp...');
    expect(textarea).toHaveValue('Olá cliente');

    fireEvent.change(textarea, { target: { value: 'Nova mensagem alterada' } });
    expect(onUpdateConfigMock).toHaveBeenCalledWith('node_text_1', expect.objectContaining({
      text: 'Nova mensagem alterada',
    }));
  });

  it('deve renderizar o formulário de botões e permitir adicionar novo botão', () => {
    const node: CustomFlowNode = {
      id: 'node_buttons_1',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: 'message.buttons',
        category: 'message',
        config: {
          description: 'Menu',
          buttons: [{ id: 'btn_1', displayText: 'Opção 1' }],
        },
      },
    };

    render(
      <NodeConfigDrawer
        selectedNode={node}
        onClose={onCloseMock}
        onUpdateConfig={onUpdateConfigMock}
      />,
    );

    expect(screen.getByText('Botões de Resposta')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Opção 1')).toBeInTheDocument();

    const addButton = screen.getByText('Adicionar Botão');
    fireEvent.click(addButton);

    expect(onUpdateConfigMock).toHaveBeenCalledWith(
      'node_buttons_1',
      expect.objectContaining({
        buttons: expect.arrayContaining([
          expect.objectContaining({ id: 'btn_1' }),
          expect.objectContaining({ displayText: 'Opção 2' }),
        ]),
      }),
    );
  });

  it('deve exibir mensagem de erro de validação com destaque', () => {
    const node: CustomFlowNode = {
      id: 'node_err_1',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: 'message.text',
        category: 'message',
        config: { text: '' },
        errorMessage: 'A mensagem de texto não pode ficar vazia.',
      },
    };

    render(
      <NodeConfigDrawer
        selectedNode={node}
        onClose={onCloseMock}
        onUpdateConfig={onUpdateConfigMock}
      />,
    );

    expect(screen.getByText('Atenção na Validação:')).toBeInTheDocument();
    expect(screen.getByText('A mensagem de texto não pode ficar vazia.')).toBeInTheDocument();
  });
});
