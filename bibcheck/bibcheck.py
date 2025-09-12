#!/usr/bin/env python3
import argparse
import json
import os
import re
import requests
import bibtexparser
from bibtexparser.bibdatabase import BibDatabase
import xml.etree.ElementTree as ET
from bibtexparser.customization import author as normalize_authors


def get_bib_from_doi(doi):
    """Fetches a BibTeX entry from a DOI."""
    if not doi:
        return None
    url = f"https://doi.org/{doi.strip()}"
    headers = {"Accept": "application/x-bibtex; charset=utf-8"}
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        print(f"Warning: Could not fetch BibTeX for DOI {doi}: {e}")
        return None


def get_doi_from_arxiv(arxiv_id):
    """Fetches a DOI from an arXiv ID."""
    if not arxiv_id:
        return None
    url = f"http://export.arxiv.org/api/query?id_list={arxiv_id.strip()}"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        root = ET.fromstring(response.content)
        namespaces = {'atom': 'http://www.w3.org/2005/Atom', 'arxiv': 'http://arxiv.org/schemas/atom'}
        entry = root.find('atom:entry', namespaces)
        if entry is not None:
            doi_element = entry.find('arxiv:doi', namespaces)
            if doi_element is not None:
                return doi_element.text
        return None
    except (requests.exceptions.RequestException, ET.ParseError) as e:
        print(f"Warning: Could not fetch DOI for arXiv ID {arxiv_id}: {e}")
        return None


def normalize_text_for_comparison(text):
    """Normalize text for comparison by handling common variants."""
    if not text:
        return text
    # Replace various dash characters with a standard hyphen for comparison only
    # \u2013 = en dash, \u2014 = em dash, \u2212 = minus sign
    return text.replace('\u2013', '-').replace('\u2014', '-').replace('\u2212', '-')


def is_page_range_improvement(original, new):
    """Check if the new page range is just a typographical improvement of the original."""
    # Normalize both for comparison
    normalized_original = normalize_text_for_comparison(" ".join(original.split()))
    normalized_new = normalize_text_for_comparison(" ".join(new.split()))
    
    # If they're the same after normalization, it's just a typographical difference
    return normalized_original == normalized_new


def is_doi_equivalent(original, new):
    """Check if two DOIs are equivalent (case-insensitive)."""
    if not original or not new:
        return False
    return original.lower() == new.lower()


def normalize_page_range(page_str):
    """Normalize page range to standard format: single number or number1-number2."""
    if not page_str:
        return page_str
    
    # Remove extra whitespace and normalize dashes
    cleaned = re.sub(r'[\u2013\u2014\u2212\-]+', '-', page_str.strip())
    
    # Extract numbers from the page string
    numbers = re.findall(r'\d+', cleaned)
    
    if not numbers:
        return page_str  # Return original if no numbers found
    
    if len(numbers) == 1:
        return numbers[0]  # Single page number
    else:
        # Take first two numbers as start and end of range
        return f"{numbers[0]}-{numbers[1]}"


def are_pages_equivalent(original, new):
    """Check if two page ranges are equivalent after normalization."""
    if not original or not new:
        return False
    return normalize_page_range(original) == normalize_page_range(new)


def format_value_for_display(value):
    """Format value for display, replacing various dash characters with hyphen to avoid encoding issues."""
    if not value:
        return value
    # First fix encoding issues - replace mojibake sequences
    # â€“ (U+00E2 U+20AC U+201C) is mojibake for en-dash (U+2013)
    value = value.replace('â€“', '-')  # Fix mojibake en-dash
    # Replace various dash characters with a standard hyphen for display
    # \u2013 = en dash, \u2014 = em dash, \u2212 = minus sign
    # \u2012 = figure dash, \u2011 = non-breaking hyphen
    return (value
            .replace('\u2013', '-')  # en dash
            .replace('\u2014', '-')  # em dash
            .replace('\u2212', '-')  # minus sign
            .replace('\u2012', '-')  # figure dash
            .replace('\u2011', '-')) # non-breaking hyphen


def compare_entries(original_entry, new_entry, fields_to_check=None, check_missing_only=False):
    """Compares two BibTeX entries and returns a list of differences."""
    report = []
    
    # Default fields to check if not provided
    if fields_to_check is None:
        fields_to_check = {
            'title': True,
            'journal': True,
            'year': True,
            'volume': True,
            'number': True,
            'pages': True,
            'doi': True,
            'author': True
        }
    
    # Author comparison - create copies to avoid modifying the original entries
    original_copy = original_entry.copy()
    new_copy = new_entry.copy()
    original_authors = normalize_authors(original_copy)['author']
    new_authors = normalize_authors(new_copy)['author']
    
    # Check author field if enabled
    if fields_to_check.get('author', True):
        if original_authors != new_authors:
            report.append(f"  Author mismatch:\n    Old: {format_value_for_display(original_entry.get('author', 'N/A'))}\n    New: {format_value_for_display(new_entry.get('author', 'N/A'))}")

    # Other fields comparison
    for field, enabled in fields_to_check.items():
        # Skip author as it's handled separately
        if field == 'author' or not enabled:
            continue
            
        original_value = original_entry.get(field)
        new_value = new_entry.get(field)
        
        if not original_value and new_value:
            report.append(f"  Missing field found: {field} = {{{format_value_for_display(new_value)}}}")
        elif not check_missing_only and original_value and new_value:
            # Special handling for pages field - normalize and compare
            if field == 'pages' and are_pages_equivalent(original_value, new_value):
                # Page ranges are equivalent after normalization, don't report it
                continue
            # Special handling for DOI field - case insensitive comparison
            elif field == 'doi' and is_doi_equivalent(original_value, new_value):
                # DOIs are equivalent (only case differs), don't report it
                continue
            else:
                # Normalize values for comparison
                normalized_original = normalize_text_for_comparison(" ".join(original_value.split()))
                normalized_new = normalize_text_for_comparison(" ".join(new_value.split()))
                
                # Only report if there's a meaningful difference
                if normalized_original != normalized_new:
                    report.append(f"  Mismatch in '{field}':\n    Old: {format_value_for_display(original_value)}\n    New: {format_value_for_display(new_value)}")
    return report


def check_bib_file(filepath, config=None):
    """Checks a BibTeX file for missing or incorrect information."""
    print(f"Processing file: {filepath}")
    try:
        with open(filepath) as bibtex_file:
            bib_database = bibtexparser.load(bibtex_file)
    except Exception as e:
        print(f"Error reading or parsing BibTeX file: {e}")
        return
    
    # Use default config if none provided
    if config is None:
        config = {
            "fields_to_check": {
                'title': True,
                'journal': True,
                'year': True,
                'volume': True,
                'number': True,
                'pages': True,
                'doi': True,
                'author': True
            },
            "check_missing_only": False
        }
    
    new_bib_database = BibDatabase()
    any_issues_found = False
    total_entries = len(bib_database.entries)

    for i, entry in enumerate(bib_database.entries):
        entry_id = entry.get('ID', 'N/A')
        print(f"Checking entry: {entry_id}")
        
        doi = entry.get('doi')
        arxiv_id = None
        if not doi:
            # ArXiv IDs are often in 'eprint', but can be in 'arxiv'
            arxiv_id = entry.get('eprint') or entry.get('arxiv')
            if arxiv_id:
                doi = get_doi_from_arxiv(arxiv_id)
                if doi:
                    print(f"  Found DOI {doi} from arXiv ID {arxiv_id}")
                    entry['doi'] = doi # Add found DOI to the entry

        # If no DOI or arXiv ID found, print information
        if not doi and not arxiv_id:
            print(f"  No DOI or arXiv ID found for entry '{entry_id}' - skipping automatic checking")
        
        bibtex_str = get_bib_from_doi(doi)

        if bibtex_str:
            try:
                new_db = bibtexparser.loads(bibtex_str)
                if new_db.entries:
                    new_entry = new_db.entries[0]
                    new_entry['ID'] = entry_id  # Preserve the original ID

                    report_lines = compare_entries(
                        entry, 
                        new_entry, 
                        config["fields_to_check"], 
                        config["check_missing_only"]
                    )
                    
                    # Print report for this entry immediately
                    if report_lines:
                        print(f"  Issues found for entry '{entry_id}':")
                        for line in report_lines:
                            print(f"    {line}")
                        any_issues_found = True
                    
                    # Create a corrected entry that only fixes mismatches and adds missing fields
                    # Start with a copy of the original entry to preserve all existing fields
                    corrected_entry = entry.copy()
                    
                    # Apply corrections based on our comparison
                    fields_to_check = config["fields_to_check"]
                    check_missing_only = config["check_missing_only"]
                    
                    # Handle author field if enabled
                    if fields_to_check.get('author', True):
                        original_copy = entry.copy()
                        new_copy = new_entry.copy()
                        original_authors = normalize_authors(original_copy)['author']
                        new_authors = normalize_authors(new_copy)['author']
                        if original_authors != new_authors and not check_missing_only:
                            # Update author only if there's a mismatch and we're not in missing-only mode
                            corrected_entry['author'] = new_entry.get('author', entry.get('author'))
                    
                    # Handle other fields
                    for field, enabled in fields_to_check.items():
                        # Skip author as it's handled separately
                        if field == 'author' or not enabled:
                            continue
                            
                        original_value = entry.get(field)
                        new_value = new_entry.get(field)
                        
                        if not original_value and new_value:
                            # Add missing field
                            corrected_entry[field] = new_value
                        elif not check_missing_only and original_value and new_value:
                            # Check if it's a page range - normalize and compare
                            if field == 'pages' and not are_pages_equivalent(original_value, new_value):
                                corrected_entry[field] = new_value
                            # Check if it's a DOI - case insensitive comparison
                            elif field == 'doi' and not is_doi_equivalent(original_value, new_value):
                                corrected_entry[field] = new_value
                            # For other fields, normalize and compare
                            elif field not in ['pages', 'doi']:
                                normalized_original = normalize_text_for_comparison(" ".join(original_value.split()))
                                normalized_new = normalize_text_for_comparison(" ".join(new_value.split()))
                                if normalized_original != normalized_new:
                                    corrected_entry[field] = new_value
                    
                    # Add the corrected entry to the output file
                    new_bib_database.entries.append(corrected_entry)
                else:
                    # Keep original if new one is empty
                    new_bib_database.entries.append(entry)
            except Exception as e:
                print(f"  Warning: Could not parse fetched BibTeX for {entry_id}: {e}")
                # Keep original on parse error
                new_bib_database.entries.append(entry)
        else:
            # Keep original if nothing was fetched
            new_bib_database.entries.append(entry)

        # Add separator after each entry (except the last one)
        if i < total_entries - 1:
            print("-" * 50)

    # Print final summary
    print("\n" + "="*20 + " Report Summary " + "="*20)
    if not any_issues_found:
        print("No discrepancies found that could be automatically checked.")
    print("="*56)

    new_filepath = f"{os.path.splitext(filepath)[0]}_fixed.bib"
    try:
        with open(new_filepath, 'w') as bibtex_file:
            bibtexparser.dump(new_bib_database, bibtex_file)
        print(f"\nCorrected BibTeX file written to: {new_filepath}")
    except Exception as e:
        print(f"Error writing corrected BibTeX file: {e}")


def load_config(config_path):
    """Load configuration from a JSON file."""
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading config file {config_path}: {e}")
        return None


def print_default_config():
    """Print the default configuration template."""
    default_config = {
        "fields_to_check": {
            "title": True,
            "journal": True,
            "year": True,
            "volume": True,
            "number": True,
            "pages": True,
            "doi": True,
            "author": True
        },
        "check_missing_only": False
    }
    print(json.dumps(default_config, indent=2))


def main():
    """Main entry point for the bibcheck command."""
    parser = argparse.ArgumentParser(description="Check and complete BibTeX files using DOI and arXiv entries.")
    parser.add_argument("file", nargs='?', help="The BibTeX file to check.")
    parser.add_argument("-c", "--config", help="Path to configuration JSON file")
    parser.add_argument("--print-config", action="store_true", help="Print the default configuration template")
    parser.add_argument("--missing-only", action="store_true", help="Check only missing fields")
    
    args = parser.parse_args()
    
    # Handle print-config command
    if args.print_config:
        print_default_config()
        return 0
    
    # Check if file argument is provided
    if not args.file:
        parser.error("the following arguments are required: file")
    
    # Check if file exists
    if not os.path.exists(args.file):
        print(f"Error: File not found at {args.file}")
        return 1
    
    # Load configuration
    config = None
    if args.config:
        config = load_config(args.config)
        if config is None:
            return 1
    else:
        # Use default configuration
        config = {
            "fields_to_check": {
                'title': True,
                'journal': True,
                'year': True,
                'volume': True,
                'number': True,
                'pages': True,
                'doi': True,
                'author': True
            },
            "check_missing_only": args.missing_only
        }
    
    print("This script uses 'bibtexparser' and 'requests'.")
    print("If you don't have them, please install with: pip install bibtexparser requests\n")
    check_bib_file(args.file, config)
    return 0


if __name__ == "__main__":
    main()
