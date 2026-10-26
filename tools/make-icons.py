"""生成扩展图标（16/48/128 PNG）。

用法：
    python tools/make-icons.py
输出：icons/icon16.png、icons/icon48.png、icons/icon128.png
"""
from __future__ import annotations

import os

from PIL import Image, ImageDraw

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")
S = 512  # 主尺寸（超采样绘制后再缩小）
SS = 4  # 超采样倍数

# 品牌色：蓝 -> 紫
C1 = (79, 124, 255)
C2 = (122, 92, 255)


def gradient(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), C1)
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = (
                round(C1[0] + (C2[0] - C1[0]) * t),
                round(C1[1] + (C2[1] - C1[1]) * t),
                round(C1[2] + (C2[2] - C1[2]) * t),
            )
    return img


def rounded_mask(size: int, radius_ratio: float = 0.22) -> Image.Image:
    """返回超采样分辨率下的圆角遮罩（与绘制图层同尺寸）。"""
    px = size * SS
    mask = Image.new("L", (px, px), 0)
    d = ImageDraw.Draw(mask)
    r = int(px * radius_ratio)
    d.rounded_rectangle([0, 0, px - 1, px - 1], radius=r, fill=255)
    return mask


def build_master() -> Image.Image:
    size = S * SS
    base = gradient(size)

    # 白色对话气泡
    bubble = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(bubble)
    bx0, by0, bx1, by1 = 0.20 * size, 0.24 * size, 0.80 * size, 0.60 * size
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=int(0.11 * size), fill=255)
    d.polygon(
        [(0.33 * size, by1 - 0.01 * size), (0.33 * size, 0.74 * size), (0.50 * size, by1 - 0.01 * size)],
        fill=255,
    )

    # 气泡内挖出三条横线，露出底色
    punch = Image.new("L", (size, size), 0)
    pd = ImageDraw.Draw(punch)
    line_h = int(0.035 * size)
    for i, (x0, x1) in enumerate(((0.30, 0.70), (0.30, 0.62), (0.30, 0.52))):
        cy = 0.335 * size + i * 0.075 * size
        pd.rounded_rectangle(
            [x0 * size, cy - line_h / 2, x1 * size, cy + line_h / 2],
            radius=line_h // 2,
            fill=255,
        )

    bubble = Image.composite(Image.new("L", (size, size), 0), bubble, punch)

    master = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    master.paste(base, (0, 0), rounded_mask(S))
    white = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    master.paste(white, (0, 0), bubble)
    return master.resize((S, S), Image.LANCZOS)


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    master = build_master()
    for size in (16, 48, 128):
        icon = master.resize((size, size), Image.LANCZOS)
        path = os.path.join(OUT_DIR, f"icon{size}.png")
        icon.save(path, "PNG")
        print("wrote", path)


if __name__ == "__main__":
    main()
