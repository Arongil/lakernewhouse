import os
import sys
import re
import argparse
from pathlib import Path
import bibtexparser

def parse_bibtex(bib_path):
    with open(bib_path, 'r', encoding='utf-8') as bibfile:
        bib_database = bibtexparser.load(bibfile)
    entries = bib_database.entries
    # Build a dict: key -> entry
    return {entry['ID']: entry for entry in entries}

def get_last_name(author):
    # Handles "First Last" and "Last, First"
    author = author.strip()
    if ',' in author:
        return author.split(',')[0].strip()
    parts = author.split()
    return parts[-1]

def format_citation(entry, all_entries, year_suffix=None):
    authors = entry.get('author', '').split(' and ')
    year = entry.get('year', '?')
    if len(authors) == 1:
        name = get_last_name(authors[0])
    elif len(authors) == 2:
        name = f"{get_last_name(authors[0])} & {get_last_name(authors[1])}"
    else:
        name = f"{get_last_name(authors[0])} et al."
    if year_suffix:
        year = f"{year}{year_suffix}"
    text = f"{name}, {year}"
    # Link logic
    url = entry.get('url')
    howpublished = entry.get('howpublished', '')
    journal = entry.get('journal', '')
    # Try to extract URL from howpublished if not present in url
    if not url and howpublished:
        import re
        m = re.search(r'\\url\{([^}]+)\}', howpublished)
        if m:
            url = m.group(1)
    if url:
        return f'<a href="{url}" target="_blank" rel="noopener noreferrer" class="citation">{text}</a>'
    elif journal.startswith('arXiv:'):
        arxiv_id = journal.split(':', 1)[1].strip()
        return f'<a href="https://arxiv.org/abs/{arxiv_id}" target="_blank" rel="noopener noreferrer" class="citation">{text}</a>'
    else:
        print(f"[CITATION ERROR] No link for citation: {entry.get('ID', '?')} ({text}) — please add a url or arXiv journal field.", file=sys.stderr)
        return text

def build_suffixes(entries):
    # Map (authors, year) -> list of keys
    author_year_map = {}
    for key, entry in entries.items():
        authors = tuple(get_last_name(a) for a in entry.get('author', '').split(' and '))
        year = entry.get('year', '?')
        k = (authors, year)
        author_year_map.setdefault(k, []).append(key)
    # For each group, assign suffixes if needed
    suffix_map = {}
    for (authors, year), keys in author_year_map.items():
        if len(keys) == 1:
            suffix_map[keys[0]] = ''
        else:
            for i, key in enumerate(sorted(keys)):
                suffix = chr(ord('a') + i)
                suffix_map[key] = suffix
    return suffix_map

def process_citations_in_text(text, entries, suffix_map):
    def replace_citep(match):
        keys = [k.strip() for k in match.group(1).split(',')]
        grouped = {}
        for key in keys:
            entry = entries.get(key)
            if not entry:
                grouped[(key, '?')] = grouped.get((key, '?'), []) + [key]
                continue
            authors = entry.get('author', '').split(' and ')
            year = entry.get('year', '?')
            group_key = (tuple(get_last_name(a) for a in authors), year)
            grouped.setdefault(group_key, []).append(key)
        out = []
        for (authors, year), group_keys in grouped.items():
            # Combine suffixes if needed
            if len(group_keys) == 1:
                key = group_keys[0]
                entry = entries.get(key)
                if not entry:
                    out.append(key)
                else:
                    out.append(format_citation(entry, entries, suffix_map.get(key, '')))
            else:
                # Multiple papers, same authors/year
                entry = entries.get(group_keys[0])
                base = format_citation(entry, entries, '')[:-len(year)]
                suffixes = [suffix_map.get(k, '') for k in group_keys]
                out.append(f"{base}{year}{','.join(suffixes)}")
        return f"[{'; '.join(out)}]"

    def replace_citet(match):
        keys = [k.strip() for k in match.group(1).split(',')]
        grouped = {}
        for key in keys:
            entry = entries.get(key)
            if not entry:
                grouped[(key, '?')] = grouped.get((key, '?'), []) + [key]
                continue
            authors = entry.get('author', '').split(' and ')
            year = entry.get('year', '?')
            group_key = (tuple(get_last_name(a) for a in authors), year)
            grouped.setdefault(group_key, []).append(key)
        out = []
        for (authors, year), group_keys in grouped.items():
            if len(group_keys) == 1:
                key = group_keys[0]
                entry = entries.get(key)
                if not entry:
                    out.append(key)
                else:
                    formatted = format_citation(entry, entries, suffix_map.get(key, ''))
                    name, yr = formatted.split(', ')
                    out.append(f"{name} ({yr})")
            else:
                entry = entries.get(group_keys[0])
                name = get_last_name(entry.get('author', '').split(' and ')[0])
                if len(entry.get('author', '').split(' and ')) == 2:
                    name = f"{get_last_name(entry.get('author', '').split(' and ')[0])} & {get_last_name(entry.get('author', '').split(' and ')[1])}"
                elif len(entry.get('author', '').split(' and ')) > 2:
                    name = f"{get_last_name(entry.get('author', '').split(' and ')[0])} et al."
                year_str = str(year)
                suffixes = [suffix_map.get(k, '') for k in group_keys]
                # Link year+first suffix+commas to first, last suffix to last
                entry_first = entries.get(group_keys[0])
                entry_last = entries.get(group_keys[-1])
                # Get links for first and last
                def get_link(entry, sfx):
                    link = format_citation(entry, entries, sfx)
                    import re
                    m = re.search(r'(href="[^"]+")', link)
                    if m:
                        return m.group(1)
                    return None
                link_first = get_link(entry_first, suffixes[0])
                link_last = get_link(entry_last, suffixes[-1])
                # Build the string
                if len(suffixes) == 2:
                    # [2024a,b] -> [<a href=first>2024a,</a><a href=last>b</a>]
                    year_and_a = f'<a {link_first} target="_blank" rel="noopener noreferrer" class="citation">{year}{suffixes[0]},</a>' if link_first else f'{year}{suffixes[0]},'
                    b = f'<a {link_last} target="_blank" rel="noopener noreferrer" class="citation">{suffixes[1]}</a>' if link_last else suffixes[1]
                    out.append(f"{name} [{year_and_a}{b}]")
                else:
                    # [2024a,b,c,...] -> [<a href=first>2024a,</a><a href=first>b,</a>...<a href=last>z</a>]
                    year_and_suffixes = ''
                    for i, sfx in enumerate(suffixes):
                        if i == 0:
                            year_and_suffixes += f'<a {link_first} target="_blank" rel="noopener noreferrer" class="citation">{year}{sfx},</a>' if link_first else f'{year}{sfx},'
                        elif i < len(suffixes) - 1:
                            year_and_suffixes += f'<a {link_first} target="_blank" rel="noopener noreferrer" class="citation">{sfx},</a>' if link_first else f'{sfx},'
                        else:
                            year_and_suffixes += f'<a {link_last} target="_blank" rel="noopener noreferrer" class="citation">{sfx}</a>' if link_last else sfx
                    out.append(f"{name} [{year_and_suffixes}]")
        return ', '.join(out)

    # Remove lines starting with %
    text = '\n'.join(line for line in text.splitlines() if not line.strip().startswith('%'))
    # Replace \citep{...}
    text = re.sub(r'\\citep\{([^}]*)\}', replace_citep, text)
    # Replace \citet{...}
    text = re.sub(r'\\citet\{([^}]*)\}', replace_citet, text)
    return text

def process_file(input_file, output_file, entries, suffix_map):
    with open(input_file, 'r', encoding='utf-8') as f:
        text = f.read()
    processed = process_citations_in_text(text, entries, suffix_map)
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(processed)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=str, default='../latex_src_raw', help='Input directory')
    parser.add_argument('--output', type=str, default='../process_tmp', help='Output directory')
    args = parser.parse_args()
    input_dir = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(exist_ok=True)
    bib_path = input_dir / 'refs.bib'
    entries = parse_bibtex(bib_path)
    suffix_map = build_suffixes(entries)
    for tex_file in input_dir.glob('*.tex'):
        output_file = output_dir / tex_file.name
        process_file(tex_file, output_file, entries, suffix_map)
        print(f"Handled citations for {tex_file.name}")
    # Copy refs.bib as well
    if bib_path.exists():
        import shutil
        shutil.copy(bib_path, output_dir / 'refs.bib')

if __name__ == '__main__':
    main() 