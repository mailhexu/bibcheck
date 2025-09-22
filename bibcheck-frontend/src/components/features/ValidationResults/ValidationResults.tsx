import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import type { ValidationResult } from "../../../hooks/useValidation";

type ValidationResultsProps = {
  results: ValidationResult[];
};

const ValidationResults: React.FC<ValidationResultsProps> = ({ results }) => (
  <Box sx={{ mt: 4 }}>
    <Typography variant="h6" gutterBottom>
      Validation Results
    </Typography>
    {results.length === 0 ? (
      <Typography>No validation results yet.</Typography>
    ) : (
      results.map(result => (
        <Alert
          key={result.id}
          severity={result.missingFields.length === 0 ? "success" : "warning"}
          sx={{ mb: 2 }}
        >
          <strong>{result.id}</strong>:{" "}
          {result.missingFields.length === 0
            ? "All required fields present."
            : `Missing fields: ${result.missingFields.join(", ")}`}
        </Alert>
      ))
    )}
  </Box>
);

export default ValidationResults;
