import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import CircularProgress from "@mui/material/CircularProgress";
import type { BibTeXEntry } from "../../../hooks/useBibTeXParser";
import type { ValidationResult } from "../../../hooks/useValidation";
import { ApiProgress, EntryConflicts } from "../../../hooks/useApiIntegration";
import DOILink from "../DOILink/DOILink";
import FieldDiff from "../FieldDiff/FieldDiff";
import EntryActions from "../EntryActions/EntryActions";

type BibTeXEditorProps = {
  entries: BibTeXEntry[];
  validationResults?: ValidationResult[];
  changes?: Record<string, { fields: string[]; source: string }>;
  progress?: ApiProgress | null;
  conflicts?: EntryConflicts;
  onAcceptCorrection?: (entryId: string, field: string, doiValue: string) => void;
  onRejectCorrection?: (entryId: string, field: string) => void;
  onFetchEntryFields?: (entry: BibTeXEntry) => void;
  onValidateEntry?: (entry: BibTeXEntry) => void;
  processingEntries?: Set<string>;
};

const BibTeXEditor: React.FC<BibTeXEditorProps> = ({
  entries,
  validationResults,
  changes,
  progress,
  conflicts,
  onAcceptCorrection,
  onRejectCorrection,
  onFetchEntryFields,
  onValidateEntry,
  processingEntries
}) => {
  const getValidationForEntry = (entryId: string) =>
    validationResults?.find(result => result.id === entryId);

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "arxiv": return "arXiv";
      case "crossref": return "CrossRef";
      case "doi": return "DOI.org";
      default: return "API";
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case "arxiv": return "primary";
      case "crossref": return "secondary";
      case "doi": return "success";
      default: return "info";
    }
  };

  const isEntryBeingProcessed = (entryId: string) => {
    return progress?.currentEntry === entryId;
  };

  const getEntryConflicts = (entryId: string) => {
    console.log('BibTeXEditor - getEntryConflicts called for entry:', entryId);
    console.log('BibTeXEditor - Current conflicts state:', conflicts);
    console.log('BibTeXEditor - Entry has DOI?:', entries.find(e => e.id === entryId)?.fields.doi);

    const entryConflicts = conflicts?.[entryId] || [];
    console.log('BibTeXEditor - Found conflicts for entry:', entryConflicts);

    // Debug: Check volume conflicts specifically
    const volumeConflict = entryConflicts.find(c => c.field === 'volume');
    if (volumeConflict) {
      console.log('BibTeXEditor - Found volume conflict:', volumeConflict);
    } else {
      console.log('BibTeXEditor - No volume conflict found');
    }

    return entryConflicts;
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        Parsed BibTeX Entries
      </Typography>
      {entries.length === 0 ? (
        <Typography>No entries parsed yet.</Typography>
      ) : (
        entries.map(entry => {
          const validation = getValidationForEntry(entry.id);
          const entryChanges = changes?.[entry.id];
          const beingProcessed = isEntryBeingProcessed(entry.id);
          const entryConflicts = getEntryConflicts(entry.id);

          return (
            <Paper
              key={entry.id}
              sx={{
                mb: 2,
                p: 2,
                border: beingProcessed ? 2 : 1,
                borderColor: beingProcessed ? 'primary.main' : 'divider'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                  <strong>{entry.type}</strong> — <code>{entry.id}</code>
                </Typography>
                {beingProcessed && (
                  <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
                    <CircularProgress size={16} sx={{ mr: 1 }} />
                    <Typography variant="body2" color="primary">
                      {progress?.currentStep}
                    </Typography>
                  </Box>
                )}
                {entryChanges && entryChanges.fields.length > 0 && !beingProcessed && (
                  <Chip
                    label={`${getSourceLabel(entryChanges.source)} updated: ${entryChanges.fields.join(", ")}`}
                    color={getSourceColor(entryChanges.source) as any}
                    size="small"
                    sx={{ ml: 2 }}
                  />
                )}
              </Box>

              {/* Debug: Current conflicts state */}
              {typeof conflicts !== 'undefined' && (
                <Alert severity="info" sx={{ mt: 1, mb: 1 }}>
                  <Typography variant="caption">
                    Debug - Conflicts for {entry.id}: {JSON.stringify(conflicts[entry.id] || 'none')}
                  </Typography>
                </Alert>
              )}

              {/* Field Conflicts */}
              {entryConflicts.length > 0 && (
                <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Data conflicts detected with DOI.org:</strong>
                  </Typography>
                  {entryConflicts.map(conflict => (
                    <Box key={conflict.field} sx={{ mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {conflict.field}:
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'error.main', textDecoration: 'line-through' }}>
                        Current: {conflict.originalValue}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'success.main' }}>
                        DOI.org: {conflict.doiValue}
                      </Typography>
                      {!conflict.accepted && (
                        <ButtonGroup size="small" sx={{ mt: 1 }}>
                          <Button
                            onClick={() => onAcceptCorrection?.(entry.id, conflict.field, conflict.doiValue)}
                            color="success"
                            variant="outlined"
                          >
                            Accept DOI.org
                          </Button>
                          <Button
                            onClick={() => onRejectCorrection?.(entry.id, conflict.field)}
                            color="error"
                            variant="outlined"
                          >
                            Keep Current
                          </Button>
                        </ButtonGroup>
                      )}
                      {conflict.accepted && (
                        <Chip label="Accepted" color="success" size="small" sx={{ mt: 1 }} />
                      )}
                    </Box>
                  ))}
                </Alert>
              )}

              {/* Validation Results for this entry */}
              {validation && validation.missingFields.length > 0 && (
                <Alert severity="warning" sx={{ mt: 1, mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Missing fields:</strong> {validation.missingFields.join(", ")}
                  </Typography>
                </Alert>
              )}

              <Box component="ul" sx={{ pl: 2 }}>
                {Object.entries(entry.fields).map(([key, value]) => (
                  <li key={key}>
                    <strong>{key}:</strong>{" "}
                    {key === "doi" ? (
                      <DOILink doi={value} />
                    ) : (
                      value
                    )}
                    {entryChanges && entryChanges.fields.includes(key) && (
                      <Chip
                        label={getSourceLabel(entryChanges.source)}
                        color={getSourceColor(entryChanges.source) as any}
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </li>
                ))}
              </Box>

              {(onFetchEntryFields || onValidateEntry) && (
                <EntryActions
                  entry={entry}
                  isProcessing={processingEntries?.has(entry.id) || beingProcessed}
                  onFetchFields={onFetchEntryFields || (() => {})}
                  onValidateEntry={onValidateEntry || (() => {})}
                />
              )}
            </Paper>
          );
        })
      )}
    </Box>
  );
};

export default BibTeXEditor;
