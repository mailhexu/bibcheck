"""BibCheck - A tool for checking and completing BibTeX files using DOI and arXiv entries."""

import os

__version__ = "0.1.0"
__default_config_path__ = os.path.join(os.path.dirname(__file__), "default_config.json")