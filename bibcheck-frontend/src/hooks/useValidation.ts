import { useCallback } from "react";
import { BibTeXEntry } from "./useBibTeXParser";

export type ValidationResult = {
  id: string;
  missingFields: string[];
};

const REQUIRED_FIELDS = [
  "title",
  "author",
  "journal",
  "year",
  "volume",
  "pages",
  "doi",
];

export function validateEntries(entries: BibTeXEntry[]): ValidationResult[] {
  return entries.map(entry => {
    const missingFields = REQUIRED_FIELDS.filter(
      field => !entry.fields[field] || entry.fields[field].trim() === ""
    );
    return {
      id: entry.id,
      missingFields,
    };
  });
}

// Hook version for App.tsx
export function useValidation() {
  const validate = useCallback(validateEntries, []);
  return { validateEntries: validate };
}
