#!/usr/bin/env python3
"""
Splits each Pretendard weight (scripts/font-src/*.subset.woff2: ASCII + 2780 hangul) into two files in src/assets/fonts:
  · .core  : ASCII and every character the app's own text uses (about 650 syllables), the only one loaded on first open
  · .more  : the other syllables and symbols, fetched by the browser only when some text (a name, a caption, a message) needs one
and prints the @font-face rules (with unicode-range) to put in src/styles.css.
  pip install fonttools brotli && python3 scripts/font-split.py
"""
import glob, os, subprocess, sys
from fontTools.ttLib import TTFont

root = os.path.join(os.path.dirname(__file__), '..')
src = os.path.join(os.path.dirname(__file__), 'font-src')
out = os.path.join(root, 'src', 'assets', 'fonts')
code = ''
for pat in ('src/**/*.ts', 'src/**/*.tsx', '../.github/scripts/*.mjs', 'index.html'):
    for p in glob.glob(os.path.join(root, pat), recursive=True):
        code += open(p, encoding='utf8').read()
used = {ord(c) for c in code}
WEIGHTS = [('Regular', 400), ('Medium', 500), ('SemiBold', 600), ('Bold', 700)]
have = set(TTFont(os.path.join(src, 'Pretendard-Regular.subset.woff2')).getBestCmap())
isH = lambda c: 0xAC00 <= c <= 0xD7A3
core = {c for c in have if c < 0x80 or c in used}
more = set(have) - core

def ranges(cps):
    cps = sorted(cps); res = []; a = b = None
    for c in cps:
        if a is None: a = b = c
        elif c == b + 1: b = c
        else: res.append((a, b)); a = b = c
    if a is not None: res.append((a, b))
    return ','.join(f'U+{x:X}' if x == y else f'U+{x:X}-{y:X}' for x, y in res)

css = []
for name, w in WEIGHTS:
    for tag, cps in (('core', core), ('more', more)):
        o = os.path.join(out, f'Pretendard-{name}.{tag}.woff2')
        subprocess.run([sys.executable, '-m', 'fontTools.subset', os.path.join(src, f'Pretendard-{name}.subset.woff2'), f'--unicodes={",".join(f"{c:X}" for c in sorted(cps))}',
                        '--flavor=woff2', f'--output-file={o}', '--layout-features=kern,locl,ccmp', '--no-hinting', '--desubroutinize'], check=True)
        print(os.path.basename(o), os.path.getsize(o) // 1024, 'KB')
        css.append(f'@font-face{{font-family:"Pretendard";src:url("./assets/fonts/Pretendard-{name}.{tag}.woff2") format("woff2");font-weight:{w};font-display:swap;unicode-range:{ranges(cps)}}}')
open(os.path.join(root, 'scripts', 'font-faces.css'), 'w').write('\n'.join(css) + '\n')
print('rules in scripts/font-faces.css')
