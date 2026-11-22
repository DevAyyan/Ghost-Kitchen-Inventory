"""
Spooky grade for the kitchen sprites (Pixel Art Fridge Pack, Fridge 4, white).

Reads the untouched frames from scripts/sprite-src/kitchen (already 4x) and writes graded 4x frames to
assets/sprites/kitchen. Run from apps/mobile:  python3 scripts/spookify-sprites.py   (needs Pillow)

Work is done at the art's native 78 x 79 px so every added mark is one real pixel.
"""
import colorsys
import sys
from PIL import Image

SRC = 'scripts/sprite-src/kitchen'
OUT = 'assets/sprites/kitchen'
SETS = ('fridge', 'freezer', 'pantry')
FRAMES = 5

WEB = (196, 206, 200, 255)
SLIME = (122, 214, 96, 255)
SLIME_DARK = (60, 140, 58, 255)
EYE = (255, 60, 40, 255)
SCRATCH = (40, 44, 42, 255)
RUST = (110, 72, 44, 255)


def grade(p):
    """Cold, sickly and dim. Pale neutrals and blues go to a grave-moss green-grey; warm colours stay warm but muddy."""
    r, g, b, a = p
    if a == 0:
        return p
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    hue = h * 360
    if s < 0.2:
        # Old enamel gone a dirty grey-green.
        h, s, l = 100 / 360, 0.07, l * 0.62
    elif 170 < hue < 230:
        # A murky, cold interior.
        h, s, l = 180 / 360, s * 0.4, l * 0.55
    else:
        s, l = s * 0.5, l * 0.6
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return (int(r * 255), int(g * 255), int(b * 255), a)


def main():
    for name in SETS:
        frames = [Image.open(f'{SRC}/{name}-{i}.png').convert('RGBA').resize((78, 79), Image.NEAREST) for i in range(FRAMES)]
        w, h = frames[0].size
        # A copy: frame 0 is graded in place below, and later frames compare against the untouched art.
        shut = frames[0].copy().load()
        ajar, fwd = make_ajar(name, frames[0], frames[1])
        for i, im in [(i, im) for i, im in enumerate(frames)] + [('ajar', ajar)]:
            orig = im.copy().load()
            px = im.load()
            move = fwd if i == 'ajar' else (lambda x, y: x)

            def put(x, y, c):
                if 0 <= x < w and 0 <= y < h and px[x, y][3] > 0:
                    px[x, y] = c

            def on_door(x, y):
                # The shut door still covers this pixel, so a mark on the door swings away with it.
                if i == 'ajar':
                    return move(x, y) is not None
                return orig[x, y] == shut[x, y]

            def put_door(x, y, c):
                # A mark on the door, at its place on the shut door; the ajar door has slid, so it moves too.
                if on_door(x, y):
                    put(move(x, y), y, c)

            for y in range(h):
                for x in range(w):
                    px[x, y] = grade(px[x, y])

            # A cobweb in the top-left corner, which stays put in every frame.
            for x, y in [(0, 0), (1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (0, 3), (0, 4), (0, 5), (0, 6), (3, 0), (4, 0),
                         (5, 0), (6, 0), (1, 3), (2, 3), (3, 2), (3, 1), (1, 5), (2, 5), (3, 5), (5, 3), (5, 2), (5, 1)]:
                put(2 + x, 2 + y, WEB)

            if name == 'pantry':
                # Claw marks down the right-hand door.
                for sx, sy in [(25, 44), (28, 43), (31, 44)]:
                    for t in range(8):
                        put_door(sx + t // 2, sy + t, SCRATCH)
                # Eyes watching from the dark back of the cabinet, only where the back panel shows.
                for ex, ey in [(9, 25), (32, 52), (17, 66), (58, 22), (66, 50)]:
                    dark = all(sum(orig[ex + d, ey][:3]) < 200 for d in (0, 2))
                    if i != 'ajar' and dark and not on_door(ex, ey):
                        put(ex, ey, EYE)
                        put(ex + 2, ey, EYE)
            else:
                # Slime oozing from the seam between freezer and fridge, down the hinge side.
                for x, length in [(2, 5), (3, 3), (5, 7), (6, 2)]:
                    for y in range(31, 31 + length):
                        put(x, y, SLIME)
                    put(x, 31 + length, SLIME_DARK)
                # Claw marks on the fridge door.
                for sx in (22, 25, 28):
                    for t in range(10):
                        put_door(sx + t // 3, 48 + t, SCRATCH)
                # A rust streak low on the fridge door.
                for x, y in [(14, 70), (15, 70), (15, 71), (16, 71), (15, 72)]:
                    put_door(x, y, RUST)

            im.resize((w * 4, h * 4), Image.NEAREST).save(f'{OUT}/{name}-{i}.png', optimize=True)


# How an ajar door (between frame 0 and 1) is made from the shut art: within the door's rows, a thin crack
# opens at its edge, showing frame 1's lit interior, and the door beside it slides over by dropping a few
# plain columns from its middle. `slide` lists (new x, old x, width) runs of door columns that move.
AJAR = {
    # Single doors open on the left, handle side: a 4 px crack, the handle half slides right.
    'freezer': {'rows': [(3, 28)], 'crack': (5, 8), 'slide': [(9, 5, 27)]},
    'fridge': {'rows': [(32, 72)], 'crack': (5, 8), 'slide': [(9, 5, 27)]},
    # The pantry's double doors part in the middle: each leaf slides 2 px outward.
    'pantry': {'rows': [(2, 73)], 'crack': (19, 22), 'slide': [(10, 12, 9), (23, 21, 16)]},
}


PROBLEMS: list[str] = []


def make_ajar(name, f0, f1):
    spec = AJAR[name]
    out = f0.copy()
    a, b, p = f0.load(), f1.load(), out.load()
    cx0, cx1 = spec['crack']
    crack = set(range(cx0, cx1 + 1))
    olds = {ox + k for _, ox, n in spec['slide'] for k in range(n)}
    slots = {nx + k for nx, _, n in spec['slide'] for k in range(n)} | crack
    shift = {ox + k: nx + k for nx, ox, n in spec['slide'] for k in range(n)}
    in_rows = lambda y: any(y0 <= y <= y1 for y0, y1 in spec['rows'])
    for y in range(f0.height):
        if not in_rows(y):
            continue
        for ox, nx in shift.items():
            p[nx, y] = a[ox, y]
        for x in crack:
            p[x, y] = b[x, y]
        # The dropped columns must be plain (equal to a neighbour), so no detail is lost.
        for x in slots - olds:
            if a[x, y] != a[x - 1, y] and a[x, y] != a[x + 1, y]:
                PROBLEMS.append(f'{name}: dropped column {x} has detail at row {y}')

    def fwd(x, y):
        """Where a pixel of the shut door is in the ajar frame, or None if the crack or the slide covered it."""
        if not in_rows(y):
            return x
        if x in shift:
            return shift[x]
        return None if x in slots else x

    return out, fwd


if __name__ == '__main__':
    main()
    # Fail loudly, so a change to AJAR can't quietly cut detail out of a door.
    if PROBLEMS:
        print('\n'.join(sorted(set(PROBLEMS))), file=sys.stderr)
        sys.exit(1)
