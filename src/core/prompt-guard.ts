const INJECTION_PATTERNS = [
  /ignore (all )?previous instructions/i,
  /system prompt/i,
  /reveal .*secret/i,
  /disable .*security/i,
  /act as root/i,
  /override policy/i,
  /sudo /i
];

export interface PromptGuardResult {
  blocked: boolean;
  reasons: string[];
}

export function detectPromptInjection(input: string): PromptGuardResult {
  const reasons = INJECTION_PATTERNS
    .filter((pattern) => pattern.test(input))
    .map((pattern) => `Matched pattern: ${pattern}`);

  return {
    blocked: reasons.length > 0,
    reasons
  };
}
