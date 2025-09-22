import React, { useState } from "react";
import { Container, Typography, Box, Button, CircularProgress, LinearProgress, Alert } from "@mui/material";
import MainLayout from "./components/layout/MainLayout";
import FileUpload from "./components/features/FileUpload/FileUpload";
import BibTeXEditor from "./components/features/BibTeXEditor/BibTeXEditor";
import ValidationConfig from "./components/features/ValidationConfig/ValidationConfig";
import ApiError from "./components/features/ApiError/ApiError";
import DownloadBibTeX from "./components/features/DownloadBibTeX/DownloadBibTeX";
import { useValidation } from "./hooks/useValidation";
import { useValidationConfig } from "./hooks/useValidationConfig";
import { useApiIntegration, ApiProgress, EntryConflicts } from "./hooks/useApiIntegration";
import type { BibTeXEntry } from "./hooks/useBibTeXParser";
import type { ValidationResult } from "./hooks/useValidation";

function App() {
  const [entries, setEntries] = useState<BibTeXEntry[]>([]);
  const [originalEntries, setOriginalEntries] = useState<BibTeXEntry[]>([]);
  const { validateEntries } = useValidation();
  const { fetchMissingFields, fetchMissingFieldsForEntry, restoreOriginalField, loading, error, progress } = useApiIntegration();
  const { getEnabledFields, config } = useValidationConfig();
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [apiChanges, setApiChanges] = useState<Record<string, { fields: string[]; source: string }>>({});
  const [conflicts, setConflicts] = useState<EntryConflicts>({});
  const [processingEntries, setProcessingEntries] = useState<Set<string>>(new Set());

  const handleParse = (parsedEntries: BibTeXEntry[]) => {
    setOriginalEntries(parsedEntries);
    setEntries(parsedEntries);
    const results = validateEntries(parsedEntries);
    setValidationResults(results);
    setApiChanges({});
    setConflicts({});
  };

  const handleProgress = (
    progressUpdate: ApiProgress,
    updatedEntry?: BibTeXEntry,
    partialChanges?: Record<string, { fields: string[]; source: string }>,
    partialConflicts?: EntryConflicts
  ) => {
    // Update entries in real-time as they are processed
    if (updatedEntry) {
      setEntries(currentEntries => {
        return currentEntries.map(entry =>
          entry.id === updatedEntry.id ? updatedEntry : entry
        );
      });
    }

    // Update changes in real-time
    if (partialChanges) {
      setApiChanges(currentChanges => ({
        ...currentChanges,
        ...partialChanges
      }));
    }

    // Update conflicts in real-time
    if (partialConflicts) {
      setConflicts(currentConflicts => ({
        ...currentConflicts,
        ...partialConflicts
      }));
    }
  };

  const handleAcceptCorrection = (entryId: string, field: string, doiValue: string) => {
    setEntries(currentEntries => {
      return currentEntries.map(entry => {
        if (entry.id === entryId) {
          return {
            ...entry,
            fields: {
              ...entry.fields,
              [field]: doiValue
            }
          };
        }
        return entry;
      });
    });

    // Mark conflict as accepted
    setConflicts(currentConflicts => {
      const entryConflicts = currentConflicts[entryId];
      if (entryConflicts) {
        const updatedConflicts = entryConflicts.map(conflict =>
          conflict.field === field ? { ...conflict, accepted: true } : conflict
        );
        return {
          ...currentConflicts,
          [entryId]: updatedConflicts
        };
      }
      return currentConflicts;
    });

    // Re-validate after correction
    setEntries(currentEntries => {
      const results = validateEntries(currentEntries);
      setValidationResults(results);
      return currentEntries;
    });
  };

  const handleRevertField = (entry: BibTeXEntry, field: string) => {
    // Get the original value
    const originalValue = restoreOriginalField(entry, field);
    if (originalValue === undefined) {
      console.warn(`No original value found for ${entry.id}.${field}`);
      return;
    }

    // Update the entry with the original value
    setEntries(currentEntries => {
      return currentEntries.map(currentEntry => {
        if (currentEntry.id === entry.id) {
          return {
            ...currentEntry,
            fields: {
              ...currentEntry.fields,
              [field]: originalValue
            }
          };
        }
        return currentEntry;
      });
    });

    // Remove the conflict
    setConflicts(currentConflicts => {
      const entryConflicts = currentConflicts[entry.id];
      if (entryConflicts) {
        const updatedConflicts = entryConflicts.filter(conflict => conflict.field !== field);
        if (updatedConflicts.length === 0) {
          const { [entry.id]: _, ...rest } = currentConflicts;
          return rest;
        }
        return {
          ...currentConflicts,
          [entry.id]: updatedConflicts
        };
      }
      return currentConflicts;
    });

    // Re-validate after revert
    setEntries(currentEntries => {
      const results = validateEntries(currentEntries);
      setValidationResults(results);
      return currentEntries;
    });
  };

  const handleRejectCorrection = (entryId: string, field: string) => {
    // Mark conflict as rejected (keep original value)
    setConflicts(currentConflicts => {
      const entryConflicts = currentConflicts[entryId];
      if (entryConflicts) {
        const updatedConflicts = entryConflicts.filter(conflict => conflict.field !== field);
        if (updatedConflicts.length === 0) {
          const { [entryId]: _, ...rest } = currentConflicts;
          return rest;
        }
        return {
          ...currentConflicts,
          [entryId]: updatedConflicts
        };
      }
      return currentConflicts;
    });
  };

  // Rest of the existing functions...
  const handleFetchMissingFields = async () => {
    const enabledFields = getEnabledFields();
    const { updatedEntries, changes, conflicts: resultConflicts } = await fetchMissingFields(originalEntries, handleProgress, enabledFields, config);
    setEntries(updatedEntries);
    setApiChanges(changes);
    setConflicts(resultConflicts);
    // Re-validate with updated entries
    const results = validateEntries(updatedEntries);
    setValidationResults(results);
  };

  const handleFetchEntryFields = async (entry: BibTeXEntry) => {
    setProcessingEntries(prev => new Set(prev).add(entry.id));

    const handleEntryProgress = (
      progressUpdate: ApiProgress,
      updatedEntry?: BibTeXEntry,
      partialChanges?: Record<string, { fields: string[]; source: string }>,
      partialConflicts?: EntryConflicts
    ) => {
      if (updatedEntry) {
        setEntries(currentEntries => {
          return currentEntries.map(e =>
            e.id === updatedEntry.id ? updatedEntry : e
          );
        });
      }

      if (partialChanges) {
        setApiChanges(currentChanges => ({
          ...currentChanges,
          ...partialChanges
        }));
      }

      if (partialConflicts) {
        setConflicts(currentConflicts => ({
          ...currentConflicts,
          ...partialConflicts
        }));
      }
    };

    try {
      const enabledFields = getEnabledFields();
      const { updatedEntry, changes, conflicts: entryConflicts } = await fetchMissingFieldsForEntry(entry, handleEntryProgress, enabledFields, config);

      setEntries(currentEntries => {
        return currentEntries.map(e =>
          e.id === updatedEntry.id ? updatedEntry : e
        );
      });

      setApiChanges(currentChanges => ({
        ...currentChanges,
        ...changes
      }));

      setConflicts(currentConflicts => ({
        ...currentConflicts,
        ...entryConflicts
      }));

      // Re-validate after individual entry update
      setEntries(currentEntries => {
        const results = validateEntries(currentEntries);
        setValidationResults(results);
        return currentEntries;
      });
    } finally {
      setProcessingEntries(prev => {
        const newSet = new Set(prev);
        newSet.delete(entry.id);
        return newSet;
      });
    }
  };

  const handleValidateEntry = async (entry: BibTeXEntry) => {
    setProcessingEntries(prev => new Set(prev).add(entry.id));

    const handleEntryProgress = (
      progressUpdate: ApiProgress,
      updatedEntry?: BibTeXEntry,
      partialChanges?: Record<string, { fields: string[]; source: string }>,
      partialConflicts?: EntryConflicts
    ) => {
      if (updatedEntry) {
        setEntries(currentEntries => {
          return currentEntries.map(e =>
            e.id === updatedEntry.id ? updatedEntry : e
          );
        });
      }

      if (partialChanges) {
        console.log('handleValidateEntry - Received changes:', partialChanges);
        setApiChanges(currentChanges => ({
          ...currentChanges,
          ...partialChanges
        }));
      }

      if (partialConflicts) {
        console.log('handleValidateEntry - Received conflicts:', partialConflicts);
        setConflicts(currentConflicts => ({
          ...currentConflicts,
          ...partialConflicts
        }));
      }
    };

    try {
      // If entry has a DOI, fetch DOI data and check for conflicts
      if (entry.fields.doi) {
        const enabledFields = getEnabledFields();
        console.log('handleValidateEntry - Entry being validated:', entry);
        console.log('handleValidateEntry - Enabled fields:', enabledFields);
        console.log('handleValidateEntry - Current validation config:', { config, enabledFields });
        const { updatedEntry, changes, conflicts: entryConflicts } = await fetchMissingFieldsForEntry(entry, handleEntryProgress, enabledFields, config);

        console.log('Received conflicts from fetchMissingFieldsForEntry:', entryConflicts);

        setEntries(currentEntries => {
          return currentEntries.map(e =>
            e.id === updatedEntry.id ? updatedEntry : e
          );
        });

        setApiChanges(currentChanges => ({
          ...currentChanges,
          ...changes
        }));

        setConflicts(currentConflicts => {
          const newConflicts = {
            ...currentConflicts,
            ...entryConflicts
          };
          console.log('Updated conflicts state:', newConflicts);
          return newConflicts;
        });
      }

      // Re-run validation for all entries (could be optimized to validate just this entry)
      const results = validateEntries(entries);
      setValidationResults(results);
    } finally {
      setProcessingEntries(prev => {
        const newSet = new Set(prev);
        newSet.delete(entry.id);
        return newSet;
      });
    }
  };

  return (
    <MainLayout>
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            BibTeX Validator
          </Typography>
          <FileUpload onParse={handleParse} />

          <ValidationConfig />

          {entries.length > 0 && (
            <>
              <Box sx={{ mt: 2, mb: 4 }}>
                <Button
                  variant="contained"
                  onClick={handleFetchMissingFields}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : null}
                >
                  {loading ? "Fetching..." : "Fetch Missing Fields"}
                </Button>
                <DownloadBibTeX entries={entries} />
              </Box>

              {loading && progress && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" gutterBottom>
                    Processing: {progress.currentEntry} - {progress.currentStep}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(progress.completed / progress.total) * 100}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption" sx={{ mt: 1 }}>
                    {progress.completed} of {progress.total} entries processed
                  </Typography>
                </Box>
              )}

              <ApiError error={error} />

              {/* Debug: Show conflicts state */}
              {Object.keys(conflicts).length > 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Debug - Current conflicts:</strong>
                    <pre>{JSON.stringify(conflicts, null, 2)}</pre>
                  </Typography>
                </Alert>
              )}

              {/* Debug: Force test conflict */}
              <Button
                variant="outlined"
                onClick={() => {
                  const testConflicts = {
                    'bousquet2010': [{
                      field: 'volume',
                      originalValue: '825',
                      doiValue: '82',
                      accepted: false
                    }]
                  };
                  setConflicts(testConflicts);
                }}
                sx={{ mb: 2 }}
              >
                Debug: Force Volume Conflict (825 → 82)
              </Button>

              <BibTeXEditor
                entries={entries}
                validationResults={validationResults}
                changes={apiChanges}
                progress={progress}
                conflicts={conflicts}
                onAcceptCorrection={handleAcceptCorrection}
                onRejectCorrection={handleRejectCorrection}
                onRevertField={handleRevertField}
                onFetchEntryFields={handleFetchEntryFields}
                onValidateEntry={handleValidateEntry}
                processingEntries={processingEntries}
              />
            </>
          )}
        </Box>
      </Container>
    </MainLayout>
  );
}

export default App;
