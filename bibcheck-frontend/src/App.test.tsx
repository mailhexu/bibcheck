import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders upload BibTeX file UI", () => {
  render(<App />);
  expect(screen.getByText(/Upload BibTeX File/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Upload BibTeX File/i })).toBeInTheDocument();
});
