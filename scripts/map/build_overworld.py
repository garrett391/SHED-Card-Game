"""
Build the campaign overworld: an 8-bit, Super Mario World-style map.

    python3 scripts/map/build_overworld.py

Writes:
    assets/map/overworld.png  the painted map (pixel art, pre-scaled by SCALE)
    assets/map/heroes.png     the three disciples as one small sprite
    src/campaign/overworld.json  map size + each node's position, keyed by
                                 preset id, read by app/campaign.tsx

The map climbs from the bottom (the first node) to the top. Each node owns a
horizontal band of land painted in its own theme; above the last band sits
a fog bank, and above that, Chris's tower in the clouds (scenery, not a
node).

To add a node: write a painter for it below, add it to REGIONS in ladder
order (the order must match PRESET_ORDER in src/campaign/presets.ts; a test
checks this), then re-run this script.

Requires Pillow (pip install pillow).
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]

W = 96            # map width in art pixels
BAND = 64         # height of one node's region, in art pixels
TOP = 84          # fog bank + Chris's tower above the last region
BOTTOM = 10       # sea/shore margin below the first region
SCALE = 8         # output upscale (nearest neighbour keeps it crisp)

# ─── Palette (SNES-ish) ──────────────────────────────────────────────────────
C = {
    'sea': (56, 128, 232), 'sea_lt': (120, 184, 248), 'sea_dk': (32, 88, 192),
    'grass': (104, 200, 72), 'grass_lt': (152, 224, 104), 'grass_dk': (56, 152, 56),
    'tree': (32, 120, 56), 'tree_lt': (64, 168, 72), 'tree_dk': (16, 80, 40),
    'trunk': (120, 72, 32),
    'cliff': (176, 112, 56), 'cliff_dk': (120, 72, 32),
    'path': (248, 216, 136), 'path_dk': (208, 160, 88),
    'stone': (168, 168, 176), 'stone_lt': (208, 208, 216), 'stone_dk': (104, 104, 120),
    'roof': (200, 64, 48), 'roof_dk': (144, 40, 32), 'wall': (240, 224, 192),
    'wood': (160, 104, 48), 'wood_dk': (112, 64, 24),
    'window': (248, 232, 96), 'black': (24, 24, 32), 'white': (248, 248, 248),
    'purple': (128, 64, 176), 'purple_dk': (80, 40, 120), 'purple_lt': (176, 120, 224),
    'gold': (248, 200, 48),
    'ash': (88, 80, 80), 'ash_dk': (56, 48, 56), 'lava': (248, 104, 32), 'lava_lt': (248, 184, 56),
    'screen': (72, 232, 120),
    'jgreen': (64, 176, 80), 'jpurple': (144, 72, 192), 'jred': (216, 48, 48), 'jblue': (48, 96, 216),
    'fog': (200, 208, 224), 'fog_lt': (232, 236, 244), 'sky': (120, 136, 176),
    'night': (40, 40, 72),
    'skin': (240, 192, 144), 'hair': (72, 48, 32),
}


class Canvas:
    def __init__(self, w: int, h: int):
        self.w, self.h = w, h
        self.img = Image.new('RGB', (w, h), C['sea'])
        self.px = self.img.load()

    def set(self, x: int, y: int, col) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = C[col] if isinstance(col, str) else col

    def get(self, x: int, y: int):
        return self.px[x, y]

    def rect(self, x: int, y: int, w: int, h: int, col) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, col)

    def disc(self, cx: float, cy: float, r: float, col) -> None:
        for yy in range(int(cy - r - 1), int(cy + r + 2)):
            for xx in range(int(cx - r - 1), int(cx + r + 2)):
                if (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r:
                    self.set(xx, yy, col)

    def sprite(self, x: int, y: int, rows: list[str], key: dict) -> None:
        """Stamp an ASCII sprite; '.' is transparent."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.':
                    self.set(x + i, y + j, key[ch])


# ─── Sprites ─────────────────────────────────────────────────────────────────
TREE = ['.ggg.', 'gGggg', 'ggggd', 'gggdd', '.ddd.', '..t..']
TREE_KEY = {'g': 'tree', 'G': 'tree_lt', 'd': 'tree_dk', 't': 'trunk'}

BUSH = ['.gg.', 'gGgd', '.dd.']
BUSH_KEY = TREE_KEY

HOUSE = [
    '...rr...',
    '..rrrr..',
    '.rrrrrr.',
    'RRRRRRRR',
    '.wwwwww.',
    '.wyww#w.',
    '.wyww#w.',
]
HOUSE_KEY = {'r': 'roof', 'R': 'roof_dk', 'w': 'wall', 'y': 'window', '#': 'wood_dk'}

ROCK = ['.ss.', 'sSsd', 'sddd']
ROCK_KEY = {'s': 'stone', 'S': 'stone_lt', 'd': 'stone_dk'}


def scatter(cv: Canvas, rng: random.Random, y0: int, y1: int, n: int, stamp, keep_clear) -> None:
    """Drop n decorations in rows y0..y1, skipping anything keep_clear rejects."""
    tries = 0
    while n > 0 and tries < n * 40:
        tries += 1
        x, y = rng.randrange(6, W - 10), rng.randrange(y0, y1)
        if keep_clear(x, y):
            continue
        stamp(x, y)
        n -= 1


# ─── Region painters ─────────────────────────────────────────────────────────
# Each paints the band [y0, y0+BAND) and returns the node position (x, y) in
# art pixels. `side` is 'left' or 'right': where the node sits in the band.

def paint_jake(cv: Canvas, y0: int, side: str, rng: random.Random, clear) -> tuple[int, int]:
    """The old wood where Jake taught: a deep forest round a firelit clearing."""
    nx = 30 if side == 'left' else 66
    ny = y0 + BAND // 2
    for _ in range(70):
        x, y = rng.randrange(4, W - 8), rng.randrange(y0 + 2, y0 + BAND - 6)
        if (x + 2 - nx) ** 2 + (y + 3 - ny) ** 2 < 15 ** 2 or clear(x, y):
            continue
        cv.sprite(x, y, TREE, TREE_KEY)
    # clearing: a stump table and a campfire
    cv.sprite(nx + 9, ny + 4, ['.ww.', 'wWWw', '.ww.'], {'w': 'wood', 'W': 'wood_dk'})
    cv.sprite(nx - 13, ny + 5, ['.l.', 'lLl', 'www'], {'l': 'lava', 'L': 'lava_lt', 'w': 'wood_dk'})
    return nx, ny


def paint_spreading(cv: Canvas, y0: int, side: str, rng: random.Random, clear) -> tuple[int, int]:
    """The town that had never known the game: cottages along the road, a pond."""
    nx = 30 if side == 'left' else 66
    ny = y0 + BAND // 2
    far = 64 if side == 'left' else 8
    for (hx, hy) in [(far, y0 + 6), (far + 12, y0 + 14), (far + 2, y0 + 26), (far + 14, y0 + 36),
                     (nx - 4 + (14 if side == 'left' else -18), y0 + 4)]:
        if not clear(hx + 3, hy + 3):
            cv.sprite(hx, hy, HOUSE, HOUSE_KEY)
    # pond
    px = 12 if side == 'left' else 72
    py = y0 + BAND - 14
    cv.disc(px + 6, py + 3, 6, 'sea')
    cv.disc(px + 5, py + 2, 2, 'sea_lt')
    # wheat field
    for yy in range(y0 + 46, y0 + 56):
        for xx in range(far, far + 20):
            if (xx + yy) % 3 == 0 and not clear(xx, yy):
                cv.set(xx, yy, 'gold')
    scatter(cv, rng, y0 + 2, y0 + BAND - 4, 10, lambda x, y: cv.sprite(x, y, BUSH, BUSH_KEY), clear)
    return nx, ny


def paint_justin(cv: Canvas, y0: int, side: str, rng: random.Random, clear) -> tuple[int, int]:
    """Justin's chapel on a raised plateau, the first heretic's seat."""
    nx = 30 if side == 'left' else 66
    ny = y0 + BAND // 2
    hx = 72 if side == 'left' else 24          # plateau centre
    hy = y0 + 26
    # plateau: light top, cliff face below (SMW-style raised ground)
    for yy in range(hy - 15, hy + 18):
        for xx in range(hx - 20, hx + 21):
            top = (xx - hx) ** 2 / 400 + (yy - hy) ** 2 / 196 <= 1
            face = (xx - hx) ** 2 / 400 + (yy - hy - 4) ** 2 / 196 <= 1
            if top:
                cv.set(xx, yy, 'grass_lt' if (xx + yy) % 7 else 'grass')
            elif face:
                cv.set(xx, yy, 'cliff' if (xx % 4) else 'cliff_dk')
    chapel = [
        '........g........',
        '.......ggg.......',
        '........g........',
        '.......PPP.......',
        '.......PyP.......',
        '.......PPP.......',
        '......ppppp......',
        '......pwwwp......',
        '.....PPPPPPP.....',
        '....ppppppppp....',
        '...ppppppppppp...',
        '..PPPPPPPPPPPPP..',
        '.wwwwwwwwwwwwwww.',
        '.wyywwwwwwwwyyww.',
        '.wyywwwy#ywwyyww.',
        '.wwwwwww#wwwwwww.',
        '.wwwwwww#wwwwwww.',
        '.sssssss#sssssss.',
    ]
    cv.sprite(hx - 8, hy - 16, chapel, {'p': 'purple', 'P': 'purple_dk', 'w': 'stone_lt', 'y': 'window',
                                        '#': 'black', 'g': 'gold', 's': 'stone_dk'})
    # steps down the cliff face
    for i in range(6):
        cv.rect(hx - 2, hy + 2 + i * 2, 5, 1, 'stone_lt')
        cv.rect(hx - 2, hy + 3 + i * 2, 5, 1, 'stone_dk')
    # graveyard on the plateau
    for gx, gy in [(hx - 16, hy - 2), (hx - 12, hy + 2), (hx + 11, hy - 1), (hx + 15, hy + 3)]:
        cv.sprite(gx, gy, ['.s.', 'sss', '.s.', '.d.'], {'s': 'stone_lt', 'd': 'stone_dk'})
    off_hill = lambda x, y: clear(x, y) or (x + 2 - hx) ** 2 / 500 + (y + 3 - hy) ** 2 / 400 < 1
    scatter(cv, rng, y0 + 2, y0 + BAND - 6, 10, lambda x, y: cv.sprite(x, y, TREE, TREE_KEY), off_hill)
    return nx, ny


def paint_greg(cv: Canvas, y0: int, side: str, rng: random.Random, clear) -> tuple[int, int]:
    """Greg's keep in the ashlands: a machine fortress on a lava field."""
    nx = 30 if side == 'left' else 66
    ny = y0 + BAND // 2
    # scorched ground: an irregular blob of ash centred on the keep's side
    fx = 60 if side == 'left' else 13
    acx, acy = fx + 11, y0 + 30
    for yy in range(y0 - 6, y0 + BAND + 6):
        for xx in range(0, W):
            ang = math.atan2(yy - acy, xx - acx)
            r = 30 + 4 * math.sin(ang * 3 + 1) + 3 * math.sin(ang * 7)
            if (xx - acx) ** 2 + ((yy - acy) * 1.1) ** 2 > r * r:
                continue
            if cv.get(xx, yy) in (C['grass'], C['grass_lt'], C['grass_dk']):
                cv.set(xx, yy, 'ash_dk' if (xx * 7 + yy * 3) % 13 == 0 else 'ash')
            elif cv.get(xx, yy) == C['cliff']:
                cv.set(xx, yy, 'black')
    # lava pools
    for lx, ly, r in [(fx + 5, y0 + 44, 4), (fx + 19, y0 + 47, 3), (fx + 2, y0 + 10, 3)]:
        if not clear(lx, ly):
            cv.disc(lx, ly, r, 'lava')
            cv.disc(lx - 1, ly - 1, r / 2, 'lava_lt')
    keep = [
        's.s.s.............s.s.s',
        'sssss.............sssss',
        'sSgSs.............sSgSs',
        'sssss.s.s.s.s.s.s.sssss',
        'sSssSsssssssssssssSssSs',
        'ssssssSSSSSSSSSSSssssss',
        'sSssSsSgggggggggSsSssSs',
        'ssssssSgGgggGgggSssssss',
        'sSssSsSgggggggggSsSssSs',
        'ssssssSSSSSSSSSSSssssss',
        'sSssSssssssssssssSsSssS',
        'sssssssssbbbbbsssssssss',
        'sSssSsssbbbbbbbsSssSssS',
        'ssssssssbbbbbbbssssssss',
        'ddddddddddddddddddddddd',
    ]
    cv.sprite(fx, y0 + 18, keep, {'s': 'stone', 'S': 'stone_dk', 'g': 'screen', 'G': 'white', 'b': 'black', 'd': 'stone_dk'})
    # smoke stacks venting over the keep
    for sx in (fx + 7, fx + 14):
        cv.rect(sx, y0 + 12, 2, 6, 'stone_dk')
        cv.disc(sx + 1, y0 + 9, 2, 'ash')
        cv.disc(sx + 2, y0 + 6, 1.5, 'stone')
    scatter(cv, rng, y0 + 2, y0 + BAND - 4, 12, lambda x, y: cv.sprite(x, y, ROCK, ROCK_KEY), clear)
    return nx, ny


def paint_chaos(cv: Canvas, y0: int, side: str, rng: random.Random, clear) -> tuple[int, int]:
    """Gio and Tati's carnival: a striped big top, balloons and a checker plaza."""
    nx = 30 if side == 'left' else 66
    ny = y0 + BAND // 2
    tx = 60 if side == 'left' else 6
    # checker plaza in front of the big top
    pcx, pcy = tx + 10, y0 + 30
    for yy in range(pcy - 9, pcy + 10):
        for xx in range(pcx - 16, pcx + 17):
            if (xx - pcx) ** 2 / 256 + (yy - pcy) ** 2 / 81 <= 1:
                cv.set(xx, yy, 'jpurple' if ((xx // 2) + (yy // 2)) % 2 else 'jgreen')
    tent = [
        '..........y..........',
        '.........rrr.........',
        '........rrbbr........',
        '.......rrbbrrb.......',
        '......rrbbrrbbr......',
        '.....rrbbrrbbrrb.....',
        '....rrbbrrbbrrbbr....',
        '...rrbbrrbbrrbbrrb...',
        '..rrbbrrbbrrbbrrbbr..',
        '.ggggggggggggggggggg.',
        '.rrbbrrbb###bbrrbbrr.',
        '.rrbbrrbb###bbrrbbrr.',
        '.rrbbrrbb###bbrrbbrr.',
        '.rrbbrrbb###bbrrbbrr.',
    ]
    cv.sprite(tx, y0 + 12, tent, {'r': 'jred', 'b': 'jblue', 'g': 'gold', 'y': 'gold', '#': 'black'})
    # balloons on strings
    for bx, by, col in [(tx - 3, y0 + 8, 'jgreen'), (tx + 21, y0 + 6, 'jpurple'),
                        (tx + 1, y0 + 42, 'jred'), (tx + 16, y0 + 44, 'gold')]:
        if not clear(bx, by):
            cv.sprite(bx, by, ['.cc.', 'cCcc', 'cccc', '.cc.', '..w.', '.w..', '..w.'],
                      {'c': col, 'C': 'white', 'w': 'white'})
    # jack-in-the-box
    jb = 12 if side == 'right' else 78
    cv.sprite(jb, y0 + 50, ['.p.', 'pPp', 'g.g', 'ggg', 'GGG'],
              {'p': 'jpurple', 'P': 'jgreen', 'g': 'gold', 'G': 'wood_dk'})
    off_plaza = lambda x, y: clear(x, y) or (x + 2 - pcx) ** 2 / 400 + (y + 1 - pcy) ** 2 / 225 < 1
    scatter(cv, rng, y0 + 2, y0 + BAND - 4, 8, lambda x, y: cv.sprite(x, y, BUSH, BUSH_KEY), off_plaza)
    return nx, ny


# Ladder order. Must match PRESET_ORDER (src/campaign/presets.ts).
REGIONS = [
    ('jake-classic', paint_jake),
    ('the-spreading', paint_spreading),
    ('justins-schism', paint_justin),
    ('super-tens', paint_greg),
    ('chaos-shed', paint_chaos),
]


# ─── Terrain: island, shore, cliffs ──────────────────────────────────────────

def paint_land(cv: Canvas, h_land: int, rng: random.Random) -> None:
    """Green land between two wavy coastlines, the sea showing at the edges."""
    for y in range(cv.h):
        wobble_l = int(5 + 3 * math.sin(y / 13) + 1.5 * math.sin(y / 4.1))
        wobble_r = int(5 + 3 * math.sin(y / 17 + 2) + 1.5 * math.sin(y / 4.7))
        for x in range(cv.w):
            if y < TOP - 4 or y >= cv.h - BOTTOM:
                continue
            if wobble_l <= x < cv.w - wobble_r:
                g = 'grass'
                n = (x * 13 + y * 7) % 17
                if n == 0:
                    g = 'grass_lt'
                elif n == 5:
                    g = 'grass_dk'
                cv.set(x, y, g)
            elif x == wobble_l - 1 or x == cv.w - wobble_r:
                cv.set(x, y, 'cliff')
    # bottom shore cliff
    for x in range(cv.w):
        for d in range(2):
            y = cv.h - BOTTOM + d
            if cv.get(x, y - 2) != C['sea']:
                cv.set(x, y, 'cliff' if d == 0 else 'cliff_dk')
    # waves
    for _ in range(cv.w * cv.h // 120):
        x, y = rng.randrange(cv.w), rng.randrange(cv.h)
        if cv.get(x, y) == C['sea'] and x + 2 < cv.w and cv.get(x + 2, y) == C['sea']:
            cv.set(x, y, 'sea_lt')
            cv.set(x + 1, y, 'sea_lt')


def paint_sky(cv: Canvas, rng: random.Random) -> None:
    """Fog bank over the unexplored north, Chris's tower rising out of it."""
    for y in range(TOP):
        for x in range(cv.w):
            cv.set(x, y, 'sky')
    # tower (scenery, not a node): dark spire with one lit window
    tower = [
        '.....b.....',
        '....bbb....',
        '....bwb....',
        '...bbbbb...',
        '...bbybb...',
        '...bbbbb...',
        '..bbbbbbb..',
        '..bbbybbb..',
        '..bbbbbbb..',
        '..bbbbbbb..',
        '.bbbbbbbbb.',
        '.bbbbybbbb.',
        '.bbbbbbbbb.',
        '.bbbbbbbbb.',
        'bbbbbbbbbbb',
        'bbbbbbbbbbb',
        'bbbbbbbbbbb',
        'bbbbbbbbbbb',
    ]
    cv.sprite(W // 2 - 5, 14, tower, {'b': 'night', 'w': 'white', 'y': 'window'})
    # quill on the spire
    cv.sprite(W // 2 - 1, 8, ['..w', '.w.', 'w..', 'g..', 'g..', 'g..'], {'w': 'white', 'g': 'gold'})
    # rolling fog: layered blobs, densest at the bottom where the land begins
    for _ in range(140):
        y = int(TOP - 1 - abs(rng.gauss(0, 18)))
        x = rng.randrange(-6, cv.w + 6)
        r = rng.uniform(3, 7)
        if y < 30 and abs(x - W // 2) < 9:
            continue  # keep the tower visible
        cv.disc(x, y, r, 'fog')
        cv.disc(x - 1, y - 1, r * 0.55, 'fog_lt')
    for x in range(cv.w):  # solid fog skirt over the coastline
        for y in range(TOP - 8, TOP):
            if rng.random() < 0.85:
                cv.set(x, y, 'fog')


# ─── Path ────────────────────────────────────────────────────────────────────

def road_points(nodes: list[tuple[int, int]]) -> list[tuple[float, float]]:
    """A winding road through every node, bottom to top, then off into the fog."""
    pts: list[tuple[float, float]] = []
    chain = [(nodes[0][0], nodes[0][1] + 14)] + nodes + [(W // 2, TOP - 10)]
    for (x0, y0), (x1, y1) in zip(chain, chain[1:]):
        steps = int(abs(y1 - y0) + abs(x1 - x0)) * 2
        for i in range(steps):
            t = i / steps
            # ease in/out horizontally so the road leaves each node going up
            e = t * t * (3 - 2 * t)
            pts.append((x0 + (x1 - x0) * e, y0 + (y1 - y0) * t))
    return pts


def paint_road(cv: Canvas, pts: list[tuple[float, float]]) -> None:
    for x, y in pts:
        cv.disc(x, y, 3.2, 'path_dk')
    for x, y in pts:
        cv.disc(x, y, 2.2, 'path')


def near_road(pts, nodes):
    road = {(int(x), int(y)) for x, y in pts}

    def clear(x: int, y: int) -> bool:
        for dx in range(-6, 9):
            for dy in range(-6, 9):
                if (x + dx, y + dy) in road:
                    return True
        return any((x - nx) ** 2 + (y - ny) ** 2 < 11 ** 2 for nx, ny in nodes)
    return clear


def node_pad(cv: Canvas, x: int, y: int) -> None:
    """A flat stone landing under each node marker."""
    cv.disc(x, y + 1, 7.5, 'path_dk')
    cv.disc(x, y, 7, 'stone_dk')
    cv.disc(x, y, 6, 'stone')
    cv.disc(x - 1, y - 1, 3, 'stone_lt')


# ─── Heroes sprite ───────────────────────────────────────────────────────────

def build_heroes() -> Image.Image:
    """Erich (beard), Garrett (clean-shaven), Nick (glasses), side by side."""
    hero = [
        '.hhhh.',
        'hhhhhh',
        'hssssh',
        '.sEsE.',
        '.ssss.',
        '.BBBB.',
        'cccccc',
        'sccccs',
        '.cccc.',
        '.p..p.',
        '.p..p.',
    ]
    looks = [
        ({'E': 'black', 'B': 'hair', 'c': 'jblue'}, None),          # Erich: beard
        ({'E': 'black', 'B': 'skin', 'c': 'jred'}, None),           # Garrett
        ({'E': 'black', 'B': 'skin', 'c': 'jgreen'}, 'glasses'),    # Nick
    ]
    cv = Canvas(6 * 3 + 4, 13)
    cv.img.paste((0, 0, 0), (0, 0, cv.w, cv.h))
    img = Image.new('RGBA', (cv.w, cv.h), (0, 0, 0, 0))
    px = img.load()
    for n, (over, extra) in enumerate(looks):
        key = {'h': 'hair', 's': 'skin', 'p': 'black', **over}
        ox, oy = n * 8, 1
        for j, row in enumerate(hero):
            for i, ch in enumerate(row):
                if ch != '.':
                    px[ox + i, oy + j] = C[key[ch]] + (255,)
        if extra == 'glasses':
            for i in range(0, 6):
                px[ox + i, oy + 3] = C['black'] + (255,)
    return img.resize((img.width * SCALE, img.height * SCALE), Image.NEAREST)


# ─── Build ───────────────────────────────────────────────────────────────────

def build() -> None:
    rng = random.Random(1987)  # fixed seed: same map every run
    h = TOP + BAND * len(REGIONS) + BOTTOM
    cv = Canvas(W, h)
    paint_land(cv, h, rng)

    # Node positions first (bottom-up, zigzag), so decorations avoid the road.
    nodes: list[tuple[int, int]] = []
    for i, _ in enumerate(REGIONS):
        y0 = h - BOTTOM - BAND * (i + 1)
        side = 'left' if i % 2 == 0 else 'right'
        nodes.append((30 if side == 'left' else 66, y0 + BAND // 2))
    pts = road_points(nodes)
    clear = near_road(pts, nodes)

    placed: dict[str, dict] = {}
    for i, (pid, painter) in enumerate(REGIONS):
        y0 = h - BOTTOM - BAND * (i + 1)
        side = 'left' if i % 2 == 0 else 'right'
        x, y = painter(cv, y0, side, rng, clear)
        placed[pid] = {'x': x * SCALE, 'y': y * SCALE, 'side': side}

    paint_sky(cv, rng)
    paint_road(cv, pts)
    for x, y in nodes:
        node_pad(cv, x, y)

    out_dir = ROOT / 'assets' / 'map'
    out_dir.mkdir(parents=True, exist_ok=True)
    cv.img.resize((W * SCALE, h * SCALE), Image.NEAREST).save(out_dir / 'overworld.png', optimize=True)
    build_heroes().save(out_dir / 'heroes.png', optimize=True)

    meta = {
        '//': 'Generated by scripts/map/build_overworld.py. Do not edit by hand.',
        'width': W * SCALE,
        'height': h * SCALE,
        'order': [pid for pid, _ in REGIONS],
        'nodes': placed,
    }
    (ROOT / 'src' / 'campaign' / 'overworld.json').write_text(json.dumps(meta, indent=2) + '\n')
    print(f'overworld {W * SCALE}x{h * SCALE}, {len(REGIONS)} nodes')


if __name__ == '__main__':
    build()
