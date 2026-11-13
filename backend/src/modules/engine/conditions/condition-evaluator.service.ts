import { Injectable } from '@nestjs/common';
import { VariableContext } from '../types/execution.types';
import { VariableResolverService } from '../variables/variable-resolver.service';

export interface EvaluationRule {
  variable: string;
  operator:
    | 'EQUALS'
    | 'NOT_EQUALS'
    | 'CONTAINS'
    | 'NOT_CONTAINS'
    | 'GREATER_THAN'
    | 'LESS_THAN'
    | 'GREATER_OR_EQUAL'
    | 'LESS_OR_EQUAL'
    | 'IS_EMPTY'
    | 'IS_NOT_EMPTY'
    | 'STARTS_WITH'
    | 'ENDS_WITH'
    // Aliases amigáveis
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'greater_than'
    | 'less_than'
    | 'regex_match'
    | 'is_empty'
    | 'is_not_empty';
  value?: any;
}

export interface CompoundCondition {
  logicalOperator: 'AND' | 'OR';
  rules: EvaluationRule[];
}

@Injectable()
export class ConditionEvaluatorService {
  constructor(private readonly variableResolver: VariableResolverService) {}

  /**
   * Avalia um conjunto de regras compostas com AND ou OR de forma estritamente segura
   */
  evaluate(condition: CompoundCondition, context: VariableContext): boolean {
    if (!condition || !Array.isArray(condition.rules) || condition.rules.length === 0) {
      return true;
    }

    const logicalOperator = (condition.logicalOperator || 'AND').toUpperCase();

    if (logicalOperator === 'OR') {
      return condition.rules.some((rule) => this.evaluateSingleRule(rule, context));
    }

    // Padrão AND
    return condition.rules.every((rule) => this.evaluateSingleRule(rule, context));
  }

  /**
   * Avalia uma única regra relacional de forma segura (sem eval)
   */
  private evaluateSingleRule(rule: EvaluationRule, context: VariableContext): boolean {
    const varName = rule.variable || (rule as any).field || '';
    const rawActual = this.variableResolver.resolvePath(varName, context);
    const op = String(rule.operator || '').toUpperCase().trim();
    const expected = rule.value;

    switch (op) {
      case 'IS_EMPTY': {
        return (
          rawActual === undefined ||
          rawActual === null ||
          rawActual === '' ||
          (Array.isArray(rawActual) && rawActual.length === 0) ||
          (typeof rawActual === 'object' && Object.keys(rawActual).length === 0)
        );
      }

      case 'IS_NOT_EMPTY': {
        return !(
          rawActual === undefined ||
          rawActual === null ||
          rawActual === '' ||
          (Array.isArray(rawActual) && rawActual.length === 0) ||
          (typeof rawActual === 'object' && Object.keys(rawActual).length === 0)
        );
      }

      case 'EQUALS':
      case '==': {
        if (typeof rawActual === 'number' && !isNaN(Number(expected))) {
          return Number(rawActual) === Number(expected);
        }
        if (typeof rawActual === 'boolean') {
          return rawActual === (String(expected).toLowerCase() === 'true');
        }
        return String(rawActual ?? '').toLowerCase() === String(expected ?? '').toLowerCase();
      }

      case 'NOT_EQUALS':
      case '!=': {
        if (typeof rawActual === 'number' && !isNaN(Number(expected))) {
          return Number(rawActual) !== Number(expected);
        }
        if (typeof rawActual === 'boolean') {
          return rawActual !== (String(expected).toLowerCase() === 'true');
        }
        return String(rawActual ?? '').toLowerCase() !== String(expected ?? '').toLowerCase();
      }

      case 'CONTAINS': {
        const strActual = String(rawActual ?? '').toLowerCase();
        const strExpected = String(expected ?? '').toLowerCase();
        return strActual.includes(strExpected);
      }

      case 'NOT_CONTAINS': {
        const strActual = String(rawActual ?? '').toLowerCase();
        const strExpected = String(expected ?? '').toLowerCase();
        return !strActual.includes(strExpected);
      }

      case 'STARTS_WITH': {
        const strActual = String(rawActual ?? '').toLowerCase();
        const strExpected = String(expected ?? '').toLowerCase();
        return strActual.startsWith(strExpected);
      }

      case 'ENDS_WITH': {
        const strActual = String(rawActual ?? '').toLowerCase();
        const strExpected = String(expected ?? '').toLowerCase();
        return strActual.endsWith(strExpected);
      }

      case 'GREATER_THAN':
      case '>': {
        const numActual = Number(rawActual);
        const numExpected = Number(expected);
        if (isNaN(numActual) || isNaN(numExpected)) return false;
        return numActual > numExpected;
      }

      case 'LESS_THAN':
      case '<': {
        const numActual = Number(rawActual);
        const numExpected = Number(expected);
        if (isNaN(numActual) || isNaN(numExpected)) return false;
        return numActual < numExpected;
      }

      case 'GREATER_OR_EQUAL':
      case '>=': {
        const numActual = Number(rawActual);
        const numExpected = Number(expected);
        if (isNaN(numActual) || isNaN(numExpected)) return false;
        return numActual >= numExpected;
      }

      case 'LESS_OR_EQUAL':
      case '<=': {
        const numActual = Number(rawActual);
        const numExpected = Number(expected);
        if (isNaN(numActual) || isNaN(numExpected)) return false;
        return numActual <= numExpected;
      }

      case 'REGEX_MATCH': {
        try {
          const regex = new RegExp(String(expected), 'i');
          return regex.test(String(rawActual ?? ''));
        } catch {
          return false;
        }
      }

      default:
        return false;
    }
  }
}
