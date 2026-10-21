/**
 * Helper to detect and extract structured form schemas from text or markdown blocks.
 */
export function extractFormFromContent(content) {
  if (!content || typeof content !== "string") return null;

  // 1. Look for ```form ... ``` or ```json ... ``` blocks
  const codeBlockRegex = /```(?:form|json)?\s*([\s\S]*?)```/gi;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const raw = match[1].trim();
    try {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.fields || parsed.title) && Array.isArray(parsed.fields)) {
        return parsed;
      }
    } catch {
      // not JSON
    }
  }

  // 2. Look for raw JSON object with "title" and "fields"
  const rawJsonMatch = content.match(/\{\s*"title"\s*:\s*"[^"]+"\s*,\s*[\s\S]*?"fields"\s*:\s*\[[\s\S]*?\]\s*\}/);
  if (rawJsonMatch) {
    try {
      const parsed = JSON.parse(rawJsonMatch[0]);
      if (parsed && Array.isArray(parsed.fields)) {
        return parsed;
      }
    } catch {}
  }

  return null;
}
