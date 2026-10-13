#!/usr/bin/env python3
"""Generate safe WebP versions of five existing catalog images; retain all PNG originals."""
from pathlib import Path
from PIL import Image
import sys

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/"catalog/index.html"
MODELS=["iphone-18-pro-max","iphone-18-pro","iphone-16-pro","iphone-17-pro-max","iphone-17-pro"]
html=CATALOG.read_text(encoding="utf-8")
changes=[]
for model in MODELS:
    src=ROOT/"assets/models"/f"{model}.png"
    dst=src.with_suffix(".webp")
    if not src.is_file():
        raise RuntimeError(f"Missing source file: {src}")
    with Image.open(src) as image:
        image.load()
        original_size=image.size
        source_has_alpha="A" in image.getbands() or "transparency" in image.info
        converted=image.convert("RGBA" if source_has_alpha else "RGB")
        profile=image.info.get("icc_profile")
        kwargs={"format":"WEBP","quality":88,"method":6,"exact":True}
        if profile:
            kwargs["icc_profile"]=profile
        converted.save(dst,**kwargs)
    with Image.open(dst) as verify:
        verify.load()
        if verify.size!=original_size or verify.format!="WEBP":
            raise RuntimeError(f"Invalid WebP output: {dst}")
    png_bytes=src.stat().st_size
    webp_bytes=dst.stat().st_size
    if webp_bytes>=png_bytes*.85:
        print(f"Skipping {model}: PNG={png_bytes}, WebP={webp_bytes} (insufficient reduction)")
        dst.unlink()
        continue
    before=f'src="/assets/models/{model}.png"'
    after=f'src="/assets/models/{model}.webp"'
    if html.count(before)!=1:
        raise RuntimeError(f"Expected one catalog reference for {model}, got {html.count(before)}")
    html=html.replace(before,after)
    changes.append((model,png_bytes,webp_bytes))
if changes:
    CATALOG.write_text(html,encoding="utf-8")
for name,old,new in changes:
    print(f"{name}: {old:,} => {new:,} bytes ({(1-new/old)*100:.1f}% smaller)")
if not changes:
    print("No WebP alternatives beat existing files by 15%; unchanged.")
