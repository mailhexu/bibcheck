import React from "react";
import { Button, Box } from "@mui/material";
import { useBibTeXParser } from "../../../hooks/useBibTeXParser";
import type { BibTeXEntry } from "../../../hooks/useBibTeXParser";

type FileUploadProps = {
  onParse: (entries: BibTeXEntry[]) => void;
};

const FileUpload: React.FC<FileUploadProps> = ({ onParse }) => {
  const { parse } = useBibTeXParser();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const text = await file.text();
      const entries = parse(text);
      onParse(entries);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <input
        accept=".bib"
        style={{ display: "none" }}
        id="bib-file-input"
        type="file"
        onChange={handleFileChange}
      />
      <label htmlFor="bib-file-input">
        <Button variant="contained" component="span">
          Upload BibTeX File
        </Button>
      </label>
    </Box>
  );
};

export default FileUpload;
