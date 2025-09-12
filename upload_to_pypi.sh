#!/bin/bash

# Script to build and upload bibcheck package to PyPI
# Usage: ./upload_to_pypi.sh [--test] [--skip-build]

set -e  # Exit on any error

# Parse command line arguments
TEST_UPLOAD=false
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --test)
            TEST_UPLOAD=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--test] [--skip-build]"
            echo "  --test: Upload to TestPyPI instead of PyPI"
            echo "  --skip-build: Skip the build step (use existing dist files)"
            exit 1
            ;;
    esac
done

# Check if we're in the right directory
if [ ! -f "pyproject.toml" ]; then
    echo "Error: pyproject.toml not found. Please run this script from the package root directory."
    exit 1
fi

echo "=== BibCheck PyPI Upload Script ==="

# Clean previous builds if not skipping build
if [ "$SKIP_BUILD" = false ]; then
    echo "Cleaning previous builds..."
    rm -rf dist/ build/ *.egg-info/
    
    echo "Building package..."
    python -m build
    
    # Check if build was successful
    if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
        echo "Error: Build failed or no distribution files created."
        exit 1
    fi
    
    echo "Build successful. Distribution files:"
    ls -la dist/
else
    echo "Skipping build step..."
    if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
        echo "Error: No distribution files found. Please build the package first."
        exit 1
    fi
fi

# Upload to PyPI or TestPyPI
if [ "$TEST_UPLOAD" = true ]; then
    echo "Uploading to TestPyPI..."
    python -m twine upload --repository testpypi dist/*
    echo "Upload to TestPyPI completed!"
    echo "Install with: pip install --index-url https://test.pypi.org/simple/ bibcheck"
else
    echo "Uploading to PyPI..."
    python -m twine upload dist/*
    echo "Upload to PyPI completed!"
    echo "Install with: pip install bibcheck"
fi

echo "=== Upload Complete ==="
