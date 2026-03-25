// Variable recursive resolution engine with circular detection
import type { EnvironmentVariable } from '../types';

export const MAX_RESOLVE_DEPTH = 10;

export interface ResolveContext {
  localVars?: EnvironmentVariable[];
  envVars?: EnvironmentVariable[];
  pathStack?: string[];
  depth?: number;
}

// VariableResolver interface for extensible variable resolution
export interface VariableResolver {
  resolve(key: string, context: ResolveContext): string | undefined;
  supports(key: string): boolean;
}

// Static variable resolver using Map-based priority (local > env)
export class StaticVariableResolver implements VariableResolver {
  private varMap: Map<string, EnvironmentVariable>;

  constructor(envVars: EnvironmentVariable[] = [], localVars: EnvironmentVariable[] = []) {
    // Use Map to establish clear priority: localVars override envVars
    this.varMap = new Map();
    // First add envVars
    envVars.forEach(v => {
      if (v.enabled) {
        this.varMap.set(v.key, v);
      }
    });
    // Then localVars override
    localVars.forEach(v => {
      if (v.enabled) {
        this.varMap.set(v.key, v);
      }
    });
  }

  supports(key: string): boolean {
    return this.varMap.has(key);
  }

  resolve(key: string): string | undefined {
    return this.varMap.get(key)?.value;
  }
}

// Main variable resolution function with circular detection
export function resolveVariables(
  value: string,
  resolver: VariableResolver,
  context: ResolveContext = {}
): string {
  const { pathStack = [], depth = 0 } = context;

  // 1. Prevent infinite recursion (depth limit)
  if (depth > MAX_RESOLVE_DEPTH) {
    throw new Error(`Variable resolution exceeded max depth (${MAX_RESOLVE_DEPTH})`);
  }

  // 2. Single-pass replacement with recursive resolution
  let result = value;
  const variablePattern = /\{\{\s*(\w+)\s*\}\}/g;

  result = result.replace(variablePattern, (match, varName) => {
    // Check for circular reference using pathStack
    // This allows a = {{b}}/{{b}} but detects a -> b -> a
    if (pathStack.includes(varName)) {
      throw new Error(
        `Circular variable reference detected: ${[...pathStack, varName].join(' -> ')}`
      );
    }

    if (!resolver.supports(varName)) {
      return match; // Keep unresolved variable for caller to handle
    }

    const resolvedValue = resolver.resolve(varName, context);
    if (resolvedValue === undefined) {
      return match;
    }

    // Recursively resolve nested variables (e.g., baseURL = {{host}}/api)
    return resolveVariables(resolvedValue, resolver, {
      ...context,
      pathStack: [...pathStack, varName],
      depth: depth + 1,
    });
  });

  return result;
}

// Convenience function for backward compatibility
export function applyEnvironmentVariables(
  value: string,
  envVars: EnvironmentVariable[],
  localVars?: EnvironmentVariable[]
): string {
  const resolver = new StaticVariableResolver(envVars, localVars);
  return resolveVariables(value, resolver);
}

// Extract unresolved variables from a string
export function extractUnresolvedVariables(value: string): string[] {
  const variablePattern = /\{\{\s*(\w+)\s*\}\}/g;
  const matches: string[] = [];
  let match;

  while ((match = variablePattern.exec(value)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1]);
    }
  }

  return matches;
}

// Check if a string contains template variables
export function hasTemplateVariables(value: string): boolean {
  return /\{\{\s*\w+\s*\}\}/.test(value);
}
