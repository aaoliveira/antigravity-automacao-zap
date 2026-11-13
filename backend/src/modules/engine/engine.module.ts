import { Module } from '@nestjs/common';
import { EngineController } from './engine.controller';
import { WorkflowEngineService } from './core/workflow-engine.service';
import { NodeHandlerRegistryService } from './handlers/node-handler-registry.service';
import { VariableResolverService } from './variables/variable-resolver.service';
import { ConditionEvaluatorService } from './conditions/condition-evaluator.service';
import { OutboxService } from './outbox/outbox.service';
import { IdempotencyService } from './resilience/idempotency.service';
import { ConcurrencyLockService } from './resilience/concurrency-lock.service';

// Handlers
import { TriggerMessageHandler } from './handlers/trigger.handlers';
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
} from './handlers/message.handlers';
import {
  InteractionQuestionHandler,
  InteractionCaptureHandler,
  InteractionChoiceHandler,
} from './handlers/interaction.handlers';
import {
  LogicConditionHandler,
  LogicSwitchHandler,
  LogicDelayHandler,
  LogicWaitForInputHandler,
} from './handlers/logic.handlers';
import {
  ActionAddTagHandler,
  ActionRemoveTagHandler,
  ActionUpdateContactHandler,
  ActionStartFlowHandler,
  ActionHumanHandoffHandler,
  ActionEndHandler,
  ActionSetVariableHandler,
} from './handlers/action.handlers';

const ALL_HANDLERS = [
  TriggerMessageHandler,
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
  InteractionQuestionHandler,
  InteractionCaptureHandler,
  InteractionChoiceHandler,
  LogicConditionHandler,
  LogicSwitchHandler,
  LogicDelayHandler,
  LogicWaitForInputHandler,
  ActionAddTagHandler,
  ActionRemoveTagHandler,
  ActionUpdateContactHandler,
  ActionStartFlowHandler,
  ActionHumanHandoffHandler,
  ActionEndHandler,
  ActionSetVariableHandler,
];

@Module({
  controllers: [EngineController],
  providers: [
    WorkflowEngineService,
    NodeHandlerRegistryService,
    VariableResolverService,
    ConditionEvaluatorService,
    OutboxService,
    IdempotencyService,
    ConcurrencyLockService,
    ...ALL_HANDLERS,
  ],
  exports: [
    WorkflowEngineService,
    NodeHandlerRegistryService,
    VariableResolverService,
    ConditionEvaluatorService,
    OutboxService,
    IdempotencyService,
    ConcurrencyLockService,
  ],
})
export class EngineModule {}
