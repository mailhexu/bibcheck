import React from "react";
import {
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
  Button,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from "@mui/material";
import { ValidationConfig as ValidationConfigType, useValidationConfig } from "../../../hooks/useValidationConfig";

const FIELD_LABELS: Record<keyof ValidationConfigType, string> = {
  title: "Title",
  author: "Author",
  journal: "Journal",
  year: "Year",
  volume: "Volume",
  pages: "Pages",
  number: "Number",
  doi: "DOI",
  autoAcceptChanges: "Auto-accept all changes from DOI validation"
};

const ValidationConfig: React.FC = () => {
  const { config, loaded, updateConfig, resetConfig, getEnabledFields } = useValidationConfig();

  // Debug: Log config changes
  const handleFieldToggle = (field: keyof ValidationConfigType) => {
    console.log(`Validation field ${field} toggled to:`, !config[field]);
    console.log('Current enabled fields:', getEnabledFields());
    updateConfig(field, !config[field]);
    // Debug: Log new enabled fields after update
    setTimeout(() => {
      console.log('Updated enabled fields:', getEnabledFields());
    }, 0);
  };

  if (!loaded) {
    return <Typography>Loading configuration...</Typography>;
  }

  return (
    <Accordion>
      <AccordionSummary
        aria-controls="validation-config-content"
        id="validation-config-header"
      >
        <Typography variant="h6">Validation Settings</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Choose which BibTeX fields to validate against DOI data:
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1, mb: 2 }}>
          {Object.entries(FIELD_LABELS)
            .filter(([field]) => field !== 'autoAcceptChanges') // Filter out autoAcceptChanges from the grid
            .map(([field, label]) => (
              <FormControlLabel
                key={field}
                control={
                  <Checkbox
                    checked={config[field as keyof ValidationConfigType]}
                    onChange={() => handleFieldToggle(field as keyof ValidationConfigType)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2">
                    {label}
                  </Typography>
                }
              />
            ))}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Auto-accept option */}
        <FormControlLabel
          control={
            <Checkbox
              checked={config.autoAcceptChanges}
              onChange={() => handleFieldToggle('autoAcceptChanges')}
              size="small"
            />
          }
          label={
            <Typography variant="body2">
              {FIELD_LABELS.autoAcceptChanges}
            </Typography>
          }
          sx={{ mb: 2, display: 'block' }} // Full width and margin bottom
        />

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            onClick={() => {
              console.log('Resetting config to defaults');
              resetConfig();
              // Debug: Log enabled fields after reset
              setTimeout(() => {
                console.log('Enabled fields after reset:', getEnabledFields());
              }, 0);
            }}
            variant="outlined"
          >
            Reset to Defaults
          </Button>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};

export default ValidationConfig;
