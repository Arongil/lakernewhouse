import re
import argparse
from pathlib import Path
import json

LABEL_TYPES = {
    'chapter': 'Chapter',
    'section': '',
    'subsection': 'Section',
    'theorembox': 'Theorem',
    'notebox': 'Note',
    'definitionbox': 'Definition',
}

HEADING_TAGS = {
    'chapter': 'h1',
    'section': 'h2',
    'subsection': 'h3',
    'theorembox': 'div',
    'notebox': 'div',
    'definitionbox': 'div',
}

# Patterns that match across lines and allow for whitespace/newlines between command and label
STRUCTURE_PATTERNS = [
    (r'\\chapter\{([^}]*)\}\s*\\label\{([^}]*)\}', 'chapter'),
    (r'\\section\{([^}]*)\}\s*\\label\{([^}]*)\}', 'section'),
    (r'\\subsection\{([^}]*)\}\s*\\label\{([^}]*)\}', 'subsection'),
    (r'\\theorembox\{([^}]*)\}\s*\\label\{([^}]*)\}', 'theorembox'),
    (r'\\notebox\{([^}]*)\}\s*\\label\{([^}]*)\}', 'notebox'),
    (r'\\definitionbox\{([^}]*)\}\s*\\label\{([^}]*)\}', 'definitionbox'),
]

def build_label_map(all_contents):
    label_map = {}
    chapter_counter = 0
    section_counter = 0
    subsection_counter = 0
    for content in all_contents:
        # Find all structure commands in order in the file
        for match in re.finditer(
            r'(\\chapter\{[^}]*\}\s*\\label\{[^}]*\})|'
            r'(\\section\{[^}]*\}\s*\\label\{[^}]*\})|'
            r'(\\subsection\{[^}]*\}\s*\\label\{[^}]*\})|'
            r'(\\theorembox\{[^}]*\}\s*\\label\{[^}]*\})|'
            r'(\\notebox\{[^}]*\}\s*\\label\{[^}]*\})|'
            r'(\\definitionbox\{[^}]*\}\s*\\label\{[^}]*\})',
            content, flags=re.DOTALL):
            s = match.group(0)
            for pattern, typ in STRUCTURE_PATTERNS:
                m = re.match(pattern, s, flags=re.DOTALL)
                if m:
                    title, label = m.group(1), m.group(2)
                    if typ == 'chapter':
                        chapter_counter += 1
                        section_counter = 0
                        subsection_counter = 0
                        label_map[label] = {
                            'type': 'Chapter',
                            'number': chapter_counter,
                            'title': title.strip(),
                            'heading_tag': 'h1',
                        }
                    elif typ == 'section':
                        section_counter += 1
                        subsection_counter = 0
                        label_map[label] = {
                            'type': 'Section',
                            'number': f"{chapter_counter}.{section_counter}",
                            'title': title.strip(),
                            'heading_tag': 'h2',
                        }
                    elif typ == 'subsection':
                        subsection_counter += 1
                        label_map[label] = {
                            'type': 'Section',
                            'number': f"{chapter_counter}.{section_counter}.{subsection_counter}",
                            'title': title.strip(),
                            'heading_tag': 'h3',
                        }
                    else:
                        label_map[label] = {
                            'type': LABEL_TYPES[typ],
                            'number': len([v for v in label_map.values() if v['type'] == LABEL_TYPES[typ]]) + 1,
                            'title': title.strip(),
                            'heading_tag': HEADING_TAGS[typ],
                        }
    return label_map

def make_heading(typ, number, title, label):
    tag = HEADING_TAGS[typ]
    label_type = LABEL_TYPES[typ]
    if typ == 'chapter':
        return f'<{tag} id="{label}">{label_type} {number}: {title}</{tag}>'
    elif typ == 'section':
        return f'<{tag} id="{label}">{label_type} {number}: {title}</{tag}>'
    elif typ == 'subsection':
        return f'<{tag} id="{label}">{label_type} {number}: {title}</{tag}>'
    elif typ in ('theorembox', 'notebox', 'definitionbox'):
        return f'<div id="{label}" class="{typ}"><strong>{label_type} {number}.</strong> {title}</div>'
    else:
        return f'<{tag} id="{label}">{label_type} {number} {title}</{tag}>'

def replace_structures(content, label_map):
    # Replace all structure patterns with visible headings
    for pattern, typ in STRUCTURE_PATTERNS:
        def repl(match):
            title, label = match.group(1), match.group(2)
            info = label_map.get(label)
            if info:
                return make_heading(typ, info['number'], title.strip(), label)
            else:
                return title  # fallback
        content = re.sub(pattern, repl, content, flags=re.DOTALL)
    return content

def process_cref(label_map):
    def replacer(match):
        label = match.group(1)
        info = label_map.get(label)
        if info:
            display = f"{info['type']} {info['number']}"
        else:
            display = f"{label}"
        return f'<a class="cref" data-target="{label}" href="#{label}">{display}</a>'
    return replacer

def process_equation(match):
    label = match.group(1) or ''  # Optional label
    equation = match.group(2)
    return f'<div id="{label}" class="equation">{equation}</div>'

def process_file(input_file, output_file, label_map):
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    # Replace LaTeX-style quotes with fancy quotes
    content = re.sub(r'``(.*?)\'\'', r'“\1”', content, flags=re.DOTALL)
    content = replace_structures(content, label_map)
    content = re.sub(r'\\cref\{([^}]*)\}', process_cref(label_map), content)
    content = re.sub(
        r'\\begin\{equation\}(?:\[([^\]]*)\])?\n(.*?)\n\\end\{equation\}',
        process_equation,
        content,
        flags=re.DOTALL
    )
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=str, default='../process_tmp', help='Input directory')
    parser.add_argument('--output', type=str, default='../latex_src', help='Output directory')
    args = parser.parse_args()
    input_dir = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(exist_ok=True)
    tex_files = list(input_dir.glob('*.tex'))
    all_contents = []
    label_to_file = {}
    for tex_file in tex_files:
        with open(tex_file, 'r', encoding='utf-8') as f:
            content = f.read()
            all_contents.append(content)
            # Find all labels in this file
            for pattern, typ in STRUCTURE_PATTERNS:
                for m in re.finditer(pattern, content, flags=re.DOTALL):
                    label = m.group(2)
                    label_to_file[label] = tex_file.name
    label_map = build_label_map(all_contents)
    for i, tex_file in enumerate(tex_files):
        output_file = output_dir / tex_file.name
        process_file(tex_file, output_file, label_map)
        print(f"Handled labels for {tex_file.name}")
    # Write label-to-file mapping
    with open(output_dir / 'label_map.json', 'w', encoding='utf-8') as f:
        json.dump(label_to_file, f)
    bib_path = input_dir / 'refs.bib'
    if bib_path.exists():
        import shutil
        shutil.copy(bib_path, output_dir / 'refs.bib')

if __name__ == '__main__':
    main() 