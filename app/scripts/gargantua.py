#!/usr/bin/env python3
"""
가르강튀아, rendered rather than drawn: a ray tracer for a Schwarzschild black hole with a thin accretion
disk, the way the film's picture is made (light bends round the hole, so the far side of the disk shows
up over the top and again, thinner, under it; the photon ring; the near side crossing in front).

  python3 scripts/gargantua.py            writes public/garg/gargantua.v2.webp (an animated, transparent loop)
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

W, H = 481, 360               # the picture (the site's CSS expects this size, the shadow's edge at 62 px)
SS = 3                         # supersampling
BC = 3 * math.sqrt(3)          # the shadow's radius (in M)
SHADOW_PX = 62.0
PX = SHADOW_PX / BC            # pixels per M
INCL = math.radians(83.0)      # the viewer's angle from the disk's axis (90° = edge on)
R_IN, R_OUT = 6.0, 15.0
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
    X, Y = np.meshgrid(xs / PX, -ys / PX)
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
        out.append((ok, rr, theta, np.clip(g, 0.3, 2.2) ** 0.38))
    return out

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
TEX = 0.5 * texture(1, (TR, TT), 70, 10) + 0.3 * texture(2, (TR, TT), 28, 22) + 0.2 * texture(3, (TR, TT), 120, 5)

def sample_tex(r, theta, turns_t):
    s = (np.log(np.clip(r, R_IN, R_OUT)) - math.log(R_IN)) / (math.log(R_OUT) - math.log(R_IN)) * (TR - 1)
    turns = TURNS * (R_IN / r) ** 1.5
    th = (theta / (2 * math.pi) - turns * turns_t) % 1.0 * TT
    return ndi.map_coordinates(TEX, [s, th], order=1, mode='grid-wrap')

STOPS = np.array([0.0, 0.25, 0.5, 0.75, 1.0, 1.4])
COLS = np.array([(0.10, 0.012, 0.0), (0.55, 0.10, 0.01), (1.0, 0.42, 0.06), (1.0, 0.66, 0.22), (1.0, 0.85, 0.55), (1.0, 0.97, 0.9)])
def colormap(t):
    return np.stack([np.interp(t, STOPS, COLS[:, c]) for c in range(3)], -1)

def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def shade(geo, t):
    """The picture at time t (0..1 of the loop): premultiplied light and how much of the disk is in the way."""
    light = np.zeros((H * SS, W * SS, 3)); T = np.ones((H * SS, W * SS))
    for n, (ok, r, theta, g) in enumerate(geo):
        if not ok.any():
            continue
        noise = sample_tex(r, theta, t)
        edge = smooth(R_IN - 0.3, R_IN + 0.5, r) * (1 - smooth(R_OUT - 4.5, R_OUT, r))
        trel = (R_IN / r) ** 0.75
        heat = g * trel * 1.05
        rad = (R_IN / r) ** 2.2 * g ** 3.0 * (0.35 + 1.25 * noise ** 1.3) * edge
        # an image of higher order is the same disk seen after light went round: dimmer and thinner
        rad = rad * (1.0 if n == 0 else 0.85 if n == 1 else 0.7)
        op = np.clip(0.30 + 1.1 * noise, 0, 1) * smooth(R_IN - 0.3, R_IN + 0.3, r) * (1 - smooth(R_OUT - 2.0, R_OUT + 0.8, r))
        a = np.where(ok, op, 0.0)
        light += (T * a * rad)[..., None] * colormap(heat)
        T = T * (1 - a)
    return light, 1 - T

def blur(img, sigma):
    return ndi.gaussian_filter(img, (sigma * SS, sigma * SS, 0) if img.ndim == 3 else sigma * SS)

def finish(light, cover):
    """Light → a transparent picture: tone-mapped, bloomed, with a dark haze under the glow."""
    k = 2.1
    glow = light + 0.55 * blur(light, 3.5) + 0.35 * blur(light, 11.0) + 0.18 * blur(light, 26.0)
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
    l0, c0 = shade(geo, t)
    l1, c1 = shade(geo, t - 1.0)
    return finish((1 - t) * l0 + t * l1, (1 - t) * c0 + t * c1)

def over(img, bg):
    a = img[..., 3:] / 255.0
    return (img[..., :3] * a + np.array(bg) * (1 - a)).astype(np.uint8)

if __name__ == '__main__':
    print('light paths…', flush=True)
    bs, tab, dphi = orbit_table()
    print('geometry…', flush=True)
    geo = geometry(bs, tab, dphi)
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
    path = os.path.join(out_dir, 'gargantua.v2.webp')
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=MS, loop=0, lossless=False, quality=88, method=5, minimize_size=False)
    print(path, os.path.getsize(path) // 1024, 'KB')
