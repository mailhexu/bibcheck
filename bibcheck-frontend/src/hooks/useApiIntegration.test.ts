import { renderHook, act } from "@testing-library/react";
import { useApiIntegration } from "./useApiIntegration";

// Mock the API functions
jest.mock("../services/api/doiApi", () => ({
  fetchBibTeXFromDOI: jest.fn(),
}));

jest.mock("../services/api/arxivApi", () => ({
  fetchDOIFromArXiv: jest.fn(),
}));

jest.mock("../services/api/crossrefApi", () => ({
  fetchDOIFromCrossRef: jest.fn(),
}));

import { fetchBibTeXFromDOI } from "../services/api/doiApi";
import { fetchDOIFromArXiv } from "../services/api/arxivApi";
import { fetchDOIFromCrossRef } from "../services/api/crossrefApi";

const mockFetchBibTeXFromDOI = fetchBibTeXFromDOI as jest.MockedFunction<typeof fetchBibTeXFromDOI>;
const mockFetchDOIFromArXiv = fetchDOIFromArXiv as jest.MockedFunction<typeof fetchDOIFromArXiv>;
const mockFetchDOIFromCrossRef = fetchDOIFromCrossRef as jest.MockedFunction<typeof fetchDOIFromCrossRef>;

describe("useApiIntegration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("detects field conflicts between existing data and DOI.org", async () => {
    // Mock API responses
    mockFetchDOIFromArXiv.mockResolvedValue(null);
    mockFetchDOIFromCrossRef.mockResolvedValue(null);
    mockFetchBibTeXFromDOI.mockResolvedValue(`
      @article{test,
        title={Correct Title},
        author={Correct Author},
        journal={Correct Journal},
        year={2023},
        doi={10.1000/test}
      }
    `);

    const { result } = renderHook(() => useApiIntegration());

    const testEntries = [
      {
        id: "test",
        type: "article",
        fields: {
          title: "Wrong Title",
          author: "Wrong Author",
          journal: "Correct Journal",
          year: "2023",
          doi: "10.1000/test"
        }
      }
    ];

    let conflictsResult: any;
    await act(async () => {
      const apiResult = await result.current.fetchMissingFields(testEntries);
      conflictsResult = apiResult.conflicts;
    });

    expect(conflictsResult).toBeDefined();
    expect(conflictsResult?.test).toHaveLength(2); // title and author conflicts

    const titleConflict = conflictsResult?.test.find((c: any) => c.field === "title");
    expect(titleConflict).toEqual({
      field: "title",
      originalValue: "Wrong Title",
      doiValue: "Correct Title",
      accepted: false
    });

    const authorConflict = conflictsResult?.test.find((c: any) => c.field === "author");
    expect(authorConflict).toEqual({
      field: "author",
      originalValue: "Wrong Author",
      doiValue: "Correct Author",
      accepted: false
    });
  });

  it("adds missing fields without conflicts", async () => {
    mockFetchDOIFromArXiv.mockResolvedValue(null);
    mockFetchDOIFromCrossRef.mockResolvedValue(null);
    mockFetchBibTeXFromDOI.mockResolvedValue(`
      @article{test,
        title={New Title},
        author={New Author},
        journal={New Journal},
        year={2023},
        volume={1},
        pages={1-10},
        doi={10.1000/test}
      }
    `);

    const { result } = renderHook(() => useApiIntegration());

    const testEntries = [
      {
        id: "test",
        type: "article",
        fields: {
          doi: "10.1000/test"
        }
      }
    ];

    let resultData: any;
    await act(async () => {
      resultData = await result.current.fetchMissingFields(testEntries);
    });

    expect(resultData).toBeDefined();
    expect(resultData.updatedEntries[0].fields.title).toBe("New Title");
    expect(resultData.updatedEntries[0].fields.author).toBe("New Author");
    expect(resultData.updatedEntries[0].fields.journal).toBe("New Journal");
    expect(resultData.updatedEntries[0].fields.year).toBe("2023");
    expect(resultData.updatedEntries[0].fields.volume).toBe("1");
    expect(resultData.updatedEntries[0].fields.pages).toBe("1-10");

    // No conflicts since fields were missing, not conflicting
    expect(resultData.conflicts?.test).toBeUndefined();
  });
});
