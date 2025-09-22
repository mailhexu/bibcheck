import React from "react";
import { Link, Typography } from "@mui/material";

interface DOILinkProps {
  doi: string;
  variant?: "body1" | "body2" | "caption";
}

const DOILink: React.FC<DOILinkProps> = ({ doi, variant = "body2" }) => {
  const doiUrl = `https://doi.org/${doi}`;

  return (
    <Link
      href={doiUrl}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        textDecoration: "none",
        "&:hover": {
          textDecoration: "underline",
        },
      }}
    >
      <Typography variant={variant}>
        {doi} 🔗
      </Typography>
    </Link>
  );
};

export default DOILink;
