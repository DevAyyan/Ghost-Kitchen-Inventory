"""
Pixel-art assets built on the graded kitchen sprites. Run from apps/mobile after spookify-sprites.py:

    python3 scripts/spookify-sprites.py && python3 scripts/make-pixel-assets.py      (needs Pillow)

Writes, all pre-scaled with nearest-neighbour so they stay crisp:
- assets/sprites/kitchen/both-ajar.png    freezer and fridge doors both ajar (freezer-ajar + fridge-ajar)
- assets/sprites/kitchen/light-<zone>-<n>.png the eerie light from a haunted door at scene frame n (1 = ajar,
  2 to 5 = swinging open), same canvas as the sprite
- assets/sprites/pixel/*.png              interior wall tiles, shelf shadow, and the food tile overlays
"""
import math
import os
from PIL import Image

SRC = 'scripts/sprite-src/kitchen'
KITCHEN = 'assets/sprites/kitchen'
PIXEL = 'assets/sprites/pixel'
W, H = 78, 79
LIGHT = (190, 255, 170)


def native(path):
    return Image.open(path).convert('RGBA').resize((W, H), Image.NEAREST)


def up(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def ajar_mask(zone):
    """Pixels that change when the door opens a crack (the ajar frame against the shut one)."""
    a, b = native(f'{KITCHEN}/{zone}-0.png').load(), native(f'{KITCHEN}/{zone}-ajar.png').load()
    return {(x, y) for y in range(H) for x in range(W) if a[x, y] != b[x, y]}


def both_ajar():
    fz = native(f'{KITCHEN}/freezer-ajar.png')
    fr = native(f'{KITCHEN}/fridge-ajar.png')
    out = fr.copy()
    p, f = out.load(), fz.load()
    for x, y in ajar_mask('freezer'):
        p[x, y] = f[x, y]
    up(out, 4).save(f'{KITCHEN}/both-ajar.png', optimize=True)


def glow(mask):
    """
    A pixel-art glow: faint over the lit pixels (so the food still shows through), then a dithered fringe
    that thins with distance, the way pixel art fakes a soft glow without blending.
    """
    im = Image.new('RGBA', (W, H))
    p = im.load()
    for x, y in mask:
        p[x, y] = LIGHT + (55,)
    for y in range(H):
        for x in range(W):
            if (x, y) in mask:
                continue
            d = min((abs(x - mx) + abs(y - my) for mx, my in mask), default=99)
            if d == 1 and (x + y) % 2 == 0:
                p[x, y] = LIGHT + (130,)
            elif d == 2 and (x + y) % 4 == 0:
                p[x, y] = LIGHT + (100,)
            elif d == 3 and x % 3 == 0 and y % 4 == 0:
                p[x, y] = LIGHT + (80,)
    return im


def light(zone, gap):
    """Light through the crack of the ajar frame (frame index 1)."""
    gx0, gy0, gx1, gy1 = gap
    mask = {(x, y) for (x, y) in ajar_mask(zone) if gx0 <= x <= gx1 and gy0 <= y <= gy1}
    up(glow(mask), 4).save(f'{KITCHEN}/light-{zone}-1.png', optimize=True)


# Rows each door covers, and the body's width (the door's outer colours are taken from the body).
DOOR_ROWS = {'freezer': (0, 29), 'fridge': (30, H - 1), 'pantry': (0, H - 1)}
BODY_W = 41


def light_open(zone):
    """
    Light while the door swings (the pack's frames 1 to 4, scene frame indices 2 to 5): every pixel the open
    door shows that the shut one didn't, in a colour the door's outside doesn't use. That is the inside of
    the body and, once the door has swung out beside it, the inside of the door too (its shelves and
    lining), but not the door's outer frame. Worked out on the untouched art, so the spooky marks don't count.
    """
    y0, y1 = DOOR_ROWS[zone]
    shut = native(f'{SRC}/{zone}-0.png').load()
    door = {shut[x, y] for y in range(y0, y1 + 1) for x in range(BODY_W)}
    for k in range(1, 5):
        f = native(f'{SRC}/{zone}-{k}.png').load()
        mask = {(x, y) for y in range(y0, y1 + 1) for x in range(W)
                if f[x, y] != shut[x, y] and f[x, y] not in door and f[x, y][3] > 0}
        up(glow(mask), 4).save(f'{KITCHEN}/light-{zone}-{k + 1}.png', optimize=True)


def tile(pattern, palette, k, name):
    """A small repeatable texture from a character grid."""
    h, w = len(pattern), len(pattern[0])
    im = Image.new('RGBA', (w, h))
    p = im.load()
    for y, row in enumerate(pattern):
        for x, ch in enumerate(row):
            p[x, y] = palette[ch]
    up(im, k).save(f'{PIXEL}/{name}.png', optimize=True)


def wall_tiles():
    # Graded fridge interior: tiled wall with darker grout and a few stains.
    tile([
        'aaaaaaaaaaaaaaab',
        'aaaaaaaaaaaaaaab',
        'aaaaaaacaaaaaaab',
        'aaaaaaaaaaaaaaab',
        'aaaaaaaaaaaaaaab',
        'aaaaaaaaaaaaaaab',
        'aaaaaaaaaaaaacab',
        'bbbbbbbbbbbbbbbb',
        'aaaaaaabaaaaaaaa',
        'aaaaaaabaaaaaaaa',
        'aacaaaabaaaaaaaa',
        'aaaaaaabaaaaaaaa',
        'aaaaaaabaaaaacca',
        'aaaaaaabaaaaaaaa',
        'aaaaaaabaaaaaaaa',
        'bbbbbbbbbbbbbbbb',
    ], {'a': (83, 110, 110, 255), 'b': (70, 94, 94, 255), 'c': (62, 84, 74, 255)}, 3, 'wall-fridge')
    # Freezer: the same tiles with frost specks.
    tile([
        'aaaaaaaaaaaaaaab',
        'aawaaaaaaaaaaaab',
        'aaaaaaaaaaawaaab',
        'aaaaaaaaaaaaaaab',
        'aaaaawaaaaaaaaab',
        'aaaaaaaaaaaaaaab',
        'aaaaaaaaaawaaaab',
        'bbbbbbbbbbbbbbbb',
        'aaaaaaabaaaaaaaa',
        'aaawaaabaaaaaaaa',
        'aaaaaaabaaaaawaa',
        'aaaaaaabaaaaaaaa',
        'awaaaaabaaaaaaaa',
        'aaaaaaabaaawaaaa',
        'aaaaaaabaaaaaaaa',
        'bbbbbbbbbbbbbbbb',
    ], {'a': (85, 103, 103, 255), 'b': (70, 86, 86, 255), 'w': (170, 196, 196, 255)}, 3, 'wall-freezer')
    # Pantry: dark vertical planks with grain and a knot.
    tile([
        'aaagaaab',
        'aaaaaaab',
        'agaaaaab',
        'aaaaagab',
        'aaaaaaab',
        'aaakaaab',
        'aaaaaaab',
        'aagaaaab',
        'aaaaaaab',
        'aaaaagab',
        'agaaaaab',
        'aaaaaaab',
        'aaaagaab',
        'aaaaaaab',
        'agaaaaab',
        'aaaaaaab',
    ], {'a': (47, 37, 31, 255), 'b': (30, 23, 19, 255), 'g': (56, 44, 36, 255), 'k': (36, 28, 23, 255)}, 3, 'wall-pantry')
    # Shadow under a shelf board, dithered rather than faded.
    tile(['ab', 'ba', 'bc', 'cb'], {'a': (0, 0, 0, 150), 'b': (0, 0, 0, 90), 'c': (0, 0, 0, 0)}, 3, 'shelf-shadow')
    # Aging: a dithered yellow cast.
    tile(['y.', '..'], {'y': (220, 200, 60, 70), '.': (0, 0, 0, 0)}, 2, 'aging')
    # Forgotten: dust settled on the tile.
    tile([
        'd.......',
        '....d...',
        '..d.....',
        '......d.',
        '.d......',
        '.....d..',
        '...d....',
        '.......d',
    ], {'d': (200, 200, 190, 150), '.': (0, 0, 0, 0)}, 2, 'dust')


def cobweb(size, name, threads):
    """A corner cobweb: spokes from the corner joined by sagging threads."""
    im = Image.new('RGBA', (size, size))
    p = im.load()
    strong, faint = (225, 230, 226, 235), (190, 198, 194, 170)
    angles = [0, 30, 60, 90]
    for ang in angles:
        a = math.radians(ang)
        for t in range(size):
            x, y = round(math.cos(a) * t), round(math.sin(a) * t)
            if 0 <= x < size and 0 <= y < size:
                p[x, y] = strong
    for radius in threads:
        for i in range(len(angles) - 1):
            a0, a1 = math.radians(angles[i]), math.radians(angles[i + 1])
            for k in range(13):
                f = k / 12
                a = a0 + (a1 - a0) * f
                r = radius - math.sin(math.pi * f) * 1.2
                x, y = round(math.cos(a) * r), round(math.sin(a) * r)
                if 0 <= x < size and 0 <= y < size and p[x, y][3] == 0:
                    p[x, y] = faint
    up(im, 2).save(f'{PIXEL}/{name}.png', optimize=True)


def embers():
    """Expiring: three frames of pixel flames licking up the tile's bottom edge."""
    w, h = 28, 8
    cols = [(255, 214, 90, 255), (255, 140, 40, 255), (200, 70, 20, 255)]
    heights = [[2, 4, 3, 5, 2, 3, 6, 3, 2, 4, 5, 2, 3, 4], [3, 2, 5, 3, 4, 6, 2, 4, 5, 2, 3, 5, 4, 2], [4, 5, 2, 4, 6, 2, 4, 5, 3, 6, 2, 4, 2, 5]]
    for f, hs in enumerate(heights):
        im = Image.new('RGBA', (w, h))
        p = im.load()
        for i, fh in enumerate(hs):
            for dx in (0, 1):
                x = i * 2 + dx
                top = h - fh + (dx if fh > 2 else 0)
                for y in range(top, h):
                    depth = y - top
                    p[x, y] = cols[2] if y >= h - 1 else cols[1] if depth > 1 else cols[0]
        up(im, 2).save(f'{PIXEL}/ember-{f}.png', optimize=True)


def art():
    """Colour pixel illustrations replacing the Fluent Emoji art (decorative only, like before)."""
    os.makedirs('assets/sprites/art', exist_ok=True)
    pal = {
        '.': (0, 0, 0, 0), 'k': (28, 22, 30, 255),
        'o': (240, 128, 32, 255), 'O': (196, 88, 18, 255), 'y': (255, 214, 90, 255), 'g': (90, 150, 60, 255),
        's': (150, 156, 168, 255), 'S': (104, 110, 124, 255), 'w': (236, 232, 214, 255), 'W': (196, 190, 160, 255),
        'p': (150, 110, 220, 255), 'P': (96, 64, 160, 255), 'l': (210, 190, 255, 255), 'r': (226, 70, 50, 255),
        'b': (60, 48, 70, 255), 'B': (40, 32, 48, 255), 'e': (110, 80, 50, 255),
    }
    grids = {
        'pumpkin': [
            '.......gg.......',
            '.......g........',
            '....kkkkkkkk....',
            '..kkooOooOookk..',
            '.koooOooooOoook.',
            '.kookkoOOokkook.',
            'koooookOOkooooOk',
            'koOoooooooooOook',
            'koOokkkkkkkkoOok',
            'koooykkykkykoook',
            '.kooOkkkkkkOook.',
            '.kooOooOOooOook.',
            '..kkooOooOookk..',
            '....kkkkkkkk....',
            '................',
            '................',
        ],
        'bat': [
            '................',
            '................',
            '......k..k......',
            '......kkkk......',
            'k....kbrbrk....k',
            'kk..kkbbbbkk..kk',
            'kbk.kbbbbbbk.kbk',
            'kbbkkbbbbbbkkbbk',
            'kbbbbbbbbbbbbbbk',
            'kbbbbbBbbBbbbbbk',
            '.kbbbk.kk.kbbbk.',
            '..kbk......kbk..',
            '...k........k...',
            '................',
            '................',
            '................',
        ],
        'headstone': [
            '.....kkkkkk.....',
            '...kkssssssks...',
            '..kssssssssssk..',
            '.ksssssSSssssSk.',
            '.kssssSSSSsssSk.',
            '.ksssssSSssssSk.',
            '.ksssssSSssssSk.',
            '.ksSSSSSSSSSssk.',
            '.kssssssssssssk.',
            '.kssSSSSSSSsssk.',
            '.kssssssssssssk.',
            '.kssSSSSSssssSk.',
            '.kssssssssssssk.',
            'kkkkkkkkkkkkkkkk',
            'keeeeeeeeegeeegk',
            'kkkkkkkkkkkkkkkk',
        ],
        'moon': [
            '.....kkkkkk.....',
            '...kkwwwwwwkk...',
            '..kwwwwwwwWwwk..',
            '.kwwWWwwwwwwwwk.',
            '.kwwWWwwwwwWwwk.',
            'kwwwwwwwwwwwwwwk',
            'kwwwwwwwWWwwwwwk',
            'kwwwwwwwWWwwwwwk',
            'kwwWwwwwwwwwwwwk',
            'kwwwwwwwwwwwwWwk',
            'kwwwwWWwwwwwwwwk',
            '.kwwwWWwwwwwwwk.',
            '.kwwwwwwwwWwwwk.',
            '..kwwwwwwwwwwk..',
            '...kkwwwwwwkk...',
            '.....kkkkkk.....',
        ],
        'candle': [
            '.......y........',
            '......yoy.......',
            '......yoy.......',
            '.......o........',
            '.......k........',
            '.....kkkkkk.....',
            '.....kwwwwk.....',
            '.....kwwwwkw....',
            '.....kwwwWk.....',
            '.....kwwwWk.....',
            '.....kwwwWk.....',
            '.....kwwwWk.....',
            '.....kwwwWk.....',
            '...kkkkkkkkkk...',
            '...keeeeeeeek...',
            '...kkkkkkkkkk...',
        ],
        # Ghosts banished this week: a gold cup with a little ghost on it.
        'trophy': [
            '................',
            '..kkkkkkkkkkkk..',
            'kkyyyyyyyyyyyykk',
            'kykyyyyyyyyyykyk',
            'kykyyywwwwyyykyk',
            'kykyywkwwkwyykyk',
            '.kkyywwwwwwyykk.',
            '..kyywwwwwwyyk..',
            '..kyywkwkwkyyk..',
            '...kyyyyyyyyk...',
            '....kkyyyykk....',
            '......kyyk......',
            '......kOOk......',
            '....kkOOOOkk....',
            '...kOOOOOOOOk...',
            '...kkkkkkkkkk...',
        ],
        'crystalBall': [
            '.....kkkkkk.....',
            '...kkppppppkk...',
            '..kpplllpppppk..',
            '.kppllpppppppPk.',
            '.kpplppplppppPk.',
            'kpppppplllpppPPk',
            'kppppppplpppppPk',
            'kppppppppppppPPk',
            'kPpppppppppppPPk',
            '.kPpppppppppPPk.',
            '.kPPppppppPPPPk.',
            '..kkPPPPPPPPkk..',
            '....kkkkkkkk....',
            '...kyyyyyyyyk...',
            '..kOOOOOOOOOOk..',
            '..kkkkkkkkkkkk..',
        ],
    }
    for name, rows in grids.items():
        im = Image.new('RGBA', (16, 16))
        p = im.load()
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                p[x, y] = pal[ch]
        up(im, 4).save(f'assets/sprites/art/{name}.png', optimize=True)


def drips_and_eyes():
    """
    Little loops for the scene: a slime drop falling from the freezer seam (four frames), and a pair of red
    eyes for the dark crack of an ajar pantry. Same 78 x 79 canvas as the sprites.
    """
    slime, dark = (122, 214, 96, 255), (60, 140, 58, 255)
    for f, y in enumerate([39, 41, 44, 48]):
        im = Image.new('RGBA', (W, H))
        p = im.load()
        p[5, y] = slime
        if f < 3:
            p[5, y + 1] = dark
        else:
            # Splat: the drop lands and spreads.
            p[4, y] = p[6, y] = dark
        up(im, 4).save(f'{KITCHEN}/drip-{f}.png', optimize=True)
    im = Image.new('RGBA', (W, H))
    p = im.load()
    for x in (19, 21):
        p[x, 27] = (255, 60, 40, 255)
        p[x, 28] = (150, 20, 20, 255)
    up(im, 4).save(f'{KITCHEN}/eyes-pantry.png', optimize=True)


def notification_icon():
    """
    Android notification icon: a white silhouette (Android tints it) of the fridge with its door ajar and a
    ghost peeking out, on a 24 px grid scaled to 96 px.
    """
    rows = [
        '........................',
        '...############.........',
        '...#..........#.........',
        '...#.##.......#.........',
        '...#.##.......#.........',
        '...#..........#.........',
        '...############.........',
        '...#..#.........#.......',
        '...#..#..........#......',
        '...#.##...........#.....',
        '...#..#.....###....#....',
        '...#..#....#####...#....',
        '...#..#...##.#.##..#....',
        '...#..#...#######..#....',
        '...#..#...#######..#....',
        '...#..#...#.#.#.#..#....',
        '...#..#............#....',
        '...#..#............#....',
        '...#..#...........#.....',
        '...#..#..........#......',
        '...#..#.........#.......',
        '...#############........',
        '....##.......##.........',
        '........................',
    ]
    im = Image.new('RGBA', (24, 24))
    p = im.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '#':
                p[x, y] = (255, 255, 255, 255)
    up(im, 4).save('assets/images/notification-icon.png', optimize=True)


def open_doors():
    """
    The swung-open door of each section, cut from its fully open frame (everything right of the body), with
    the haunted light cut to match. Shown beside the shelves of an open compartment on wide screens.
    """
    rows = {'freezer': (0, 30), 'fridge': (30, H - 1), 'pantry': (0, H - 1)}
    for zone, (y0, y1) in rows.items():
        im = native(f'{KITCHEN}/{zone}-4.png')
        lit = native(f'{KITCHEN}/light-{zone}-5.png')
        box = im.crop((BODY_W, y0, W, y1 + 1)).getbbox()
        if not box:
            continue
        x0, by0, x1, by1 = box
        crop = (BODY_W + x0, y0 + by0, BODY_W + x1, y0 + by1)
        up(im.crop(crop), 4).save(f'{KITCHEN}/door-{zone}.png', optimize=True)
        up(lit.crop(crop), 4).save(f'{KITCHEN}/door-light-{zone}.png', optimize=True)
        print(zone, 'door', crop[2] - crop[0], 'x', crop[3] - crop[1])


def main():
    os.makedirs(PIXEL, exist_ok=True)
    notification_icon()
    drips_and_eyes()
    art()
    both_ajar()
    # Gaps of the ajar frames, in native sprite pixels (x0, y0, x1, y1), found by diffing frame 1 with 0.
    # The cracks of the ajar frames (scripts/spookify-sprites.py, AJAR), in sprite pixels (x0, y0, x1, y1).
    light('freezer', (5, 3, 8, 28))
    light('fridge', (5, 32, 8, 72))
    light('pantry', (19, 2, 22, 73))
    for zone in ('freezer', 'fridge', 'pantry'):
        light_open(zone)
        # Replaced by light-<zone>-1.png.
        old = f'{KITCHEN}/light-{zone}.png'
        if os.path.exists(old):
            os.remove(old)
    wall_tiles()
    cobweb(12, 'cobweb-small', (5, 9))
    cobweb(18, 'cobweb-large', (4, 8, 12, 16))
    embers()
    # After the lights: the door cut-outs take their light from light-<zone>-5.png.
    open_doors()


if __name__ == '__main__':
    main()
