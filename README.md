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

## Installation

```bash
pip install bibcheck
```

Or install from source:

```bash
git clone https://github.com/yourusername/bibcheck.git
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

## Intelligent Comparison

BibCheck now includes intelligent comparison that ignores trivial differences such as:
- En-dash (–) vs hyphen (-) vs em-dash (—) vs minus sign (−) in page ranges
- Case differences in DOIs
- Other common Unicode variants that don't affect the meaning

This prevents false positives when the only difference is typography or case rather than content.

## Special Handling for Page Ranges

BibCheck includes special handling for page ranges:
- Uses regex to extract and normalize page numbers
- Formats page ranges as "number1-number2" for two numbers or just "number" for one
- Recognizes equivalent page ranges regardless of dash type (en-dash, hyphen, etc.)
- Won't report differences when page ranges are equivalent after normalization
- Still reports actual differences in page numbers (e.g., 10-20 vs 15-25)
- Properly handles encoding issues to avoid display problems with Unicode characters
- Fixes mojibake encoding issues (like "â€“" instead of "–")

## Case-Insensitive DOI Comparison

BibCheck now performs case-insensitive comparison of DOIs, recognizing that DOIs are case-insensitive identifiers. This prevents false positives when the only difference is in the case of the DOI.

## Preservation of Original Content

BibCheck only makes minimal changes to your BibTeX files:
- Only fixes actual mismatches (not just formatting differences)
- Only adds missing fields (doesn't remove existing fields)
- Preserves all original entries (doesn't delete anything)
- Note: Due to limitations in the bibtexparser library, entry and field order may be changed in the output file

## Clear Entry Separation

BibCheck now adds a clear separator line between entries in the output, making it easier to distinguish between the results for different entries when processing files with multiple entries.

## Immediate Reporting

BibCheck now reports issues immediately after checking each entry, rather than waiting until the end of the process. This provides real-time feedback and makes it easier to identify which entries have issues.

## Requirements

- Python 3.7+
- bibtexparser >= 1.4.0
- requests >= 2.25.0

## License

This project is licensed under the MIT License - see the LICENSE file for details.# bibcheck
