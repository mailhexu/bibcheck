import React from "react";
import { Box, Button, Typography } from "@mui/material";
import CheckIcon from '@mui/icons-material/Check';
import RestoreIcon from '@mui/icons-material/Restore';

interface FieldDiffProps {
  originalValue: string;
  correctedValue: string;
  fieldName: string;
  onAccept?: () => void;
  onRevert?: () => void;
}

const FieldDiff: React.FC<FieldDiffProps> = ({
  originalValue,
  correctedValue,
  fieldName,
  onAccept,
  onRevert
}) => {
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

        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Button
            size="small"
            variant="contained"
            color="success"
            onClick={onAccept}
            startIcon={<CheckIcon />}
          >
            Accept
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            onClick={onRevert}
            startIcon={<RestoreIcon />}
          >
            Revert
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default FieldDiff;
