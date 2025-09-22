import { useState } from "react";
import { BibTeXEntry } from "./useBibTeXParser";
import { fetchBibTeXFromDOI } from "../services/api/doiApi";
import { fetchDOIFromArXiv } from "../services/api/arxivApi";
import { fetchDOIFromCrossRef } from "../services/api/crossrefApi";
import { ValidationConfig } from "./useValidationConfig";
import { parseBibTeXFields } from "../services/parsers/bibTexParser";

export interface ApiProgress {
  currentEntry: string;
  currentStep: string;
  completed: number;
  total: number;
}

export interface FieldConflict {
  field: string;
  originalValue: string;
  doiValue: string;
  accepted?: boolean;
}

export interface EntryConflicts {
  [entryId: string]: FieldConflict[];
}

export function useApiIntegration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ApiProgress | null>(null);

  // Normalize field values for comparison
  const normalizeFieldValue = (field: string, value: string): string => {
    if (!value) {
      console.log(`🔍 Normalizing ${field}: empty value`);
      return '';
    }

    // Remove leading zeros and whitespace
    let normalized = value.trim().replace(/^0+/, '');
    console.log(`🔍 Normalizing ${field}:`, { 
      original: value,
      afterTrim: normalized
    });

    switch (field) {
      case 'volume':
        // Convert to number and back to string to normalize
        const num = parseInt(normalized, 10);
        normalized = isNaN(num) ? normalized : num.toString();
        console.log(`🔢 Volume normalization:`, { 
          original: value,
          parsed: num,
          final: normalized,
          isNaN: isNaN(num)
        });
        return normalized;
      default:
        return normalized;
    }
  };

  // Returns updated entries, changes, and conflicts
  const fetchMissingFields = async (
    entries: BibTeXEntry[],
    onProgress?: (progress: ApiProgress, updatedEntry?: BibTeXEntry, changes?: Record<string, { fields: string[]; source: string }>, conflicts?: EntryConflicts) => void,
    enabledFields?: (keyof ValidationConfig)[],
    config?: ValidationConfig
  ) => {
    setLoading(true);
    setError(null);
    const updatedEntries: BibTeXEntry[] = [];
    const changes: Record<string, { fields: string[]; source: string }> = {};
    const conflicts: EntryConflicts = {};

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const progressInfo: ApiProgress = {
        currentEntry: entry.id,
        currentStep: "Processing entry...",
        completed: i,
        total: entries.length
      };
      setProgress(progressInfo);
      onProgress?.(progressInfo);

      let updatedEntry = { ...entry, fields: { ...entry.fields } };
      const entryChanges: string[] = [];
      const entryConflicts: FieldConflict[] = [];
      let changeSource = "";

      // If missing DOI and arXiv ID present, fetch DOI from arXiv
      if (!entry.fields.doi && entry.fields.arxiv) {
        progressInfo.currentStep = "Checking arXiv for DOI...";
        setProgress({ ...progressInfo });
        onProgress?.({ ...progressInfo });

        const doi = await fetchDOIFromArXiv(entry.fields.arxiv);
        if (doi) {
          updatedEntry.fields.doi = doi;
          entryChanges.push("doi");
          changeSource = "arxiv";
          progressInfo.currentStep = "Found DOI from arXiv";
          setProgress({ ...progressInfo });
          onProgress?.({ ...progressInfo }, updatedEntry, { [entry.id]: { fields: [...entryChanges], source: changeSource } });
        }
      }

      // If still missing DOI, try CrossRef API using bibliographic data
      if (!updatedEntry.fields.doi && (entry.fields.title || entry.fields.author || entry.fields.journal)) {
        progressInfo.currentStep = "Searching CrossRef for DOI...";
        setProgress({ ...progressInfo });
        onProgress?.({ ...progressInfo });

        const doi = await fetchDOIFromCrossRef(
          entry.fields.title,
          entry.fields.author,
          entry.fields.journal
        );
        if (doi) {
          updatedEntry.fields.doi = doi;
          entryChanges.push("doi");
          changeSource = "crossref";
          progressInfo.currentStep = "Found DOI from CrossRef";
          setProgress({ ...progressInfo });
          onProgress?.({ ...progressInfo }, updatedEntry, { [entry.id]: { fields: [...entryChanges], source: changeSource } });
        }
      }

      // If DOI present, fetch BibTeX from DOI.org and detect conflicts
      if (updatedEntry.fields.doi) {
        progressInfo.currentStep = "Validating against DOI.org data...";
        setProgress({ ...progressInfo });
        onProgress?.({ ...progressInfo });

          const bibtex = await fetchBibTeXFromDOI(updatedEntry.fields.doi);
          if (bibtex) {
            console.log('DOI.org/CrossRef BibTeX response for', updatedEntry.fields.doi, ':', bibtex);
            
            // Parse DOI.org/CrossRef bibtex data using our parser
            const doiFields = parseBibTeXFields(bibtex);
            
            console.log('🔍 Parsed DOI response for', entry.id);
            console.log('📊 BibTeX parsing results:', {
              totalFields: Object.keys(doiFields).length,
              fields: doiFields,
              parsedVolume: doiFields.volume,
              originalBibtex: bibtex
            });

          if (Object.keys(doiFields).length === 0) {
            console.warn('⚠️ No fields parsed from BibTeX:', bibtex);
          }

          console.log('Final parsed DOI fields:', doiFields);

          // Compare existing fields with DOI.org data and detect conflicts
          console.log('🔄 Comparing fields for entry:', entry.id);
          console.log('Original entry:', {
            id: entry.id,
            fields: entry.fields,
            originalVolume: entry.fields.volume
          });
          console.log('DOI data:', {
            fields: doiFields,
            doiVolume: doiFields.volume
          });
          console.log('Validation config:', {
            enabledFields: enabledFields || [],
            volumeEnabled: enabledFields?.includes('volume')
          });

          for (const [key, doiValue] of Object.entries(doiFields)) {
            const originalValue = entry.fields[key];
            console.log(`Comparing field ${key}:`, {
              originalValue,
              doiValue,
              isDifferent: originalValue !== doiValue,
              isEnabled: enabledFields?.includes(key as keyof ValidationConfig)
            });

            // Normalize values before comparison
            const normalizedOriginal = normalizeFieldValue(key, originalValue);
            const normalizedDoi = normalizeFieldValue(key, doiValue);

            console.log(`🔄 Comparing normalized values for ${key}:`, {
              original: {
                value: originalValue,
                normalized: normalizedOriginal
              },
              doi: {
                value: doiValue,
                normalized: normalizedDoi
              },
              different: normalizedOriginal !== normalizedDoi
            });

            if (originalValue && normalizedOriginal !== normalizedDoi) {
              // Field exists and differs - check if we should auto-accept or mark as conflict
              console.log(`🔴 CONFLICT for ${key}:`, {
                originalValue,
                doiValue,
                isVolumeField: key === 'volume',
                isEnabled: enabledFields?.includes(key as keyof ValidationConfig)
              });
              
              if (!enabledFields?.includes(key as keyof ValidationConfig)) {
                console.log(`⚠️ Field ${key} not enabled for validation, skipping conflict`);
                continue;
              }

              // Check for auto-accept configuration
              const shouldAutoAccept = config?.autoAcceptChanges;
              console.log(`🔄 Auto-accept for ${key}:`, shouldAutoAccept);
              
              if (shouldAutoAccept) {
                // Auto-accept the DOI value
                console.log(`✅ Auto-accepting DOI value for ${key}`);
                updatedEntry.fields[key] = doiValue;
                entryChanges.push(key);
                if (!changeSource) changeSource = "doi";
              } else {
                // Add as a conflict for user decision
                console.log(`⚠️ Adding conflict for ${key}`);
                entryConflicts.push({
                  field: key,
                  originalValue,
                  doiValue,
                  accepted: false
                });
              }
            } else if (!originalValue) {
              // Field missing - add it
              console.log(`Adding missing field ${key}: "${doiValue}"`);
              updatedEntry.fields[key] = doiValue;
              entryChanges.push(key);
              if (!changeSource) changeSource = "doi";
            } else {
              console.log(`Field ${key} matches: "${originalValue}"`);
            }
            // If values match, no action needed
          }

          if (entryConflicts.length > 0) {
            console.log('🎯 Final conflicts for', entry.id, ':', entryConflicts);
            conflicts[entry.id] = entryConflicts;
          } else {
            console.log('ℹ️ No conflicts found for', entry.id);
          }

          const stepMessage = entryConflicts.length > 0
            ? `Found ${entryConflicts.length} field conflicts`
            : "Validated against DOI.org";
          console.log('📝 Step complete:', stepMessage);
          progressInfo.currentStep = stepMessage;
          setProgress({ ...progressInfo });
          onProgress?.({ ...progressInfo }, updatedEntry, { [entry.id]: { fields: [...entryChanges], source: changeSource } }, conflicts);
        }
      }

      updatedEntries.push(updatedEntry);
      if (entryChanges.length > 0) {
        changes[entry.id] = { fields: entryChanges, source: changeSource };
      }

      progressInfo.completed = i + 1;
      progressInfo.currentStep = "Entry processed";
      setProgress({ ...progressInfo });
      onProgress?.({ ...progressInfo }, updatedEntry, changes, conflicts);
    }

    setLoading(false);
    setProgress(null);
    return { updatedEntries, changes, conflicts, error };
  };

  // Fetch missing fields for a single entry
  const fetchMissingFieldsForEntry = async (
    entry: BibTeXEntry,
    onProgress?: (progress: ApiProgress, updatedEntry?: BibTeXEntry, changes?: Record<string, { fields: string[]; source: string }>, conflicts?: EntryConflicts) => void,
    enabledFields?: (keyof ValidationConfig)[],
    config?: ValidationConfig
  ) => {
    console.log('🎬 fetchMissingFieldsForEntry started:', {
      entry,
      enabledFields,
      hasVolume: !!entry.fields.volume,
      volumeEnabled: enabledFields?.includes('volume')
    });
    const progressInfo: ApiProgress = {
      currentEntry: entry.id,
      currentStep: "Processing entry...",
      completed: 0,
      total: 1
    };
    setProgress(progressInfo);
    onProgress?.(progressInfo);

    let updatedEntry = { ...entry, fields: { ...entry.fields } };
    const entryChanges: string[] = [];
    const entryConflicts: FieldConflict[] = [];
    let changeSource = "";

    // If missing DOI and arXiv ID present, fetch DOI from arXiv
    if (!entry.fields.doi && entry.fields.arxiv) {
      progressInfo.currentStep = "Checking arXiv for DOI...";
      setProgress({ ...progressInfo });
      onProgress?.({ ...progressInfo });

      const doi = await fetchDOIFromArXiv(entry.fields.arxiv);
      if (doi) {
        updatedEntry.fields.doi = doi;
        entryChanges.push("doi");
        changeSource = "arxiv";
        progressInfo.currentStep = "Found DOI from arXiv";
        setProgress({ ...progressInfo });
        onProgress?.({ ...progressInfo }, updatedEntry, { [entry.id]: { fields: [...entryChanges], source: changeSource } });
      }
    }

    // If still missing DOI, try CrossRef API using bibliographic data
    if (!updatedEntry.fields.doi && (entry.fields.title || entry.fields.author || entry.fields.journal)) {
      progressInfo.currentStep = "Searching CrossRef for DOI...";
      setProgress({ ...progressInfo });
      onProgress?.({ ...progressInfo });

      const doi = await fetchDOIFromCrossRef(
        entry.fields.title,
        entry.fields.author,
        entry.fields.journal
      );
      if (doi) {
        updatedEntry.fields.doi = doi;
        entryChanges.push("doi");
        changeSource = "crossref";
        progressInfo.currentStep = "Found DOI from CrossRef";
        setProgress({ ...progressInfo });
        onProgress?.({ ...progressInfo }, updatedEntry, { [entry.id]: { fields: [...entryChanges], source: changeSource } });
      }
    }

    // If DOI present, fetch BibTeX from DOI.org and detect conflicts
    if (updatedEntry.fields.doi) {
      progressInfo.currentStep = "Validating against DOI.org data...";
      setProgress({ ...progressInfo });
      onProgress?.({ ...progressInfo });

        const bibtex = await fetchBibTeXFromDOI(updatedEntry.fields.doi);
        if (bibtex) {
          console.log('DOI.org/CrossRef BibTeX response for', updatedEntry.fields.doi, ':', bibtex);
          
          // Parse DOI.org/CrossRef bibtex data using our parser
          const doiFields = parseBibTeXFields(bibtex);
          
          console.log('🔍 Parsed DOI response for', entry.id);
          console.log('📊 BibTeX parsing results:', {
            totalFields: Object.keys(doiFields).length,
            fields: doiFields,
            parsedVolume: doiFields.volume,
            originalBibtex: bibtex
          });

        if (Object.keys(doiFields).length === 0) {
          console.warn('⚠️ No fields parsed from BibTeX:', bibtex);
        }

        console.log('Parsed DOI fields:', doiFields);

        // Compare existing fields with DOI.org data and detect conflicts
        console.log('🔄 Comparing fields for entry:', entry.id);
        console.log('Original entry:', {
          id: entry.id,
          fields: entry.fields,
          originalVolume: entry.fields.volume
        });
        console.log('DOI data:', {
          fields: doiFields,
          doiVolume: doiFields.volume
        });
        console.log('Validation config:', {
          enabledFields: enabledFields || [],
          volumeEnabled: enabledFields?.includes('volume')
        });

        for (const [key, doiValue] of Object.entries(doiFields)) {
          const originalValue = entry.fields[key];
          console.log(`Comparing field ${key}: "${originalValue}" vs "${doiValue}"`);

          // Normalize values before comparison
          const normalizedOriginal = normalizeFieldValue(key, originalValue);
          const normalizedDoi = normalizeFieldValue(key, doiValue);

          console.log(`🔄 Comparing normalized values for ${key}:`, {
            original: {
              value: originalValue,
              normalized: normalizedOriginal
            },
            doi: {
              value: doiValue,
              normalized: normalizedDoi
            },
            different: normalizedOriginal !== normalizedDoi
          });

          if (originalValue && normalizedOriginal !== normalizedDoi) {
            // Field exists and differs - this is a conflict
            console.log(`🔴 CONFLICT for ${key}:`, {
              originalValue,
              doiValue,
              isVolumeField: key === 'volume',
              isEnabled: enabledFields?.includes(key as keyof ValidationConfig)
            });
            
            if (!enabledFields?.includes(key as keyof ValidationConfig)) {
              console.log(`⚠️ Field ${key} not enabled for validation, skipping conflict`);
              continue;
            }
            
            console.log(`✅ Adding conflict for ${key}`);
            entryConflicts.push({
              field: key,
              originalValue,
              doiValue,
              accepted: false // User hasn't decided yet
            });
          } else if (!originalValue) {
            // Field missing - add it
            console.log(`Adding missing field ${key}: "${doiValue}"`);
            updatedEntry.fields[key] = doiValue;
            entryChanges.push(key);
            if (!changeSource) changeSource = "doi";
          } else {
            console.log(`Field ${key} matches: "${originalValue}"`);
          }
          // If values match, no action needed
        }

        if (entryConflicts.length > 0) {
          progressInfo.currentStep = `Found ${entryConflicts.length} field conflicts`;
        } else {
          progressInfo.currentStep = "Validated against DOI.org";
        }
        setProgress({ ...progressInfo });
        onProgress?.({ ...progressInfo }, updatedEntry, { [entry.id]: { fields: [...entryChanges], source: changeSource } }, { [entry.id]: entryConflicts });
      }
    }

    progressInfo.completed = 1;
    progressInfo.currentStep = "Entry processed";
    setProgress({ ...progressInfo });
    onProgress?.({ ...progressInfo }, updatedEntry, { [entry.id]: { fields: entryChanges, source: changeSource } }, { [entry.id]: entryConflicts });

    setProgress(null);
    return { updatedEntry, changes: { [entry.id]: { fields: entryChanges, source: changeSource } }, conflicts: { [entry.id]: entryConflicts } };
  };

  return { fetchMissingFields, fetchMissingFieldsForEntry, loading, error, progress };
}
