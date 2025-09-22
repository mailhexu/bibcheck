import React from "react";
import { Box, Typography } from "@mui/material";

interface FieldDiffProps {
  originalValue: string;
  correctedValue: string;
  fieldName: string;
}

const FieldDiff: React.FC<FieldDiffProps> = ({
  originalValue,
  correctedValue,
  fieldName
}) => {
  // Simple diff: show original with strikethrough and corrected in green
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
        {fieldName} correction:
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box>
          <Typography
            variant="body2"
            sx={{
              color: 'error.main',
              textDecoration: 'line-through',
              fontStyle: 'italic'
            }}
          >
            Original: {originalValue}
          </Typography>
        </Box>

        <Box>
          <Typography
            variant="body2"
            sx={{
              color: 'success.main',
              fontWeight: 'bold'
            }}
          >
            Corrected: {correctedValue}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default FieldDiff;
