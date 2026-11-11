"""
Build the campaign overworld: a 16-bit fairytale land you pan across.

    python3 scripts/map/build_overworld.py

Writes:
    assets/map/overworld.png     the painted map (pixel art, pre-scaled by SCALE)
    assets/map/heroes.png        the three disciples as one small sprite
    assets/story/ending-*.png    two crops of the tower on its peak, used by
                                 the campaign's ending cutscene
    src/campaign/overworld.json  map size, hero sprite size and each node's
                                 position, keyed by preset id; read by
                                 app/campaign.tsx

One continuous country with no sea around it: Jake's deep wood in the
south-west, farmland and a river, a chapel hill, a volcano with Greg's keep
and its machinery, a red-rock canyon, a desert plain, a lake, a dead marsh,
the Council's plateau, and a wall of mountains with Chris's tower on the
tallest peak (scenery, not a node). The road wanders: east along the south,
north to the volcano, back west through the canyon, round the lake both
ways, through the marsh and up to the plateau.

Style: 16-bit. Every material has a shade ramp (dark → light) and shapes are
lit from the upper left, outlined, and cast a soft shadow down-right.

How it's put together: each table has a region painter that draws its
landmark in a 192x128 tile; a View sets that tile down wherever NODES and
TILES say. The land around them (ground, water, canyon, mountains, road,
filler) is painted in "The land" below.

To add a node: write a painter for it, add it to REGIONS in ladder order
(the order must match PRESET_ORDER in src/campaign/presets.ts; a test
checks this), give it a place in NODES, TILES, RESERVED and SCATTER_ON, add
it to ROAD, then re-run this script. Output is deterministic (fixed seed).

Requires Pillow (pip install pillow).
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path
from typing import Callable

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]

W = 192           # width of one region painter's tile, in art pixels
BAND = 128        # and its height
SCALE = 4         # output upscale (nearest neighbour keeps it crisp)
NODE_X = {'left': 60, 'right': 132}

# ─── Palette: shade ramps, darkest first ─────────────────────────────────────
R = {
    'grass': [(30, 92, 46), (46, 124, 54), (72, 160, 62), (112, 194, 78), (164, 222, 110)],
    'leaf': [(14, 50, 38), (24, 82, 46), (40, 118, 54), (70, 156, 62), (122, 194, 86)],
    'pine': [(10, 44, 40), (18, 70, 50), (30, 102, 62), (58, 138, 74)],
    'water': [(22, 58, 142), (36, 88, 192), (58, 128, 228), (104, 176, 246), (196, 230, 255)],
    'sand': [(118, 82, 46), (172, 124, 70), (214, 172, 108), (238, 206, 142), (252, 234, 182)],
    'rock': [(44, 40, 54), (80, 76, 92), (120, 116, 132), (164, 160, 174), (210, 208, 220)],
    'cliff': [(64, 38, 26), (104, 66, 38), (146, 98, 54), (184, 136, 80), (214, 172, 112)],
    'roof': [(92, 26, 24), (142, 40, 34), (192, 66, 48), (226, 112, 82)],
    'roof_b': [(30, 50, 96), (44, 76, 140), (68, 108, 184), (110, 150, 216)],
    'wall': [(140, 116, 94), (190, 166, 134), (228, 212, 180), (248, 240, 218)],
    'wood': [(58, 36, 22), (98, 60, 30), (140, 92, 46), (182, 130, 70)],
    'purple': [(44, 22, 66), (76, 38, 114), (114, 62, 162), (162, 108, 204), (206, 166, 234)],
    'ash': [(34, 30, 38), (52, 46, 54), (72, 66, 74), (96, 90, 98)],
    'lava': [(128, 22, 16), (204, 60, 22), (246, 124, 30), (252, 196, 70), (255, 244, 180)],
    'jred': [(110, 20, 30), (176, 36, 46), (224, 70, 70), (246, 126, 116)],
    'jblue': [(22, 36, 104), (38, 66, 176), (76, 114, 228), (130, 166, 246)],
    'jgreen': [(22, 90, 46), (44, 142, 70), (92, 192, 100), (150, 226, 140)],
    'jpurple': [(60, 30, 98), (106, 52, 162), (154, 100, 212), (198, 156, 240)],
    'gold': [(132, 84, 14), (196, 144, 30), (246, 198, 54), (255, 234, 140)],
    'fog': [(112, 120, 156), (152, 160, 190), (194, 200, 222), (230, 234, 246)],
    'night': [(14, 12, 26), (28, 26, 48), (44, 42, 72), (66, 64, 100)],
    'screen': [(16, 72, 40), (40, 160, 80), (96, 236, 132), (196, 255, 210)],
    'glass': [(150, 40, 60), (60, 90, 200), (240, 200, 60), (80, 170, 90)],
}
INK = (18, 16, 26)          # outline
WHITE = (250, 250, 250)
SKIN = [(176, 116, 82), (226, 168, 124), (246, 202, 162)]
HAIR = [(40, 26, 18), (74, 48, 30), (110, 74, 44)]

LIGHT = (-0.55, -0.6, 0.58)   # from the upper left, toward the viewer


def mix(a, b, t: float):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def shade(ramp, v: float):
    """Pick a ramp colour for brightness v in 0..1."""
    v = max(0.0, min(0.999, v))
    return ramp[int(v * len(ramp))]


# ─── Value noise (deterministic texture) ─────────────────────────────────────

def _hash(x: int, y: int, seed: int) -> float:
    h = (x * 374761393 + y * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return (h ^ (h >> 16)) / 0xFFFFFFFF


def noise(x: float, y: float, cell: float, seed: int = 0) -> float:
    gx, gy = x / cell, y / cell
    x0, y0 = int(math.floor(gx)), int(math.floor(gy))
    fx, fy = gx - x0, gy - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = _hash(x0, y0, seed) + (_hash(x0 + 1, y0, seed) - _hash(x0, y0, seed)) * fx
    b = _hash(x0, y0 + 1, seed) + (_hash(x0 + 1, y0 + 1, seed) - _hash(x0, y0 + 1, seed)) * fx
    return a + (b - a) * fy


# ─── Canvas and shape helpers ────────────────────────────────────────────────

class Canvas:
    def __init__(self, w: int, h: int):
        self.w, self.h = w, h
        self.img = Image.new('RGB', (w, h), R['water'][1])
        self.px = self.img.load()

    def ok(self, x: int, y: int) -> bool:
        return 0 <= x < self.w and 0 <= y < self.h

    def set(self, x: int, y: int, col) -> None:
        if self.ok(x, y):
            self.px[x, y] = col

    def get(self, x: int, y: int):
        return self.px[x, y] if self.ok(x, y) else (0, 0, 0)

    def rect(self, x: int, y: int, w: int, h: int, col) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, col)

    def disc(self, cx: float, cy: float, r: float, col) -> None:
        for yy in range(int(cy - r - 1), int(cy + r + 2)):
            for xx in range(int(cx - r - 1), int(cx + r + 2)):
                if (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r:
                    self.set(xx, yy, col)

    def darken(self, x: int, y: int, f: float) -> None:
        if self.ok(x, y):
            c = self.px[x, y]
            self.px[x, y] = (int(c[0] * f), int(c[1] * f), int(c[2] * f * 1.05))

    def tint(self, x: int, y: int, col, t: float) -> None:
        if self.ok(x, y):
            self.px[x, y] = mix(self.px[x, y], col, t)

    def shadow(self, cx: float, cy: float, rx: float, ry: float, f: float = 0.7) -> None:
        """Soft drop shadow: an ellipse that darkens what's under it."""
        for yy in range(int(cy - ry - 1), int(cy + ry + 2)):
            for xx in range(int(cx - rx - 1), int(cx + rx + 2)):
                if ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1:
                    self.darken(xx, yy, f)

    def glow(self, cx: float, cy: float, r: float, col, strength: float = 0.45) -> None:
        for yy in range(int(cy - r), int(cy + r + 1)):
            for xx in range(int(cx - r), int(cx + r + 1)):
                d = math.hypot(xx - cx, yy - cy) / r
                if d < 1:
                    self.tint(xx, yy, col, strength * (1 - d) ** 1.5)

    def blob(self, circles: list[tuple[float, float, float]], ramp, outline=INK,
             highlight: bool = True) -> None:
        """Union of spheres, each lit from the upper left, with an outline."""
        if not circles:
            return
        x0 = int(min(c[0] - c[2] for c in circles)) - 2
        x1 = int(max(c[0] + c[2] for c in circles)) + 2
        y0 = int(min(c[1] - c[2] for c in circles)) - 2
        y1 = int(max(c[1] + c[2] for c in circles)) + 2

        def inside(x, y):
            return any((x - cx) ** 2 + (y - cy) ** 2 <= r * r for cx, cy, r in circles)

        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if not inside(x, y):
                    continue
                if outline and not (inside(x - 1, y) and inside(x + 1, y)
                                    and inside(x, y - 1) and inside(x, y + 1)):
                    self.set(x, y, outline)
                    continue
                # light from the circle this pixel sits nearest the top of
                best = -9.0
                for cx, cy, r in circles:
                    d2 = (x - cx) ** 2 + (y - cy) ** 2
                    if d2 <= r * r:
                        nx, ny = (x - cx) / r, (y - cy) / r
                        nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
                        lit = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
                        best = max(best, lit)
                v = 0.5 + best * 0.55
                # ordered dither between ramp steps for a 16-bit finish
                v += ((x * 3 + y * 5) % 4 - 1.5) * 0.03
                self.set(x, y, shade(ramp, v if highlight else min(v, 0.75)))

    def box(self, x: int, y: int, w: int, h: int, ramp, outline=INK) -> None:
        """A wall: lit left edge, shaded right edge, outline."""
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                t = (xx - x) / max(1, w - 1)
                col = ramp[-1] if t < 0.15 else ramp[-2] if t < 0.7 else ramp[-3]
                self.set(xx, yy, col)
        self.outline_rect(x, y, w, h)
        _ = outline

    def outline_rect(self, x: int, y: int, w: int, h: int) -> None:
        for xx in range(x, x + w):
            self.set(xx, y, INK)
            self.set(xx, y + h - 1, INK)
        for yy in range(y, y + h):
            self.set(x, yy, INK)
            self.set(x + w - 1, yy, INK)

    def sprite(self, x: int, y: int, rows: list[str], key: dict) -> None:
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.':
                    self.set(x + i, y + j, key[ch])


# ─── Props ───────────────────────────────────────────────────────────────────

def tree(cv: Canvas, x: int, y: int, s: float = 1.0) -> None:
    """Round broadleaf tree; (x, y) is the base of the trunk."""
    cv.shadow(x + 3, y + 1, 7 * s, 2.5 * s, 0.62)
    cv.rect(x - 1, y - int(5 * s), 3, int(5 * s) + 1, R['wood'][1])
    cv.rect(x - 1, y - int(5 * s), 1, int(5 * s) + 1, R['wood'][2])
    r = 5.2 * s
    cv.blob([(x - 3 * s, y - 8 * s, r), (x + 3 * s, y - 8 * s, r), (x, y - 12 * s, r * 1.05)],
            R['leaf'], outline=R['leaf'][0])


def pine(cv: Canvas, x: int, y: int, s: float = 1.0) -> None:
    """Layered conifer; (x, y) is the base of the trunk."""
    cv.shadow(x + 3, y + 1, 5 * s, 2 * s, 0.62)
    cv.rect(x - 1, y - 3, 3, 4, R['wood'][1])
    h = int(18 * s)
    for j in range(h):
        yy = y - 3 - j
        half = (h - j) * 0.42 + ((j % 6) < 2) * 1.2
        for xx in range(int(x - half), int(x + half) + 1):
            edge = xx in (int(x - half), int(x + half)) or (j % 6 == 0)
            t = (xx - (x - half)) / max(1, 2 * half)
            col = R['pine'][0] if edge else R['pine'][3] if t < 0.3 else R['pine'][2] if t < 0.6 else R['pine'][1]
            cv.set(xx, yy, col)
    cv.set(x, y - 3 - h, R['pine'][0])


def bush(cv: Canvas, x: int, y: int) -> None:
    cv.shadow(x + 2, y + 1, 4, 1.5, 0.65)
    cv.blob([(x - 2, y - 2, 2.6), (x + 2, y - 2, 2.6), (x, y - 4, 2.8)], R['leaf'], outline=R['leaf'][0])


def boulder(cv: Canvas, x: int, y: int, r: float = 3) -> None:
    cv.shadow(x + 2, y + 1, r + 1, 1.6, 0.65)
    cv.blob([(x, y - r * 0.6, r), (x + r * 0.7, y - r * 0.3, r * 0.7)], R['rock'])


def flower(cv: Canvas, x: int, y: int, col) -> None:
    cv.set(x, y, col)
    cv.set(x, y + 1, R['grass'][1])


def house(cv: Canvas, x: int, y: int, w: int = 14, roof='roof', chimney: bool = True) -> None:
    """Cottage; (x, y) is the top-left of the wall."""
    h = 9
    cv.shadow(x + w / 2 + 3, y + h, w / 2 + 3, 2.5, 0.65)
    cv.box(x, y, w, h, R['wall'])
    # door + windows
    dx = x + w // 2 - 1
    cv.rect(dx, y + h - 6, 3, 5, R['wood'][1])
    cv.set(dx + 2, y + h - 3, R['gold'][2])
    for wx in (x + 2, x + w - 5):
        cv.rect(wx, y + 2, 3, 3, R['gold'][3])
        cv.set(wx, y + 2, R['gold'][1])
        cv.outline_rect(wx - 1, y + 1, 5, 5)
    # roof: overhanging, tiled rows lit on the left slope
    rh = 7
    for j in range(rh):
        yy = y - rh + j
        inset = rh - 1 - j
        for xx in range(x - 2 + inset, x + w + 2 - inset):
            mid = x + w / 2
            ramp = R[roof]
            col = ramp[3] if xx < mid - 1 else ramp[2] if xx < mid + 1 else ramp[1]
            if j % 2 == 1 and (xx + j) % 3 == 0:
                col = ramp[0]
            if xx in (x - 2 + inset, x + w + 1 - inset) or j == rh - 1:
                col = INK
            cv.set(xx, yy, col)
    if chimney:
        cx = x + w - 4
        cv.rect(cx, y - rh - 2, 3, 5, R['rock'][2])
        cv.outline_rect(cx - 1, y - rh - 3, 5, 6)
        for k, (ox, oy, r) in enumerate([(1, -6, 1.6), (3, -9, 2.0), (2, -13, 2.4)]):
            cv.blob([(cx + 1 + ox, y - rh - 3 + oy, r)], R['fog'], outline=None)


def campfire(cv: Canvas, x: int, y: int) -> None:
    cv.glow(x, y - 2, 14, R['lava'][3], 0.35)
    for i in range(-3, 4):
        cv.set(x + i, y, R['wood'][1])
        cv.set(x + i, y - 1 if abs(i) == 3 else y, R['wood'][2])
    cv.sprite(x - 2, y - 6, ['..a..', '.aba.', 'abcba', '.bcb.', '..b..'],
              {'a': R['lava'][1], 'b': R['lava'][3], 'c': R['lava'][4]})


def gravestone(cv: Canvas, x: int, y: int) -> None:
    cv.shadow(x + 2, y + 1, 3, 1, 0.7)
    cv.sprite(x - 2, y - 6, ['.ooo.', 'oabbo', 'oabbo', 'oabbo', 'oabbo', 'ooooo'],
              {'o': INK, 'a': R['rock'][4], 'b': R['rock'][3]})


# ─── Region painters ─────────────────────────────────────────────────────────
# Each paints its landmark in a tile W wide, from row y0 to y0+BAND, as if
# the road ran up the tile past a node on `side`; the landmark goes on the
# other side. They draw through a View (see "The land"), which sets the tile
# down on the map, so the node they return is not used: NODES places it.
# `clear(x, y)` says whether (x, y) is somewhere they must not decorate.

Clear = Callable[[int, int], bool]


def scatter(rng: random.Random, y0: int, y1: int, n: int, stamp, keep_clear: Clear,
            x0: int = 14, x1: int = W - 14) -> None:
    pts = []
    tries = 0
    while len(pts) < n and tries < n * 60:
        tries += 1
        x, y = rng.randrange(x0, x1), rng.randrange(y0, y1)
        if keep_clear(x, y) or any(abs(x - px) < 7 and abs(y - py) < 6 for px, py in pts):
            continue
        pts.append((x, y))
    for x, y in sorted(pts, key=lambda p: p[1]):   # back to front
        stamp(x, y)


def paint_jake(cv: Canvas, y0: int, side: str, rng: random.Random, clear: Clear) -> tuple[int, int]:
    """The old wood where Jake taught: deep forest around a firelit clearing."""
    nx, ny = NODE_X[side], y0 + BAND // 2
    # clearing: trampled earth, a stump table, the campfire.
    # Props sit beside the node, not below it: the map's label covers the
    # area under every node.
    for yy in range(ny - 20, ny + 14):
        for xx in range(nx - 46, nx + 46):
            if ((xx - nx) / 46) ** 2 + ((yy - ny + 4) / 16) ** 2 <= 1 and noise(xx, yy, 5, 3) > 0.35:
                cv.set(xx, yy, R['sand'][2] if noise(xx, yy, 2, 4) > 0.5 else R['sand'][1])
    sx, sy = nx - 32, ny + 2
    cv.shadow(sx + 3, sy + 3, 8, 3, 0.6)
    cv.disc(sx, sy + 1, 7, INK)
    cv.disc(sx, sy + 1, 6, R['wood'][0])
    cv.disc(sx, sy - 1, 6, INK)
    cv.disc(sx, sy - 1, 5, R['wood'][3])
    cv.disc(sx, sy - 1, 3, R['wood'][2])
    cv.disc(sx, sy - 1, 1, R['wood'][1])
    for r in (4, 2):   # growth rings
        for a in range(0, 360, 20):
            cv.set(int(sx + r * math.cos(math.radians(a))), int(sy - 1 + r * math.sin(math.radians(a)) * 0.8),
                   R['wood'][1])
    campfire(cv, nx + 32, ny + 2)
    # logs to sit on
    for lx, ly in [(nx + 22, ny - 10), (nx + 38, ny + 6)]:
        cv.rect(lx, ly, 9, 3, R['wood'][2])
        cv.rect(lx, ly, 9, 1, R['wood'][3])
        cv.outline_rect(lx - 1, ly - 1, 11, 5)
    # mushrooms
    for mx, my in [(nx + 32, ny + 22), (nx - 36, ny - 10), (nx + 8, ny + 26)]:
        if not clear(mx, my):
            cv.sprite(mx, my, ['.rr.', 'rwrr', 'oooo', '.ww.'],
                      {'r': R['jred'][2], 'w': WHITE, 'o': INK})
    # tree canopies rise ~20px above their base, so keep bases well below
    forest = lambda x, y: clear(x, y) or ((x - nx) / 54) ** 2 + ((y - ny - 8) / 32) ** 2 < 1
    scatter(rng, y0 + 18, y0 + BAND - 2, 46,
            lambda x, y: (pine if (x * 7 + y) % 3 else tree)(cv, x, y, 0.9 + (x % 3) * 0.1), forest)
    return nx, ny


def paint_spreading(cv: Canvas, y0: int, side: str, rng: random.Random, clear: Clear) -> tuple[int, int]:
    """The town that had never known the game: cottages, a tavern, a pond."""
    nx, ny = NODE_X[side], y0 + BAND // 2
    far = 112 if side == 'left' else 16
    # wheat field with fence
    fx, fy = far + 4, y0 + 92
    for yy in range(fy, fy + 22):
        for xx in range(fx, fx + 52):
            if not clear(xx, yy):
                cv.set(xx, yy, R['gold'][2] if (xx + (yy // 2)) % 3 else R['gold'][1] if yy % 2 else R['gold'][3])
    for xx in range(fx - 2, fx + 54, 4):
        if not clear(xx, fy - 2):
            cv.rect(xx, fy - 4, 1, 4, R['wood'][1])
    for xx in range(fx - 2, fx + 53):
        if not clear(xx, fy - 3):
            cv.set(xx, fy - 3, R['wood'][3])
    # tavern (bigger, blue roof, hanging sign) and cottages
    houses = [(far + 6, y0 + 22, 14), (far + 30, y0 + 16, 22), (far + 6, y0 + 50, 14),
              (far + 34, y0 + 58, 14)]
    for i, (hx, hy, w) in enumerate(houses):
        house(cv, hx, hy, w, roof='roof_b' if w > 16 else 'roof')
    tx, ty = houses[1][0], houses[1][1]
    cv.rect(tx - 4, ty + 2, 1, 6, R['wood'][0])
    cv.rect(tx - 7, ty + 4, 4, 3, R['wood'][2])
    cv.set(tx - 6, ty + 5, R['gold'][3])
    # well
    wx, wy = far + 26, y0 + 46
    cv.shadow(wx + 2, wy + 3, 5, 2, 0.65)
    cv.disc(wx, wy, 4, R['rock'][3])
    cv.disc(wx, wy, 2.5, R['water'][0])
    cv.rect(wx - 4, wy - 7, 1, 6, R['wood'][1])
    cv.rect(wx + 3, wy - 7, 1, 6, R['wood'][1])
    cv.rect(wx - 5, wy - 8, 10, 2, R['roof'][2])
    # pond on the near side, under the road's far bank
    px, py = (18 if side == 'left' else 160), y0 + 104
    for yy in range(py - 9, py + 10):
        for xx in range(px - 14, px + 15):
            d = ((xx - px) / 14) ** 2 + ((yy - py) / 9) ** 2
            if d <= 1:
                cv.set(xx, yy, R['water'][3] if d > 0.75 else R['water'][2] if d > 0.35 else R['water'][1])
            elif d <= 1.25:
                cv.set(xx, yy, R['sand'][2])
    for lx, ly in [(px - 5, py - 2), (px + 4, py + 3)]:
        cv.sprite(lx, ly, ['.gg', 'ggg', 'gg.'], {'g': R['grass'][3]})
    cv.set(px + 5, py + 3, (240, 160, 200))
    scatter(rng, y0 + 4, y0 + BAND - 4, 14, lambda x, y: bush(cv, x, y),
            lambda x, y: clear(x, y) or (far - 4 < x < far + 60))
    scatter(rng, y0 + 4, y0 + BAND - 4, 18,
            lambda x, y: flower(cv, x, y, [WHITE, (250, 220, 80), (240, 120, 160)][x % 3]), clear)
    return nx, ny


def paint_justin(cv: Canvas, y0: int, side: str, rng: random.Random, clear: Clear) -> tuple[int, int]:
    """Justin's chapel on a raised plateau, the first heretic's seat."""
    nx, ny = NODE_X[side], y0 + BAND // 2
    hx, hy = (144 if side == 'left' else 48), y0 + 54
    rx, ry, face = 40, 26, 10
    # plateau: lit top with grass texture, a striped cliff face below
    for yy in range(hy - ry, hy + ry + face + 1):
        for xx in range(hx - rx, hx + rx + 1):
            top = ((xx - hx) / rx) ** 2 + ((yy - hy) / ry) ** 2 <= 1
            under = ((xx - hx) / rx) ** 2 + ((yy - hy - face) / ry) ** 2 <= 1
            if top:
                edge = ((xx - hx) / rx) ** 2 + ((yy - hy) / ry) ** 2 > 0.9
                v = 0.55 + 0.25 * noise(xx, yy, 4, 9) - (0.2 if edge else 0)
                cv.set(xx, yy, shade(R['grass'][1:], v))
            elif under and yy > hy:
                depth = (yy - hy) / (ry + face)
                band = (yy + (xx // 5)) % 4 == 0
                ramp = R['cliff']
                col = ramp[1] if band else ramp[3] if xx < hx - rx * 0.5 else ramp[2]
                cv.set(xx, yy, mix(col, ramp[0], depth * 0.4))
    # outline of the plateau top
    for yy in range(hy - ry - 1, hy + ry + 2):
        for xx in range(hx - rx - 1, hx + rx + 2):
            d = ((xx - hx) / rx) ** 2 + ((yy - hy) / ry) ** 2
            if 1 < d <= 1.08 and yy <= hy + 4:
                cv.set(xx, yy, R['grass'][0])
    # steps cut into the cliff
    sx = hx - 4
    for i in range(7):
        y = hy + ry - 4 + i * 2
        cv.rect(sx, y, 9, 1, R['rock'][4])
        cv.rect(sx, y + 1, 9, 1, R['rock'][2])
    # chapel
    cx, cy = hx - 13, hy - 10   # wall top-left
    cv.shadow(cx + 17, cy + 16, 18, 4, 0.62)
    cv.box(cx, cy, 26, 15, R['wall'])
    # pointed nave roof
    for j in range(9):
        inset = 8 - j
        for xx in range(cx - 2 + inset, cx + 28 - inset):
            col = R['purple'][3] if xx < cx + 12 else R['purple'][2] if xx < cx + 15 else R['purple'][1]
            if (xx + j) % 4 == 0 and j % 2:
                col = R['purple'][0]
            if xx in (cx - 2 + inset, cx + 27 - inset):
                col = INK
            cv.set(xx, cy - 9 + j, col)
    # bell tower with spire and cross
    tx = cx + 9
    cv.box(tx, cy - 22, 8, 14, R['wall'])
    cv.rect(tx + 2, cy - 19, 4, 4, INK)
    cv.rect(tx + 3, cy - 18, 2, 3, R['gold'][2])
    for j in range(10):
        half = (j + 1) * 0.45
        for xx in range(int(tx + 4 - half), int(tx + 4 + half) + 1):
            col = R['purple'][3] if xx < tx + 4 else R['purple'][1]
            cv.set(xx, cy - 32 + j, col)
    cv.rect(tx + 3, cy - 39, 1, 7, R['gold'][2])
    cv.rect(tx + 1, cy - 37, 5, 1, R['gold'][2])
    # rose window (stained glass) and arched door
    rwx, rwy = cx + 13, cy + 5
    cv.disc(rwx, rwy, 3.5, INK)
    for k, (ox, oy) in enumerate([(-1, -1), (1, -1), (-1, 1), (1, 1), (0, 0)]):
        cv.set(rwx + ox, rwy + oy, R['glass'][k % 4])
    cv.sprite(rwx - 2, cy + 9, ['.ooo.', 'obbbo', 'obbbo', 'obbbo', 'obbbo', 'obbbo'],
              {'o': INK, 'b': R['wood'][1]})
    for wx in (cx + 3, cx + 20):
        cv.sprite(wx, cy + 4, ['.o.', 'oao', 'obo', 'oco', 'ooo'],
                  {'o': INK, 'a': R['glass'][2], 'b': R['glass'][1], 'c': R['glass'][0]})
    # graveyard
    for gx, gy in [(hx - 32, hy - 2), (hx - 25, hy + 6), (hx + 22, hy - 4), (hx + 29, hy + 4),
                   (hx - 33, hy + 10)]:
        gravestone(cv, gx, gy)
    off_hill = lambda x, y: clear(x, y) or ((x - hx) / (rx + 8)) ** 2 + ((y - hy - 4) / (ry + 14)) ** 2 < 1
    scatter(rng, y0 + 10, y0 + BAND - 2, 16, lambda x, y: tree(cv, x, y), off_hill)
    return nx, ny


def paint_greg(cv: Canvas, y0: int, side: str, rng: random.Random, clear: Clear) -> tuple[int, int]:
    """Greg's keep in the ashlands: a machine fortress on a field of lava."""
    nx, ny = NODE_X[side], y0 + BAND // 2
    kx = 124 if side == 'left' else 24        # keep's left edge
    acx, acy = kx + 22, y0 + 60
    # scorched ground: an irregular blob of ash
    land = (R['grass'] + [R['sand'][2], R['sand'][3], R['sand'][4]])
    for yy in range(y0 - 10, y0 + BAND + 10):
        for xx in range(W):
            ang = math.atan2(yy - acy, xx - acx)
            r = 60 + 8 * math.sin(ang * 3 + 1) + 6 * math.sin(ang * 7) + 4 * noise(xx, yy, 6, 2)
            d = math.hypot(xx - acx, (yy - acy) * 1.15)
            if d > r or cv.get(xx, yy) not in land:
                continue
            if d > r - 3:
                cv.set(xx, yy, mix(cv.get(xx, yy), R['ash'][2], 0.6))
            else:
                v = noise(xx, yy, 3, 8)
                cv.set(xx, yy, shade(R['ash'], 0.2 + v * 0.6))
                if v > 0.82:
                    cv.set(xx, yy, R['lava'][1])   # embers in the cracks
    # lava pools with bright cores and a glow around them
    for lx, ly, r in [(kx + 6, y0 + 94, 8), (kx + 40, y0 + 100, 6), (kx + 2, y0 + 22, 5)]:
        if clear(lx, ly):
            continue
        cv.glow(lx, ly, r * 2.2, R['lava'][2], 0.5)
        for yy in range(int(ly - r), int(ly + r) + 1):
            for xx in range(int(lx - r * 1.4), int(lx + r * 1.4) + 1):
                d = ((xx - lx) / (r * 1.4)) ** 2 + ((yy - ly) / r) ** 2
                if d <= 1:
                    v = 1 - d + 0.25 * noise(xx, yy, 2, 5)
                    cv.set(xx, yy, shade(R['lava'], v))
                elif d <= 1.2:
                    cv.set(xx, yy, R['ash'][0])
    # keep: brick walls, corner towers with crenellations, a giant screen
    W_, H_ = 44, 28
    ky = y0 + 36
    cv.shadow(kx + W_ / 2 + 5, ky + H_, W_ / 2 + 6, 4, 0.6)
    for yy in range(ky, ky + H_):
        for xx in range(kx, kx + W_):
            row = (yy - ky) // 3
            mortar = (yy - ky) % 3 == 2 or (xx + (row % 2) * 3) % 6 == 0
            t = (xx - kx) / W_
            col = R['rock'][1] if mortar else R['rock'][3] if t < 0.2 else R['rock'][2]
            cv.set(xx, yy, col)
    cv.outline_rect(kx, ky, W_, H_)
    for tx in (kx - 4, kx + W_ - 8):
        cv.box(tx, ky - 10, 12, H_ + 10, R['rock'])
        for i in range(0, 12, 4):
            cv.rect(tx + i, ky - 13, 3, 3, R['rock'][3])
            cv.outline_rect(tx + i - 1, ky - 14, 5, 5)
        cv.rect(tx + 4, ky - 4, 3, 5, R['screen'][2])
        cv.outline_rect(tx + 3, ky - 5, 5, 7)
    for i in range(0, W_ - 8, 5):
        cv.rect(kx + 8 + i, ky - 3, 3, 3, R['rock'][3])
        cv.outline_rect(kx + 7 + i, ky - 4, 5, 5)
    # the screen: green glow, scanlines, a blinking cursor
    sx, sy = kx + 13, ky + 4
    cv.rect(sx - 1, sy - 1, 20, 12, INK)
    for yy in range(sy, sy + 10):
        for xx in range(sx, sx + 18):
            cv.set(xx, yy, R['screen'][1] if yy % 2 else R['screen'][0])
    for i, ln in enumerate([7, 12, 5, 9]):
        cv.rect(sx + 2, sy + 1 + i * 2, ln, 1, R['screen'][3])
    cv.rect(sx + 2 + 10, sy + 7, 2, 2, R['screen'][3])
    cv.glow(sx + 9, sy + 5, 18, R['screen'][2], 0.25)
    # gate and pipes
    cv.sprite(kx + W_ // 2 - 4, ky + H_ - 9, ['.oooooo.', 'oaaaaaao', 'oabababo', 'oabababo',
                                             'oabababo', 'oabababo', 'oabababo', 'oabababo', 'oooooooo'],
              {'o': INK, 'a': R['wood'][1], 'b': R['wood'][0]})
    for px in (kx + 10, kx + 34):
        cv.rect(px, ky - 18, 4, 18, R['rock'][1])
        cv.rect(px, ky - 18, 1, 18, R['rock'][3])
        for k, (ox, oy, r) in enumerate([(2, -22, 2.5), (5, -27, 3.2), (3, -33, 3.8)]):
            cv.blob([(px + ox, ky + oy, r)], R['ash'], outline=None)
    scatter(rng, y0 + 4, y0 + BAND - 4, 16, lambda x, y: boulder(cv, x, y, 2.5 + (x % 2)), clear)
    return nx, ny


def desert_ground(cv: Canvas, y0: int, y1: int, fade: int = 14) -> None:
    """Turn the grass in rows y0..y1 into sand dunes, dithering into grass
    over `fade` rows at each edge so biomes blend instead of meeting in a line."""
    if getattr(cv, 'world', False):
        return      # on the map proper, the desert is part of the land's own ground
    grass = set(R['grass'])
    for yy in range(y0 - fade, y1 + fade):
        edge = min(yy - (y0 - fade), (y1 + fade) - yy) / (2 * fade)   # 0 at the outer edge
        for xx in range(W):
            if cv.get(xx, yy) not in grass:
                continue
            if edge < 0.5 and noise(xx, yy, 3, 41) > edge * 2:
                continue                                              # keep some grass in the blend
            ripple = math.sin(xx / 5 + yy / 3 + noise(xx, yy, 9, 42) * 4)
            v = 0.45 + 0.18 * ripple + 0.15 * noise(xx, yy, 4, 43)
            # redder than the road's sand, so the road still reads
            cv.set(xx, yy, mix(shade(R['sand'][1:], v), R['cliff'][2], 0.38))


def cactus(cv: Canvas, x: int, y: int, s: float = 1.0) -> None:
    """Saguaro; (x, y) is its base."""
    h = int(14 * s)
    cv.shadow(x + 3, y + 1, 4 * s, 1.5, 0.65)
    def col(xx, yy, top, bot):
        for yv in range(top, bot):
            cv.set(xx - 1, yv, R['grass'][0])
            cv.set(xx, yv, R['grass'][2])
            cv.set(xx + 1, yv, R['grass'][1])
            cv.set(xx + 2, yv, R['grass'][0])
        cv.set(xx, top - 1, R['grass'][0])
        cv.set(xx + 1, top - 1, R['grass'][0])
    col(x, y, y - h, y + 1)
    ay = y - int(h * 0.55)
    for i in range(3):                        # left arm
        cv.set(x - 2 - i, ay, R['grass'][1])
        cv.set(x - 2 - i, ay + 1, R['grass'][0])
    col(x - 5, ay + 1, ay - int(5 * s), ay + 1)
    by = y - int(h * 0.35)
    for i in range(3):                        # right arm
        cv.set(x + 3 + i, by, R['grass'][1])
        cv.set(x + 3 + i, by + 1, R['grass'][0])
    col(x + 6, by + 1, by - int(4 * s), by + 1)


def mesa(cv: Canvas, cx: int, base: int, w: int, h: int) -> None:
    """A flat-topped red-rock butte with banded strata; (cx, base) is its foot."""
    cv.shadow(cx + w * 0.3, base + 2, w * 0.6, 4, 0.6)
    top = base - h
    for yy in range(top, base):
        t = (yy - top) / h
        half = w / 2 * (0.82 + 0.18 * t) + 2 * noise(cx, yy, 3, 44)
        for xx in range(int(cx - half), int(cx + half) + 1):
            lit = (xx - (cx - half)) / (2 * half)
            band = (yy // 4) % 3
            base_col = R['cliff'][3] if lit < 0.35 else R['cliff'][2] if lit < 0.7 else R['cliff'][1]
            if band == 1:
                base_col = mix(base_col, R['jred'][1], 0.35)
            if xx in (int(cx - half), int(cx + half)):
                base_col = INK
            cv.set(xx, yy, base_col)
    half = w / 2 * 0.82
    for xx in range(int(cx - half), int(cx + half) + 1):   # sunlit cap
        cv.set(xx, top, R['sand'][4] if xx < cx else R['sand'][3])
        cv.set(xx, top - 1, INK)


def paint_pass(cv: Canvas, y0: int, side: str, rng: random.Random, clear: Clear) -> tuple[int, int]:
    """The Outlaw Pass: a red-rock canyon, the bandits' camp and their wagon
    of hand-copied rulebooks (each sealed with a gold quill)."""
    nx, ny = NODE_X[side], y0 + BAND // 2
    desert_ground(cv, y0, y0 + BAND, fade=18)
    far = 136 if side == 'left' else 56          # the camp, across the road
    # canyon walls: buttes crowding both edges of the band
    for cx, by, w, h in [(18, y0 + 40, 30, 26), (176, y0 + 30, 28, 30),
                         (14, y0 + 104, 26, 22), (180, y0 + 96, 26, 24)]:
        if not clear(cx, by - h // 2):
            mesa(cv, cx, by, w, h)
    # the bandits' wagon: canvas cover, crates of books with gold quill seals
    wx, wy = far - 14, y0 + 56
    cv.shadow(wx + 16, wy + 13, 18, 3.5, 0.6)
    cv.rect(wx, wy, 30, 9, R['wood'][2])
    cv.rect(wx, wy, 30, 2, R['wood'][3])
    cv.outline_rect(wx - 1, wy - 1, 32, 11)
    for j in range(9):                            # canvas hoop cover
        half = 15 - abs(j - 4) * 0.4
        for xx in range(int(wx + 15 - half), int(wx + 15 + half)):
            t = (xx - wx) / 30
            cv.set(xx, wy - 10 + j, R['wall'][3] if t < 0.3 else R['wall'][2] if t < 0.75 else R['wall'][1])
    for xx in range(wx, wx + 30):
        cv.set(xx, wy - 11, INK)
    for k in range(4):                            # books spilling out the back
        bx = wx + 32 + k * 4
        cv.rect(bx, wy + 3 - (k % 2) * 2, 3, 4, [R['jred'][1], R['purple'][1], R['jblue'][1], R['wood'][1]][k])
        cv.set(bx + 1, wy + 4 - (k % 2) * 2, R['gold'][3])   # the quill seal
    for wxx in (wx + 5, wx + 24):                 # wheels
        cv.disc(wxx, wy + 11, 4, INK)
        cv.disc(wxx, wy + 11, 2.5, R['wood'][2])
        cv.set(wxx, wy + 11, INK)
    # camp: a fire, a lean-to, a WANTED-style signpost
    campfire(cv, far + 18, y0 + 84)
    cv.rect(far - 4, y0 + 70, 1, 12, R['wood'][0])
    cv.rect(far - 9, y0 + 70, 11, 6, R['wood'][3])
    cv.outline_rect(far - 10, y0 + 69, 13, 8)
    cv.rect(far - 7, y0 + 72, 7, 1, R['wood'][0])
    # bleached bones and tumbleweeds
    for bx, by in [(far + 30, y0 + 100), (far - 20, y0 + 106)]:
        if not clear(bx, by):
            cv.rect(bx, by, 6, 1, R['wall'][3])
            cv.set(bx - 1, by - 1, R['wall'][3])
            cv.set(bx + 6, by + 1, R['wall'][3])
    tumble = lambda x, y: cv.blob([(x, y - 2, 2.4)], [R['wood'][0], R['wood'][1], R['wood'][2], R['sand'][2]])
    scatter(rng, y0 + 6, y0 + BAND - 4, 9, lambda x, y: cactus(cv, x, y, 0.8 + (x % 3) * 0.15),
            lambda x, y: clear(x, y) or abs(x - far) < 34 and abs(y - y0 - 70) < 30)
    scatter(rng, y0 + 6, y0 + BAND - 4, 6, tumble, clear)
    return nx, ny


def paint_chaos(cv: Canvas, y0: int, side: str, rng: random.Random, clear: Clear) -> tuple[int, int]:
    """Gio and Tati's carnival: a striped big top, a checker plaza, balloons."""
    nx, ny = NODE_X[side], y0 + BAND // 2
    desert_ground(cv, y0, y0 + BAND, fade=14)
    tw = 50
    tx = 108 if side == 'left' else 34       # tent's left edge
    # checker plaza in front of the big top
    pcx, pcy = tx + tw // 2, y0 + 78
    for yy in range(pcy - 18, pcy + 19):
        for xx in range(pcx - 30, pcx + 31):
            d = ((xx - pcx) / 30) ** 2 + ((yy - pcy) / 18) ** 2
            if d <= 1:
                odd = ((xx // 4) + (yy // 3)) % 2
                ramp = R['jpurple'] if odd else R['jgreen']
                cv.set(xx, yy, ramp[1] if d > 0.85 else ramp[2])
            elif d <= 1.1:
                cv.set(xx, yy, R['gold'][1])
    # the big top: striped body, conical roof lit from the left, pennants
    by, bh = y0 + 44, 18
    cv.shadow(tx + tw / 2 + 4, by + bh, tw / 2 + 6, 4, 0.6)
    for yy in range(by, by + bh):
        for xx in range(tx, tx + tw):
            stripe = ((xx - tx) // 4) % 2
            ramp = R['jred'] if stripe else R['jblue']
            t = (xx - tx) / tw
            cv.set(xx, yy, ramp[3] if t < 0.15 else ramp[2] if t < 0.65 else ramp[1])
    cv.outline_rect(tx, by, tw, bh)
    door = tx + tw // 2 - 5
    for yy in range(by + 4, by + bh):
        half = min(5, (yy - by - 4) * 0.6 + 1)
        for xx in range(int(door + 5 - half), int(door + 5 + half)):
            cv.set(xx, yy, INK)
    apex = (tx + tw // 2, y0 + 14)
    for yy in range(apex[1], by):
        frac = (yy - apex[1]) / (by - apex[1])
        half = frac * (tw / 2 + 3)
        for xx in range(int(apex[0] - half), int(apex[0] + half) + 1):
            ang = (xx - apex[0]) / max(1, half)
            seg = int((ang + 1) * 5) % 2
            ramp = R['jred'] if seg else R['jblue']
            col = ramp[3] if ang < -0.4 else ramp[2] if ang < 0.3 else ramp[1]
            if xx in (int(apex[0] - half), int(apex[0] + half)):
                col = INK
            cv.set(xx, yy, col)
    for xx in range(tx - 3, tx + tw + 3):
        cv.set(xx, by - 1, R['gold'][2] if xx % 3 else R['gold'][0])
    cv.rect(apex[0], apex[1] - 8, 1, 8, INK)
    cv.sprite(apex[0] + 1, apex[1] - 8, ['aaa', 'aa.', 'a..'], {'a': R['jgreen'][2]})
    # bunting strung from the tent to a pole
    pole = tx + tw + 8 if side == 'left' else tx - 8
    cv.rect(pole, y0 + 26, 1, 22, INK)
    for i in range(13):
        t = i / 12
        x = int(apex[0] + (pole - apex[0]) * t)
        y = int(apex[1] + 4 + (y0 + 26 - apex[1] - 4) * t + math.sin(t * math.pi) * 6)
        cv.set(x, y, INK)
        if i % 2:
            cv.sprite(x - 1, y + 1, ['abc', '.b.'],
                      {'a': R['jred'][2], 'b': [R['jgreen'][2], R['gold'][2], R['jpurple'][2]][i % 3],
                       'c': R['jblue'][2]})
    # balloons on strings
    for bx, by2, ramp in [(tx - 6, y0 + 74, 'jred'), (tx + tw + 6, y0 + 58, 'jpurple'),
                          (tx + 4, y0 + 104, 'gold'), (tx + tw - 4, y0 + 106, 'jgreen')]:
        if clear(bx, by2):
            continue
        for k in range(8):
            cv.set(bx + (k % 2), by2 + 4 + k, INK)
        cv.blob([(bx, by2, 3.3)], R[ramp])
        cv.set(bx - 1, by2 - 1, WHITE)
    # jack-in-the-box
    jx, jy = (tx + tw - 2, y0 + 108) if side == 'left' else (tx - 6, y0 + 108)
    cv.shadow(jx + 5, jy + 9, 6, 2, 0.65)
    cv.box(jx, jy, 9, 8, R['jpurple'])
    cv.rect(jx + 2, jy + 2, 5, 4, R['gold'][2])
    for k in range(5):
        cv.set(jx + 4 + (k % 2) * 2 - 1, jy - 1 - k, R['rock'][3])
    cv.blob([(jx + 4.5, jy - 9, 3.2)], R['wall'])
    cv.set(jx + 3, jy - 9, INK)
    cv.set(jx + 6, jy - 9, INK)
    cv.rect(jx + 3, jy - 7, 4, 1, R['jred'][2])
    cv.sprite(jx + 1, jy - 15, ['a.b.c', '.aabc'], {'a': R['jred'][2], 'b': R['jgreen'][2], 'c': R['jblue'][2]})
    off_plaza = lambda x, y: clear(x, y) or ((x - pcx) / 44) ** 2 + ((y - pcy + 16) / 40) ** 2 < 1
    scatter(rng, y0 + 4, y0 + BAND - 4, 9, lambda x, y: cactus(cv, x, y, 0.8 + (x % 3) * 0.15), off_plaza)
    scatter(rng, y0 + 4, y0 + BAND - 4, 16,
            lambda x, y: cv.set(x, y, [R['jred'][2], R['jgreen'][3], R['gold'][3], R['jpurple'][3]][(x + y) % 4]),
            off_plaza)   # confetti
    return nx, ny


def torch(cv: Canvas, x: int, y: int) -> None:
    """Standing torch; (x, y) is the foot of the pole."""
    cv.glow(x, y - 9, 10, R['lava'][3], 0.4)
    cv.rect(x, y - 7, 1, 8, R['wood'][0])
    cv.sprite(x - 1, y - 11, ['.a.', 'aba', '.c.'],
              {'a': R['lava'][2], 'b': R['lava'][4], 'c': R['wood'][2]})


def banner(cv: Canvas, x: int, y: int, ramp, mark=None) -> None:
    """A hanging banner on a pole; (x, y) is the foot of the pole."""
    cv.rect(x, y - 20, 1, 21, R['wood'][0])
    cv.set(x, y - 21, R['gold'][3])
    for j in range(12):
        w = 6 if j < 10 else (4 if j == 10 else 2)
        for i in range(w):
            col = ramp[2] if i < 2 else ramp[1]
            if i == w - 1 or (j == 11):
                col = ramp[0]
            cv.set(x + 1 + i + (6 - w) // 2, y - 19 + j, col)
    if mark:
        for i in range(4):   # an X, Justin's mark from his banners
            cv.set(x + 2 + i, y - 16 + i, mark)
            cv.set(x + 5 - i, y - 16 + i, mark)


def paint_second_schism(cv: Canvas, y0: int, side: str, rng: random.Random, clear: Clear) -> tuple[int, int]:
    """The schism returns: Justin's dark cathedral, red banners, burning cards."""
    nx, ny = NODE_X[side], y0 + BAND // 2
    cx = 144 if side == 'left' else 48            # cathedral centre
    by = y0 + 62                                  # cathedral base line
    # flagstone plaza
    for yy in range(by - 4, by + 34):
        for xx in range(cx - 38, cx + 39):
            d = ((xx - cx) / 38) ** 2 + ((yy - by - 14) / 20) ** 2
            if d <= 1 and not clear(xx, yy):
                edge = (xx // 5 + (yy // 3) % 2) % 2 == 0 and yy % 3 == 0 or xx % 5 == 0
                col = R['rock'][1] if edge else R['rock'][2] if noise(xx, yy, 3, 21) < 0.5 else R['rock'][3]
                cv.set(xx, yy, col)
    # nave
    nw, nh = 34, 22
    nx0 = cx - nw // 2
    cv.shadow(cx + 6, by + 2, nw / 2 + 12, 5, 0.6)
    for yy in range(by - nh, by):
        for xx in range(nx0, nx0 + nw):
            row = (yy - by) // 3
            mortar = (yy - by) % 3 == 0 or (xx + (row % 2) * 2) % 5 == 0
            t = (xx - nx0) / nw
            col = R['night'][3] if t < 0.2 else R['night'][2]
            cv.set(xx, yy, R['night'][1] if mortar else col)
    cv.outline_rect(nx0, by - nh, nw, nh)
    for j in range(10):                           # pitched roof
        inset = 9 - j
        for xx in range(nx0 - 1 + inset, nx0 + nw + 1 - inset):
            col = R['jred'][2] if xx < cx - 1 else R['jred'][1] if xx < cx + 2 else R['jred'][0]
            if xx in (nx0 - 1 + inset, nx0 + nw - inset):
                col = INK
            cv.set(xx, by - nh - 10 + j, col)
    # twin towers with spires
    for tx in (nx0 - 8, nx0 + nw - 2):
        th = nh + 14
        for yy in range(by - th, by):
            for xx in range(tx, tx + 10):
                t = (xx - tx) / 10
                mortar = (yy % 3 == 0) or (xx + (yy // 3) % 2 * 2) % 5 == 0
                col = R['night'][1] if mortar else R['night'][3] if t < 0.3 else R['night'][2]
                cv.set(xx, yy, col)
        cv.outline_rect(tx, by - th, 10, th)
        for j in range(12):
            half = (j + 1) * 0.45
            for xx in range(int(tx + 5 - half), int(tx + 5 + half) + 1):
                cv.set(xx, by - th - 12 + j, R['jred'][2] if xx < tx + 5 else R['jred'][0])
        cv.rect(tx + 3, by - th + 5, 4, 6, INK)
        cv.rect(tx + 4, by - th + 6, 2, 4, R['lava'][3])
        cv.glow(tx + 5, by - th + 8, 8, R['lava'][2], 0.25)
    # rose window and great door
    cv.disc(cx, by - nh + 8, 4.5, INK)
    for k, (ox, oy) in enumerate([(-2, 0), (2, 0), (0, -2), (0, 2), (0, 0), (-1, -1), (1, 1)]):
        cv.set(cx + ox, by - nh + 8 + oy, R['jred'][2] if k % 2 else R['lava'][3])
    cv.sprite(cx - 4, by - 10, ['..oooo..', '.obbbbo.', 'obbbbbbo', 'obbbbbbo', 'obbbbbbo',
                                'obbbbbbo', 'obbbbbbo', 'obbbbbbo', 'obbbbbbo', 'oooooooo'],
              {'o': INK, 'b': R['wood'][0]})
    # red X banners and torches flanking the door
    for bx in (cx - 22, cx + 18):
        banner(cv, bx, by + 8, R['jred'], mark=WHITE)
    for tx in (cx - 12, cx + 12):
        torch(cv, tx, by + 6)
    # the burning pile of old-rule cards
    fx, fy = cx, by + 22
    cv.glow(fx, fy - 3, 16, R['lava'][3], 0.45)
    for k in range(14):
        ang = k * 2.4
        x = int(fx + math.cos(ang) * (3 + k % 4) * 1.6)
        y = int(fy + math.sin(ang) * (2 + k % 3))
        cv.rect(x, y, 2, 1, WHITE)
        cv.set(x, y + 1, INK)
    cv.sprite(fx - 3, fy - 9, ['...a...', '..aba..', '.abcba.', 'abccbba', '.bcccb.', '..bbb..'],
              {'a': R['lava'][1], 'b': R['lava'][3], 'c': R['lava'][4]})
    # dead trees around
    def dead_tree(x: int, y: int) -> None:
        cv.shadow(x + 2, y + 1, 4, 1.5, 0.7)
        cv.rect(x, y - 10, 2, 11, R['wood'][0])
        for i in range(4):
            cv.set(x - 1 - i, y - 7 - i, R['wood'][0])
            cv.set(x + 2 + i, y - 5 - i, R['wood'][0])
    off = lambda x, y: clear(x, y) or ((x - cx) / 48) ** 2 + ((y - by) / 44) ** 2 < 1
    scatter(rng, y0 + 6, y0 + BAND - 2, 10, dead_tree, off)
    scatter(rng, y0 + 6, y0 + BAND - 2, 8, lambda x, y: boulder(cv, x, y, 2.5), off)
    return nx, ny


def paint_council(cv: Canvas, y0: int, side: str, rng: random.Random, clear: Clear) -> tuple[int, int]:
    """The Council of Schisms: one round table, a seat and banner for each."""
    nx, ny = NODE_X[side], y0 + BAND // 2
    cx, cy = (138 if side == 'left' else 54), y0 + 66
    R1 = 40
    # marble floor in a ring of pillars
    for yy in range(cy - 30, cy + 31):
        for xx in range(cx - R1 - 2, cx + R1 + 3):
            d = ((xx - cx) / R1) ** 2 + ((yy - cy) / 28) ** 2
            if d > 1:
                continue
            ring = 0.82 < d
            v = 0.55 + 0.3 * noise(xx, yy, 5, 31)
            col = R['wall'][1] if ring else shade(R['wall'], v)
            if not ring and 0.47 < noise(xx * 1.4, yy, 6, 33) < 0.5:
                col = R['wall'][0]           # marble veins
            cv.set(xx, yy, col)
    for yy in range(cy - 31, cy + 32):        # floor edge + low step
        for xx in range(cx - R1 - 3, cx + R1 + 4):
            d = ((xx - cx) / R1) ** 2 + ((yy - cy) / 28) ** 2
            if 1 < d <= 1.1:
                cv.set(xx, yy, INK if yy < cy else R['rock'][1])
    # pillars around the ring (back ones first)
    pillars = []
    for k in range(10):
        a = k / 10 * 2 * math.pi + 0.3
        pillars.append((cx + math.cos(a) * (R1 - 4), cy + math.sin(a) * 24))
    for px, py in sorted(pillars, key=lambda p: p[1]):
        px, py = int(px), int(py)
        cv.shadow(px + 3, py + 1, 4, 1.5, 0.6)
        cv.rect(px - 2, py - 16, 5, 16, R['wall'][2])
        cv.rect(px - 2, py - 16, 1, 16, R['wall'][3])
        cv.rect(px + 2, py - 16, 1, 16, R['wall'][0])
        cv.rect(px - 3, py - 18, 7, 2, R['wall'][3])
        cv.rect(px - 3, py, 7, 1, R['rock'][1])
        cv.outline_rect(px - 3, py - 18, 7, 2)
    # the round table, with a seat for each dissenter
    cv.shadow(cx + 4, cy + 6, 18, 6, 0.6)
    seats = [('purple', -1.0), ('screen', -0.35), ('jred', 0.35), ('jblue', 1.0)]   # Justin, Greg, Gio, Tati
    for ramp, t in seats:                     # far seats behind the table
        sx, sy = int(cx + t * 20), cy - 13 + int(abs(t) * 5)
        cv.blob([(sx, sy, 3.2)], R[ramp])
    cv.disc(cx, cy + 2, 16, R['wood'][0])
    for yy in range(cy - 12, cy + 13):
        for xx in range(cx - 18, cx + 19):
            d = ((xx - cx) / 17) ** 2 + ((yy - cy) / 11) ** 2
            if d <= 1:
                v = 0.6 - (xx - cx + yy - cy) / 60
                cv.set(xx, yy, shade(R['wood'], v))
            elif d <= 1.12:
                cv.set(xx, yy, INK)
    for k in range(7):                        # cards dealt round the table
        a = k / 7 * 2 * math.pi
        x, y = int(cx + math.cos(a) * 10), int(cy + math.sin(a) * 6)
        cv.rect(x, y, 2, 3, WHITE)
        cv.set(x, y, R['jred'][2] if k % 2 else INK)
    cv.rect(cx - 1, cy - 1, 3, 3, R['jblue'][1])  # the deck
    # banners: Justin, Greg, Gio, Tati
    for (ramp, mark), bx in zip([('purple', WHITE), ('screen', None), ('jred', None), ('jblue', None)],
                                [cx - 30, cx - 12, cx + 8, cx + 26]):
        banner(cv, bx, cy - 24, R[ramp], mark=mark)
    # hedges
    off = lambda x, y: clear(x, y) or ((x - cx) / (R1 + 10)) ** 2 + ((y - cy + 4) / 42) ** 2 < 1
    scatter(rng, y0 + 4, y0 + BAND - 4, 18, lambda x, y: bush(cv, x, y), off)
    scatter(rng, y0 + 4, y0 + BAND - 4, 8, lambda x, y: tree(cv, x, y), off)
    return nx, ny


# Ladder order. Must match PRESET_ORDER (src/campaign/presets.ts).
REGIONS = [
    ('jake-classic', paint_jake),
    ('the-spreading', paint_spreading),
    ('justins-schism', paint_justin),
    ('super-tens', paint_greg),
    ('the-pass', paint_pass),
    ('chaos-shed', paint_chaos),
    ('second-schism', paint_second_schism),
    ('the-council', paint_council),
]


# ─── The land ────────────────────────────────────────────────────────────────
# One continuous country, MW x MH art pixels, with no sea around it: the map
# simply runs to its edges. Each table's landmark is painted by its region
# painter above, through a View that sets the painter's 192x128 tile down
# wherever the land wants it. Everything else here is the country itself:
# ground, water, canyon, plateau, mountains, volcano, the road and the filler.

MW, MH = 576, 760

# Where each table stands (art pixels), in ladder order.
NODES = {
    'jake-classic': (94, 644),
    'the-spreading': (250, 626),
    'justins-schism': (424, 666),
    'super-tens': (488, 528),
    'the-pass': (344, 472),
    'chaos-shed': (184, 440),
    'second-schism': (84, 280),
    'the-council': (290, 266),
}
# Each region painter's tile: which way round it paints ('side') and the
# tile's top-left corner, chosen so its landmark lands beside the node.
TILES = {
    'jake-classic': ('left', 34, 580),       # the clearing sits round the node
    'the-spreading': ('right', 145, 503),    # cottages north-west, pond by the river
    'justins-schism': ('left', 326, 566),    # chapel hill north-east
    'super-tens': ('right', 394, 504),       # the keep west of the node
    'the-pass': ('left', 220, 352),          # the bandits' camp on the canyon's north rim
    'chaos-shed': ('left', -25, 388),        # the big top south-west of the node
    'second-schism': ('left', -40, 160),     # the dark cathedral above the node
    'the-council': ('left', 212, 182),       # the ring of pillars on the plateau
}
# The ground each landmark stands on, kept clear of filler (x0, y0, x1, y1).
RESERVED = {
    'jake-classic': (46, 618, 142, 664),
    'the-spreading': (156, 506, 226, 624),
    'justins-schism': (410, 566, 514, 672),
    'super-tens': (406, 504, 472, 574),
    'the-pass': (328, 392, 404, 444),
    'chaos-shed': (74, 400, 142, 492),
    'second-schism': (62, 164, 146, 262),
    'the-council': (304, 196, 400, 284),
}

TOWER = (500, 176)          # foot of Chris's tower, on the great peak
LAKE = (160, 348, 40, 26)   # centre x, y and radii


class View(Canvas):
    """A window onto the map for one region painter: the painter draws in its
    own 192x128 tile coordinates and the View sets them down at (ox, oy)."""
    world = True

    def __init__(self, base: Canvas, ox: int, oy: int):
        self.base, self.ox, self.oy = base, ox, oy
        self.w, self.h = W, BAND
        self.img, self.px = base.img, base.px

    def ok(self, x, y):
        return self.base.ok(x + self.ox, y + self.oy)

    def set(self, x, y, col):
        self.base.set(x + self.ox, y + self.oy, col)

    def get(self, x, y):
        return self.base.get(x + self.ox, y + self.oy)

    def darken(self, x, y, f):
        self.base.darken(x + self.ox, y + self.oy, f)

    def tint(self, x, y, col, t):
        self.base.tint(x + self.ox, y + self.oy, col, t)


def spline(pts: list[tuple[float, float]], step: float = 0.6) -> list[tuple[float, float]]:
    """A smooth curve through pts (Catmull-Rom), sampled about every `step` pixels."""
    out: list[tuple[float, float]] = []
    P = [pts[0]] + list(pts) + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        n = max(2, int(math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
        for k in range(n):
            t = k / n
            out.append(tuple(
                0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t
                       + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t
                       + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3)
                for j in (0, 1)))
    out.append(pts[-1])
    return out


class Mask:
    """Pixels something already stands on."""

    def __init__(self):
        self.bits = bytearray(MW * MH)

    def mark(self, x: int, y: int) -> None:
        if 0 <= x < MW and 0 <= y < MH:
            self.bits[y * MW + x] = 1

    def box(self, x0: int, y0: int, x1: int, y1: int) -> None:
        for y in range(max(0, y0), min(MH, y1 + 1)):
            for x in range(max(0, x0), min(MW, x1 + 1)):
                self.bits[y * MW + x] = 1

    def near(self, pts, r: int) -> None:
        seen = set()
        for x, y in pts:
            key = (int(x), int(y))
            if key not in seen:
                seen.add(key)
                self.box(key[0] - r, key[1] - r, key[0] + r, key[1] + r)

    def __call__(self, x: int, y: int) -> bool:
        return not (0 <= x < MW and 0 <= y < MH) or bool(self.bits[y * MW + x])


# ─── Ground ──────────────────────────────────────────────────────────────────

MARSH = [(28, 48, 46), (40, 66, 58), (54, 86, 68), (74, 108, 82)]
SNOW = [(168, 184, 214), (204, 216, 236), (232, 238, 250), (250, 252, 255)]
# (biome, centre x, centre y, reach): the nearest edge wins, with a wobble
BIOMES = [
    ('forest', 105, 615, 128), ('forest', 52, 440, 54),
    ('farm', 268, 600, 94), ('meadow', 440, 652, 96), ('meadow', 300, 720, 60),
    ('ash', 518, 480, 60), ('red', 343, 464, 84), ('desert', 178, 446, 84),
    ('marsh', 81, 262, 96), ('high', 328, 275, 120), ('high', 528, 320, 82),
    ('snow', 288, 96, 150), ('snow', 60, 96, 90), ('snow', 500, 150, 96),
]


def biome_at(x: int, y: int) -> str:
    wx = x + (noise(x, y, 30, 51) - 0.5) * 46
    wy = y + (noise(x, y, 30, 52) - 0.5) * 46
    scored = sorted((math.hypot(wx - bx, wy - by) - r, name) for name, bx, by, r in BIOMES)
    # dither the border between the two nearest so biomes fray into each other
    if scored[1][0] - scored[0][0] < 7 and _hash(x, y, 53) < 0.5 - (scored[1][0] - scored[0][0]) / 14:
        return scored[1][1]
    return scored[0][1]


def ground(biome: str, x: int, y: int):
    v = 0.35 + 0.3 * noise(x, y, 9, 1) + 0.15 * noise(x, y, 3, 2)
    if biome == 'forest':
        return shade([R['leaf'][1], R['leaf'][2], R['grass'][1], R['leaf'][2]], v)
    if biome == 'farm':
        return shade(R['grass'][2:5], v * 0.85)
    if biome == 'meadow':
        return shade(R['grass'][1:4], v)
    if biome == 'ash':
        a = noise(x, y, 3, 8)
        return R['lava'][1] if a > 0.88 else shade(R['ash'], 0.2 + a * 0.6)
    if biome == 'desert':
        ripple = math.sin(x / 5 + y / 3 + noise(x, y, 9, 42) * 4)
        return mix(shade(R['sand'][1:], 0.45 + 0.18 * ripple + 0.15 * noise(x, y, 4, 43)), R['cliff'][2], 0.38)
    if biome == 'red':
        band = math.sin(y / 4 + noise(x, y, 12, 44) * 5)
        return mix(shade(R['cliff'][1:], 0.4 + 0.2 * band + 0.2 * noise(x, y, 3, 45)), R['jred'][1], 0.18)
    if biome == 'marsh':
        return shade(MARSH, 0.25 + 0.5 * noise(x, y, 7, 46) + 0.2 * noise(x, y, 2, 47))
    if biome == 'high':
        return mix(shade(R['grass'][1:4], v), R['rock'][2], 0.42)
    return shade(SNOW, 0.35 + 0.45 * noise(x, y, 8, 48) + 0.15 * noise(x, y, 2, 49))


def paint_ground(cv: Canvas) -> list[list[str]]:
    biome = [[biome_at(x, y) for x in range(MW)] for y in range(MH)]
    for y in range(MH):
        for x in range(MW):
            cv.set(x, y, ground(biome[y][x], x, y))
    return biome


# ─── Sky, mountains, the tower ───────────────────────────────────────────────

def paint_sky(cv: Canvas, rng: random.Random, horizon: int = 128) -> None:
    """Night over the mountains: the peaks stand against it."""
    for y in range(horizon):
        t = y / horizon
        base = mix(R['night'][1], R['fog'][0], t ** 0.8)
        for x in range(MW):
            c = mix(base, R['night'][2], 0.25) if (x + y * 2) % 7 == 0 and t < 0.6 else base
            cv.set(x, y, c)
    for _ in range(170):
        x, y = rng.randrange(MW), rng.randrange(horizon * 2 // 3)
        cv.set(x, y, WHITE if rng.random() < 0.3 else R['fog'][3])
    cv.blob([(70, 30, 9)], [(170, 170, 150), (210, 208, 184), (238, 236, 214), (252, 250, 236)])


def peak(cv: Canvas, cx: int, base: int, h: int, w: int, ramp=None, snow: float = 0.4,
         seed: int = 0) -> None:
    """A mountain: lit left face, shaded right, a ragged ridge between them
    and a snow cap. (cx, base) is the middle of its foot; w its half-width."""
    ramp = ramp or R['rock']
    top = base - h
    for yy in range(top, base + 1):
        t = (yy - top) / h
        half = w * t + 1.5 * noise(cx + seed, yy, 5, 61) * t
        ridge = cx + (noise(seed, yy, 7, 62) - 0.5) * 10 * t
        snow_line = snow + 0.1 * noise(seed, cx, 3, 63)
        for xx in range(int(cx - half), int(cx + half) + 1):
            if not cv.ok(xx, yy):
                continue
            edge = xx in (int(cx - half), int(cx + half))
            lit = xx < ridge
            jag = noise(xx, yy, 4, 64 + seed)
            if t < snow_line + (jag - 0.5) * 0.14:
                col = (WHITE if jag > 0.4 else SNOW[2]) if lit else (SNOW[1] if jag > 0.45 else SNOW[0])
            else:
                crease = (xx * 2 + yy + seed) % 9 == 0 or jag > 0.78
                if lit:
                    col = ramp[2] if crease else ramp[4] if jag > 0.55 else ramp[3]
                else:
                    col = ramp[0] if crease else ramp[2] if jag > 0.7 else ramp[1]
            if yy > base - 5 and _hash(xx, yy, 65) < (yy - (base - 5)) / 6:
                continue                      # fray the foot into the ground
            cv.set(xx, yy, INK if edge and t > 0.04 else col)


def paint_tower(cv: Canvas, cx: int, base: int) -> None:
    """Chris's tower: a brick shaft narrowing upward, lit windows, a quill on top."""
    top = base - 82
    for y in range(top, base):
        half = 9 + (y - top) * 0.09
        for x in range(int(cx - half), int(cx + half) + 1):
            row = y // 3
            mortar = y % 3 == 0 or (x + (row % 2) * 2) % 5 == 0
            t = (x - (cx - half)) / (2 * half)
            col = R['night'][3] if t < 0.2 else R['night'][2] if t < 0.65 else R['night'][1]
            if mortar:
                col = R['night'][0]
            if x in (int(cx - half), int(cx + half)):
                col = INK
            cv.set(x, y, col)
    for y in range(top - 14, top + 1):     # roof cone
        half = (y - top + 14) * 0.75
        for x in range(int(cx - half), int(cx + half) + 1):
            cv.set(x, y, R['purple'][2] if x < cx else R['purple'][1])
    for wy in (top + 12, top + 30, top + 48, top + 64):
        cv.rect(cx - 2, wy, 4, 6, INK)
        cv.rect(cx - 1, wy + 1, 2, 4, R['gold'][3] if wy != top + 30 else R['gold'][2])
        cv.glow(cx, wy + 3, 9, R['gold'][2], 0.3)
    for i in range(12):                    # the quill
        x, y = cx + 1 + i // 2, top - 15 - i
        cv.set(x, y, R['wall'][3])
        cv.set(x - 1, y, R['wall'][1] if i > 2 else R['gold'][2])
    cv.rect(cx, top - 17, 1, 4, R['gold'][1])


def clouds(cv: Canvas, rng: random.Random, n: int, x0: float, x1: float, y: float, spread: float,
           keep=None) -> None:
    puffs = []
    for _ in range(n):
        px_, py_ = rng.uniform(x0, x1), y + rng.gauss(0, spread)
        if keep and keep(px_, py_):
            continue
        puffs.append((px_, py_, rng.uniform(5, 11)))
    for px_, py_, r in sorted(puffs, key=lambda p: p[1]):
        cv.blob([(px_, py_, r), (px_ + r * 0.8, py_ + 1, r * 0.75)], R['fog'], outline=None)


# ─── Water, canyon, plateau, volcano ─────────────────────────────────────────

RIVER = [(188, 370), (222, 428), (232, 492), (282, 558), (322, 614), (334, 668), (340, 720), (346, 764)]
CANYON = [(456, 466), (418, 478), (382, 468), (344, 472), (310, 480), (288, 474)]
PLATEAU = (327, 256, 86, 46, 22)        # centre x, y, radii, cliff height


def in_lake(x: float, y: float, grow: float = 0) -> bool:
    cx, cy, rx, ry = LAKE
    return ((x - cx) / (rx + grow)) ** 2 + ((y - cy) / (ry + grow)) ** 2 <= 1 + 0.12 * (noise(x, y, 9, 71) - 0.5)


def paint_water(cv: Canvas) -> list[tuple[float, float]]:
    river = spline(RIVER, 1.0)
    for r, col in ((6.5, R['sand'][2]), (5.2, None)):
        for x, y in river:
            for yy in range(int(y - r), int(y + r) + 1):
                for xx in range(int(x - r), int(x + r) + 1):
                    if (xx - x) ** 2 + (yy - y) ** 2 <= r * r:
                        cv.set(xx, yy, col or shade(R['water'][1:4], 0.35 + 0.5 * noise(xx, yy, 4, 72)))
    for x, y in river[::9]:                      # the current
        cv.set(int(x) + 1, int(y), R['water'][4])
        cv.set(int(x) - 1, int(y) + 2, R['water'][3])
    cx, cy, rx, ry = LAKE
    for yy in range(cy - ry - 6, cy + ry + 7):
        for xx in range(cx - rx - 6, cx + rx + 7):
            if in_lake(xx, yy):
                d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
                cv.set(xx, yy, shade(R['water'][:4], 0.25 + d * 0.6 + 0.12 * noise(xx, yy, 4, 73)))
                if not in_lake(xx, yy - 1):
                    cv.set(xx, yy, R['water'][4])
            elif in_lake(xx, yy, 2.5):
                cv.set(xx, yy, R['sand'][3])
    for lx, ly in [(cx - 18, cy - 6), (cx + 10, cy + 8), (cx - 4, cy + 12)]:   # lily pads
        cv.sprite(lx, ly, ['.gg', 'ggg', 'gg.'], {'g': R['grass'][3]})
    cv.set(cx + 11, cy + 8, (240, 160, 200))
    return river


def paint_canyon(cv: Canvas) -> list[tuple[float, float]]:
    """A trench through the red rock: sunlit north wall, shadowed south wall,
    a floor wide enough for the road and a table."""
    line = spline(CANYON, 2.0)
    x0 = int(min(p[0] for p in line)) - 30
    x1 = int(max(p[0] for p in line)) + 30
    y0 = int(min(p[1] for p in line)) - 30
    y1 = int(max(p[1] for p in line)) + 30
    for yy in range(y0, y1):
        for xx in range(x0, x1):
            d, near = min((math.hypot(xx - px_, yy - py_), py_) for px_, py_ in line)
            d += (noise(xx, yy, 6, 81) - 0.5) * 3
            if d > 26:
                continue
            north = yy < near
            if d <= 18:
                floor = mix(shade(R['cliff'][:3], 0.3 + 0.5 * noise(xx, yy, 4, 82)), R['ash'][1], 0.25)
                if north and d > 12:
                    floor = mix(floor, INK, 0.35)          # the north wall's shadow
                cv.set(xx, yy, floor)
            else:
                strata = (yy // 2 + xx // 7) % 3
                if north:
                    col = R['cliff'][1] if strata == 0 else R['cliff'][0]
                else:
                    col = R['cliff'][3] if strata == 0 else R['cliff'][4] if d > 24 else R['cliff'][2]
                if d > 25:
                    col = INK if north else R['sand'][4]
                cv.set(xx, yy, col)
    return line


def on_plateau(x: float, y: float) -> bool:
    cx, cy, rx, ry, _ = PLATEAU
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + 0.1 * (noise(x, y, 12, 91) - 0.5)


def paint_plateau(cv: Canvas) -> None:
    """The Council's high ground: a grassy stone table with a sheer south face."""
    cx, cy, rx, ry, face = PLATEAU
    for yy in range(cy - ry - 4, cy + ry + face + 6):
        for xx in range(cx - rx - 6, cx + rx + 7):
            if on_plateau(xx, yy):
                v = 0.5 + 0.3 * noise(xx, yy, 5, 92)
                col = mix(shade(R['grass'][2:5], v), R['rock'][3], 0.3)
                if not on_plateau(xx, yy - 1) or not on_plateau(xx - 1, yy):
                    col = R['grass'][4]
                cv.set(xx, yy, col)
            else:
                k = next((k for k in range(1, face + 1) if on_plateau(xx, yy - k)), None)
                if k is None:
                    if on_plateau(xx, yy - face - 3):
                        cv.darken(xx, yy, 0.7)             # shadow at the foot
                    continue
                band = (yy + xx // 5) % 4 == 0
                col = R['rock'][1] if band else R['rock'][3] if xx < cx - rx * 0.4 else R['rock'][2]
                cv.set(xx, yy, INK if k == 1 else mix(col, R['rock'][0], k / face * 0.5))


def paint_waterfall(cv: Canvas, x: int) -> tuple[int, int]:
    """Off the plateau's south face into a pool; returns the pool's centre."""
    cx, cy, rx, ry, face = PLATEAU
    top = next(yy for yy in range(cy, cy + ry + 8) if not on_plateau(x, yy))
    for yy in range(top - 6, top + face + 4):
        for xx in range(x - 3, x + 4):
            v = (xx * 3 + yy) % 4
            cv.set(xx, yy, WHITE if v == 0 else R['water'][4] if v < 3 else R['water'][3])
    py_ = top + face + 8
    for yy in range(py_ - 7, py_ + 8):
        for xx in range(x - 15, x + 16):
            d = ((xx - x) / 15) ** 2 + ((yy - py_) / 7) ** 2
            if d <= 1:
                cv.set(xx, yy, R['water'][4] if d > 0.8 else shade(R['water'][1:4], 0.3 + 0.5 * noise(xx, yy, 3, 93)))
    for mx, my, r in [(x - 6, py_ - 5, 4), (x + 5, py_ - 4, 3.5), (x, py_ - 8, 4.5)]:
        cv.blob([(mx, my, r)], R['fog'], outline=None)       # mist
    return x, py_


VOLCANO = (530, 494, 118, 50)           # centre of its foot, height, half-width


def paint_volcano(cv: Canvas, rng: random.Random) -> None:
    cx, base, h, w = VOLCANO
    top = base - h
    cv.glow(cx, top + 6, 46, R['lava'][2], 0.5)
    for yy in range(top + 8, base + 1):
        t = (yy - top) / h
        half = w * (t ** 1.25) + 5 + 2 * noise(cx, yy, 5, 101)
        ridge = cx + (noise(3, yy, 8, 102) - 0.5) * 12
        for xx in range(int(cx - half), int(cx + half) + 1):
            jag = noise(xx, yy, 4, 103)
            lit = xx < ridge
            col = (R['ash'][3] if jag > 0.6 else R['ash'][2]) if lit else (R['ash'][1] if jag > 0.6 else R['ash'][0])
            if (xx + yy * 2) % 11 == 0:
                col = R['ash'][0]
            if yy > base - 6 and _hash(xx, yy, 104) < (yy - (base - 6)) / 7:
                continue
            cv.set(xx, yy, INK if xx in (int(cx - half), int(cx + half)) else col)
    for xx in range(cx - 7, cx + 8):                         # the crater's rim
        for yy in range(top + 5, top + 12):
            d = ((xx - cx) / 7) ** 2 + ((yy - top - 8) / 3.5) ** 2
            if d <= 1:
                cv.set(xx, yy, shade(R['lava'], 1 - d * 0.7))
    for sx, drift, length in [(cx - 2, -0.28, 78), (cx + 3, 0.34, 60), (cx, 0.05, 40)]:   # lava runs
        x = float(sx)
        for i in range(length):
            yy = top + 11 + i
            x += drift + (noise(sx, yy, 6, 105) - 0.5) * 1.6
            wide = 2 if i < length * 0.6 else 1
            for k in range(-wide, wide + 1):
                cv.set(int(x) + k, yy, shade(R['lava'], 0.85 - abs(k) * 0.25 - i / length * 0.3))
            if i % 9 == 0:
                cv.glow(x, yy, 7, R['lava'][2], 0.35)
    for ox, oy, r in [(0, -4, 5), (5, -11, 6.5), (1, -20, 8), (9, -30, 9.5), (4, -42, 11)]:   # smoke
        cv.blob([(cx + ox, top + oy, r)], R['ash'], outline=None)


# ─── Greg's machinery: the keep draws its power from the volcano ─────────────

def pylon(cv: Canvas, x: int, y: int, h: int = 22) -> None:
    cv.shadow(x + 3, y + 1, 4, 1.5, 0.65)
    for j in range(h):
        cv.set(x - 1 - (h - j) // 6, y - j, R['rock'][1])
        cv.set(x + 1 + (h - j) // 6, y - j, R['rock'][3])
        if j % 4 == 0:
            cv.rect(x - 2, y - j, 5, 1, R['rock'][2])
    cv.rect(x - 4, y - h, 9, 1, R['rock'][3])
    cv.set(x - 4, y - h + 1, R['screen'][3])
    cv.set(x + 4, y - h + 1, R['screen'][3])


def wire(cv: Canvas, a: tuple[int, int], b: tuple[int, int], sag: int = 4) -> None:
    n = max(abs(b[0] - a[0]), abs(b[1] - a[1]))
    for i in range(n + 1):
        t = i / n
        cv.set(int(a[0] + (b[0] - a[0]) * t), int(a[1] + (b[1] - a[1]) * t + math.sin(t * math.pi) * sag),
               R['rock'][4])


def dish(cv: Canvas, x: int, y: int) -> None:
    cv.shadow(x + 3, y + 1, 6, 2, 0.65)
    cv.rect(x, y - 7, 2, 8, R['rock'][1])
    cv.sprite(x - 6, y - 15, ['....oooo.', '..oobbbbo', '.obbbbbao', 'obbbbbao.', 'obbbbao..', '.obbao...', '..ooo....'],
              {'o': INK, 'b': R['rock'][4], 'a': R['rock'][2]})
    cv.set(x + 3, y - 16, R['lava'][1])
    cv.glow(x + 3, y - 16, 4, R['lava'][2], 0.5)


def terminal(cv: Canvas, x: int, y: int) -> None:
    cv.shadow(x + 3, y + 1, 5, 1.5, 0.65)
    cv.rect(x, y - 3, 7, 4, R['rock'][2])
    cv.outline_rect(x - 1, y - 11, 9, 8)
    cv.rect(x, y - 10, 7, 6, R['screen'][0])
    for i, ln in enumerate((4, 5, 2)):
        cv.rect(x + 1, y - 9 + i * 2, ln, 1, R['screen'][3])
    cv.glow(x + 3, y - 7, 8, R['screen'][2], 0.3)


def antenna(cv: Canvas, x: int, y: int, h: int = 26) -> None:
    cv.shadow(x + 3, y + 1, 3, 1.2, 0.65)
    cv.rect(x, y - h, 1, h + 1, R['rock'][3])
    for j in range(4, h, 6):
        cv.rect(x - 2, y - j, 5, 1, R['rock'][1])
    cv.set(x, y - h - 1, R['lava'][1])
    cv.glow(x, y - h - 1, 6, R['lava'][1], 0.55)


def gear(cv: Canvas, x: int, y: int, r: int = 5) -> None:
    """A cog half-sunk in the ash."""
    for a in range(0, 360, 45):
        cv.rect(int(x + (r + 1) * math.cos(math.radians(a))) - 1, int(y + (r + 1) * math.sin(math.radians(a)) * 0.7) - 1,
                2, 2, R['rock'][1])
    for yy in range(y - r, y + r + 1):
        for xx in range(x - r, x + r + 1):
            d = math.hypot(xx - x, (yy - y) / 0.7)
            if d <= r:
                cv.set(xx, yy, INK if d > r - 1 else R['rock'][0] if d < 1.5 else R['rock'][2 + (xx < x)])


def trace(cv: Canvas, pts: list[tuple[int, int]]) -> None:
    """A circuit trace laid across the ash: right-angled, with a pad at each bend."""
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        for i in range(max(abs(bx - ax), abs(by - ay)) + 1):
            t = i / max(1, max(abs(bx - ax), abs(by - ay)))
            cv.set(int(ax + (bx - ax) * t), int(ay + (by - ay) * t), R['screen'][2])
    for x, y in pts:
        cv.rect(x - 1, y - 1, 3, 3, R['screen'][3])
        cv.glow(x, y, 5, R['screen'][2], 0.3)


def paint_machinery(cv: Canvas, clear: Clear) -> None:
    """Small signs of technology in the ash around Super Tens: a power line
    from the volcano over the road to the keep, a dish, an aerial, terminals,
    a pipe and a few cogs."""
    for run in ([(466, 556), (476, 556), (476, 574)],
                [(416, 580), (416, 592), (402, 592)],
                [(546, 566), (546, 540), (566, 540)],
                [(520, 560), (534, 560), (534, 578)]):
        trace(cv, run)
    posts = [(516, 504), (462, 518)]
    for x, y in posts:
        pylon(cv, x, y)
    for s in (-4, 4):
        wire(cv, (posts[0][0] + s, posts[0][1] - 21), (posts[1][0] + s, posts[1][1] - 21), 5)
    wire(cv, (458, 497), (452, 528), 1)                      # down to the keep
    dish(cv, 550, 566)
    antenna(cv, 564, 544)
    for x, y in [(516, 528), (544, 590), (482, 592)]:
        terminal(cv, x, y)
    for xx in range(520, 546):                               # a pipe from the volcano's foot
        cv.set(xx, 508, R['rock'][3])
        cv.set(xx, 509, R['rock'][1])
        if xx % 6 == 0:
            cv.rect(xx, 507, 1, 4, R['rock'][0])
    for x, y in [(556, 604), (504, 606), (536, 546), (446, 492)]:
        if not clear(x, y):
            gear(cv, x, y, 4 + (x % 2))


# ─── Road, bridges, spurs ────────────────────────────────────────────────────

def n(pid: str) -> tuple[int, int]:
    return NODES[pid]


# The road, table to table. It doubles back through the canyon, crosses the
# river twice, splits to pass the lake on both sides and climbs to the tower.
ROAD = [
    [(40, 692), n('jake-classic'), (168, 654), n('the-spreading'), (292, 642), (322, 634)],
    [(322, 634), (360, 652), n('justins-schism'), (468, 690), (524, 670), (538, 618), (520, 566),
     n('super-tens'), (474, 494), (456, 466)],
    [(456, 466), (418, 478), (382, 468), n('the-pass'), (310, 480), (288, 474), (262, 466), (244, 462)],
    [(244, 462), (214, 452), n('chaos-shed'), (160, 412), (136, 392)],
    [(136, 392), (110, 362), (112, 326), (136, 304), (160, 298)],           # west of the lake
    [(136, 392), (160, 387), (180, 386), (202, 378), (214, 356), (210, 326), (186, 304), (160, 298)],  # east
    [(160, 298), (120, 292), n('second-schism')],
    [n('second-schism'), (60, 264), (40, 238), (46, 200), (62, 174)],       # round the cathedral
    [(62, 174), (120, 152), (196, 196), (242, 250), n('the-council')],
    [n('the-council'), (326, 290), (366, 292), (402, 274), (432, 240), (456, 222), (440, 200), (468, 190), (488, 182)],
]
SPURS = [
    [n('the-spreading'), (262, 664), (270, 698)],             # to the windmill
    [n('super-tens'), (524, 536), (552, 522), (560, 508)],    # to the mine
    [(402, 274), (420, 302), (400, 332)],                     # to the foot of the waterfall
    [(40, 238), (26, 226), (22, 208)],                        # to the ruin in the marsh
]
BRIDGES = [((306, 637), (346, 645)), ((254, 465), (210, 451)), ((176, 387), (206, 376))]


def paint_road(cv: Canvas, pts: list[tuple[float, float]]) -> None:
    for x, y in pts:
        cv.disc(x + 1, y + 1, 7, R['sand'][0])     # shaded lower-right edge
    for x, y in pts:
        cv.disc(x, y, 6.2, R['sand'][1])
    for x, y in pts:
        cv.disc(x, y, 5.2, R['sand'][2])
    for x, y in pts[::3]:
        cv.disc(x - 1, y - 1, 2.6, R['sand'][3])   # worn, sunlit middle
    seen = set()
    for x, y in pts[::7]:                          # pebbles
        k = (int(x * 3 + y) % 9)
        p = (int(x) + k - 4, int(y) + (k % 3) - 1)
        if p not in seen and k in (1, 5):
            seen.add(p)
            cv.set(*p, R['sand'][0])
            cv.set(p[0] + 1, p[1], R['sand'][4])


def node_pad(cv: Canvas, x: int, y: int) -> None:
    """A round stone landing under each node marker."""
    cv.shadow(x + 3, y + 4, 15, 9, 0.6)
    cv.disc(x, y + 2, 14, R['rock'][1])     # side of the slab
    for yy in range(y - 13, y + 14):
        for xx in range(x - 13, x + 14):
            d = math.hypot(xx - x, yy - y)
            if d <= 13:
                ring = d > 11
                seam = (int(math.atan2(yy - y, xx - x) * 4) % 3 == 0 and 6 < d < 11)
                v = 0.75 - (xx - x + yy - y) / 60
                col = R['rock'][1] if ring else R['rock'][2] if seam else shade(R['rock'][2:], v)
                cv.set(xx, yy, col)
    for yy in range(y - 14, y + 15):
        for xx in range(x - 14, x + 15):
            if 13 < math.hypot(xx - x, yy - y) <= 14:
                cv.set(xx, yy, INK)


def paint_spur(cv: Canvas, pts: list[tuple[float, float]]) -> None:
    for x, y in pts:
        cv.disc(x + 1, y + 1, 3.6, R['sand'][0])
    for x, y in pts:
        cv.disc(x, y, 2.8, R['sand'][2])


def paint_bridge(cv: Canvas, a: tuple[int, int], b: tuple[int, int]) -> None:
    length = math.hypot(b[0] - a[0], b[1] - a[1])
    ux, uy = (b[0] - a[0]) / length, (b[1] - a[1]) / length
    for i in range(int(length * 2) + 1):
        t = i / 2
        x, y = a[0] + ux * t, a[1] + uy * t
        plank = int(t) % 4
        for k in range(-8, 9):
            col = R['wood'][0] if plank == 3 else R['wood'][3] if k < -2 else R['wood'][2]
            if abs(k) == 8:
                col = INK
            elif abs(k) == 7:
                col = R['wood'][1]
            cv.set(int(x - uy * k), int(y + ux * k), col)
    for t in (0, length):                                   # posts at each end
        for k in (-8, 8):
            x, y = int(a[0] + ux * t - uy * k), int(a[1] + uy * t + ux * k)
            cv.rect(x - 1, y - 4, 3, 5, R['wood'][1])
            cv.outline_rect(x - 2, y - 5, 5, 7)


# ─── Filler ──────────────────────────────────────────────────────────────────

def dead_tree(cv: Canvas, x: int, y: int) -> None:
    cv.shadow(x + 2, y + 1, 4, 1.5, 0.7)
    for j in range(11):
        cv.set(x, y - j, R['wood'][0])
        cv.set(x + 1, y - j, R['ash'][2])
    for dx, dy, ln in [(-1, -6, 4), (1, -8, 4), (-1, -10, 3), (1, -4, 3)]:
        for k in range(1, ln + 1):
            cv.set(x + dx * k + (dx > 0), y + dy - k // 2, R['wood'][0])


def reeds(cv: Canvas, x: int, y: int) -> None:
    for k, hgt in enumerate((5, 7, 4)):
        for j in range(hgt):
            cv.set(x + k * 2, y - j, R['leaf'][2])
        cv.set(x + k * 2, y - hgt, R['wood'][2])


def bog(cv: Canvas, x: int, y: int, rx: int = 9, ry: int = 4) -> None:
    for yy in range(y - ry, y + ry + 1):
        for xx in range(x - rx, x + rx + 1):
            d = ((xx - x) / rx) ** 2 + ((yy - y) / ry) ** 2
            if d <= 1:
                cv.set(xx, yy, (22, 40, 58) if d < 0.6 else (40, 64, 76))
    cv.set(x - 2, y - 1, (90, 130, 140))
    reeds(cv, x + rx - 2, y - ry + 2)


def lava_pool(cv: Canvas, x: int, y: int, r: float) -> None:
    cv.glow(x, y, r * 2.2, R['lava'][2], 0.5)
    for yy in range(int(y - r), int(y + r) + 1):
        for xx in range(int(x - r * 1.4), int(x + r * 1.4) + 1):
            d = ((xx - x) / (r * 1.4)) ** 2 + ((yy - y) / r) ** 2
            if d <= 1:
                cv.set(xx, yy, shade(R['lava'], 1 - d + 0.25 * noise(xx, yy, 2, 5)))
            elif d <= 1.25:
                cv.set(xx, yy, R['ash'][0])


def crystal(cv: Canvas, x: int, y: int, s: int = 1) -> None:
    """A cluster of glowing shards: the mountains' own light."""
    cv.glow(x, y - 6 * s, 12 * s, R['purple'][3], 0.4)
    for dx, hgt in ((-3, 6), (0, 10), (3, 7)):
        for j in range(hgt * s):
            wide = max(0, min(2, (hgt * s - j) // 3))
            for k in range(-wide, wide + 1):
                cv.set(x + dx * s + k, y - j, R['purple'][4] if k < 0 else R['purple'][3] if k == 0 else R['purple'][2])
        cv.set(x + dx * s, y - hgt * s, WHITE)


def wisp(cv: Canvas, x: int, y: int) -> None:
    cv.glow(x, y, 6, (150, 240, 220), 0.55)
    cv.set(x, y, WHITE)


def great_tree(cv: Canvas, x: int, y: int) -> None:
    """The elder tree of Jake's wood, many times the size of the rest."""
    cv.shadow(x + 10, y + 3, 34, 9, 0.6)
    for j in range(40):
        half = 6 + (j < 8) * (8 - j) * 0.9 + (j > 30) * (j - 30) * 0.5
        for xx in range(int(x - half), int(x + half) + 1):
            t = (xx - (x - half)) / (2 * half)
            col = R['wood'][3] if t < 0.25 else R['wood'][2] if t < 0.6 else R['wood'][1]
            if (xx + j // 2) % 5 == 0:
                col = R['wood'][0]
            cv.set(xx, y - j, INK if xx in (int(x - half), int(x + half)) else col)
    for rx_, ry_ in ((-9, 3), (10, 2), (-14, 5)):          # roots
        cv.rect(x + rx_, y + ry_ - 3, 6, 3, R['wood'][1])
    cv.blob([(x - 24, y - 50, 18), (x + 22, y - 52, 19), (x - 6, y - 70, 22), (x + 14, y - 78, 17),
             (x - 28, y - 68, 14), (x + 34, y - 66, 13), (x, y - 46, 16)], R['leaf'], outline=R['leaf'][0])
    for lx, ly in [(-20, -44), (16, -40), (-2, -30), (28, -50)]:     # lanterns in the boughs
        cv.set(x + lx, y + ly, R['gold'][3])
        cv.glow(x + lx, y + ly, 7, R['gold'][2], 0.5)


def windmill(cv: Canvas, x: int, y: int) -> None:
    cv.shadow(x + 6, y + 1, 10, 3, 0.65)
    for j in range(22):
        half = 4 + j * 0.16
        for xx in range(int(x - half), int(x + half) + 1):
            cv.set(xx, y - 21 + j, R['wall'][3] if xx < x - 1 else R['wall'][1])
    cv.rect(x - 1, y - 5, 3, 6, R['wood'][1])
    for j in range(6):
        for xx in range(x - 5 + j // 2, x + 6 - j // 2):
            cv.set(xx, y - 27 + j, R['roof'][3] if xx < x else R['roof'][1])
    for dx, dy in ((1, -1), (-1, 1), (1, 1), (-1, -1)):
        for k in range(2, 15):
            cv.set(x + dx * k, y - 20 + dy * k, R['wood'][0])
            if k > 4:
                cv.set(x + dx * k + (1 if dx * dy < 0 else 0), y - 20 + dy * k + (0 if dx * dy < 0 else 1), R['wall'][3])
    cv.set(x, y - 20, INK)


def standing_stones(cv: Canvas, x: int, y: int) -> None:
    for a in range(0, 360, 51):
        sx = int(x + 15 * math.cos(math.radians(a)))
        sy = int(y + 7 * math.sin(math.radians(a)))
        cv.shadow(sx + 2, sy + 1, 3, 1.2, 0.65)
        cv.box(sx - 1, sy - 8, 4, 9, R['rock'])
    cv.glow(x, y - 2, 10, R['purple'][3], 0.3)


def ruin(cv: Canvas, x: int, y: int) -> None:
    for i, hgt in enumerate((12, 7, 10, 4)):
        cv.box(x + i * 7, y - hgt, 4, hgt + 1, R['rock'])
    cv.rect(x - 2, y - 13, 12, 2, R['rock'][3])
    cv.outline_rect(x - 3, y - 14, 14, 4)
    for bx, by in ((x + 30, y - 1), (x + 12, y + 4)):
        boulder(cv, bx, by, 2.5)


def mine(cv: Canvas, x: int, y: int) -> None:
    cv.sprite(x - 6, y - 10, ['..oooooooo..', '.owwwwwwwwo.', 'owwoooooowwo'] + ['owwonnnnowwo'] * 7,
              {'o': INK, 'w': R['wood'][2], 'n': R['night'][0]})
    for k in range(7):                                       # rails out of the dark
        cv.set(x - 3 - k, y + k // 2, R['rock'][3])
        cv.set(x + 2 - k, y + 1 + k // 2, R['rock'][3])
    cv.box(x - 14, y + 1, 7, 5, R['wood'])                   # an ore cart
    cv.set(x - 12, y + 1, R['purple'][3])
    cv.set(x - 10, y + 1, R['gold'][3])


def pier(cv: Canvas, x: int, y: int) -> None:
    for k in range(16):
        cv.rect(x + k, y, 1, 4, R['wood'][3] if k % 3 else R['wood'][1])
    cv.outline_rect(x - 1, y - 1, 18, 6)
    bx, by = x + 22, y + 6                                   # a rowing boat
    cv.sprite(bx, by, ['o.......o', 'obbbbbbbo', '.obbbbbo.', '..ooooo..'], {'o': INK, 'b': R['wood'][2]})


def signpost(cv: Canvas, x: int, y: int) -> None:
    cv.rect(x, y - 8, 1, 9, R['wood'][0])
    cv.rect(x - 4, y - 9, 9, 3, R['wood'][3])
    cv.outline_rect(x - 5, y - 10, 11, 5)


def sheep(cv: Canvas, x: int, y: int) -> None:
    cv.blob([(x, y - 2, 2.4), (x + 2, y - 2, 2.2)], R['wall'], outline=None)
    cv.set(x + 4, y - 3, INK)
    cv.set(x - 1, y, INK)
    cv.set(x + 2, y, INK)


def hay(cv: Canvas, x: int, y: int) -> None:
    cv.blob([(x, y - 2, 3)], [R['gold'][0], R['gold'][1], R['gold'][2], R['gold'][3]])


def field(cv: Canvas, x: int, y: int, w: int, h: int, ramp, clear: Clear) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if not clear(xx, yy):
                cv.set(xx, yy, ramp[2] if (xx + yy // 2) % 3 else ramp[1] if yy % 2 else ramp[3])


def scatter_land(cv: Canvas, rng: random.Random, biome, names: tuple[str, ...], count: int, stamp,
                 clear: Clear, box=(8, 150, MW - 8, MH - 4), gap: tuple[int, int] = (7, 6)) -> list:
    """Scatter `count` stamps over the ground of the named biomes, away from
    everything `clear` protects. Returns (y, x, stamp) for y-sorted painting."""
    pts: list[tuple[int, int]] = []
    tries = 0
    while len(pts) < count and tries < count * 80:
        tries += 1
        x, y = rng.randrange(box[0], box[2]), rng.randrange(box[1], box[3])
        if biome[y][x] not in names or clear(x, y):
            continue
        if any(abs(x - px_) < gap[0] and abs(y - py_) < gap[1] for px_, py_ in pts):
            continue
        pts.append((x, y))
    return [(y, x, stamp) for x, y in pts]



# ─── Heroes sprite ───────────────────────────────────────────────────────────

HERO = [
    '...oooooo...',
    '..oHHHHHHo..',
    '.oHHhhhhHHo.',
    '.oHhhhhhhHo.',
    '.oHssssssHo.',
    '.ossesseso..',
    '.ossesseso..',
    '..osssssso..',
    '..oBBBBBBo..',
    '...oBmmBo...',
    '..ooccccoo..',
    '.occCCCCcco.',
    'ossccCCccsso',
    'ossccCCccsso',
    '.o.ccccccoo.',
    '..obbbbbbo..',
    '..obbo.obbo.',
    '..obbo.obbo.',
    '..oooo.oooo.',
]


def build_heroes() -> tuple[Image.Image, int, int]:
    """Erich (beard, blue), Garrett (clean-shaven, red), Nick (glasses, green)."""
    looks = [
        ('jblue', 'beard', None),
        ('jred', 'shaven', None),
        ('jgreen', 'shaven', 'glasses'),
    ]
    hw, hh = len(HERO[0]), len(HERO)
    gap = 2
    img = Image.new('RGBA', (hw * 3 + gap * 2, hh), (0, 0, 0, 0))
    px = img.load()
    for n, (shirt, face, extra) in enumerate(looks):
        beard = HAIR[1] if face == 'beard' else SKIN[1]
        key = {
            'o': INK, 'H': HAIR[0], 'h': HAIR[2], 's': SKIN[2], 'e': INK,
            'B': beard, 'm': HAIR[0] if face == 'beard' else SKIN[0],
            'c': R[shirt][1], 'C': R[shirt][2], 'b': R['wood'][1],
        }
        ox = n * (hw + gap)
        for j, row in enumerate(HERO):
            for i, ch in enumerate(row):
                if ch != '.':
                    px[ox + i, j] = key[ch] + (255,)
        if extra == 'glasses':
            for i in range(2, 10):
                px[ox + i, 5] = INK + (255,)
            px[ox + 4, 6] = (150, 200, 240, 255)
            px[ox + 7, 6] = (150, 200, 240, 255)
    return img.resize((img.width * SCALE, img.height * SCALE), Image.NEAREST), img.width * SCALE, img.height * SCALE


# ─── Build ───────────────────────────────────────────────────────────────────

# Ground each region painter may scatter its own props over (outside its
# landmark): cacti stay in the desert, dead trees in the marsh.
SCATTER_ON = {
    'jake-classic': ('forest', 'farm', 'meadow'),
    'the-spreading': ('farm', 'meadow', 'forest'),
    'justins-schism': ('meadow', 'farm'),
    'super-tens': ('ash',),
    'the-pass': ('desert', 'red'),
    'chaos-shed': ('desert',),
    'second-schism': ('marsh',),
    'the-council': ('high',),
}


def inside(box, x: int, y: int) -> bool:
    return box[0] <= x <= box[2] and box[1] <= y <= box[3]


def build() -> None:
    rng = random.Random(1987)  # fixed seed: same map every run
    cv = Canvas(MW, MH)
    biome = paint_ground(cv)
    horizon = 118
    paint_sky(cv, rng, horizon)

    taken = Mask()             # where filler may not go
    taken.box(0, 0, MW, horizon + 6)

    river = paint_water(cv)
    taken.near(river, 9)
    cx, cy, rx, ry = LAKE
    taken.box(cx - rx - 6, cy - ry - 6, cx + rx + 6, cy + ry + 6)
    canyon = paint_canyon(cv)
    taken.near(canyon, 29)
    paint_plateau(cv)
    px_, py_, prx, pry, face = PLATEAU
    taken.box(px_ - prx - 4, py_ - pry - 4, px_ + prx + 4, py_ + pry + face + 6)
    pool_x, pool_y = paint_waterfall(cv, 372)
    taken.box(pool_x - 19, pool_y - 34, pool_x + 19, pool_y + 10)

    # mountains, back to front: the wall across the north with cloud between
    # its rows, the great peak and its shoulders, then the lower ranges
    peaks: list[tuple[int, int, int, int, int]] = []        # base, cx, h, w, seed
    for i, x in enumerate(range(-6, MW + 20, 20)):
        peaks.append((120 + rng.randrange(0, 10), x + rng.randrange(-5, 6), rng.randrange(58, 92),
                      rng.randrange(34, 48), i))
    front: list[tuple[int, int, int, int, int]] = []
    for i, x in enumerate(range(4, 410, 26)):
        low = 134 if 70 < x < 240 else 146                   # the road runs under these
        front.append((low - rng.randrange(0, 8), x + rng.randrange(-6, 7), rng.randrange(44, 70),
                      rng.randrange(28, 40), 40 + i))
    for base, x, h, w_, seed in sorted(peaks):
        if abs(x - TOWER[0]) < 30:
            continue                 # a gap in the wall: the tower's top stands against the night
        peak(cv, x, base, h, w_, seed=seed)
    clouds(cv, rng, 70, -10, MW + 10, 108, 5)
    for base, x, h, w_, seed in sorted(front):
        peak(cv, x, base, h, w_, seed=seed)
        taken.box(x - w_, base - h // 2, x + w_, base + 3)
    for x, base, h, w_, seed in [(418, 222, 64, 42, 71), (566, 256, 92, 52, 72)]:
        peak(cv, x, base, h, w_, seed=seed)
        taken.box(x - w_, base - h, x + w_, base + 3)
    peak(cv, TOWER[0], 300, 150, 118, snow=0.46, seed=73)
    taken.box(TOWER[0] - 118, 150, MW, 304)
    paint_tower(cv, *TOWER)
    hills = [(432, 366, 36, 24, 74), (560, 344, 44, 30, 75), (478, 348, 30, 22, 76), (30, 336, 32, 22, 77),
             (62, 346, 24, 18, 78), (12, 356, 22, 16, 79), (236, 330, 26, 20, 80)]
    for x, base, h, w_, seed in sorted(hills, key=lambda p: p[1]):
        peak(cv, x, base, h, w_, snow=0.0 if h < 34 else 0.3, seed=seed)
        taken.box(x - w_, base - h, x + w_, base + 3)
    paint_volcano(cv, rng)
    vx, vbase, vh, vw = VOLCANO
    taken.box(vx - vw - 4, vbase - vh, vx + vw + 4, vbase + 4)

    # the road and its spurs, under everything that stands beside them
    road = [spline(seg) for seg in ROAD]
    spurs = [spline(seg) for seg in SPURS]
    for pts in spurs:
        paint_spur(cv, pts)
        taken.near(pts, 6)
    paint_road(cv, [p for pts in road for p in pts])     # one pass, so joins don't show
    for pts in road:
        taken.near(pts, 11)
    for x, y in NODES.values():
        taken.box(x - 20, y - 20, x + 20, y + 22)
    for a, b in BRIDGES:
        paint_bridge(cv, a, b)
    great = (0, 508, 96, 612)                               # the elder tree's ground

    def clear_for(owner: str | None) -> Clear:
        def clear(x: int, y: int) -> bool:
            if taken(x, y) or inside(great, x, y):
                return True
            return any(pid != owner and inside(box, x, y) for pid, box in RESERVED.items())
        return clear

    # each table's landmark, painted by its region painter through a View
    placed: dict[str, dict] = {}
    for pid, painter in REGIONS:
        side, ox, oy = TILES[pid]
        world_clear = clear_for(pid)
        own, on = RESERVED[pid], SCATTER_ON[pid]

        def clear(x: int, y: int, ox=ox, oy=oy, world_clear=world_clear, own=own, on=on) -> bool:
            wx, wy = x + ox, y + oy
            if world_clear(wx, wy):
                return True
            return not inside(own, wx, wy) and biome[wy][wx] not in on

        painter(View(cv, ox, oy), 0, side, rng, clear)
        x, y = NODES[pid]
        placed[pid] = {'x': x * SCALE, 'y': y * SCALE}

    # filler, painted back to front so nearer things overlap farther ones
    clear = clear_for(None)
    stamps: list = []
    add = lambda names, count, stamp, **kw: stamps.extend(
        scatter_land(cv, rng, biome, names, count, stamp, clear, **kw))
    add(('forest',), 300, lambda x, y: (pine if (x * 7 + y) % 3 == 0 else tree)(cv, x, y, 0.9 + (x % 4) * 0.1))
    add(('farm',), 26, lambda x, y: tree(cv, x, y))
    add(('farm', 'meadow'), 44, lambda x, y: bush(cv, x, y))
    add(('meadow',), 60, lambda x, y: tree(cv, x, y, 0.9 + (x % 3) * 0.1))
    add(('farm', 'meadow'), 150,
        lambda x, y: flower(cv, x, y, [WHITE, (250, 220, 80), (240, 120, 160), (150, 190, 250)][x % 4]), gap=(3, 3))
    add(('high',), 120, lambda x, y: pine(cv, x, y, 0.8 + (x % 3) * 0.12))
    add(('high',), 30, lambda x, y: boulder(cv, x, y, 2.5 + (x % 3)))
    add(('snow',), 46, lambda x, y: pine(cv, x, y, 0.75 + (x % 3) * 0.1))
    add(('snow',), 16, lambda x, y: boulder(cv, x, y, 3))
    add(('marsh',), 90, lambda x, y: dead_tree(cv, x, y))
    add(('marsh',), 16, lambda x, y: bog(cv, x, y, 7 + x % 5, 3 + x % 2), gap=(22, 10))
    add(('marsh',), 30, lambda x, y: reeds(cv, x, y))
    add(('desert',), 18, lambda x, y: cactus(cv, x, y, 0.8 + (x % 3) * 0.15), gap=(18, 12))
    add(('desert', 'red'), 26, lambda x, y: boulder(cv, x, y, 2.5 + (x % 2)))
    add(('red',), 9, lambda x, y: mesa(cv, x, y, 20 + x % 10, 14 + y % 10), gap=(30, 22))
    add(('red',), 6, lambda x, y: cactus(cv, x, y, 0.8), gap=(18, 12))
    add(('ash',), 40, lambda x, y: boulder(cv, x, y, 2.5 + (x % 3)))
    add(('ash',), 6, lambda x, y: lava_pool(cv, x, y, 4 + x % 3), gap=(26, 16))
    for x, y, stamp in [
        (44, 604, great_tree), (286, 702, windmill), (540, 716, standing_stones), (6, 204, ruin),
        (566, 502, mine), (116, 346, pier),
        (58, 678, signpost), (150, 404, signpost), (470, 452, signpost), (414, 252, signpost),
        (470, 208, crystal), (420, 232, crystal), (530, 262, crystal), (384, 178, crystal),
        (250, 160, crystal), (152, 134, crystal), (546, 196, crystal),
        (250, 690, sheep), (232, 706, sheep), (262, 716, sheep), (306, 716, sheep), (220, 684, sheep),
        (244, 566, hay), (252, 592, hay), (278, 584, hay),
        (24, 626, wisp), (70, 596, wisp), (132, 600, wisp), (30, 680, wisp), (150, 690, wisp),
        (110, 560, wisp), (64, 720, wisp), (16, 560, wisp),
    ]:
        stamps.append((y, x, lambda x, y, stamp=stamp: stamp(cv, x, y)))
    field(cv, 236, 548, 36, 18, R['gold'], clear)
    field(cv, 240, 574, 30, 14, R['grass'][1:] , clear)
    for y, x, stamp in sorted(stamps, key=lambda s: s[0]):
        stamp(x, y)
    paint_machinery(cv, clear)

    # cloud round the great peak, below the tower and clear of the path up
    on_path = Mask()
    for pts in road:
        on_path.near(pts, 14)
    clouds(cv, rng, 46, 404, MW + 6, 226, 9, keep=lambda x, y: on_path(int(x), int(y)))
    for x, y in NODES.values():
        node_pad(cv, x, y)

    out_dir = ROOT / 'assets' / 'map'
    out_dir.mkdir(parents=True, exist_ok=True)
    cv.img.resize((MW * SCALE, MH * SCALE), Image.NEAREST).save(out_dir / 'overworld.png', optimize=True)
    heroes, hw, hh = build_heroes()
    heroes.save(out_dir / 'heroes.png', optimize=True)

    # Ending cutscene art (src/campaign/story.ts, ENDING_ID): the tower on
    # its peak above the cloud, and the tower up close.
    story_dir = ROOT / 'assets' / 'story'
    tx, ty = TOWER
    crops = {
        'ending-north.png': (MW - W, ty - 144, MW, ty - 4),            # the tower among the peaks
        'ending-tower.png': (tx - 48, ty - 116, tx + 48, ty - 62),      # tower, window, quill
    }
    for name, box in crops.items():
        part = cv.img.crop(box)
        part.resize((part.width * SCALE * 2, part.height * SCALE * 2), Image.NEAREST).save(
            story_dir / name, optimize=True)

    meta = {
        '//': 'Generated by scripts/map/build_overworld.py. Do not edit by hand.',
        'width': MW * SCALE,
        'height': MH * SCALE,
        # How many map pixels span a phone's width: the map is wider than
        # the screen and pans, at the scale the landmarks were painted for.
        'viewWidth': W * SCALE,
        'heroes': {'width': hw, 'height': hh},
        # Chris's tower (scenery): the map makes it tappable once every
        # node is beaten, to rewatch the ending.
        'tower': {'x': tx * SCALE, 'y': (ty - 54) * SCALE, 'width': 34 * SCALE, 'height': 112 * SCALE},
        'order': [pid for pid, _ in REGIONS],
        'nodes': placed,
    }
    (ROOT / 'src' / 'campaign' / 'overworld.json').write_text(json.dumps(meta, indent=2) + '\n')
    print(f'overworld {MW * SCALE}x{MH * SCALE}, {len(REGIONS)} nodes')


if __name__ == '__main__':
    build()
