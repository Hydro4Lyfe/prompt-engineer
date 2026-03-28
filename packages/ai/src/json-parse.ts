/**
 * Extracts and parses JSON from LLM output that may contain
 * markdown fences, leading text, or trailing explanation.
 */
export function safeJsonParse<T>(raw: string): T | null {
  let cleaned = raw.trim();

  // Strip markdown code fences
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Try direct parse
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall through
  }

  // Try extracting first JSON object
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]) as T;
    } catch {
      // Fall through
    }
  }

  return null;
}
