import { transitions } from '@megha/constants';
import { DomainError } from '../errors/domain-error';
export function checkTransition(kind: string, from: string, to: string): void {
  if (!transitions[kind]?.[from]?.includes(to))
    throw new DomainError('INVALID_TRANSITION', `Cannot change ${from} to ${to}.`, 409);
}
