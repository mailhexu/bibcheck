export async function fetchBibTeXFromDOI(doi: string): Promise<string | null> {
  try {
    console.log('fetchBibTeXFromDOI - Fetching for DOI:', doi);
    // First try DOI.org directly
    let response = await fetch(`https://doi.org/${doi}`, {
      headers: { Accept: "application/x-bibtex" },
      redirect: 'follow'
    });

    // If DOI.org redirects to CrossRef, follow the redirect
    console.log('fetchBibTeXFromDOI - Initial response URL:', response.url);
    if (response.url && response.url.includes('crossref.org')) {
      console.log('🔄 Following CrossRef redirect');
      response = await fetch(response.url, {
        headers: { Accept: "application/x-bibtex" },
      });
    }

    if (response.ok) {
      const bibtex = await response.text();
      console.log('📝 BibTeX response details:', {
        doi,
        responseUrl: response.url,
        contentType: response.headers.get('content-type'),
        bibtexLength: bibtex.length,
        bibtexPreview: bibtex.substring(0, 100) + '...',
        fullBibtex: bibtex
      });
      return bibtex;
    }
    return null;
  } catch (error) {
    console.error('Error fetching BibTeX from DOI:', error);
    return null;
  }
}
