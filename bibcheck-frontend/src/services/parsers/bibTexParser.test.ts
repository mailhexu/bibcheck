import { parseBibTeXFields } from './bibTexParser';

describe('parseBibTeXFields', () => {
  it('should parse article entry type and basic fields', () => {
    const bibtex = `@article{smith2023,
      title = {Test Title},
      author = {John Smith},
      journal = {Test Journal},
      year = {2023},
      volume = {42}
    }`;

    const fields = parseBibTeXFields(bibtex);
    expect(fields).toEqual({
      entryType: 'article',
      title: 'Test Title',
      author: 'John Smith',
      journal: 'Test Journal',
      year: '2023',
      volume: '42'
    });
  });

  it('should parse fields with different quote styles', () => {
    const bibtex = `@book{test,
      title = "Double Quoted",
      author = 'Single Quoted',
      publisher = {Brace Quoted},
      year = 2023
    }`;

    const fields = parseBibTeXFields(bibtex);
    expect(fields).toEqual({
      entryType: 'book',
      title: 'Double Quoted',
      author: 'Single Quoted',
      publisher: 'Brace Quoted',
      year: '2023'
    });
  });

  it('should handle multiline field values', () => {
    const bibtex = `@inproceedings{test,
      title = {Multi
               Line
               Title},
      abstract = {This is a
                  very long
                  abstract}
    }`;

    const fields = parseBibTeXFields(bibtex);
    expect(fields).toEqual({
      entryType: 'inproceedings',
      title: 'Multi Line Title',
      abstract: 'This is a very long abstract'
    });
  });

  it('should parse DOI.org style BibTeX', () => {
    const bibtex = `@article{10.1234/example,
      author = {Doe, Jane and Smith, John},
      title = {Example Title},
      journal = {Journal of Examples},
      volume = {42},
      number = {5},
      pages = {123--456},
      year = {2023},
      doi = {10.1234/example},
      url = {https://doi.org/10.1234/example}
    }`;

    const fields = parseBibTeXFields(bibtex);
    expect(fields).toEqual({
      entryType: 'article',
      author: 'Doe, Jane and Smith, John',
      title: 'Example Title',
      journal: 'Journal of Examples',
      volume: '42',
      number: '5',
      pages: '123--456',
      year: '2023',
      doi: '10.1234/example',
      url: 'https://doi.org/10.1234/example'
    });
  });

  it('should handle missing or empty fields', () => {
    const bibtex = `@misc{empty,
      title = {},
      author = "",
      year = { },
      note = {   }
    }`;

    const fields = parseBibTeXFields(bibtex);
    expect(fields).toEqual({
      entryType: 'misc',
      title: '',
      author: '',
      year: '',
      note: ''
    });
  });

  it('should handle special characters in field values', () => {
    const bibtex = `@article{special,
      title = {Title with $math$ and #special# chars},
      author = {O'Connor, John & Smith},
      journal = {Journal of % Comments}
    }`;

    const fields = parseBibTeXFields(bibtex);
    expect(fields).toEqual({
      entryType: 'article',
      title: 'Title with $math$ and #special# chars',
      author: "O'Connor, John & Smith",
      journal: 'Journal of % Comments'
    });
  });

  it('should handle volume fields with leading zeros', () => {
    const bibtex = `@article{test,
      volume = {042},
      number = {005}
    }`;

    const fields = parseBibTeXFields(bibtex);
    expect(fields).toEqual({
      entryType: 'article',
      volume: '042',
      number: '005'
    });
  });
});
