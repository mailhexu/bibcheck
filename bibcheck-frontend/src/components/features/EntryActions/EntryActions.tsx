import React from "react";
import { Box, Button, ButtonGroup, CircularProgress } from "@mui/material";
import { BibTeXEntry } from "../../../hooks/useBibTeXParser";

interface EntryActionsProps {
  entry: BibTeXEntry;
  isProcessing?: boolean;
  onFetchFields: (entry: BibTeXEntry) => void;
  onValidateEntry: (entry: BibTeXEntry) => void;
}

const EntryActions: React.FC<EntryActionsProps> = ({
  entry,
  isProcessing = false,
  onFetchFields,
  onValidateEntry,
}) => {
  return (
    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
      <ButtonGroup size="small" variant="outlined">
        <Button
          onClick={() => onFetchFields(entry)}
          disabled={isProcessing}
          startIcon={isProcessing ? <CircularProgress size={14} /> : null}
        >
          Fetch Missing
        </Button>
        <Button
          onClick={() => {
            console.log('Validate button clicked for entry:', entry);
            onValidateEntry(entry);
          }}
          disabled={isProcessing}
        >
          Validate
        </Button>
      </ButtonGroup>
    </Box>
  );
};

export default EntryActions;
