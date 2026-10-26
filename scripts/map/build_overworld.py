"""
Build the campaign overworld: a 16-bit, Super Mario World-style map.

    python3 scripts/map/build_overworld.py

Writes:
    assets/map/overworld.png     the painted map (pixel art, pre-scaled by SCALE)
    assets/map/heroes.png        the three disciples as one small sprite
    assets/story/ending-*.png    two crops of the north (fog, tower) used by
                                 the campaign's ending cutscene
    src/campaign/overworld.json  map size, hero sprite size and each node's
                                 position, keyed by preset id; read by
                                 app/campaign.tsx

The map climbs from the bottom (the first node) to the top. Each node owns a
horizontal band of land painted in its own theme; above the last band sits
a fog bank, and above that, Chris's tower in the clouds (scenery, not a
node).

Style: 16-bit. Every material has a shade ramp (dark → light) and shapes are
lit from the upper left, outlined, and cast a soft shadow down-right.

To add a node: write a painter for it below, add it to REGIONS in ladder
order (the order must match PRESET_ORDER in src/campaign/presets.ts; a test
checks this), then re-run this script. Output is deterministic (fixed seed).

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

W = 192           # map width in art pixels
BAND = 128        # height of one node's region, in art pixels
TOP = 168         # sky, fog bank and Chris's tower above the last region
BOTTOM = 20       # shore and sea below the first region
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
# Each paints the band [y0, y0+BAND) and returns the node position (x, y) in
# art pixels. `side` is where the node sits; landmarks go on the other side.
# `clear(x, y)` says whether (x, y) is too near the road or a node to decorate.

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


def paint_chaos(cv: Canvas, y0: int, side: str, rng: random.Random, clear: Clear) -> tuple[int, int]:
    """Gio and Tati's carnival: a striped big top, a checker plaza, balloons."""
    nx, ny = NODE_X[side], y0 + BAND // 2
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
    scatter(rng, y0 + 4, y0 + BAND - 4, 12, lambda x, y: bush(cv, x, y), off_plaza)
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
    ('chaos-shed', paint_chaos),
    ('second-schism', paint_second_schism),
    ('the-council', paint_council),
]


# ─── Terrain: island, beach, foam, shore cliff ───────────────────────────────

def coast(y: int) -> tuple[int, int]:
    """Left and right edges of the land on row y."""
    left = 10 + 6 * math.sin(y / 26) + 3 * math.sin(y / 8.3) + 2 * noise(0, y, 6, 11)
    right = W - (10 + 6 * math.sin(y / 34 + 2) + 3 * math.sin(y / 9.4) + 2 * noise(1, y, 6, 12))
    return int(left), int(right)


def paint_land(cv: Canvas, rng: random.Random) -> None:
    land_top, land_bottom = TOP - 8, cv.h - BOTTOM
    for y in range(cv.h):
        lft, rgt = coast(y)
        for x in range(cv.w):
            inland = land_top <= y < land_bottom and lft <= x < rgt
            if inland:
                d_edge = min(x - lft, rgt - 1 - x)
                if d_edge < 3:
                    cv.set(x, y, R['sand'][3] if d_edge else R['sand'][2])
                    continue
                v = 0.35 + 0.3 * noise(x, y, 9, 1) + 0.15 * noise(x, y, 3, 2)
                cv.set(x, y, shade(R['grass'][1:4], v))
            else:
                # water: shallow and light near the land, deep further out
                d = min(abs(x - lft), abs(x - rgt), abs(y - land_bottom) if y >= land_bottom else 99)
                if y < land_bottom and lft <= x < rgt:
                    d = 99
                v = 0.85 - min(d, 16) / 22 + 0.1 * noise(x, y, 5, 6)
                cv.set(x, y, shade(R['water'][:4], v))
                if d == 1 or (d == 2 and (x + y) % 3 == 0):
                    cv.set(x, y, R['water'][4])   # foam
    # grass detail: tufts and dark speckle
    for _ in range(cv.w * cv.h // 40):
        x, y = rng.randrange(cv.w), rng.randrange(land_top, land_bottom)
        if cv.get(x, y) in R['grass'][1:4] and cv.get(x, y - 1) in R['grass'][1:4]:
            if rng.random() < 0.5:
                cv.set(x, y, R['grass'][4])
                cv.set(x - 1, y + 1, R['grass'][1])
                cv.set(x + 1, y + 1, R['grass'][1])
            else:
                cv.set(x, y, R['grass'][1])
    # shore cliff along the bottom: the island stands above the sea
    for x in range(cv.w):
        lft, rgt = coast(land_bottom)
        if not (lft <= x < rgt):
            continue
        for d in range(7):
            band = (x // 6 + d) % 3 == 0
            col = R['cliff'][1] if band else R['cliff'][3] if d < 2 else R['cliff'][2]
            cv.set(x, land_bottom + d, mix(col, R['cliff'][0], d / 9))
        cv.set(x, land_bottom + 7, R['water'][4])
    # glints on the open sea
    for _ in range(cv.w * cv.h // 260):
        x, y = rng.randrange(cv.w), rng.randrange(cv.h)
        if cv.get(x, y) in R['water'][:3] and cv.get(x + 2, y) in R['water'][:3]:
            cv.set(x, y, R['water'][3])
            cv.set(x + 1, y, R['water'][4])
            cv.set(x + 2, y, R['water'][3])


def paint_sky(cv: Canvas, rng: random.Random) -> None:
    """Night sky over the unexplored north, Chris's tower rising from the fog."""
    for y in range(TOP):
        t = y / TOP
        base = mix(R['night'][1], R['fog'][0], t ** 0.8)
        for x in range(cv.w):
            # banded dither between gradient steps
            c = mix(base, R['night'][2], 0.25) if (x + y * 2) % 7 == 0 and t < 0.6 else base
            cv.set(x, y, c)
    for _ in range(60):
        x, y = rng.randrange(cv.w), rng.randrange(TOP // 2)
        cv.set(x, y, WHITE if rng.random() < 0.3 else R['fog'][3])
    # moon
    cv.blob([(30, 22, 7)], [(170, 170, 150), (210, 208, 184), (238, 236, 214), (252, 250, 236)])
    # tower: brick shaft narrowing upward, lit windows, a quill on top
    cx, base = W // 2, 118
    for y in range(36, base):
        half = 9 + (y - 36) * 0.09
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
    for y in range(22, 37):     # roof cone
        half = (y - 22) * 0.75
        for x in range(int(cx - half), int(cx + half) + 1):
            cv.set(x, y, R['purple'][2] if x < cx else R['purple'][1])
    for wy in (48, 66, 84, 100):
        cv.rect(cx - 2, wy, 4, 6, INK)
        cv.rect(cx - 1, wy + 1, 2, 4, R['gold'][3] if wy != 66 else R['gold'][2])
        cv.glow(cx, wy + 3, 9, R['gold'][2], 0.3)
    # the quill
    for i in range(12):
        x, y = cx + 1 + i // 2, 21 - i
        cv.set(x, y, R['wall'][3])
        cv.set(x - 1, y, R['wall'][1] if i > 2 else R['gold'][2])
    cv.rect(cx, 19, 1, 4, R['gold'][1])
    # rolling fog: shaded cloud puffs, densest where the land begins
    puffs = []
    for _ in range(170):
        y = TOP - 2 - abs(rng.gauss(0, 26))
        x = rng.uniform(-8, cv.w + 8)
        if y < 70 and abs(x - cx) < 16:
            continue      # keep the tower clear
        puffs.append((x, y, rng.uniform(5, 11)))
    for x, y, r in sorted(puffs, key=lambda p: p[1]):
        cv.blob([(x, y, r), (x + r * 0.8, y + 1, r * 0.75)], R['fog'], outline=None)
    for x in range(cv.w):
        for y in range(TOP - 10, TOP + 2):
            if noise(x, y, 4, 13) > 0.25 or y > TOP - 4:
                cv.set(x, y, R['fog'][2] if (x + y) % 5 else R['fog'][3])


# ─── Road and node pads ──────────────────────────────────────────────────────

def road_points(nodes: list[tuple[int, int]]) -> list[tuple[float, float]]:
    """A winding road through every node, bottom to top, then into the fog."""
    pts: list[tuple[float, float]] = []
    chain = [(nodes[0][0], nodes[0][1] + 30)] + nodes + [(W // 2, TOP - 14)]
    for (x0, y0), (x1, y1) in zip(chain, chain[1:]):
        steps = int(abs(y1 - y0) + abs(x1 - x0)) * 2
        for i in range(steps):
            t = i / steps
            e = t * t * (3 - 2 * t)
            pts.append((x0 + (x1 - x0) * e, y0 + (y1 - y0) * t))
    return pts


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


def near_road(pts, nodes) -> Clear:
    road = set()
    for x, y in pts:
        for dx in range(-11, 12):
            for dy in range(-11, 12):
                road.add((int(x) + dx, int(y) + dy))

    def clear(x: int, y: int) -> bool:
        if (x, y) in road:
            return True
        return any((x - nx) ** 2 + (y - ny) ** 2 < 22 ** 2 for nx, ny in nodes)
    return clear


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

def build() -> None:
    rng = random.Random(1987)  # fixed seed: same map every run
    h = TOP + BAND * len(REGIONS) + BOTTOM
    cv = Canvas(W, h)
    paint_land(cv, rng)

    nodes: list[tuple[int, int]] = []
    sides: list[str] = []
    for i, _ in enumerate(REGIONS):
        y0 = h - BOTTOM - BAND * (i + 1)
        side = 'left' if i % 2 == 0 else 'right'
        sides.append(side)
        nodes.append((NODE_X[side], y0 + BAND // 2))
    pts = road_points(nodes)
    clear = near_road(pts, nodes)

    paint_road(cv, pts)          # under everything placed beside it
    placed: dict[str, dict] = {}
    for i, (pid, painter) in enumerate(REGIONS):
        y0 = h - BOTTOM - BAND * (i + 1)
        x, y = painter(cv, y0, sides[i], rng, clear)
        placed[pid] = {'x': x * SCALE, 'y': y * SCALE, 'side': sides[i]}
    paint_road(cv, pts)          # repaint so props never sit on the road
    paint_sky(cv, rng)
    for x, y in nodes:
        node_pad(cv, x, y)

    out_dir = ROOT / 'assets' / 'map'
    out_dir.mkdir(parents=True, exist_ok=True)
    cv.img.resize((W * SCALE, h * SCALE), Image.NEAREST).save(out_dir / 'overworld.png', optimize=True)
    heroes, hw, hh = build_heroes()
    heroes.save(out_dir / 'heroes.png', optimize=True)

    # Ending cutscene art (src/campaign/story.ts, ENDING_ID): the fog line
    # seen from the last node, and the tower up close. Both crops sit above
    # the top node, so no node pad shows in them.
    story_dir = ROOT / 'assets' / 'story'
    crops = {
        'ending-north.png': (0, 6, W, 6 + 140),               # moon, tower, fog bank
        'ending-tower.png': (W // 2 - 48, 8, W // 2 + 48, 8 + 54),  # tower, window, quill
    }
    for name, box in crops.items():
        part = cv.img.crop(box)
        part.resize((part.width * SCALE * 2, part.height * SCALE * 2), Image.NEAREST).save(
            story_dir / name, optimize=True)

    meta = {
        '//': 'Generated by scripts/map/build_overworld.py. Do not edit by hand.',
        'width': W * SCALE,
        'height': h * SCALE,
        'heroes': {'width': hw, 'height': hh},
        # Chris's tower (scenery): the map makes it tappable once every
        # node is beaten, to rewatch the ending.
        'tower': {'x': (W // 2) * SCALE, 'y': 72 * SCALE, 'width': 30 * SCALE, 'height': 104 * SCALE},
        'order': [pid for pid, _ in REGIONS],
        'nodes': placed,
    }
    (ROOT / 'src' / 'campaign' / 'overworld.json').write_text(json.dumps(meta, indent=2) + '\n')
    print(f'overworld {W * SCALE}x{h * SCALE}, {len(REGIONS)} nodes')


if __name__ == '__main__':
    build()
