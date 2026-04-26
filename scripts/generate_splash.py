#!/usr/bin/env python3
"""Regenerate iOS and Android splash images using balance_logo.png.

The previous splash images shipped the default Capacitor placeholder (a small
blue X on white). We replace them with the Balance brand mark centered on the
app's dark navy background (#1a1a2e from capacitor.config.ts).
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "balance_logo.png"
BG = (26, 26, 46, 255)  # #1a1a2e

ANDROID_SIZES = {
    "drawable/splash.png": (480, 320),
    "drawable-land-mdpi/splash.png": (480, 320),
    "drawable-land-hdpi/splash.png": (800, 480),
    "drawable-land-xhdpi/splash.png": (1280, 720),
    "drawable-land-xxhdpi/splash.png": (1600, 960),
    "drawable-land-xxxhdpi/splash.png": (1920, 1280),
    "drawable-port-mdpi/splash.png": (320, 480),
    "drawable-port-hdpi/splash.png": (480, 800),
    "drawable-port-xhdpi/splash.png": (720, 1280),
    "drawable-port-xxhdpi/splash.png": (960, 1600),
    "drawable-port-xxxhdpi/splash.png": (1280, 1920),
}

IOS_FILES = [
    "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
    "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png",
    "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png",
]
IOS_SIZE = (2732, 2732)


def make_splash(out_path: Path, width: int, height: int, logo: Image.Image) -> None:
    canvas = Image.new("RGBA", (width, height), BG)
    # Logo should occupy ~35% of the smaller dimension so it reads well on
    # phones and tablets without dominating the screen.
    target = int(min(width, height) * 0.35)
    scaled = logo.copy()
    scaled.thumbnail((target, target), Image.LANCZOS)
    x = (width - scaled.width) // 2
    y = (height - scaled.height) // 2
    canvas.paste(scaled, (x, y), scaled)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path, "PNG")
    print(f"wrote {out_path.relative_to(ROOT)} ({width}x{height})")


def main() -> None:
    logo = Image.open(LOGO).convert("RGBA")
    android_root = ROOT / "android/app/src/main/res"
    for rel, (w, h) in ANDROID_SIZES.items():
        make_splash(android_root / rel, w, h, logo)
    for rel in IOS_FILES:
        make_splash(ROOT / rel, IOS_SIZE[0], IOS_SIZE[1], logo)


if __name__ == "__main__":
    main()
