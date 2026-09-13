/**
 * Safely parses JSON from a string, stripping markdown code blocks if present.
 */
export function safeParseJson<T>(text: string, defaultValue: T): T {
    try {
        // 1. Try direct parse
        return JSON.parse(text);
    } catch (e) {
        try {
            // 2. Try stripping markdown code blocks
            // Matches ```json { ... } ``` or ``` { ... } ```
            const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (jsonMatch && jsonMatch[1]) {
                return JSON.parse(jsonMatch[1].trim());
            }

            // 3. Try finding the first '{' and last '}'
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                const potentialJson = text.substring(firstBrace, lastBrace + 1);
                return JSON.parse(potentialJson);
            }
        } catch (innerError) {
            console.error("[JSON-Parser] Failed to parse JSON even after cleanup:", innerError);
            console.error("[JSON-Parser] Original text:", text);
        }
    }
    return defaultValue;
}
