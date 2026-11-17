import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NodeConfigDrawer } from './NodeConfigDrawer';
import { CustomFlowNode } from '../../../types/flow';
import { FlowApi } from '../../../lib/api';

jest.mock('../../../lib/api', () => ({
  FlowApi: {
    uploadMedia: jest.fn(),
  },
}));

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

  it('deve renderizar o formulário de mídia para imagem com modo upload e url', () => {
    const node: CustomFlowNode = {
      id: 'node_media_1',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: 'message.image',
        category: 'message',
        config: {},
      },
    };

    render(
      <NodeConfigDrawer
        selectedNode={node}
        onClose={onCloseMock}
        onUpdateConfig={onUpdateConfigMock}
      />,
    );

    expect(screen.getByText('Imagem')).toBeInTheDocument();
    expect(screen.getByText('Upload de Arquivo')).toBeInTheDocument();
    expect(screen.getByText('URL Externa')).toBeInTheDocument();
    expect(screen.getByText('Clique para selecionar ou arraste o arquivo aqui')).toBeInTheDocument();
  });

  it('deve permitir alternar para aba URL Externa e preencher URL e legenda', () => {
    const node: CustomFlowNode = {
      id: 'node_media_2',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: 'message.image',
        category: 'message',
        config: {},
      },
    };

    render(
      <NodeConfigDrawer
        selectedNode={node}
        onClose={onCloseMock}
        onUpdateConfig={onUpdateConfigMock}
      />,
    );

    fireEvent.click(screen.getByText('URL Externa'));

    const inputUrl = screen.getByPlaceholderText('https://meusite.com.br/arquivo.pdf');
    expect(inputUrl).toBeInTheDocument();

    fireEvent.change(inputUrl, { target: { value: 'https://exemplo.com/foto.png' } });
    expect(onUpdateConfigMock).toHaveBeenCalledWith('node_media_2', expect.objectContaining({
      url: 'https://exemplo.com/foto.png',
    }));

    const captionTextarea = screen.getByPlaceholderText(
      'Digite uma legenda opcional... Suporta variáveis como {{contact.name}}',
    );
    fireEvent.change(captionTextarea, { target: { value: 'Confira nosso banner promocional' } });
    expect(onUpdateConfigMock).toHaveBeenCalledWith('node_media_2', expect.objectContaining({
      caption: 'Confira nosso banner promocional',
    }));
  });

  it('deve realizar upload de arquivo via FlowApi.uploadMedia ao selecionar arquivo', async () => {
    const mockUploadResponse = {
      success: true,
      url: 'http://localhost:3000/uploads/tenant-test/foto.png',
      relativeUrl: '/uploads/tenant-test/foto.png',
      fileName: 'foto.png',
      mimetype: 'image/png',
      size: 1024,
      mediaType: 'image' as const,
    };
    (FlowApi.uploadMedia as jest.Mock).mockResolvedValueOnce(mockUploadResponse);

    const node: CustomFlowNode = {
      id: 'node_media_3',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: 'message.image',
        category: 'message',
        config: {},
      },
    };

    const { container } = render(
      <NodeConfigDrawer
        selectedNode={node}
        onClose={onCloseMock}
        onUpdateConfig={onUpdateConfigMock}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const file = new File(['dummy content'], 'foto.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(FlowApi.uploadMedia).toHaveBeenCalledWith(file, expect.any(Function));
    });

    expect(onUpdateConfigMock).toHaveBeenCalledWith('node_media_3', expect.objectContaining({
      url: 'http://localhost:3000/uploads/tenant-test/foto.png',
      relativeUrl: '/uploads/tenant-test/foto.png',
      fileName: 'foto.png',
      mimetype: 'image/png',
      fileSize: 1024,
    }));
  });

  it('deve exibir campo específico de nome de arquivo para nó de documento', () => {
    const node: CustomFlowNode = {
      id: 'node_doc_1',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: 'message.document',
        category: 'message',
        config: {
          url: 'http://localhost:3000/uploads/tenant/manual.pdf',
          fileName: 'Manual_Usuario.pdf',
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

    expect(screen.getByText('Documento / PDF')).toBeInTheDocument();
    expect(screen.getByText('Nome de Exibição do Documento *')).toBeInTheDocument();

    const fileNameInput = screen.getByDisplayValue('Manual_Usuario.pdf');
    fireEvent.change(fileNameInput, { target: { value: 'Contrato_Assinado.pdf' } });

    expect(onUpdateConfigMock).toHaveBeenCalledWith('node_doc_1', expect.objectContaining({
      fileName: 'Contrato_Assinado.pdf',
    }));
  });

  it('deve exibir opção de áudio gravado (PTT) para nó de áudio', () => {
    const node: CustomFlowNode = {
      id: 'node_audio_1',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: 'message.audio',
        category: 'message',
        config: {
          isPtt: true,
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

    expect(screen.getByText('Áudio (PTT)')).toBeInTheDocument();
    expect(screen.getByText('Enviar como Áudio Gravado (PTT)')).toBeInTheDocument();

    const pttCheckbox = screen.getByRole('checkbox');
    expect(pttCheckbox).toBeChecked();

    fireEvent.click(pttCheckbox);
    expect(onUpdateConfigMock).toHaveBeenCalledWith('node_audio_1', expect.objectContaining({
      isPtt: false,
    }));
  });
});
