import os
import shutil
import urllib.request
from pathlib import Path

fonts_dir = Path("data/synthetic-generator/fonts")
fonts_dir.mkdir(parents=True, exist_ok=True)

# 1. First copy Nirmala UI and other Windows Indic fonts if present
win_font_dir = Path("C:/Windows/Fonts")
win_map = {
    "Nirmala.ttf": "Nirmala.ttf",
    "NirmalaB.ttf": "NirmalaB.ttf",
    "mangal.ttf": "Mangal.ttf",
    "tunga.ttf": "Tunga.ttf",
    "vrinda.ttf": "Vrinda.ttf",
    "latha.ttf": "Latha.ttf",
    "gautami.ttf": "Gautami.ttf",
}

for src_name, dst_name in win_map.items():
    src = win_font_dir / src_name
    if src.exists():
        shutil.copy2(src, fonts_dir / dst_name)
        print(f"Copied Windows system font: {dst_name}")

# 2. Try downloading Noto Fonts
font_urls = {
    "NotoSansDevanagari.ttf": "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf",
    "NotoSansKannada.ttf": "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansKannada/NotoSansKannada-Regular.ttf",
    "NotoSansBengali.ttf": "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansBengali/NotoSansBengali-Regular.ttf",
    "NotoSansTamil.ttf": "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansTamil/NotoSansTamil-Regular.ttf",
    "NotoSansTelugu.ttf": "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansTelugu/NotoSansTelugu-Regular.ttf",
}

headers = {"User-Agent": "Mozilla/5.0"}
for fname, url in font_urls.items():
    dest = fonts_dir / fname
    if not dest.exists():
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp, open(dest, "wb") as out:
                out.write(resp.read())
            print(f"Downloaded Noto font: {fname} ({dest.stat().st_size} bytes)")
        except Exception as e:
            print(f"Note for {fname}: {e}")

print("Total fonts available:", [f.name for f in fonts_dir.glob("*.ttf")])