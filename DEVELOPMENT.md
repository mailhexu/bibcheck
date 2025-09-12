# Development Guide

This document explains how to develop and publish the bibcheck package.

## Prerequisites

Install the required development tools:

```bash
pip install build twine
```

## Building the Package

To build the package:

```bash
python -m build
```

This will create distribution files in the `dist/` directory.

## Uploading to PyPI

### Using the Upload Script

The package includes a script to simplify the upload process:

```bash
# Make the script executable
chmod +x upload_to_pypi.sh

# Upload to TestPyPI for testing
./upload_to_pypi.sh --test

# Upload to PyPI (production)
./upload_to_pypi.sh

# Skip build step if you've already built the package
./upload_to_pypi.sh --skip-build
```

### Manual Upload

You can also upload manually:

```bash
# Upload to TestPyPI
python -m twine upload --repository testpypi dist/*

# Upload to PyPI
python -m twine upload dist/*
```

## PyPI Configuration

You'll need to configure your PyPI credentials in `~/.pypirc`:

```ini
[distutils]
index-servers =
    pypi
    testpypi

[pypi]
username = __token__
password = pypi-your-api-token

[testpypi]
repository = https://test.pypi.org/legacy/
username = __token__
password = pypi-your-test-api-token
```

Alternatively, you can use API tokens with twine directly:

```bash
python -m twine upload --username __token__ --password YOUR_API_TOKEN dist/*
```

## Version Management

Update the version in `pyproject.toml` before each release:

```toml
[project]
name = "bibcheck"
version = "0.1.0"  # Update this
# ...
```

## Testing the Package

Before uploading, test the package locally:

```bash
# Install in development mode
pip install -e .

# Run some basic tests
bibcheck --help
```