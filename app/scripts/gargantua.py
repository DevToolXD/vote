#!/usr/bin/env python3
"""
가르강튀아, rendered rather than drawn: a ray tracer for a Schwarzschild black hole with a thin accretion
disk, the way the film's picture is made (light bends round the hole, so the far side of the disk shows
up over the top and again, thinner, under it; the photon ring; the near side crossing in front).

  python3 scripts/gargantua.py            writes public/garg/gargantua.v4.webp (an animated, transparent loop)
  python3 scripts/gargantua.py preview    writes preview PNGs next to it in the scratch dir given by $OUT

How it works (M = 1, the hole's shadow has radius b_c = 3√3):
  · a light ray's path round the hole is flat (it stays in one plane) and obeys u'' = -u + 3u²  (u = 1/r,
    the angle φ along the path), starting at u = 0 with u' = 1/b, b being the ray's impact parameter =
    the distance of its pixel from the centre. It is integrated once per b (a table), not once per pixel.
  · for a pixel (b, α) the path's plane crosses the disk plane at φ₁, φ₁+π, φ₁+2π … : the first image
    of the disk, the second (light that went round behind the hole), and so on up the photon ring.
  · where a ray crosses the disk between its inner edge (6M, the last stable orbit) and the outer edge
    the disk glows: its heat falls with r, the matter moves round at r^-3/2 so the side coming towards
    us is brighter and bluer (g = sqrt(1-3/r) / (1 + Ω b sinθ₀ cosα), light ∝ g³) and a turbulent texture
    turns with it.
  · the glow gets a bloom, the picture is transparent where light falls into the hole (the profile photo
    shows through there) and has a dark haze under the glow, so it also reads on a white page.
"""
import math, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

W, H = 600, 360               # the picture (gargantuaArt.ts has this size; the shadow's edge is at 62 px)
SS = 3                         # supersampling
BC = 3 * math.sqrt(3)          # the shadow's radius (in M)
SHADOW_PX = 62.0
PX = SHADOW_PX / BC            # pixels per M
INCL = math.radians(float(os.environ.get('INCL', 76.0)))
ROLL = math.radians(float(os.environ.get('ROLL', 7.0)))   # the picture is turned a little: the disk's left end rises, as in the film      # the viewer's angle from the disk's axis (90° = edge on)
R_IN, R_OUT = float(os.environ.get('RIN', 4.2)), float(os.environ.get('ROUT', 19.0))   # (the film's hole spins, so its disk reaches in close to the photon ring)   # the disk ends close in, so the picture hardly spills over the neighbours
FRAMES, MS = 40, 60
TURNS = 1.5                    # turns of the disk's inner edge in one loop

out_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'garg')
scratch = os.environ.get('OUT', '/tmp')

# ---------------------------------------------------------------------------- light paths, one per b
def orbit_table():
    d_out = np.geomspace(1e-6, 40, 3600)
    d_in = np.geomspace(1e-6, BC - 0.02, 1500)[::-1]
    bs = np.concatenate([BC - d_in, BC + d_out])
    dphi, steps = 0.003, int(6 * math.pi / 0.003)
    u = np.zeros_like(bs); v = 1.0 / bs
    alive = np.ones_like(bs, bool)
    tab = np.zeros((steps + 1, bs.size), np.float32)
    f = lambda u, v: (v, -u + 3 * u * u)
    for i in range(1, steps + 1):
        k1u, k1v = f(u, v)
        k2u, k2v = f(u + 0.5 * dphi * k1u, v + 0.5 * dphi * k1v)
        k3u, k3v = f(u + 0.5 * dphi * k2u, v + 0.5 * dphi * k2v)
        k4u, k4v = f(u + dphi * k3u, v + dphi * k3v)
        nu = u + dphi / 6 * (k1u + 2 * k2u + 2 * k3u + k4u)
        nv = v + dphi / 6 * (k1v + 2 * k2v + 2 * k3v + k4v)
        u = np.where(alive, nu, u); v = np.where(alive, nv, v)
        fell = alive & (u >= 0.5)            # inside r = 2M: gone
        gone = alive & (u <= 0) & (i > 5)    # back out to infinity
        u = np.where(fell, 1.0, np.where(gone, 0.0, u))
        alive &= ~(fell | gone)
        tab[i] = u
    return bs, tab, dphi

# ---------------------------------------------------------------------------- the picture's geometry
def geometry(bs, tab, dphi):
    xs = (np.arange(W * SS) + 0.5) / SS - W / 2
    ys = (np.arange(H * SS) + 0.5) / SS - H / 2
    X0, Y0 = np.meshgrid(xs / PX, -ys / PX)
    X = X0 * math.cos(ROLL) - Y0 * math.sin(ROLL)
    Y = X0 * math.sin(ROLL) + Y0 * math.cos(ROLL)
    b = np.maximum(np.hypot(X, Y), 0.02)
    a = np.arctan2(Y, X)
    phi1 = np.arctan2(math.cos(INCL), -math.sin(INCL) * np.sin(a))
    # the table's row for each pixel (the nearest b on either side, mixed)
    j = np.clip(np.searchsorted(bs, b) - 1, 0, bs.size - 2)
    wb = np.clip((b - bs[j]) / (bs[j + 1] - bs[j]), 0, 1)
    out = []
    for n in range(5):
        phi = phi1 + n * math.pi
        k = phi / dphi
        k0 = np.clip(k.astype(np.int64), 0, tab.shape[0] - 2)
        wk = k - k0
        u = ((1 - wk) * ((1 - wb) * tab[k0, j] + wb * tab[k0, j + 1])
             + wk * ((1 - wb) * tab[k0 + 1, j] + wb * tab[k0 + 1, j + 1]))
        with np.errstate(divide='ignore'):
            r = np.where(u > 1e-4, 1.0 / u, np.inf)
        ok = (r > R_IN - 0.3) & (r < R_OUT + 1.0)
        rr = np.where(ok, r, R_IN)
        x = rr * (np.cos(phi) * math.sin(INCL) - np.sin(phi) * np.sin(a) * math.cos(INCL))
        y = rr * np.sin(phi) * np.cos(a)
        theta = np.arctan2(y, x)
        om = rr ** -1.5
        g = np.sqrt(np.maximum(1 - 3 / rr, 1e-3)) / (1 + om * b * math.sin(INCL) * np.cos(a))
        # the film softened the one-sided glow; so the shift is applied at about a third of its real strength
        out.append((ok, rr, theta, np.clip(g, 0.3, 2.2) ** 0.35, b, np.sin(a) < 0))
    return out, np.hypot(X0, Y0), np.arctan2(Y0, X0)

# ---------------------------------------------------------------------------- the disk's texture
def texture(seed, shape, kr, kt):
    rng = np.random.default_rng(seed)
    f = np.fft.fft2(rng.standard_normal(shape))
    fr = np.fft.fftfreq(shape[0])[:, None] * shape[0]
    ft = np.fft.fftfreq(shape[1])[None, :] * shape[1]
    filt = np.exp(-(fr / kr) ** 2 - (ft / kt) ** 2)
    t = np.real(np.fft.ifft2(f * filt))
    lo, hi = np.percentile(t, [3, 97])
    return np.clip((t - lo) / (hi - lo), 0, 1)

TR, TT = 384, 1024
# long streaks round the ring (fine across it, very long along it), fine concentric grooves, and dust clumps
STREAK = 0.6 * texture(1, (TR, TT), 80, 5) + 0.4 * texture(4, (TR, TT), 130, 3)
DUST = texture(2, (TR, TT), 22, 18)
TEX = STREAK


def sample_tex(r, theta, turns_t, tex=None):
    tex = STREAK if tex is None else tex
    s = (np.log(np.clip(r, R_IN, R_OUT)) - math.log(R_IN)) / (math.log(R_OUT) - math.log(R_IN)) * (TR - 1)
    turns = TURNS * (R_IN / r) ** 1.5
    th = (theta / (2 * math.pi) - turns * turns_t) % 1.0 * TT
    return ndi.map_coordinates(tex, [s, th], order=1, mode='grid-wrap')

# the film's colours: white-hot at the inner edge, cream, peach, burnt orange, then dusty brown (not pure gold)
STOPS = np.array([0.0, 0.18, 0.36, 0.55, 0.75, 0.95, 1.3])
COLS = np.array([(0.05, 0.022, 0.012), (0.26, 0.105, 0.05), (0.62, 0.29, 0.13), (0.92, 0.55, 0.30), (1.0, 0.80, 0.60), (1.0, 0.93, 0.84), (1.0, 0.98, 0.95)])
def colormap(t):
    return np.stack([np.interp(t, STOPS, COLS[:, c]) for c in range(3)], -1)

def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def shade(geo, t):
    """The picture at time t (0..1 of the loop): premultiplied light and how much of the disk is in the way."""
    light = np.zeros((H * SS, W * SS, 3)); T = np.ones((H * SS, W * SS))
    near = np.zeros((H * SS, W * SS, 3))   # the disk's near side crossing in front of the hole: it is not smeared
    for n, (ok, r, theta, g, b, front) in enumerate(geo):
        if not ok.any():
            continue
        noise = sample_tex(r, theta, t)
        dust = sample_tex(r, theta, t, DUST)
        # the outer edge is torn into wisps by the dust, not a clean circle
        edge = smooth(R_IN - 0.3, R_IN + 0.5, r) * (1 - smooth(R_OUT - 9.0, R_OUT, r + 7.0 * (dust - 0.45)))
        trel = (R_IN / r) ** 1.15
        # clumps of dust dim the light and make it browner, more so farther out
        lane = 1 - np.clip((dust - 0.35) * 2.2, 0, 1) * np.clip((r - R_IN) / 3.0, 0.3, 1.0) * 0.8
        heat = g * trel * 1.2 * (0.6 + 0.4 * lane)
        rad = ((R_IN / r) ** 1.35 * (0.22 + 2.5 * noise ** 1.9) + 0.06 * noise ** 1.5) * g ** 3.0 * lane * edge
        # an image of higher order is the same disk seen after light went round: dimmer and thinner; inside the
        # shadow's edge it is faint, outside it piles up into the thin bright photon ring
        k = 1.0 if n == 0 else 0.85 if n == 1 else np.where(b > BC, 1.1, 0.06)
        rad = rad * k * (np.where(front, 1.5, 1.0) if n == 0 else 1.0)   # the near band in front is lit a little more
        op = np.clip(0.25 + 1.2 * noise, 0, 1) * smooth(R_IN - 0.3, R_IN + 0.3, r) * (1 - smooth(R_OUT - 4.0, R_OUT + 0.6, r + 5.0 * (dust - 0.45)))
        a = np.where(ok, op, 0.0)
        add = (T * a * rad)[..., None] * colormap(heat)
        if n == 0:
            near += np.where(front[..., None], add, 0); light += np.where(front[..., None], 0, add)
        else:
            light += add
        T = T * (1 - a)
    return (light, near), 1 - T

def blur(img, sigma):
    return ndi.gaussian_filter(img, (sigma * SS, sigma * SS, 0) if img.ndim == 3 else sigma * SS)

# ---- streaks: the light of the arcs is smeared round the hole (a long exposure of matter in orbit), in polar coordinates
NA = 2048
def polar_maps():
    cy, cx = H * SS / 2, W * SS / 2
    rmax = math.hypot(cy, cx)
    nr = int(rmax) + 1
    ang = np.linspace(-math.pi, math.pi, NA, endpoint=False)
    rr = np.arange(nr, dtype=np.float64)
    to_polar = (cy - np.outer(rr, np.sin(ang)), cx + np.outer(rr, np.cos(ang)))
    yy, xx = np.mgrid[0:H * SS, 0:W * SS]
    dy, dx = cy - (yy + 0.5), (xx + 0.5) - cx
    back = (np.hypot(dx, dy), (np.arctan2(dy, dx) + math.pi) / (2 * math.pi) * NA)
    return to_polar, back, np.arctan2(dy, dx)
POLAR = None
def smear(img, sigma_rad, amount):
    """Blur `img` along circles round the centre (by `sigma_rad` radians), more where the circle is horizontal-ish (not along the near band)."""
    global POLAR
    if POLAR is None:
        POLAR = polar_maps()
    to_polar, back, ang = POLAR
    chans = img.shape[-1] if img.ndim == 3 else 1
    out = np.empty_like(img)
    for c in range(chans):
        ch = img[..., c] if img.ndim == 3 else img
        pol = ndi.map_coordinates(ch, to_polar, order=1, mode='nearest')
        pol = ndi.gaussian_filter1d(pol, sigma_rad / (2 * math.pi) * NA, axis=1, mode='wrap')
        res = ndi.map_coordinates(np.pad(pol, ((0, 0), (0, 1)), mode='wrap'), back, order=1, mode='nearest')
        if img.ndim == 3: out[..., c] = res
        else: out = res
    m = amount * smooth(0.25, 0.8, np.abs(np.sin(ang + ROLL)))
    return img * (1 - m[..., None] if img.ndim == 3 else 1 - m) + out * (m[..., None] if img.ndim == 3 else m)

def finish(light, cover):
    """Light → a transparent picture: smeared into streaks, tone-mapped, bloomed, with a dark haze under the glow."""
    light = smear(light[0], 0.22, 0.95) + light[1]
    cover = smear(cover, 0.22, 0.95)
    k = 2.2
    glow = light + 0.7 * blur(light, 2.5) + 0.5 * blur(light, 7.0) + 0.3 * blur(light, 16.0) + 0.12 * blur(light, 30.0)
    v = 1 - np.exp(-k * glow)
    a = np.clip(v.max(-1), 0, 1)
    haze = np.clip(blur(cover, 5.0) * 1.2, 0, 0.7)
    dark = np.array([0.09, 0.035, 0.012])
    out_a = a + haze * (1 - a)
    prem = v + dark * (haze * (1 - a))[..., None]
    rgb = np.where(out_a[..., None] > 1e-4, prem / np.maximum(out_a[..., None], 1e-4), 0)
    img = np.concatenate([np.clip(rgb, 0, 1), np.clip(out_a, 0, 1)[..., None]], -1)
    # down to the real size (alpha-weighted so edges don't pick up black)
    prem_img = img[..., :3] * img[..., 3:]
    prem_img = prem_img.reshape(H, SS, W, SS, 3).mean((1, 3))
    al = img[..., 3].reshape(H, SS, W, SS).mean((1, 3))
    rgb = np.where(al[..., None] > 1e-4, prem_img / np.maximum(al[..., None], 1e-4), 0)
    return (np.clip(np.concatenate([rgb, al[..., None]], -1), 0, 1) * 255 + 0.5).astype(np.uint8)

def frame(geo, i):
    t = i / FRAMES
    # a seamless loop: the end of the loop blends back into its start
    (l0, n0), c0 = shade(geo, t)
    (l1, n1), c1 = shade(geo, t - 1.0)
    return finish(((1 - t) * l0 + t * l1, (1 - t) * n0 + t * n1), (1 - t) * c0 + t * c1)

def over(img, bg):
    a = img[..., 3:] / 255.0
    return (img[..., :3] * a + np.array(bg) * (1 - a)).astype(np.uint8)

if __name__ == '__main__':
    print('light paths…', flush=True)
    bs, tab, dphi = orbit_table()
    print('geometry…', flush=True)
    geo, _, _ = geometry(bs, tab, dphi)
    del tab
    if len(sys.argv) > 1 and sys.argv[1] == 'preview':
        for i in (0, 10, 20, 30):
            f = frame(geo, i)
            both = np.concatenate([over(f, (255, 255, 255)), over(f, (0, 0, 0))], 1)
            Image.fromarray(both).save(os.path.join(scratch, f'garg-{i}.png'))
        print('preview in', scratch)
        sys.exit(0)
    frames = []
    for i in range(FRAMES):
        f = frame(geo, i)
        f[f[..., 3] == 0, :3] = 0
        frames.append(Image.fromarray(f, 'RGBA'))
        print('frame', i, flush=True)
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, 'gargantua.v4.webp')
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=MS, loop=0, lossless=False, quality=88, method=5, minimize_size=False)
    print(path, os.path.getsize(path) // 1024, 'KB')
