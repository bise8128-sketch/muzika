import os
import re
import sys

def check_links(directory):
    markdown_link_regex = re.compile(r'\[.*?\]\((.*?)\)')
    broken_links = []
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.md'):
                file_path = os.path.join(root, file)
                # Skip the script itself if it was somehow in the search path
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    links = markdown_link_regex.findall(content)
                    
                    for link in links:
                        # Skip external links, anchors within the same file, and mailto
                        if link.startswith('http') or link.startswith('#') or link.startswith('mailto:') or link.startswith('tel:'):
                            continue
                        
                        # Handle file URI
                        if link.startswith('file:///'):
                            # Convert file:/// URI to absolute path
                            link_path = link.replace('file://', '')
                            if not os.path.exists(link_path):
                                broken_links.append((file_path, link))
                            continue

                        # Clean up link (remove fragments/query params)
                        clean_link = link.split('#')[0].split('?')[0]
                        if not clean_link:
                            continue

                        # Resolve relative path
                        target_path = os.path.normpath(os.path.join(root, clean_link))
                        
                        if not os.path.exists(target_path):
                            broken_links.append((file_path, link))
                            
    return broken_links

if __name__ == '__main__':
    # Add project root to search if running from scripts dir
    cwd = os.getcwd()
    search_dirs = ['docs', 'plans']
    all_broken = []
    for d in search_dirs:
        target_dir = os.path.join(cwd, d)
        if os.path.exists(target_dir):
            all_broken.extend(check_links(target_dir))
            
    if all_broken:
        print(f"Found {len(all_broken)} broken links:")
        for file, link in all_broken:
            relative_file = os.path.relpath(file, cwd)
            print(f"  {relative_file}: {link}")
        sys.exit(1)
    else:
        print("Success: No broken internal links found in /docs or /plans!")
        sys.exit(0)
