import shutil
import subprocess
from pathlib import Path
import os
import sys

def main():
    base_dir = Path(__file__).parent.parent
    raw_dir = base_dir / 'latex_src_raw'
    tmp_dir = base_dir / 'process_tmp'
    final_dir = base_dir / 'latex_src'

    # Clean/create tmp dir
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)

    # Run process_citations.py
    subprocess.run([sys.executable, 'process_latex/handle_citations.py', '--input', str(raw_dir), '--output', str(tmp_dir)], check=True)

    # Run process_labels.py
    try:
        subprocess.run([sys.executable, 'process_latex/handle_labels.py', '--input', str(tmp_dir), '--output', str(final_dir)], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error processing labels: {e}")
        return

    # Clean up tmp dir
    shutil.rmtree(tmp_dir)
    print('Processing complete.')

if __name__ == '__main__':
    main() 