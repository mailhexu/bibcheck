# bibcheck-frontend

A React web interface for uploading and validating BibTeX files using Material-UI.

## Features

- Upload `.bib` files via a simple UI
- Responsive layout with Material Design theming
- MainLayout and FileUpload components scaffolded
- Unit and integration tests for FileUpload

## Getting Started

### Prerequisites

- Node.js >= 16.x
- npm >= 8.x

### Installation

```bash
npm install
```

### Running the App

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view in your browser.

### Running Tests

```bash
npm test
```

## Project Structure

- `src/components/layout/MainLayout.tsx` - Main layout wrapper
- `src/components/features/FileUpload/FileUpload.tsx` - File upload component
- `src/App.tsx` - App entry point
- `src/theme.ts` - Material-UI theme
- `src/index.tsx` - ThemeProvider integration

## Next Steps

- Implement BibTeX parsing and validation logic
- Add more features and UI components

## License

MIT
