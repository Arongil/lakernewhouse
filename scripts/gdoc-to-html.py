import re

def convert_to_html(text, title):
    # Split the text into paragraphs
    paragraphs = text.split('\n')
    
    # Function to convert URLs to HTML links
    def convert_urls(text):
        # Pattern for URLs with http:// or https://
        url_pattern = r'(https?://\S+)'
        # Pattern for domain-like strings without http://, including possible paths
        domain_pattern = r'\b(\w+\.\w+(?:\.\w+)?(?:/\S*)?)\b'
        
        # First, convert explicit URLs
        text = re.sub(url_pattern, r'<a href="\1">\1</a>', text)
        
        # Then, convert domain-like strings
        def domain_to_link(match):
            full_path = match.group(1)
            return f'<a href="https://www.{full_path}">{full_path}</a>'
        
        text = re.sub(domain_pattern, domain_to_link, text)
        
        return text
    
    # Process each paragraph
    html_paragraphs = [f'\t\t<p>{convert_urls(p.strip())}</p>' for p in paragraphs if p.strip()]
    
    # Join the HTML paragraphs
    html_content = '\n'.join(html_paragraphs)
    
    # Create a basic HTML structure
    html = f'''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - Laker Newhouse</title>
    <link href='https://fonts.googleapis.com/css?family=Roboto:400,700&display=swap' rel='stylesheet'>
    <link rel="stylesheet" href="/css/normalize.css">
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <header>
        <nav>
            <h3><a href="/" style="font-size: 1.4rem; color: #333; text-decoration: none;">Laker Newhouse</a></h3>
            <a href="/research">Research</a>
            <a href="/writing">Writing</a>
            <a href="/how-to-mit">~ How to MIT ~</a>
        </nav>
    </header>
    <main>
        <h2 style="margin: 0;">{title}</h2>
        <h4 style="margin-top: 0; margin-bottom: 2rem; text-align: center;">MONTH YEAR</h4>
{html_content}
    </main>
</body>
</html>
'''
    return html

# Read from gdoc-source.txt
try:
    with open('scripts/gdoc-source.txt', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    if not lines:
        raise ValueError("The file is empty.")
    
    title = lines[0].strip()
    content = ''.join(lines[1:])
    
    html_output = convert_to_html(content, title)
    
    # Save the HTML to a file
    with open('scripts/doc.html', 'w', encoding='utf-8') as f:
        f.write(html_output)
    
    print("HTML file has been successfully created as 'doc.html'")
    
except FileNotFoundError:
    print("Error: 'gdoc-source.txt' file not found. Please make sure the file exists in the same directory as this script.")
except ValueError as e:
    print(f"Error: {str(e)}")
except Exception as e:
    print(f"An unexpected error occurred: {str(e)}")