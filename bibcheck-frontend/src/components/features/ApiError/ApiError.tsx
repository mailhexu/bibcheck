import React from "react";
import Alert from "@mui/material/Alert";

type ApiErrorProps = {
  error: string | null;
};

const ApiError: React.FC<ApiErrorProps> = ({ error }) =>
  error ? (
    <Alert severity="error" sx={{ mt: 2 }}>
      API Error: {error}
    </Alert>
  ) : null;

export default ApiError;
