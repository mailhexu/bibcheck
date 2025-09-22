import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import FileUpload from "./FileUpload";

describe("FileUpload", () => {
  it("renders upload button and title", () => {
    render(<FileUpload onParse={() => {}} />);
    expect(screen.getByText(/Upload BibTeX File/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Upload BibTeX File/i })).toBeInTheDocument();
  });

  it("calls onParse when a file is chosen", async () => {
    const mockOnParse = jest.fn();
    render(<FileUpload onParse={mockOnParse} />);

    // Mock File and FileReader
    const mockFile = {
      text: jest.fn().mockResolvedValue("@article{test, title={Test}}"),
    };

    // Find the hidden file input via parent of button
    const input = screen.getByLabelText(/Upload BibTeX File/i);
    fireEvent.change(input, { target: { files: [mockFile] } });

    // Wait for async file reading
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockOnParse).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "test",
          type: "article",
          fields: expect.objectContaining({ title: "Test" })
        })
      ])
    );
  });
});
