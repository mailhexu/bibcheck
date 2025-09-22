export async function fetchDOIFromArXiv(arxivId: string): Promise<string | null> {
  try {
    console.log('🔍 arXiv lookup started for ID:', arxivId);

    // Remove version number if present (e.g., v1, v2)
    const baseId = arxivId.replace(/v\d+$/, '');
    console.log('📝 Using base arXiv ID:', baseId);

    const url = `https://export.arxiv.org/api/query?id_list=${baseId}`;
    console.log('🌐 Querying arXiv API:', { url });

    const response = await fetch(url);
    console.log('📡 arXiv API response:', {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
      contentType: response.headers.get('content-type')
    });

    if (!response.ok) {
      console.log('❌ arXiv API error:', response.statusText);
      return null;
    }

    const text = await response.text();
    console.log('📊 arXiv response size:', text.length, 'bytes');

    // Parse DOI from XML response
    // Look for DOI in format: <doi>10.xxxx/xxxx</doi>
    const doiMatch = text.match(/<doi>([^<]+)<\/doi>/);
    if (doiMatch) {
      const doi = doiMatch[1];
      console.log('✅ Found DOI:', doi);
      return doi;
    }

    console.log('❌ No DOI found in arXiv response');
    return null;
  } catch (error) {
    console.error('❌ arXiv API error:', error);
    return null;
  }
}
