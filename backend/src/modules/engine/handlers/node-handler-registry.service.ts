import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WorkflowNodeHandler } from './node-handler.interface';
import { TriggerMessageHandler } from './trigger.handlers';
import {
  MessageTextHandler,
  MessageImageHandler,
  MessageVideoHandler,
  MessageAudioHandler,
  MessageDocumentHandler,
  MessageStickerHandler,
  MessageLocationHandler,
  MessageContactHandler,
  MessageButtonsHandler,
  MessageListHandler,
  MessageTemplateHandler,
} from './message.handlers';
import {
  InteractionQuestionHandler,
  InteractionCaptureHandler,
  InteractionChoiceHandler,
} from './interaction.handlers';
import {
  LogicConditionHandler,
  LogicSwitchHandler,
  LogicDelayHandler,
  LogicWaitForInputHandler,
} from './logic.handlers';
import {
  ActionAddTagHandler,
  ActionRemoveTagHandler,
  ActionUpdateContactHandler,
  ActionStartFlowHandler,
  ActionHumanHandoffHandler,
  ActionEndHandler,
  ActionSetVariableHandler,
} from './action.handlers';

@Injectable()
export class NodeHandlerRegistryService implements OnModuleInit {
  private readonly logger = new Logger(NodeHandlerRegistryService.name);
  private readonly handlers = new Map<string, WorkflowNodeHandler>();

  constructor(
    private readonly triggerMessageHandler: TriggerMessageHandler,
    private readonly messageTextHandler: MessageTextHandler,
    private readonly messageImageHandler: MessageImageHandler,
    private readonly messageVideoHandler: MessageVideoHandler,
    private readonly messageAudioHandler: MessageAudioHandler,
    private readonly messageDocumentHandler: MessageDocumentHandler,
    private readonly messageStickerHandler: MessageStickerHandler,
    private readonly messageLocationHandler: MessageLocationHandler,
    private readonly messageContactHandler: MessageContactHandler,
    private readonly messageButtonsHandler: MessageButtonsHandler,
    private readonly messageListHandler: MessageListHandler,
    private readonly messageTemplateHandler: MessageTemplateHandler,
    private readonly interactionQuestionHandler: InteractionQuestionHandler,
    private readonly interactionCaptureHandler: InteractionCaptureHandler,
    private readonly interactionChoiceHandler: InteractionChoiceHandler,
    private readonly logicConditionHandler: LogicConditionHandler,
    private readonly logicSwitchHandler: LogicSwitchHandler,
    private readonly logicDelayHandler: LogicDelayHandler,
    private readonly logicWaitForInputHandler: LogicWaitForInputHandler,
    private readonly actionAddTagHandler: ActionAddTagHandler,
    private readonly actionRemoveTagHandler: ActionRemoveTagHandler,
    private readonly actionUpdateContactHandler: ActionUpdateContactHandler,
    private readonly actionStartFlowHandler: ActionStartFlowHandler,
    private readonly actionHumanHandoffHandler: ActionHumanHandoffHandler,
    private readonly actionEndHandler: ActionEndHandler,
    private readonly actionSetVariableHandler: ActionSetVariableHandler,
  ) {}

  onModuleInit() {
    this.registerAll([
      this.triggerMessageHandler,
      this.messageTextHandler,
      this.messageImageHandler,
      this.messageVideoHandler,
      this.messageAudioHandler,
      this.messageDocumentHandler,
      this.messageStickerHandler,
      this.messageLocationHandler,
      this.messageContactHandler,
      this.messageButtonsHandler,
      this.messageListHandler,
      this.messageTemplateHandler,
      this.interactionQuestionHandler,
      this.interactionCaptureHandler,
      this.interactionChoiceHandler,
      this.logicConditionHandler,
      this.logicSwitchHandler,
      this.logicDelayHandler,
      this.logicWaitForInputHandler,
      this.actionAddTagHandler,
      this.actionRemoveTagHandler,
      this.actionUpdateContactHandler,
      this.actionStartFlowHandler,
      this.actionHumanHandoffHandler,
      this.actionEndHandler,
      this.actionSetVariableHandler,
    ]);
  }

  register(handler: WorkflowNodeHandler): void {
    const types = Array.isArray(handler.type) ? handler.type : [handler.type];
    for (const t of types) {
      const normalized = t.toLowerCase().trim();
      this.handlers.set(normalized, handler);
      // Suporta variação com ponto e underscore: "message.text" <-> "message_text"
      this.handlers.set(normalized.replace(/\./g, '_'), handler);
      this.handlers.set(normalized.replace(/_/g, '.'), handler);
    }
  }

  registerAll(handlers: WorkflowNodeHandler[]): void {
    for (const h of handlers) {
      this.register(h);
    }
    this.logger.log(`Catálogo de execução carregado com ${this.handlers.size} identificadores de nós.`);
  }

  getHandler(nodeType: string): WorkflowNodeHandler | undefined {
    if (!nodeType) return undefined;
    const normalized = nodeType.toLowerCase().trim();
    return (
      this.handlers.get(normalized) ||
      this.handlers.get(normalized.replace(/\./g, '_')) ||
      this.handlers.get(normalized.replace(/_/g, '.'))
    );
  }

  hasHandler(nodeType: string): boolean {
    return this.getHandler(nodeType) !== undefined;
  }
}
