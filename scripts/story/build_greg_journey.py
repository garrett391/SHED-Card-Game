"""
Story art for the road to Greg's table (the Super Tens cutscene).

    python3 scripts/story/build_greg_journey.py

Writes:
    assets/story/greg-journey1.png  the disciples walking as the land turns
                                    from forest to machine
    assets/story/greg-journey2.png  robot peasants working fields of wire

Same 16-bit style and palette as the campaign map: it borrows the map
script's palette and drawing helpers. Output is deterministic (fixed seed).
Requires Pillow (pip install pillow).
"""
from __future__ import annotations

import math
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts' / 'map'))

from build_overworld import (  # noqa: E402
    HAIR, HERO, INK, R, SKIN, WHITE, Canvas, bush, mix, noise, shade, tree,
)

W, H = 256, 144
SCALE = 5

METAL = [(46, 52, 62), (72, 80, 92), (104, 112, 124), (146, 154, 166), (196, 202, 212)]
RUST = [(92, 46, 26), (146, 76, 38), (196, 112, 54), (232, 156, 88)]
STRAW = [(140, 104, 40), (196, 156, 66), (236, 204, 110)]
GLOW = R['screen']


def tech_amount(x: float) -> float:
    """0 = untouched nature (left) … 1 = all machine (right)."""
    t = (x - 70) / 130
    return max(0.0, min(1.0, t))


# ─── Pieces ──────────────────────────────────────────────────────────────────

def sky(cv: Canvas, horizon: int) -> None:
    for y in range(horizon):
        for x in range(W):
            t = tech_amount(x)
            day = mix(R['water'][3], R['water'][4], y / horizon)
            smog = mix((112, 124, 120), (168, 178, 170), y / horizon)
            c = mix(day, smog, t)
            if t > 0.4 and (x * 3 + y * 7) % 11 == 0:
                c = mix(c, (96, 110, 104), 0.5)     # smog dither
            cv.set(x, y, c)
    # sun on the left, a sickly green glow on the right
    cv.blob([(34, 22, 9)], [(250, 220, 120), (252, 236, 160), (255, 246, 200), (255, 252, 230)], outline=None)
    cv.glow(220, horizon - 6, 60, GLOW[2], 0.22)
    # clouds left, smoke right
    for cx, cy, r in [(70, 18, 6), (80, 15, 7), (92, 19, 5), (128, 28, 5), (136, 26, 6)]:
        cv.blob([(cx, cy, r)], R['fog'][1:], outline=None)


def horizon_line(cv: Canvas, horizon: int, rng: random.Random) -> None:
    # rolling green hills on the left
    for x in range(W):
        t = tech_amount(x)
        h = int(8 + 5 * math.sin(x / 17) + 3 * math.sin(x / 7))
        for y in range(horizon - h, horizon + 1):
            if t < 0.6:
                c = shade(R['grass'][1:4], 0.4 + 0.3 * noise(x, y, 6, 7))
                cv.set(x, y, mix(c, (120, 140, 130), 0.25 + t * 0.5))
    # factory skyline on the right: towers, chimneys, antennas, blinking lights
    for bx, bw, bh in [(150, 10, 26), (163, 7, 18), (172, 14, 34), (189, 9, 22), (200, 16, 40),
                       (219, 8, 24), (229, 12, 30), (243, 13, 20)]:
        for y in range(horizon - bh, horizon + 1):
            for x in range(bx, bx + bw):
                t = (x - bx) / bw
                c = METAL[1] if t > 0.6 else METAL[2]
                if (y - horizon) % 5 == 0 and 0.2 < t < 0.8:
                    c = GLOW[2] if (x + y) % 3 else METAL[0]   # lit windows
                cv.set(x, y, mix(c, (130, 142, 136), 0.35))
        cv.set(bx + bw // 2, horizon - bh - 1, METAL[1])
        cv.set(bx + bw // 2, horizon - bh - 2, (240, 70, 60))
    for sx in (178, 206, 234):                       # smokestacks
        cv.rect(sx, horizon - 52, 4, 20, mix(METAL[1], (130, 142, 136), 0.3))
        for k, (ox, oy, r) in enumerate([(2, -56, 3), (5, -61, 4), (9, -67, 5), (14, -72, 5)]):
            cv.blob([(sx + ox, horizon + oy, r)], [(86, 92, 90), (110, 116, 112), (136, 142, 138), (160, 166, 160)],
                    outline=None)


def ground(cv: Canvas, horizon: int) -> None:
    for y in range(horizon, H):
        for x in range(W):
            t = tech_amount(x + (y - horizon) * 0.35)   # the boundary leans
            grass = shade(R['grass'][1:4], 0.35 + 0.35 * noise(x, y, 7, 1) + 0.12 * noise(x, y, 2, 2))
            plate_seam = (x % 16 == 0) or ((y - horizon) % 10 == 0)
            plate = METAL[1] if plate_seam else (METAL[3] if (x % 16 < 2 or (y - horizon) % 10 < 1) else METAL[2])
            # creeping circuitry: grass gives way through a dither band
            edge = noise(x, y, 4, 5)
            if t <= 0.0 or edge > t * 1.4:
                c = grass
            else:
                c = plate
            cv.set(x, y, c)
    # glowing traces running through the plates and creeping into the grass
    rng = random.Random(7)
    for _ in range(26):
        x = rng.randrange(110, W)
        y = rng.randrange(horizon + 4, H)
        length = rng.randrange(10, 40)
        horiz = rng.random() < 0.6
        for i in range(length):
            px, py = (x - i, y) if horiz else (x, y + i)
            if not (0 <= px < W and horizon < py < H):
                break
            if tech_amount(px) <= 0.02 and rng.random() < 0.6:
                break
            cv.set(px, py, GLOW[2] if i % 6 else GLOW[3])
        cv.disc(x, y, 1.2, GLOW[3])


def road(cv: Canvas) -> list[tuple[float, float]]:
    """From the bottom left, winding up toward the machine land."""
    pts = []
    for i in range(400):
        t = i / 399
        x = -6 + t * 250
        y = 132 - t * 52 + 7 * math.sin(t * 5.2)
        pts.append((x, y))
    for x, y in pts:
        w = 7 - 3 * (x / W)
        tech = tech_amount(x)
        edge = mix(R['sand'][0], METAL[0], tech)
        cv.disc(x, y + 1, w + 1, edge)
    for x, y in pts:
        w = 7 - 3 * (x / W)
        tech = tech_amount(x)
        dirt = R['sand'][2]
        walk = METAL[3]
        cv.disc(x, y, w, mix(dirt, walk, tech))
    # walkway stripes where the road becomes metal
    for i, (x, y) in enumerate(pts[::6]):
        if tech_amount(x) > 0.6:
            cv.set(int(x), int(y), (236, 200, 60))
    return pts


def wired_tree(cv: Canvas, x: int, y: int) -> None:
    """A tree half taken over: a cable wound up the trunk, a blinking bulb."""
    tree(cv, x, y, 1.0)
    for i in range(6):
        cv.set(x - 1 + (i % 2) * 2, y - i, INK)
    cv.set(x + 4, y - 15, (240, 70, 60))
    cv.set(x + 4, y - 14, INK)


def pylon(cv: Canvas, x: int, y: int, h: int = 30) -> None:
    for j in range(h):
        half = 1 + (h - j) * 0.18
        cv.set(int(x - half), y - j, METAL[0])
        cv.set(int(x + half), y - j, METAL[0])
        if j % 5 == 0:
            for xx in range(int(x - half), int(x + half) + 1):
                cv.set(xx, y - j, METAL[1])
    cv.rect(x - 6, y - h, 13, 1, METAL[0])


ROBOT = [
    '....a.....',
    '....r.....',
    '..sssss...',
    '.SSSSSSS..',
    'sssssssss.',
    '..hhhhh...',
    '.hHHHHHh..',
    '.hveeevh..',
    '.hvvvvvh..',
    '..hhhhh...',
    '...nnn....',
    '.bbbbbbb..',
    'aBbqqqbBa.',
    'a.bqqqb.a.',
    '..bbbbb...',
    '..bb.bb...',
    '..ll.ll...',
    '.LLL.LLL..',
]
ROBOT_W = 10


def robot(cv: Canvas, x: int, y: int, body, tool: str | None = None, flip: bool = False,
          s: int = 1) -> None:
    """Robot peasant in a straw hat and overalls; (x, y) is between its feet.
    `s` scales every pixel to an s×s block."""
    def put(i: int, j: int, col) -> None:
        ii = (ROBOT_W - 1 - i) if flip else i
        for dy in range(s):
            for dx in range(s):
                cv.set(x + (ii - ROBOT_W // 2) * s + dx, y - (len(ROBOT) - j) * s + dy, col)

    cv.shadow(x + 2 * s, y + s, 6 * s, 1.6 * s, 0.62)
    key = {'a': METAL[0], 'r': (240, 70, 60), 's': STRAW[1], 'S': STRAW[2],
           'h': METAL[2], 'H': METAL[4], 'v': INK, 'e': GLOW[3], 'n': METAL[1],
           'b': body[1], 'B': body[2], 'q': body[0], 'l': METAL[1], 'L': METAL[0]}
    for j, row in enumerate(ROBOT):
        for i, ch in enumerate(row):
            if ch != '.':
                put(i, j, key[ch])
    if tool == 'hoe':
        for k in range(14):
            put(9 + k // 5, 6 + k, R['wood'][1])
        for k in range(3):
            put(10 + k, 19, METAL[3])
    if tool == 'basket':
        for j in range(4):
            for i in range(5):
                put(7 + i, 11 + j, STRAW[0] if j else STRAW[2])
        for i, c in enumerate([METAL[3], GLOW[2], METAL[4]]):
            put(8 + i, 10, c)


def wire_crop_rows(cv: Canvas, x0: int, y0: int, w: int, h: int, step: int = 7) -> None:
    """A field of cable sprouts with LED buds, in dark furrows."""
    for row in range(0, h, step):
        for x in range(x0, x0 + w):
            cv.set(x, y0 + row + 2, R['cliff'][0])     # furrow
            cv.set(x, y0 + row + 3, R['cliff'][1])
        for x in range(x0 + 2, x0 + w - 1, 5):
            cv.set(x, y0 + row + 1, INK)
            cv.set(x, y0 + row, INK)
            cv.set(x - 1, y0 + row - 1, GLOW[2])
            cv.set(x + 1, y0 + row - 1, GLOW[2])
            cv.set(x, y0 + row - 2, GLOW[3] if (x + row) % 3 else (240, 120, 200))


def heroes(cv: Canvas, positions: list[tuple[int, int]]) -> None:
    """Erich (blue, beard), Garrett (red), Nick (green, glasses), as on the map."""
    looks = [('jblue', 'beard', False), ('jred', 'shaven', False), ('jgreen', 'shaven', True)]
    for (x, y), (shirt, face, glasses) in zip(positions, looks):
        beard = HAIR[1] if face == 'beard' else SKIN[1]
        key = {'o': INK, 'H': HAIR[0], 'h': HAIR[2], 's': SKIN[2], 'e': INK, 'B': beard,
               'm': HAIR[0] if face == 'beard' else SKIN[0], 'c': R[shirt][1], 'C': R[shirt][2],
               'b': R['wood'][1]}
        cv.shadow(x + 7, y + len(HERO), 6, 1.6, 0.6)
        for j, row in enumerate(HERO):
            for i, ch in enumerate(row):
                if ch != '.':
                    cv.set(x + i, y + j, key[ch])
        if glasses:
            for i in range(2, 10):
                cv.set(x + i, y + 5, INK)


# ─── Scenes ──────────────────────────────────────────────────────────────────

def scene_walk() -> Canvas:
    """The disciples on the road as forest turns to machine."""
    cv = Canvas(W, H)
    horizon = 62
    sky(cv, horizon)
    horizon_line(cv, horizon, random.Random(3))
    ground(cv, horizon)
    pts = road(cv)
    rng = random.Random(11)
    # nature on the left, then wired trees, then pylons and cable
    for x, y in sorted([(8, 92), (22, 76), (40, 70), (14, 118), (52, 82), (30, 140), (62, 140)],
                       key=lambda p: p[1]):
        tree(cv, x, y, 1.1)
    for x, y in [(84, 74), (102, 70), (96, 140)]:
        wired_tree(cv, x, y)
    for x, y in [(6, 104), (46, 98), (70, 124)]:
        bush(cv, x, y)
    pylons = [(132, 74), (176, 70), (222, 68)]
    for x, y in pylons:
        pylon(cv, x, y, 34)
    for (x0, y0), (x1, y1) in zip(pylons, pylons[1:]):   # sagging power lines
        for i in range(60):
            t = i / 59
            cv.set(int(x0 + 6 + (x1 - x0) * t), int(y0 - 34 + (y1 - y0) * t + math.sin(t * math.pi) * 5), INK)
    wire_crop_rows(cv, 150, 100, 56, 20)
    wire_crop_rows(cv, 214, 112, 40, 24)
    robot(cv, 166, 112, RUST, 'hoe')
    robot(cv, 198, 117, RUST, 'hoe', flip=True)
    robot(cv, 150, 96, (METAL[0], (120, 90, 150), (160, 128, 190)), None, flip=True)
    robot(cv, 244, 100, RUST, 'hoe', flip=True)
    # one big fellow in the foreground, basket of bolts, staring at the visitors
    robot(cv, 226, 139, (METAL[0], (70, 110, 150), (110, 150, 190)), 'basket', flip=True, s=2)
    # the disciples on the road, just past the treeline
    heroes(cv, [(70, 99), (84, 95), (98, 92)])
    _ = rng, pts
    return cv


def scene_peasants() -> Canvas:
    """Closer in: robot peasants at work, the disciples watching."""
    cv = Canvas(W, H)
    horizon = 34
    for y in range(horizon):
        for x in range(W):
            cv.set(x, y, mix((120, 132, 128), (170, 180, 172), y / horizon))
    horizon_line(cv, horizon, random.Random(5))
    for y in range(horizon, H):
        for x in range(W):
            seam = (x % 20 == 0) or ((y - horizon) % 12 == 0)
            cv.set(x, y, METAL[1] if seam else (METAL[3] if (x % 20 < 2 or (y - horizon) % 12 < 1) else METAL[2]))
    # one wide field of wire crops
    wire_crop_rows(cv, 4, 50, 248, 52, step=9)
    blue = (METAL[0], (70, 110, 150), (110, 150, 190))
    purple = (METAL[0], (120, 90, 150), (160, 128, 190))
    workers = [
        (44, 70, RUST, 'hoe', False, 1), (122, 66, blue, 'hoe', True, 1), (206, 72, RUST, 'basket', False, 1),
        (86, 98, RUST, 'hoe', False, 2), (168, 104, purple, 'basket', True, 2),
        (236, 102, RUST, 'hoe', True, 2),
    ]
    for x, y, body, tool, flip, sc in sorted(workers, key=lambda w: w[1]):
        robot(cv, x, y, body, tool, flip, sc)
    # a cart of bolts
    cx, cy = 116, 124
    cv.shadow(cx + 12, cy + 8, 16, 3, 0.6)
    cv.rect(cx, cy, 26, 9, R['wood'][2])
    cv.rect(cx, cy, 26, 2, R['wood'][3])
    cv.outline_rect(cx - 1, cy - 1, 28, 11)
    for k in range(12):
        cv.disc(cx + 2 + k * 2, cy - 1 - (k % 3), 1.4, METAL[3] if k % 2 else GLOW[2])
    for wx in (cx + 4, cx + 21):
        cv.disc(wx, cy + 10, 3.5, INK)
        cv.disc(wx, cy + 10, 2, METAL[2])
    # the disciples, in the foreground on the left, looking on
    heroes(cv, [(10, 112), (24, 115), (38, 112)])
    return cv


def main() -> None:
    out = ROOT / 'assets' / 'story'
    for name, scene in [('greg-journey1.png', scene_walk), ('greg-journey2.png', scene_peasants)]:
        cv = scene()
        cv.img.resize((W * SCALE, H * SCALE), resample=0).save(out / name, optimize=True)
        print('wrote', name)


if __name__ == '__main__':
    main()
