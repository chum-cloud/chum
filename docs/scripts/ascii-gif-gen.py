#!/usr/bin/env python3
"""ASCII NFT Art Generator — Animated GIF with Matrix Rain
Converts NFT PFP → green ASCII matrix rain animated GIF (<2MB target)
Usage: python3 ascii-gif-gen.py <image_path> <output.gif> [--cols 80] [--frames 30]
"""
import sys, os, random, colorsys, argparse
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import numpy as np

RAMP = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. "
CHARS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(){}[]<>?/\\|~+-=_:;,.")

def build_grid(img, cols=80):
    """Build ASCII grid with green color mapping from image."""
    img = ImageEnhance.Contrast(img).enhance(1.4)
    img = ImageEnhance.Sharpness(img).enhance(2.0)

    w, h = img.size
    pixels = np.array(img)

    # BG removal: sample top-left + top-right 15% patches, use MEDIAN
    top_h = max(1, int(h * 0.15))
    tl = pixels[:top_h, :int(w * 0.15)].reshape(-1, 3)
    tr = pixels[:top_h, int(w * 0.85):].reshape(-1, 3)
    corners = np.concatenate([tl, tr])
    bg_avg = np.median(corners, axis=0)
    bg_std = np.std(corners)
    threshold = max(55, min(100, 55 + bg_std * 0.5))

    rows = int(h * (cols / w) / 2.0)
    small = img.resize((cols, rows), Image.LANCZOS)
    gray = small.convert('L')

    edges = gray.filter(ImageFilter.FIND_EDGES)
    edges = ImageEnhance.Brightness(edges).enhance(2.0)
    gray_np = np.array(gray, dtype=float)
    edge_np = np.array(edges, dtype=float)
    blended = np.clip(gray_np - edge_np * 0.3, 0, 255).astype(np.uint8)

    small_arr = np.array(small)

    grid = []  # Each cell: None (bg) or (density_idx, r, g, b)
    for y in range(rows):
        row = []
        for x in range(cols):
            px = small_arr[y, x]
            g = blended[y, x]

            dist = np.sqrt(np.sum((px.astype(float) - bg_avg) ** 2))
            if dist < threshold:
                row.append(None)
                continue

            idx = int(g / 256 * len(RAMP))
            idx = min(idx, len(RAMP) - 1)

            r, gg, b = int(px[0]), int(px[1]), int(px[2])
            h_orig, s_orig, v_orig = colorsys.rgb_to_hsv(r / 255, gg / 255, b / 255)
            green_h = 0.33 + (h_orig - 0.33) * 0.4
            green_h = max(0.12, min(0.52, green_h))
            green_s = 0.6 + s_orig * 0.4
            green_v = max(0.25, min(1.0, v_orig * 1.4 + 0.4))
            r2, g2, b2 = colorsys.hsv_to_rgb(green_h, green_s, min(1.0, green_v))

            row.append((idx, int(r2 * 255), int(g2 * 255), int(b2 * 255)))
        grid.append(row)

    return grid, rows, cols


class MatrixRain:
    """Matrix rain streak manager."""
    def __init__(self, cols, rows, max_streaks=20, spawn_rate=0.06):
        self.cols = cols
        self.rows = rows
        self.max_streaks = max_streaks
        self.spawn_rate = spawn_rate
        self.streaks = []

    def tick(self):
        # Spawn new streaks
        if len(self.streaks) < self.max_streaks and random.random() < self.spawn_rate:
            self.streaks.append({
                'x': random.randint(0, self.cols - 1),
                'y': -random.random() * self.rows * 0.3,
                'speed': 0.5 + random.random() * 0.6,
                'len': 3 + random.randint(0, 5)
            })

        # Move streaks
        for s in self.streaks:
            s['y'] += s['speed']

        # Remove off-screen
        self.streaks = [s for s in self.streaks if s['y'] - s['len'] < self.rows]

    def get_overlay(self):
        """Returns dict of (x, y) -> (char, r, g, b) for rain cells."""
        overlay = {}
        for s in self.streaks:
            for j in range(s['len']):
                sy = int(s['y']) - j
                if sy < 0 or sy >= self.rows:
                    continue
                ch = random.choice(CHARS)
                if j == 0:
                    # Head: bright white-green
                    overlay[(s['x'], sy)] = (ch, 220, 255, 220)
                else:
                    bright = max(0, 180 - j * 35)
                    overlay[(s['x'], sy)] = (ch, 0, bright, 0)
        return overlay


def render_frame(grid, rows, cols, rain, rng, font, char_w, char_h, target_size=1080, flicker_rate=0.12):
    """Render one frame of the animation at target resolution."""
    # Render at native char size first
    native_w = char_w * cols
    native_h = char_h * rows

    img = Image.new('RGB', (native_w, native_h), (0, 0, 0))
    draw = ImageDraw.Draw(img)

    rain.tick()
    overlay = rain.get_overlay()

    for y in range(rows):
        for x in range(cols):
            # Check rain overlay first
            if (x, y) in overlay:
                ch, r, g, b = overlay[(x, y)]
                draw.text((x * char_w, y * char_h), ch, fill=(r, g, b), font=font)
                continue

            cell = grid[y][x]
            if cell is None:
                continue

            density_idx, r, g, b = cell
            # Flicker: randomly change character but keep color
            if rng.random() < flicker_rate:
                ch = rng.choice(CHARS)
            else:
                ch = RAMP[density_idx]
            draw.text((x * char_w, y * char_h), ch, fill=(r, g, b), font=font)

    # Scale up to target square resolution using nearest neighbor (keeps chars crisp)
    # Pad to square first
    w, h = img.size
    max_dim = max(w, h)
    if w != h:
        square = Image.new('RGB', (max_dim, max_dim), (0, 0, 0))
        square.paste(img, ((max_dim - w) // 2, (max_dim - h) // 2))
        img = square
    
    if img.size[0] != target_size:
        img = img.resize((target_size, target_size), Image.NEAREST)
    
    # Convert to palette mode for GIF
    img = img.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    return img


def generate_gif(image_path, output_path, cols=80, num_frames=30, fps=10):
    """Main pipeline: image → animated ASCII GIF."""
    print(f"Loading {image_path}...")
    src = Image.open(image_path).convert('RGB')

    print(f"Building ASCII grid ({cols} cols)...")
    grid, rows, grid_cols = build_grid(src, cols)
    print(f"Grid: {grid_cols}x{rows}")

    # Font setup — larger for crisp chars at 1080px
    font_size = 14
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", font_size)
    except:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", font_size)
        except:
            font = ImageFont.load_default()

    char_w = max(1, int(font.getlength("M")))
    char_h = font_size + 2

    rain = MatrixRain(grid_cols, rows, max_streaks=20, spawn_rate=0.06)
    rng = random.Random(42)

    print(f"Rendering {num_frames} frames...")
    frames = []
    for i in range(num_frames):
        f = render_frame(grid, rows, grid_cols, rain, rng, font, char_w, char_h)
        frames.append(f)
        if (i + 1) % 10 == 0:
            print(f"  Frame {i + 1}/{num_frames}")

    duration = int(1000 / fps)  # ms per frame
    print(f"Saving GIF ({duration}ms/frame, {fps}fps)...")
    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=0,
        optimize=True
    )

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"Raw: {output_path} ({size_mb:.2f}MB)")

    # Optimize with gifsicle if available
    import shutil, subprocess
    if shutil.which('gifsicle'):
        tmp_opt = output_path + '.opt'
        try:
            subprocess.run([
                'gifsicle', '-O3', '--lossy=100', '--colors', '48',
                output_path, '-o', tmp_opt
            ], check=True, capture_output=True)
            os.replace(tmp_opt, output_path)
            size_mb = os.path.getsize(output_path) / 1024 / 1024
            print(f"Optimized: {size_mb:.2f}MB")
        except Exception as e:
            print(f"gifsicle optimization failed: {e}")
            if os.path.exists(tmp_opt):
                os.remove(tmp_opt)
    
    print(f"Done: {output_path} ({size_mb:.2f}MB)")
    if size_mb > 2:
        print(f"⚠️  Over 2MB target!")
    return output_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ASCII NFT Art GIF Generator")
    parser.add_argument("image", help="Input image path")
    parser.add_argument("output", help="Output GIF path")
    parser.add_argument("--cols", type=int, default=80, help="ASCII columns (default 80)")
    parser.add_argument("--frames", type=int, default=30, help="Number of frames (default 30)")
    parser.add_argument("--fps", type=int, default=10, help="Frames per second (default 10)")
    args = parser.parse_args()

    generate_gif(args.image, args.output, cols=args.cols, num_frames=args.frames, fps=args.fps)
