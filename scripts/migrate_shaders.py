#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

"""
Shader Migration Script for Shader Wallpaper v4.0

This script migrates existing shaders to the new format with metadata,
and generates a shader index file for the library.
"""

import os
import re
import json
import hashlib
from pathlib import Path
from datetime import datetime

# Categories and their detection patterns
CATEGORY_PATTERNS = {
    'Fractal': [r'mandelbrot', r'julia', r'fractal', r'iteration'],
    'Raymarching': [r'raymar', r'sdf', r'sphere\s*tracing', r'distance\s*field'],
    'Space': [r'star', r'galaxy', r'nebula', r'space', r'cosmos', r'planet'],
    'Nature': [r'wave', r'water', r'ocean', r'cloud', r'tree', r'sky', r'sun'],
    'Retro': [r'retro', r'crt', r'scanline', r'pixel', r'8-?bit', r'vhs'],
    'Noise': [r'noise', r'perlin', r'simplex', r'worley', r'voronoi'],
    'Geometric': [r'voronoi', r'hexagon', r'polygon', r'triangle', r'grid'],
    'Audio Reactive': [r'audio', r'music', r'sound', r'beat', r'frequency'],
    '3D': [r'camera', r'rotate', r'perspective', r'depth'],
    '2D': [r'uv\s*=', r'fragCoord\s*/\s*iResolution'],
}

def detect_category(code: str) -> str:
    """Detect shader category based on code patterns."""
    code_lower = code.lower()
    
    for category, patterns in CATEGORY_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, code_lower):
                return category
    
    return 'Abstract'

def detect_features(code: str) -> dict:
    """Detect shader features from code."""
    return {
        'needsAudio': bool(re.search(r'iChannel.*audio|music|sound', code, re.I)),
        'needsTextures': 'iChannel' in code and 'texture' in code.lower(),
        'hasBuffers': bool(re.search(r'Buffer[ABCD]', code)),
        'usesTime': 'iTime' in code,
        'usesMouse': 'iMouse' in code,
        'usesDate': 'iDate' in code,
    }

def extract_shader_info(file_path: Path) -> dict:
    """Extract information from a shader file."""
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # Generate ID from file hash
    shader_id = hashlib.md5(content.encode()).hexdigest()[:12]
    
    # Extract name from filename
    name = file_path.stem
    name = name.replace('.frag', '').replace('.qsb', '')
    name = name.replace('_', ' ').replace('-', ' ')
    name = ' '.join(word.capitalize() for word in name.split())
    
    # Try to extract author from comments
    author = ''
    author_match = re.search(r'(?:author|by|created by)[:\s]+([^\n]+)', content, re.I)
    if author_match:
        author = author_match.group(1).strip()
    
    # Try to extract Shadertoy URL/ID
    source = 'local'
    source_id = ''
    shadertoy_match = re.search(r'shadertoy\.com/view/(\w+)', content, re.I)
    if shadertoy_match:
        source = 'shadertoy'
        source_id = shadertoy_match.group(1)
    
    # Try to extract description from comments
    description = ''
    desc_match = re.search(r'(?:description|about)[:\s]+([^\n]+)', content, re.I)
    if desc_match:
        description = desc_match.group(1).strip()
    
    # Detect category and features
    category = detect_category(content)
    features = detect_features(content)
    
    return {
        'id': shader_id,
        'name': name,
        'author': author,
        'description': description,
        'category': category,
        'tags': [],
        'shaderPath': str(file_path),
        'thumbnailPath': '',
        'source': source,
        'sourceId': source_id,
        'likes': 0,
        'views': 0,
        'favorite': False,
        **features
    }

def migrate_shaders(shaders_dir: str, output_dir: str = None) -> list:
    """Migrate all shaders in a directory."""
    shaders_path = Path(shaders_dir)
    if not shaders_path.exists():
        print(f"Shaders directory not found: {shaders_dir}")
        return []
    
    shaders = []
    
    # Find all shader files
    for ext in ['*.frag', '*.frag.qsb', '*.glsl']:
        for shader_file in shaders_path.rglob(ext):
            try:
                info = extract_shader_info(shader_file)
                # Make path relative
                info['shaderPath'] = str(shader_file.relative_to(shaders_path.parent))
                shaders.append(info)
                print(f"Processed: {info['name']} ({info['category']})")
            except Exception as e:
                print(f"Error processing {shader_file}: {e}")
    
    return shaders

def create_shader_index(shaders: list, output_path: str):
    """Create shader index JSON file."""
    index = {
        'version': 1,
        'generated': datetime.now().isoformat(),
        'shaders': shaders,
        'categories': list(CATEGORY_PATTERNS.keys()) + ['Abstract', 'Imported', 'Favorites']
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=2)
    
    print(f"\nCreated shader index with {len(shaders)} shaders")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate shaders to v4.0 format')
    parser.add_argument('--shaders', '-s', 
                        default='package/contents/ui/Shaders',
                        help='Path to shaders directory')
    parser.add_argument('--output', '-o',
                        default='package/contents/ui/shader_index.json',
                        help='Output path for shader index')
    
    args = parser.parse_args()
    
    print("Shader Migration Script for Shader Wallpaper v4.0")
    print("=" * 50)
    
    # Also check Shaders6 directory
    shaders = []
    
    if os.path.exists(args.shaders):
        shaders.extend(migrate_shaders(args.shaders))
    
    shaders6_dir = args.shaders.replace('Shaders', 'Shaders6')
    if os.path.exists(shaders6_dir):
        shaders.extend(migrate_shaders(shaders6_dir))
    
    if shaders:
        create_shader_index(shaders, args.output)
        print(f"Index saved to: {args.output}")
    else:
        print("No shaders found to migrate")

if __name__ == '__main__':
    main()

