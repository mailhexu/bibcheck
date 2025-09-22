import { fetchBibTeXFromDOI } from "./doiApi";

describe("fetchBibTeXFromDOI", () => {
  it("returns BibTeX string for a valid DOI", async () => {
    // Mock fetch to simulate DOI.org redirecting to CrossRef
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        url: "https://api.crossref.org/v1/works/10.1000%2Ftestdoi/transform",
        text: async () => "@article{test, title={Test Title}, volume={82}}",
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "@article{test, title={Test Title}, volume={82}}",
      }) as any;

    const bibtex = await fetchBibTeXFromDOI("10.1000/testdoi");
    expect(bibtex).toContain("@article{test");
    expect(bibtex).toContain("volume={82}");
  });

  it("returns null for an invalid DOI", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      text: async () => "",
    }) as any;

    const bibtex = await fetchBibTeXFromDOI("invalid-doi");
    expect(bibtex).toBeNull();
  });

  it("handles Physical Review B DOI format", async () => {
    const mockBibTeX = `@article{PhysRevB.82.220402,
  title={J dependence in the LSDA+U treatment of noncollinear magnets},
  author={Bousquet, Eric and Spaldin, Nicola},
  journal={Phys. Rev. B},
  volume={82},
  issue={22},
  pages={220402},
  numpages={4},
  year={2010},
  month={Dec},
  publisher={American Physical Society},
  doi={10.1103/PhysRevB.82.220402},
  url={https://link.aps.org/doi/10.1103/PhysRevB.82.220402}
}`;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => mockBibTeX,
    }) as any;

    const bibtex = await fetchBibTeXFromDOI("10.1103/PhysRevB.82.220402");
    expect(bibtex).toContain("volume={82}");
    expect(bibtex).toContain("title={J dependence");
  });
});
