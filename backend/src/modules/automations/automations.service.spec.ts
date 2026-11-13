import { Test, TestingModule } from '@nestjs/testing';
import { AutomationsService } from './automations.service';
import { PrismaService } from '../database/prisma.service';
import { FlowValidatorService } from './validator/flow-validator.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AutomationStatus } from '@prisma/client';

describe('AutomationsService (Unit Tests)', () => {
  let service: AutomationsService;
  let prismaMock: any;
  let validatorMock: any;

  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';
  const userId = '99999999-9999-9999-9999-999999999999';

  beforeEach(async () => {
    prismaMock = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: tenantA, name: 'Tenant A' }),
        create: jest.fn().mockResolvedValue({ id: tenantA, name: 'Tenant A' }),
      },
      automation: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      flowVersion: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      automationTrigger: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      flowVariable: {
        upsert: jest.fn(),
        create: jest.fn(),
      },
      flowExecution: {
        findMany: jest.fn(),
      },
    };

    validatorMock = {
      validate: jest.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: FlowValidatorService, useValue: validatorMock },
      ],
    }).compile();

    service = module.get<AutomationsService>(AutomationsService);
  });

  describe('create', () => {
    it('deve criar uma nova automação com rascunho padrão quando não fornecido', async () => {
      const createdId = 'auto-uuid-1';
      prismaMock.automation.create.mockResolvedValue({
        id: createdId,
        tenantId: tenantA,
        name: 'Fluxo Boas-vindas',
        status: AutomationStatus.DRAFT,
      });

      prismaMock.automation.findFirst.mockResolvedValue({
        id: createdId,
        tenantId: tenantA,
        name: 'Fluxo Boas-vindas',
        status: AutomationStatus.DRAFT,
        versions: [],
        triggers: [],
        variables: [],
        _count: { versions: 0, executions: 0 },
      });

      const result = await service.create(tenantA, userId, {
        name: 'Fluxo Boas-vindas',
      });

      expect(prismaMock.automation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: tenantA,
            name: 'Fluxo Boas-vindas',
            status: AutomationStatus.DRAFT,
          }),
        }),
      );
      expect(result.id).toBe(createdId);
    });
  });

  describe('findOne & Isolamento Multi-tenant', () => {
    it('deve retornar a automação quando pertencer ao tenant requisitante', async () => {
      prismaMock.automation.findFirst.mockResolvedValue({
        id: 'auto-1',
        tenantId: tenantA,
        name: 'Fluxo Tenant A',
        versions: [],
        _count: { versions: 0, executions: 0 },
      });

      const auto = await service.findOne(tenantA, 'auto-1');
      expect(auto.id).toBe('auto-1');
      expect(prismaMock.automation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'auto-1', tenantId: tenantA },
        }),
      );
    });

    it('deve lançar NotFoundException quando o tenant tentar acessar automação de outro tenant', async () => {
      prismaMock.automation.findFirst.mockResolvedValue(null);

      await expect(service.findOne(tenantB, 'auto-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('publish & versionamento imutável', () => {
    it('deve validar, gerar nova versão imutável e atualizar status para PUBLISHED', async () => {
      const autoId = 'auto-1';
      const validDraft = {
        schemaVersion: '1.0.0',
        nodes: [{ id: 'trig', type: 'trigger', config: {} }],
        edges: [],
      };

      prismaMock.automation.findFirst.mockResolvedValue({
        id: autoId,
        tenantId: tenantA,
        name: 'Fluxo Vendas',
        currentDraft: validDraft,
        versions: [],
        triggers: [],
        variables: [],
        _count: { versions: 0, executions: 0 },
      });

      prismaMock.flowVersion.findFirst.mockResolvedValue({ versionNumber: 2 }); // Última versão era 2
      prismaMock.flowVersion.create.mockResolvedValue({
        id: 'version-3',
        automationId: autoId,
        versionNumber: 3,
        isPublished: true,
      });

      const res = await service.publish(tenantA, autoId, userId, {
        releaseNotes: 'Correção de texto',
      });

      expect(validatorMock.validate).toHaveBeenCalledWith(validDraft);
      expect(prismaMock.flowVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            automationId: autoId,
            tenantId: tenantA,
            versionNumber: 3,
            isPublished: true,
            publishedBy: userId,
          }),
        }),
      );
      expect(prismaMock.automation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: autoId },
          data: expect.objectContaining({
            status: AutomationStatus.PUBLISHED,
            activeVersionId: 'version-3',
          }),
        }),
      );
      expect(res.success).toBe(true);
    });

    it('deve reprovar a publicação caso o fluxo possua erros estruturais de validação', async () => {
      validatorMock.validate.mockReturnValue({
        isValid: false,
        errors: [{ code: 'MISSING_TRIGGER', message: 'Sem gatilho' }],
        warnings: [],
      });

      prismaMock.automation.findFirst.mockResolvedValue({
        id: 'auto-1',
        tenantId: tenantA,
        currentDraft: { nodes: [] },
        versions: [],
        _count: { versions: 0, executions: 0 },
      });

      await expect(service.publish(tenantA, 'auto-1', userId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('restoreVersion', () => {
    it('deve restaurar a definição de uma versão histórica para o rascunho de trabalho', async () => {
      const autoId = 'auto-1';
      const versionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const historicalDefinition = { nodes: [{ id: 'n1', type: 'trigger' }] };

      prismaMock.automation.findFirst.mockResolvedValue({
        id: autoId,
        tenantId: tenantA,
        versions: [],
        _count: { versions: 0, executions: 0 },
      });

      prismaMock.flowVersion.findFirst.mockResolvedValue({
        id: versionId,
        automationId: autoId,
        versionNumber: 1,
        definition: historicalDefinition,
      });

      const result = await service.restoreVersion(tenantA, autoId, versionId);

      expect(prismaMock.automation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: autoId },
          data: { currentDraft: historicalDefinition },
        }),
      );
      expect(result.success).toBe(true);
      expect(result.restoredFromVersionNumber).toBe(1);
    });
  });

  describe('pause', () => {
    it('deve atualizar o status da automação para PAUSED', async () => {
      prismaMock.automation.findFirst.mockResolvedValue({
        id: 'auto-1',
        tenantId: tenantA,
        versions: [],
        _count: { versions: 0, executions: 0 },
      });

      prismaMock.automation.update.mockResolvedValue({
        id: 'auto-1',
        status: AutomationStatus.PAUSED,
      });

      const updated = await service.pause(tenantA, 'auto-1');
      expect(updated.status).toBe(AutomationStatus.PAUSED);
    });
  });

  describe('duplicate', () => {
    it('deve duplicar a automação e suas configurações com nome Cópia de...', async () => {
      prismaMock.automation.findFirst.mockResolvedValue({
        id: 'auto-source',
        tenantId: tenantA,
        name: 'Fluxo Original',
        currentDraft: { nodes: [] },
        variables: [{ name: 'email', type: 'STRING' }],
        triggers: [{ type: 'KEYWORD_EXACT', config: {}, isActive: true }],
        versions: [],
        _count: { versions: 1, executions: 5 },
      });

      prismaMock.automation.create.mockResolvedValue({
        id: 'auto-duplicated',
        tenantId: tenantA,
        name: 'Cópia de Fluxo Original',
        status: AutomationStatus.DRAFT,
      });

      await service.duplicate(tenantA, 'auto-source');

      expect(prismaMock.automation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Cópia de Fluxo Original',
            status: AutomationStatus.DRAFT,
          }),
        }),
      );
      expect(prismaMock.flowVariable.create).toHaveBeenCalled();
      expect(prismaMock.automationTrigger.create).toHaveBeenCalled();
    });
  });
});
