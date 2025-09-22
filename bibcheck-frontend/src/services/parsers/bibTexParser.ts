/**
 * Parses BibTeX data and extracts fields and entry type.
 * Handles multiple field formats and entry types.
 */
export function parseBibTeXFields(bibtex: string): Record<string, string> {
  const fields: Record<string, string> = {};
  
  // First parse entry type
  const typeRegex = /@(\w+)\s*\{/;
  const typeMatch = bibtex.match(typeRegex);
  if (typeMatch) {
    fields.entryType = typeMatch[1].toLowerCase();
  }

  // Then try single line entries with quotes or braces
  let match;
  const singleLineRegex = /(\w+)\s*=\s*[{"']([^}"']+)[}"']/g;
  while ((match = singleLineRegex.exec(bibtex))) {
    const [, key, value] = match;
    if (key && value) {
      fields[key] = value.trim();
    }
  }

  // Then try entries with braces, allowing for newlines
  const bracesRegex = /(\w+)\s*=\s*{([^}]+)}/g;
  const normalizedBibtex = bibtex.replace(/\r?\n/g, ' ');
  while ((match = bracesRegex.exec(normalizedBibtex))) {
    const [, key, value] = match;
    if (key && value && !fields[key]) {
      // Remove extra whitespace and normalize newlines
      const normalizedValue = value.replace(/\s+/g, ' ').trim();
      fields[key] = normalizedValue;
    }
  }

  // Finally try any remaining formats
  const alternateRegex = /(\w+)\s*=\s*(?:{([^}]*)}|"([^"]*)"|'([^']*)'|\s*(\S[^,}]*?)(?=\s*(?:,|\}|$)))/g;
  while ((match = alternateRegex.exec(bibtex))) {
    const [, key, ...values] = match;
    const value = values.find(v => v !== undefined);
    if (key && value && !fields[key]) {
      fields[key] = value.trim();
    }
  }

  return fields;
}
