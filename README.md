# BibCheck

A tool for checking and completing BibTeX files using DOI and arXiv entries.

## Description

BibCheck is a Python tool that helps improve the quality of BibTeX files by fetching missing information from DOI and arXiv identifiers. It compares the existing entries with the fetched data and reports any discrepancies.

## Features

- Fetches BibTeX entries from DOI identifiers
- Converts arXiv IDs to DOIs and fetches corresponding BibTeX entries
- Compares existing entries with fetched data to identify discrepancies
- Generates a corrected BibTeX file with the most complete information
- Configurable field checking via JSON configuration files
- Option to check only missing fields
- Intelligent comparison that ignores trivial differences (like en-dash vs hyphen)
- Special handling for page ranges (regex-based normalization)
- Case-insensitive DOI comparison
- Proper encoding handling to avoid display issues
- Fixes for mojibake encoding issues in page ranges
- Clear separation between entries in output
- Immediate reporting of issues after checking each entry
- Preserves original entries (only fixes mismatches and adds missing fields)
- Note: Entry and field order may be changed due to bibtexparser limitations
- Informs users when entries have no DOI or arXiv identifiers

## Installation

```bash
pip install bibcheck
```

Or install from source:

```bash
git clone https://github.com/mailhexu/bibcheck.git
cd bibcheck
pip install .
```

## Usage

```bash
# Basic usage
bibcheck your_bibliography.bib

# Print the default configuration template
bibcheck --print-config

# Use a custom configuration file
bibcheck -c config.json your_bibliography.bib

# Check only missing fields
bibcheck --missing-only your_bibliography.bib
```

This will generate a new file named `your_bibliography_fixed.bib` with the corrected entries.

## Configuration

You can customize which fields are checked by creating a JSON configuration file:

```bash
# Print the default configuration template
bibcheck --print-config > config.json
```

Then edit the `config.json` file to enable or disable specific fields:

```json
{
  "fields_to_check": {
    "title": true,
    "journal": true,
    "year": true,
    "volume": true,
    "number": true,
    "pages": true,
    "doi": true,
    "author": true
  },
  "check_missing_only": false
}
```
## Requirements

- Python 3.7+
- bibtexparser >= 1.4.0
- requests >= 2.25.0

## License

This project is licensed under the MIT License - see the LICENSE file for details.
