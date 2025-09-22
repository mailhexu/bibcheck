import React from 'react';
import { Button } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { BibTeXEntry } from '../../../hooks/useBibTeXParser';

interface DownloadBibTeXProps {
  entries: BibTeXEntry[];
}

const DownloadBibTeX: React.FC<DownloadBibTeXProps> = ({ entries }) => {
  const handleDownload = () => {
    // Create BibTeX content
    const bibTeXContent = entries.map(entry => {
      const fields = Object.entries(entry.fields)
        .map(([key, value]) => `  ${key} = {${value}}`)
        .join(',\n');

      return `@${entry.type}{${entry.id},\n${fields}\n}`;
    }).join('\n\n');

    // Create download
    const blob = new Blob([bibTeXContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'references.bib';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="contained"
      onClick={handleDownload}
      startIcon={<FileDownloadIcon />}
      sx={{ ml: 2 }}
    >
      Download BibTeX
    </Button>
  );
};

export default DownloadBibTeX;
