import { Injectable, Logger } from '@nestjs/common';
import { VariableContext } from '../types/execution.types';

@Injectable()
export class VariableResolverService {
  private readonly logger = new Logger(VariableResolverService.name);

  /**
   * Substitui interpolações de variáveis no formato {{variavel}} dentro do texto
   */
  interpolate(text: string, context: VariableContext): string {
    if (!text || typeof text !== 'string') {
      return text;
    }

    // Suporta {{variavel}} e {{ variavel }} com espaços opcionais
    return text.replace(/{{\s*([\w.-]+)\s*}}/g, (match, path) => {
      const value = this.resolvePath(path, context);
      if (value === undefined || value === null) {
        this.logger.debug(`Variável inexistente referenciada: ${path}. Substituindo por string vazia.`);
        return '';
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    });
  }

  /**
   * Resolve o valor de um caminho pontilhado dentro dos escopos do contexto
   */
  resolvePath(path: string, context: VariableContext): any {
    if (!path || !context) return undefined;

    const parts = path.split('.');
    const scope = parts[0];

    switch (scope) {
      case 'contact': {
        const direct = this.getNested(context.contact, parts.slice(1));
        if (direct !== undefined) return direct;
        if (context.contact?.customFields) {
          return this.getNested(context.contact.customFields, parts.slice(1));
        }
        return undefined;
      }

      case 'conversation':
        return this.getNested(context.conversation, parts.slice(1));

      case 'execution':
        if (parts.length > 2 && parts[1] === 'variables') {
          return this.getNested(context.execution.variables, parts.slice(2));
        }
        return this.getNested(context.execution, parts.slice(1));

      case 'company':
      case 'tenant':
        return this.getNested(context.company, parts.slice(1));

      case 'flow':
        return this.getNested(context.flow, parts.slice(1));

      default:
        // Se não possui prefixo explícito, procura primeiro nas variáveis de execução
        if (context.execution?.variables && context.execution.variables[path] !== undefined) {
          return context.execution.variables[path];
        }
        // Em seguida, tenta campos do contato
        if (context.contact && (context.contact as any)[path] !== undefined) {
          return (context.contact as any)[path];
        }
        return undefined;
    }
  }

  /**
   * Auxiliar para navegar recursivamente em objetos aninhados
   */
  private getNested(obj: any, parts: string[]): any {
    if (!obj || parts.length === 0) return obj;

    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }
}
