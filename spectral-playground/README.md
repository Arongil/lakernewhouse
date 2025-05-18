# Spectral Playground: Citation Processing

## Usage

1. `source ../site/bin/activate`
2. `pip install -r requirements.txt`
3. `python process_latex/process.py`

All `.tex` files in `latex_src_raw/` will be processed and output formatted files to `latex_src/`.

## LaTeX Source Structure

- Place your raw `.tex` files and `refs.bib` in the `latex_src_raw/` directory.
- Each `.tex` file can use `\citep{key}` for citations, where `key` matches an entry in `refs.bib`.
- The script will output processed `.tex` files in the `latex_src/` directory.

## Features

- Citations are formatted with last names and year suffixes (e.g., "Smith et al., 2024a,b")
- Multiple citations in one `\citep` are separated by semicolons
- Cross-references (`\cref`) and equations are clickable in the web view
- Equations can be clicked to highlight their references