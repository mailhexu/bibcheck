import { fetchDOIFromCrossRef } from "./crossrefApi";

describe("fetchDOIFromCrossRef", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns DOI when CrossRef API returns valid data", async () => {
    const mockResponse = {
      status: "ok",
      message: {
        items: [
          {
            DOI: "10.1038/171737a0",
            title: ["MOLECULAR STRUCTURE OF NUCLEIC ACIDS"],
            author: [
              { given: "J. D.", family: "WATSON" },
              { given: "F. H. C.", family: "CRICK" }
            ]
          }
        ]
      }
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as any;

    const doi = await fetchDOIFromCrossRef("MOLECULAR STRUCTURE OF NUCLEIC ACIDS", "WATSON", "Nature");
    expect(doi).toBe("10.1038/171737a0");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.crossref.org/works?query.bibliographic=MOLECULAR%20STRUCTURE%20OF%20NUCLEIC%20ACIDS%20WATSON%20Nature&rows=1"
    );
  });

  it("returns null when no bibliographic data provided", async () => {
    const doi = await fetchDOIFromCrossRef();
    expect(doi).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null when CrossRef API returns no items", async () => {
    const mockResponse = {
      status: "ok",
      message: {
        items: []
      }
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as any;

    const doi = await fetchDOIFromCrossRef("Unknown Title", "Unknown Author");
    expect(doi).toBeNull();
  });

  it("returns null when CrossRef API request fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
    }) as any;

    const doi = await fetchDOIFromCrossRef("Test Title", "Test Author");
    expect(doi).toBeNull();
  });

  it("returns null when network error occurs", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const doi = await fetchDOIFromCrossRef("Test Title", "Test Author");
    expect(doi).toBeNull();
  });

  it("builds query with available bibliographic data", async () => {
    const mockResponse = {
      status: "ok",
      message: {
        items: [{ DOI: "10.1000/test" }]
      }
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as any;

    // Test with only title
    await fetchDOIFromCrossRef("Test Title");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.crossref.org/works?query.bibliographic=Test%20Title&rows=1"
    );

    // Test with title and author
    await fetchDOIFromCrossRef("Test Title", "Test Author");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.crossref.org/works?query.bibliographic=Test%20Title%20Test%20Author&rows=1"
    );
  });
});
