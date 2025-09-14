#!/usr/bin/env python3
"""
Convert interview transcript to HTML format
"""

import re
import os
from datetime import datetime

import argparse

# arg for input file
parser = argparse.ArgumentParser(description='Convert interview transcript to HTML format')
parser.add_argument('input_file', type=str, help='Path to the input transcript file')
args = parser.parse_args()

# Family pairs and their information
FAMILY_INFO = {
    'Benita': {
        'partner': 'John',
        'family_name': 'Katzenellenbogen',
        'full_name': 'Benita Katzenellenbogen'
    },
    'John': {
        'partner': 'Benita',
        'family_name': 'Katzenellenbogen',
        'full_name': 'John Katzenellenbogen'
    },
    'Meg': {
        'partner': 'Joe',
        'family_name': 'Newhouse',
        'full_name': 'Meg Newhouse'
    },
    'Joe': {
        'partner': 'Meg',
        'family_name': 'Newhouse',
        'full_name': 'Joe Newhouse'
    }
}

def parse_transcript(file_path):
    """Parse the transcript file and extract speaker segments"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split into segments based on speaker indicators
    segments = []
    current_speaker = None
    current_text = []
    speakers_found = set()
    
    lines = content.split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            if current_text:
                current_text.append('')  # Preserve paragraph breaks
            continue
            
        # Check if line starts with a speaker name (more flexible regex)
        speaker_match = re.match(r'^([A-Za-z]+):\s*(.*)$', line)
        
        if speaker_match:
            speaker_name = speaker_match.group(1)
            speakers_found.add(speaker_name)
            
            # Save previous segment if exists
            if current_speaker and current_text:
                segments.append({
                    'speaker': current_speaker,
                    'text': '\n'.join(current_text).strip()
                })
            
            # Start new segment
            current_speaker = speaker_name
            current_text = [speaker_match.group(2)] if speaker_match.group(2) else []
        else:
            # Continuation of current speaker
            if current_speaker:
                current_text.append(line)
    
    # Don't forget the last segment
    if current_speaker and current_text:
        segments.append({
            'speaker': current_speaker,
            'text': '\n'.join(current_text).strip()
        })
    
    return segments, speakers_found

def detect_interviewee(speakers_found):
    """Detect who the main interviewee is based on speakers found"""
    # Remove 'Laker' as they're always the interviewer
    potential_interviewees = speakers_found - {'Laker'}
    
    # Find which family member this is
    for speaker in potential_interviewees:
        if speaker in FAMILY_INFO:
            return speaker
    
    # If we can't detect, default to first non-Laker speaker
    if potential_interviewees:
        return list(potential_interviewees)[0]
    
    return None

def generate_html(segments, output_file, interviewee):
    """Generate HTML file from parsed segments"""
    
    # Get family info
    if interviewee and interviewee in FAMILY_INFO:
        family_info = FAMILY_INFO[interviewee]
        title = f"{interviewee} {family_info['family_name']} - Interview Transcript"
        header_name = family_info['full_name']
        partner = family_info['partner']
        family_name = family_info['family_name'].lower()
    else:
        # Fallback for unknown interviewees
        title = f"{interviewee} - Interview Transcript" if interviewee else "Interview Transcript"
        header_name = interviewee if interviewee else "Unknown"
        partner = None
        family_name = "unknown"
    
    # Generate transcript HTML first
    transcript_html = ""
    
    for segment in segments:
        transcript_html += f'''
            <div class="segment">
                <strong>{segment['speaker']}:</strong> {segment['text']}
            </div>
        '''
    
    # Generate navigation buttons
    nav_buttons = '<a href="index.html" class="nav-button">← Back to Family Page</a>'
    if partner:
        # Try to find partner's interview file
        base_dir = os.path.dirname(output_file)
        partner_file = None
        
        # Look for common file patterns
        possible_files = [
            f"{partner.lower()}.html",
            f"{partner.lower()}.txt",
        ]
        
        for possible_file in possible_files:
            if os.path.exists(os.path.join(base_dir, possible_file)):
                partner_file = possible_file
                break
        
        if partner_file:
            nav_buttons += f' <a href="{partner_file}" class="nav-button">{partner}\'s Interview →</a>'
    
    joe_predendum = '' if interviewee != 'Joe' else '<a href="https://www.nlm.nih.gov/hmd/nichsr/newhouse.html" style="text-align: center; margin: auto;">Predendum: Joe did an oral interview in 1998 accessible here.</a>'
    
    # Create the complete HTML content
    html_content = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex">
    <title>{title}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: 'Georgia', 'Times New Roman', serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
            padding: 20px;
            line-height: 1.6;
        }}

        .container {{
            max-width: 900px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            overflow: hidden;
        }}

        .header {{
            background: linear-gradient(45deg, #3498db, #2980b9);
            color: white;
            padding: 40px;
            text-align: center;
        }}

        .header h1 {{
            font-size: 2.5em;
            margin-bottom: 10px;
            font-weight: 300;
            letter-spacing: 1px;
        }}

        .header .subtitle {{
            font-size: 1.1em;
            opacity: 0.9;
            font-style: italic;
        }}

        .transcript-content {{
            padding: 40px;
        }}

        .segment {{
            font-size: 1.1em;
            color: #2c3e50;
            margin-left: 40px;
            margin-right: 40px;
            white-space: pre-line;
            text-align: justify;
        }}

        .navigation {{
            padding: 30px 40px;
            text-align: center;
            border-top: 1px solid rgba(0, 0, 0, 0.1);
            background: rgba(249, 249, 249, 0.8);
        }}

        .nav-button {{
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(45deg, #3498db, #2980b9);
            color: white;
            text-decoration: none;
            border-radius: 25px;
            font-size: 1em;
            font-weight: 500;
            transition: all 0.3s ease;
            margin: 0 10px;
        }}

        .nav-button:hover {{
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(52, 152, 219, 0.4);
        }}

        @media (max-width: 768px) {{
            body {{
                padding: 10px;
            }}
            
            .header h1 {{
                font-size: 2em;
            }}
            
            .transcript-content {{
                padding: 20px;
            }}
            
            .segment {{
                font-size: 1em;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{header_name}</h1>
            <p class="subtitle">Interview Transcript - May 2025<br>Interviewed by Laker Newhouse</p>
        </div>

        <div class="transcript-content">
            {joe_predendum}
            {transcript_html}
        </div>

        <div class="navigation">
            {nav_buttons}
        </div>
    </div>
</body>
</html>'''
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_content)

def main():
    # File paths
    input_file = args.input_file
    output_file = args.input_file.replace('.txt', '.html')
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found!")
        return
    
    print(f"Converting {input_file} to {output_file}...")
    
    # Parse transcript
    segments, speakers_found = parse_transcript(input_file)
    print(f"Parsed {len(segments)} conversation segments")
    print(f"Speakers found: {', '.join(speakers_found)}")
    
    # Detect interviewee
    interviewee = detect_interviewee(speakers_found)
    if interviewee:
        print(f"Detected interviewee: {interviewee}")
        if interviewee in FAMILY_INFO:
            print(f"Family: {FAMILY_INFO[interviewee]['full_name']}")
    else:
        print("Could not detect interviewee")
    
    # Generate HTML
    generate_html(segments, output_file, interviewee)
    print(f"Open {output_file} in your browser to view the formatted interview")

if __name__ == "__main__":
    main() 