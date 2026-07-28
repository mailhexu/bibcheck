#!/usr/bin/env python3
import argparse
from difflib import SequenceMatcher
import json
import os
import re
import requests
import bibtexparser
from bibtexparser.bibdatabase import BibDatabase
import unicodedata
import xml.etree.ElementTree as ET
from bibtexparser.customization import author as normalize_authors


# ponytail: in-process lookup cache, populated/saved by check_bib_file; tests reset it
_LOOKUP_CACHE = {}


def load_lookup_cache(filepath):
    """Load the JSON cache next to the bibliography file, if present."""
    global _LOOKUP_CACHE
    try:
        with open(filepath, 'r', encoding='utf-8') as cache_file:
            _LOOKUP_CACHE = json.load(cache_file)
    except (FileNotFoundError, ValueError):
        _LOOKUP_CACHE = {}


def save_lookup_cache(filepath):
    """Persist the lookup cache next to the bibliography file."""
    try:
        with open(filepath, 'w', encoding='utf-8') as cache_file:
            json.dump(_LOOKUP_CACHE, cache_file, ensure_ascii=False, indent=2)
    except OSError as error:
        print(f"Warning: Could not write lookup cache {filepath}: {error}")


def get_bib_from_doi(doi):
    """Fetches a BibTeX entry from a DOI."""
    doi = normalize_doi(doi)
    if not doi:
        return None
    cache_key = f"bib:{doi.lower()}"
    cached = _LOOKUP_CACHE.get(cache_key)
    if cached is not None:
        return cached
    url = f"https://doi.org/{doi}"
    headers = {"Accept": "application/x-bibtex; charset=utf-8"}
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        result = response.text or None
    except requests.exceptions.RequestException as e:
        print(f"Warning: Could not fetch BibTeX for DOI {doi}: {e}")
        return None
    if result is not None:
        _LOOKUP_CACHE[cache_key] = result
    return result


def get_doi_from_arxiv(arxiv_id):
    """Fetches a DOI from an arXiv ID."""
    if not arxiv_id:
        return None
    cache_key = f"arxiv:{arxiv_id.strip()}"
    cached = _LOOKUP_CACHE.get(cache_key)
    if cached is not None:
        return cached
    url = f"http://export.arxiv.org/api/query?id_list={arxiv_id.strip()}"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        root = ET.fromstring(response.content)
        namespaces = {'atom': 'http://www.w3.org/2005/Atom', 'arxiv': 'http://arxiv.org/schemas/atom'}
        entry = root.find('atom:entry', namespaces)
        result = None
        if entry is not None:
            doi_element = entry.find('arxiv:doi', namespaces)
            if doi_element is not None:
                result = doi_element.text
    except (requests.exceptions.RequestException, ET.ParseError) as e:
        print(f"Warning: Could not fetch DOI for arXiv ID {arxiv_id}: {e}")
        return None
    if result is not None:
        _LOOKUP_CACHE[cache_key] = result
    return result


def normalize_metadata_text(value):
    """Normalize BibTeX and Crossref text for conservative matching."""
    value = re.sub(r'\\[A-Za-z]+', '', value or '')
    value = re.sub(r'[^\w]+', '', value).casefold()
    # ponytail: strip accents so "Poncé" matches "Ponce" / "Ponc{\'e}"
    return ''.join(c for c in unicodedata.normalize('NFKD', value) if not unicodedata.combining(c))


def first_author_surname(author):
    """Return the first author's surname from common BibTeX name forms."""
    first_author = (author or '').split(' and ', 1)[0].strip()
    if ',' in first_author:
        return normalize_metadata_text(first_author.split(',', 1)[0])
    return normalize_metadata_text(first_author.split()[-1] if first_author else '')


def crossref_year(item):
    """Return the publication year from a Crossref result."""
    for field in ('issued', 'published-print', 'published-online'):
        parts = item.get(field, {}).get('date-parts', [[]])
        if parts and parts[0]:
            return str(parts[0][0])
    return None


def get_doi_from_metadata(entry):
    """Find a DOI through Crossref only when title, author, and year agree."""
    title = entry.get('title')
    if not title:
        return None
    cache_key = f"meta:{normalize_metadata_text(title)}|{first_author_surname(entry.get('author'))}|{entry.get('year')}"
    cached = _LOOKUP_CACHE.get(cache_key)
    if cached is not None:
        return cached
    query = ' '.join(str(entry.get(field, '')) for field in ('title', 'author', 'journal', 'year', 'volume', 'pages'))
    try:
        response = requests.get(
            'https://api.crossref.org/works',
            params={'query.bibliographic': query, 'rows': 5, 'mailto': 'mailhexu@gmail.com'},
            headers={'User-Agent': 'bibcheck/0.1 (https://github.com/mailhexu/bibcheck)'},
            timeout=10,
        )
        response.raise_for_status()
        items = response.json().get('message', {}).get('items', [])
    except (requests.exceptions.RequestException, ValueError):
        return None

    normalized_title = normalize_metadata_text(title)
    source_year = entry.get('year')
    source_author = first_author_surname(entry.get('author'))
    result = None
    for item in items:
        candidate_title = strip_markup(' '.join(item.get('title', [])))
        candidate_doi = item.get('DOI')
        if not candidate_title or not candidate_doi:
            continue
        candidate_year = crossref_year(item)
        # ponytail: allow ±3 years to absorb print-vs-online date drift
        try:
            if source_year and candidate_year and abs(int(candidate_year) - int(source_year)) > 3:
                continue
        except ValueError:
            pass
        candidate_authors = {normalize_metadata_text(author.get('family')) for author in item.get('author', [])}
        if source_author and candidate_authors and source_author not in candidate_authors:
            continue
        minimum_score = 0.90 if source_author and candidate_authors else 0.96
        normalized_candidate = normalize_metadata_text(candidate_title)
        score = SequenceMatcher(None, normalized_title, normalized_candidate).ratio()
        # ponytail: boost score when one title contains the other (handles book subtitles)
        if normalized_title in normalized_candidate or normalized_candidate in normalized_title:
            score = max(score, 0.91)
        if score >= minimum_score:
            result = normalize_doi(candidate_doi)
            break
    if result is not None:
        _LOOKUP_CACHE[cache_key] = result
    return result


def normalize_text_for_comparison(text):
    """Normalize text for comparison by handling common variants."""
    if not text:
        return text
    # Replace various dash characters with a standard hyphen for comparison only
    # \u2013 = en dash, \u2014 = em dash, \u2212 = minus sign
    return text.replace('\u2013', '-').replace('\u2014', '-').replace('\u2212', '-')


def normalize_doi(doi):
    """Return a DOI without common wrappers used in BibTeX files."""
    if not doi:
        return doi
    return re.sub(r'^(?:https?://(?:dx\.)?doi\.org/|doi:\s*)', '', doi.strip().strip('{}'), flags=re.I)


def normalize_fetched_bibtex(bibtex_str):
    """Make bare month names acceptable to bibtexparser."""
    months = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december'
    return re.sub(rf'(?i)(\bmonth\s*=\s*)({months})(?=\s*[,\n}}])', r'\1{\2}', bibtex_str)


def fix_mojibake(value):
    """Repair UTF-8-as-Windows-1252 corruption returned by some DOI services."""
    if not isinstance(value, str) or not any(marker in value for marker in ('Ã', 'Â', 'â', 'Î')):
        return value
    for encoding in ('cp1252', 'latin1'):
        try:
            return value.encode(encoding).decode('utf-8')
        except UnicodeError:
            continue
    return value


def has_markup(value):
    """Return whether a field contains HTML or MathML rather than BibTeX."""
    return isinstance(value, str) and bool(re.search(r'<[^>]+>', value))


def strip_markup(value):
    """Remove HTML/MathML tags, leaving only their text content."""
    if not isinstance(value, str):
        return value
    return re.sub(r'<[^>]+>', '', value)


def unicode_to_latex(value):
    """Convert Unicode accented characters to LaTeX escapes for BibTeX."""
    if not isinstance(value, str) or not value:
        return value
    from bibtexparser.latexenc import string_to_latex
    return string_to_latex(value)


def fetched_entry_matches_doi(requested_doi, fetched_entry):
    """Reject a DOI response that identifies a different publication."""
    fetched_doi = normalize_doi(fetched_entry.get('doi'))
    return bool(fetched_doi) and fetched_doi.lower() == normalize_doi(requested_doi).lower()


def fetched_entry_matches_source(original_entry, requested_doi, fetched_entry):
    """Reject a DOI response whose title belongs to another publication."""
    if not fetched_entry_matches_doi(requested_doi, fetched_entry):
        return False
    original_title = strip_markup(original_entry.get('title', '') or '')
    fetched_title = strip_markup(fetched_entry.get('title', '') or '')
    return not original_title or not fetched_title or SequenceMatcher(
        None, normalize_metadata_text(original_title), normalize_metadata_text(fetched_title)
    ).ratio() >= 0.50


# ponytail: natural citation reading order, not alphabetical
PREFERRED_FIELD_ORDER = [
    'title', 'author', 'editor',
    'journal', 'booktitle', 'school', 'institution', 'organization',
    'series', 'volume', 'issue', 'number', 'chapter', 'pages', 'numpages', 'articleno',
    'year', 'month',
    'publisher', 'address', 'note', 'abstract',
    'doi', 'isbn', 'issn', 'url', 'eprint', 'arxiv',
    'keywords', 'language',
]

# ponytail: full journal name → ISO 4 abbreviation, applied to all entries for consistency
JOURNAL_ABBREVIATIONS = {
    'Physical Review Letters': 'Phys. Rev. Lett.',
    'Physical Review B': 'Phys. Rev. B',
    'Physical Review A': 'Phys. Rev. A',
    'Physical Review': 'Phys. Rev.',
    'Physical Review Applied': 'Phys. Rev. Appl.',
    'Physical Review Materials': 'Phys. Rev. Mater.',
    'Physical Review X': 'Phys. Rev. X',
    'Reviews of Modern Physics': 'Rev. Mod. Phys.',
    'Nature Materials': 'Nat. Mater.',
    'Nature Communications': 'Nat. Commun.',
    'Nature Nanotechnology': 'Nat. Nanotechnol.',
    'Applied Physics Letters': 'Appl. Phys. Lett.',
    'Advanced Materials': 'Adv. Mater.',
    'Advanced Functional Materials': 'Adv. Funct. Mater.',
    'Annual Review of Condensed Matter Physics': 'Annu. Rev. Condens. Matter Phys.',
    'Annual Review of Materials Research': 'Annu. Rev. Mater. Res.',
    'Canadian Journal of Physics': 'Can. J. Phys.',
    'Computer Physics Communications': 'Comput. Phys. Commun.',
    'Journal of Materials Chemistry C': 'J. Mater. Chem. C',
    'Journal of Physics C: Solid State Physics': 'J. Phys. C: Solid State Phys.',
    'Journal of Physics: Condensed Matter': 'J. Phys.: Condens. Matter',
    'Journal of Physics F: Metal Physics': 'J. Phys. F: Met. Phys.',
    'Journal of Computational Physics': 'J. Comput. Phys.',
    'Journal of Computational Chemistry': 'J. Comput. Chem.',
    'Journal of Magnetism and Magnetic Materials': 'J. Magn. Magn. Mater.',
    'Journal of the European Ceramic Society': 'J. Eur. Ceram. Soc.',
    'Journal of the Physical Society of Japan': 'J. Phys. Soc. Jpn.',
    'Japanese Journal of Applied Physics': 'Jpn. J. Appl. Phys.',
    'Scripta Materialia': 'Scr. Mater.',
    'Solid State Communications': 'Solid State Commun.',
    'Solid State Sciences': 'Solid State Sci.',
    'Acta Materialia': 'Acta Mater.',
    'Acta Crystallographica Section A': 'Acta Crystallogr. A',
    'Computational Materials Science': 'Comput. Mater. Sci.',
    'Materials Chemistry and Physics': 'Mater. Chem. Phys.',
    'Materials Letters': 'Mater. Lett.',
    'Reports on Progress in Physics': 'Rep. Prog. Phys.',
    'Science Advances': 'Sci. Adv.',
    'Proceedings of the National Academy of Sciences': 'Proc. Natl. Acad. Sci.',
    'The Journal of Chemical Physics': 'J. Chem. Phys.',
    'The Journal of Physical Chemistry': 'J. Phys. Chem.',
    'The Journal of Physical Chemistry A': 'J. Phys. Chem. A',
    'The Journal of Physical Chemistry B': 'J. Phys. Chem. B',
    'The Journal of Physical Chemistry C': 'J. Phys. Chem. C',
    'Advances in Physics': 'Adv. Phys.',
    'Physica B: Condensed Matter': 'Physica B',
    'physica status solidi (b)': 'Phys. Status Solidi B',
    'MRS Bulletin': 'MRS Bull.',
}


def abbreviate_journal(name):
    """Return the standard abbreviation for a journal name, or the original if unknown."""
    if not name:
        return name
    return JOURNAL_ABBREVIATIONS.get(name.strip(), name.strip())


def _make_ordered_writer():
    """Return a writer with fields in natural citation order, entries sorted by ID."""
    from bibtexparser.bwriter import BibTexWriter
    writer = BibTexWriter()
    writer.display_order = PREFERRED_FIELD_ORDER
    return writer


def write_order_changed_file(filepath, output_path, entry_ids=None):
    """Write original entries with natural field order, sorted by ID like the fixed file."""
    with open(filepath) as bibtex_file:
        bib_database = bibtexparser.load(bibtex_file)
    for entry in bib_database.entries:
        if entry.get('journal'):
            entry['journal'] = abbreviate_journal(entry['journal'])
    with open(output_path, 'w') as bibtex_file:
        bibtexparser.dump(bib_database, bibtex_file, writer=_make_ordered_writer())


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
    return normalize_doi(original).lower() == normalize_doi(new).lower()


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
    cache_filepath = f"{os.path.splitext(filepath)[0]}_cache.json"
    load_lookup_cache(cache_filepath)
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

        if not doi:
            doi = get_doi_from_metadata(entry)
            if doi:
                print(f"  Found DOI {doi} from bibliographic metadata")
                entry['doi'] = doi
        if not doi:
            print(f"  No DOI found for entry '{entry_id}' - skipping automatic checking")
        
        bibtex_str = get_bib_from_doi(doi)

        if bibtex_str:
            try:
                new_db = bibtexparser.loads(normalize_fetched_bibtex(bibtex_str))
                if new_db.entries:
                    new_entry = new_db.entries[0]
                    new_entry = {field: fix_mojibake(value) for field, value in new_entry.items()}
                    if not fetched_entry_matches_source(entry, doi, new_entry):
                        print(f"  Warning: Fetched BibTeX does not match {normalize_doi(doi)} - keeping original entry")
                        new_bib_database.entries.append(entry)
                        continue
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
                            corrected_entry['author'] = unicode_to_latex(new_entry.get('author', entry.get('author')))
                    
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
                                if normalized_original != normalized_new and not (field == 'title' and has_markup(new_value)):
                                    corrected_entry[field] = unicode_to_latex(new_value) if field == 'title' else new_value
                    
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
    order_changed_filepath = f"{os.path.splitext(filepath)[0]}_order_changed.bib"
    for entry in new_bib_database.entries:
        if entry.get('journal'):
            entry['journal'] = abbreviate_journal(entry['journal'])
    try:
        with open(new_filepath, 'w') as bibtex_file:
            bibtexparser.dump(new_bib_database, bibtex_file, writer=_make_ordered_writer())
        print(f"\nCorrected BibTeX file written to: {new_filepath}")
        write_order_changed_file(filepath, order_changed_filepath, (entry['ID'] for entry in bib_database.entries))
        print(f"Order-only BibTeX file written to: {order_changed_filepath}")
    except Exception as e:
        print(f"Error writing corrected BibTeX file: {e}")
    save_lookup_cache(cache_filepath)


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
