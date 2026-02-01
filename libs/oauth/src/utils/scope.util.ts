import { isFormat } from './formats.util';
import { InvalidScopeException } from '../exceptions';

const whiteSpace = /\s+/g;

export function parseScope(requestedScope?: string | null): string[] | undefined {
  if (requestedScope == null) {
    return undefined;
  }

  if (typeof requestedScope !== 'string') {
    throw new InvalidScopeException('Invalid parameter: `scope`');
  }

  const trimmed = requestedScope.trim();

  if (!isFormat.nqschar(trimmed)) {
    throw new InvalidScopeException('Invalid parameter: `scope`');
  }

  return trimmed.split(whiteSpace);
}
