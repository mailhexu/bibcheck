import { useState } from "react";

export type BibTeXEntry = {
  id: string;
  type: string;
  fields: Record<string, string>;
};

function extractBracedContent(text: string, startPos: number = 0): [string, number] {
  let braceCount = 0;
  let content = "";
  let pos = startPos;

  while (pos < text.length) {
    const char = text[pos];
    if (char === '{') {
      braceCount++;
      if (braceCount === 1) {
        pos++;
        continue;
      }
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0) {
        break;
      }
    }
    if (braceCount > 0) {
      content += char;
    }
    pos++;
  }

  return [content, pos];
}

function parseFields(fieldsBlock: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let pos = 0;

  while (pos < fieldsBlock.length) {
    // Skip whitespace
    while (pos < fieldsBlock.length && /\s/.test(fieldsBlock[pos])) pos++;
    if (pos >= fieldsBlock.length) break;

    // Match field name
    const fieldMatch = /^([\w-]+)\s*=\s*/.exec(fieldsBlock.slice(pos));
    if (!fieldMatch) {
      pos++;
      continue;
    }

    const fieldName = fieldMatch[1];
    pos += fieldMatch[0].length;

    // Extract field value
    let fieldValue = "";
    if (fieldsBlock[pos] === '{') {
      const [content, endPos] = extractBracedContent(fieldsBlock, pos);
      fieldValue = content;
      pos = endPos + 1;
    } else if (fieldsBlock[pos] === '"') {
      pos++;
      const endQuote = fieldsBlock.indexOf('"', pos);
      if (endQuote !== -1) {
        fieldValue = fieldsBlock.slice(pos, endQuote);
        pos = endQuote + 1;
      }
    }

    if (fieldValue) {
      fields[fieldName.trim()] = fieldValue.trim();
      console.log("Parsed field:", fieldName.trim(), "=", fieldValue.trim());
    }

    // Skip to next field (past comma if present)
    while (pos < fieldsBlock.length && !/[\w-]/.test(fieldsBlock[pos])) pos++;
  }

  return fields;
}

function parseBibTeX(text: string): BibTeXEntry[] {
  console.log("Raw input:", text);
  
  const entries: BibTeXEntry[] = [];
  const entryRegex = /@(\w+)\s*{\s*([^,]+),/g;
  
  let pos = 0;
  while (pos < text.length) {
    const match = entryRegex.exec(text.slice(pos));
    if (!match) break;
    
    const type = match[1];
    const id = match[2].trim();
    pos += match.index + match[0].length;
    
    console.log("Found entry:", { type, id });
    
    // Find matching closing brace for the entry
    let braceCount = 1;
    let endPos = pos;
    while (braceCount > 0 && endPos < text.length) {
      if (text[endPos] === '{') braceCount++;
      if (text[endPos] === '}') braceCount--;
      endPos++;
    }
    
    if (braceCount === 0) {
      const fieldsBlock = text.slice(pos, endPos - 1);
      console.log("Fields block:", fieldsBlock);
      
      const fields = parseFields(fieldsBlock);
      const entry = { id, type, fields };
      console.log("Final entry:", entry);
      entries.push(entry);
    }
    
    pos += endPos - pos;
    entryRegex.lastIndex = 0; // Reset regex for next search from new position
  }
  
  return entries;
}

export function useBibTeXParser() {
  const [entries, setEntries] = useState<BibTeXEntry[]>([]);

  const parse = (text: string) => {
    const parsedEntries = parseBibTeX(text);
    setEntries(parsedEntries);
    return parsedEntries;
  };

  return { entries, parse };
}
