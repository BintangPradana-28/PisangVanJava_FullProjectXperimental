// lib/sanitize.ts
// Pure JS lightweight sanitizer that does not require heavy DOM engines like jsdom.
// Safe to run in any JS runtime (Node, Edge, Serverless).

export const DOMPurify = {
  sanitize(text: unknown): string {
    if (typeof text !== 'string') {
      return ''
    }
    // Remove all HTML tags to prevent tag injection and HTML pollution.
    // React handles character escaping automatically to prevent XSS during rendering.
    return text.replace(/<[^>]*>/g, '')
  }
}

export default DOMPurify

// Safely serializes a JSON-LD payload for use inside a <script type="application/ld+json">
// rendered via dangerouslySetInnerHTML. JSON.stringify alone does NOT escape "<", so a
// free-text field (e.g. an admin-entered product description) containing the literal
// sequence "</script>" could break out of the script tag and inject arbitrary markup —
// the HTML tokenizer parses "</script>" before the browser ever looks at the script's
// type attribute or content. Escaping "<" to "\u003c" neutralizes that without altering
// the JSON-LD's semantic meaning (parsers decode the unicode escape back to "<").
export function safeJsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}