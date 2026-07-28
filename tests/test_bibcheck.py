import os
import tempfile
import unittest
from unittest.mock import Mock, patch

import bibtexparser

from bibcheck import bibcheck


class BibCheckRegressionTests(unittest.TestCase):
    def setUp(self):
        bibcheck._LOOKUP_CACHE.clear()

    def test_bare_month_is_parseable(self):
        raw = '@article{x, month = july, title = {Title}}'

        database = bibtexparser.loads(bibcheck.normalize_fetched_bibtex(raw))

        self.assertEqual(database.entries[0]['month'], 'july')

    def test_normalize_doi_strips_wrappers(self):
        self.assertEqual(bibcheck.normalize_doi('{https://doi.org/10.1/example}'), '10.1/example')

    def test_accented_author_surname_matches_plain(self):
        self.assertEqual(bibcheck.normalize_metadata_text('Poncé'), bibcheck.normalize_metadata_text('Ponce'))

    def test_journal_full_name_abbreviated(self):
        self.assertEqual(bibcheck.abbreviate_journal('Physical Review B'), 'Phys. Rev. B')
        self.assertEqual(bibcheck.abbreviate_journal('Physical Review Letters'), 'Phys. Rev. Lett.')
        self.assertEqual(bibcheck.abbreviate_journal('Nature Materials'), 'Nat. Mater.')
        self.assertEqual(bibcheck.abbreviate_journal('Computer Physics Communications '), 'Comput. Phys. Commun.')
        self.assertEqual(bibcheck.abbreviate_journal('Phys. Rev. B'), 'Phys. Rev. B')

    @patch('bibcheck.bibcheck.requests.get')
    def test_arxiv_lookup_still_returns_doi(self, get):
        get.return_value = Mock(content=b'''<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom"><entry><arxiv:doi>10.1/example</arxiv:doi></entry></feed>''')

        self.assertEqual(bibcheck.get_doi_from_arxiv('1234.5678'), '10.1/example')

    def test_html_and_mathml_titles_are_rejected(self):
        self.assertTrue(bibcheck.has_markup('TiO<sub>2</sub>'))
        self.assertTrue(bibcheck.has_markup('<mml:math>TiO</mml:math>'))

    def test_mathml_markup_stripped_to_text(self):
        self.assertEqual(bibcheck.strip_markup('CrI<mml:msub>3</mml:msub>'), 'CrI3')
        self.assertEqual(bibcheck.strip_markup('a <b>b</b> c'), 'a b c')

    def test_mojibake_is_repaired(self):
        self.assertEqual(bibcheck.fix_mojibake('Fr\u00c3\u00b6hlich'), 'Fr\u00f6hlich')

    def test_unicode_accents_converted_to_latex(self):
        self.assertEqual(bibcheck.unicode_to_latex('Blügel'), 'Bl{\\"u}gel')
        self.assertEqual(bibcheck.unicode_to_latex('García'), 'Garc{\\\'\\i}a')

    def test_mismatched_fetched_doi_is_rejected(self):
        self.assertFalse(bibcheck.fetched_entry_matches_doi('10.1/right', {'doi': '10.1/wrong'}))
        self.assertFalse(bibcheck.fetched_entry_matches_doi('10.1/right', {}))

    def test_unrelated_title_with_matching_doi_is_rejected(self):
        original = {'title': 'Correct paper about phonons'}
        fetched = {'doi': '10.1/right', 'title': 'Unrelated gold film spectroscopy'}

        self.assertFalse(bibcheck.fetched_entry_matches_source(original, '10.1/right', fetched))

    def test_order_only_output_uses_natural_field_order(self):
        source = ('@article{zebra, title = {Original}, author = {Doe, Jane}, '
                  'doi = {10.1/right}, year = {2020}, journal = {J}}')
        config = {'fields_to_check': {}, 'check_missing_only': False}

        with tempfile.TemporaryDirectory() as directory:
            source_path = os.path.join(directory, 'references.bib')
            with open(source_path, 'w') as file:
                file.write(source)
            with patch.object(bibcheck, 'get_bib_from_doi', return_value=None):
                bibcheck.check_bib_file(source_path, config)

            with open(os.path.join(directory, 'references_order_changed.bib')) as file:
                text = file.read()
            title_pos = text.find('title')
            author_pos = text.find('author')
            journal_pos = text.find('journal')
            self.assertLess(title_pos, author_pos)
            self.assertLess(author_pos, journal_pos)

    @patch('bibcheck.bibcheck.requests.get')
    def test_metadata_lookup_returns_matching_crossref_doi(self, get):
        get.return_value = Mock(json=lambda: {'message': {'items': [{
            'DOI': '10.1/example',
            'title': ['A Precise Paper Title'],
            'author': [{'family': 'Doe'}],
            'issued': {'date-parts': [[2020]]},
        }]}})
        entry = {'title': 'A Precise Paper Title', 'author': 'Doe, Jane', 'year': '2020'}

        self.assertEqual(bibcheck.get_doi_from_metadata(entry), '10.1/example')

    @patch('bibcheck.bibcheck.requests.get')
    def test_metadata_lookup_rejects_wrong_crossref_record(self, get):
        get.return_value = Mock(json=lambda: {'message': {'items': [{
            'DOI': '10.1/wrong',
            'title': ['A Different Paper'],
            'author': [{'family': 'Other'}],
            'issued': {'date-parts': [[2020]]},
        }]}})
        entry = {'title': 'A Precise Paper Title', 'author': 'Doe, Jane', 'year': '2020'}

        self.assertIsNone(bibcheck.get_doi_from_metadata(entry))

    @patch('bibcheck.bibcheck.requests.get')
    def test_metadata_lookup_allows_year_mismatch_within_three_years(self, get):
        get.return_value = Mock(json=lambda: {'message': {'items': [{
            'DOI': '10.1/example',
            'title': ['A Precise Paper Title'],
            'author': [{'family': 'Doe'}],
            'issued': {'date-parts': [[2023]]},
        }]}})
        entry = {'title': 'A Precise Paper Title', 'author': 'Doe, Jane', 'year': '2020'}

        self.assertEqual(bibcheck.get_doi_from_metadata(entry), '10.1/example')

    @patch('bibcheck.bibcheck.requests.get')
    def test_metadata_lookup_handles_book_subtitles(self, get):
        get.return_value = Mock(json=lambda: {'message': {'items': [{
            'DOI': '10.1/book',
            'title': ['Atomistic Spin Dynamics'],
            'author': [{'family': 'Eriksson'}],
            'issued': {'date-parts': [[2017]]},
        }]}})
        entry = {'title': 'Atomistic spin dynamics: Foundations and applications',
                 'author': 'Eriksson, Olle', 'year': '2017'}

        self.assertEqual(bibcheck.get_doi_from_metadata(entry), '10.1/book')

    @patch('bibcheck.bibcheck.requests.get')
    def test_metadata_lookup_is_cached_after_first_call(self, get):
        get.return_value = Mock(json=lambda: {'message': {'items': [{
            'DOI': '10.1/example',
            'title': ['A Precise Paper Title'],
            'author': [{'family': 'Doe'}],
            'issued': {'date-parts': [[2020]]},
        }]}})
        entry = {'title': 'A Precise Paper Title', 'author': 'Doe, Jane', 'year': '2020'}

        self.assertEqual(bibcheck.get_doi_from_metadata(entry), '10.1/example')
        bibcheck.get_doi_from_metadata(entry)
        self.assertEqual(get.call_count, 1)

    def test_order_only_output_preserves_original_values(self):
        source = '@article{source, doi = {10.1/right}, title = {Original {Value}}, author = {Doe, Jane}, journal = {Journal}}'
        fetched = '@article{fetched, doi = {10.1/right}, title = {Original {Value} Updated}, author = {Doe, Jane}, journal = {Journal}}'
        config = {'fields_to_check': {'title': True}, 'check_missing_only': False}

        with tempfile.TemporaryDirectory() as directory:
            source_path = os.path.join(directory, 'references.bib')
            with open(source_path, 'w') as file:
                file.write(source)
            with patch.object(bibcheck, 'get_bib_from_doi', return_value=fetched):
                bibcheck.check_bib_file(source_path, config)

            fixed_path = os.path.join(directory, 'references_fixed.bib')
            order_path = os.path.join(directory, 'references_order_changed.bib')
            self.assertTrue(os.path.exists(fixed_path))
            self.assertTrue(os.path.exists(order_path))
            with open(fixed_path) as file:
                self.assertEqual(bibtexparser.load(file).entries[0]['title'], 'Original {Value} Updated')
            with open(order_path) as file:
                self.assertEqual(bibtexparser.load(file).entries[0]['title'], 'Original {Value}')
            with open(order_path) as file:
                self.assertIn('title = {Original {Value}}', file.read())


if __name__ == '__main__':
    unittest.main()
