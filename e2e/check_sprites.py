"""
After the sprite scripts have rerun, checks that every generated PNG still has the same pixels as the
committed one. Compares decoded pixels, not bytes, because PNG compression differs between zlib versions.

    cd apps/mobile && python3 scripts/spookify-sprites.py && python3 scripts/make-pixel-assets.py && cd ../..
    python3 e2e/check_sprites.py
"""
import io
import subprocess
import sys

from PIL import Image

changed = subprocess.run(
    ['git', 'diff', '--name-only', '--', 'apps/mobile/assets/sprites', 'apps/mobile/assets/images/notification-icon.png'],
    capture_output=True, text=True, check=True,
).stdout.split()
untracked = subprocess.run(
    ['git', 'ls-files', '--others', '--exclude-standard', '--', 'apps/mobile/assets/sprites'],
    capture_output=True, text=True, check=True,
).stdout.split()

bad = [f'{p}: made by the scripts but not committed' for p in untracked]
for path in changed:
    if not path.endswith('.png'):
        continue
    old = subprocess.run(['git', 'show', f'HEAD:{path}'], capture_output=True, check=True).stdout
    a = Image.open(io.BytesIO(old)).convert('RGBA')
    b = Image.open(path).convert('RGBA')
    if a.size != b.size or a.tobytes() != b.tobytes():
        bad.append(f'{path}: pixels differ from the committed file')

if bad:
    print('Generated sprites are out of date. Rerun the scripts and commit the results:', *bad, sep='\n  ', file=sys.stderr)
    sys.exit(1)
print(f'sprites match ({len(changed)} re-encoded files checked)')
