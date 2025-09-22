interface CrossRefItem {
  DOI?: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string }>;
}

interface CrossRefResponse {
  status: string;
  message?: {
    items?: CrossRefItem[];
  };
}

export async function fetchDOIFromCrossRef(
  title?: string,
  author?: string,
  journal?: string
): Promise<string | null> {
  try {
    console.log('🔍 CrossRef search started with:', { title, author, journal });

    // Build query using bibliographic information
    const queryParts: string[] = [];
    if (title) queryParts.push(title);
    if (author) queryParts.push(author);
    if (journal) queryParts.push(journal);

    if (queryParts.length === 0) {
      console.log('❌ No search terms provided');
      return null;
    }

    const query = encodeURIComponent(queryParts.join(' '));
    const url = `https://api.crossref.org/works?query.bibliographic=${query}&rows=1`;
    console.log('🌐 Searching CrossRef API:', { url });

    const response = await fetch(url);
    console.log('📡 CrossRef API response:', { 
      status: response.status,
      ok: response.ok,
      statusText: response.statusText
    });

    if (!response.ok) {
      console.log('❌ CrossRef API error:', response.statusText);
      return null;
    }

    const data: CrossRefResponse = await response.json();
    console.log('📊 CrossRef API data:', {
      status: data.status,
      itemCount: data.message?.items?.length || 0,
      firstItem: data.message?.items?.[0]
    });

    // Extract DOI from first item if available
    const items = data.message?.items;
    if (items && items.length > 0 && items[0].DOI) {
      console.log('✅ Found DOI:', items[0].DOI);
      return items[0].DOI;
    }

    console.log('❌ No DOI found in CrossRef response');
    return null;
  } catch (error) {
    console.error('❌ CrossRef API error:', error);
    return null;
  }
}
