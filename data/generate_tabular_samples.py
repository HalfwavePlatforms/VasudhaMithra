"""
Synthetic Legacy Tabular Khasra Register Generator.
Renders authentic government legacy Khasra registers with tabular column grids,
Hindi/Devanagari text headers (खसरा, स्तंभ, खाता, रकबा, भूमि स्वामी),
and generates corresponding ground-truth JSON files with document_type="legacy_tabular_register".
"""
import os
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

DATA_DIR = Path(__file__).parent
SAMPLES_DIR = DATA_DIR / "sample-documents"
GT_DIR = DATA_DIR / "ground-truth"
FONTS_DIR = DATA_DIR / "synthetic-generator" / "fonts"

FONT_PATH = FONTS_DIR / "NotoSansDevanagari.ttf"
if not FONT_PATH.exists():
    FONT_PATH = None

def get_font(size: int):
    if FONT_PATH and FONT_PATH.exists():
        try:
            return ImageFont.truetype(str(FONT_PATH), size)
        except Exception:
            pass
    return ImageFont.load_default()

def create_tabular_sample(filename_base: str, title: str, col_headers: list[str], rows: list[list[str]], subtitle: str = ""):
    width = 1100
    row_height = 45
    header_height = 55
    top_margin = 130
    left_margin = 40
    right_margin = 40
    table_width = width - left_margin - right_margin
    total_height = top_margin + header_height + len(rows) * row_height + 80

    img = Image.new("RGB", (width, total_height), color=(252, 250, 246))
    draw = ImageDraw.Draw(img)

    title_font = get_font(22)
    sub_font = get_font(15)
    th_font = get_font(15)
    td_font = get_font(14)

    # Title
    draw.text((width // 2, 40), title, fill=(20, 20, 20), font=title_font, anchor="mm")
    if subtitle:
        draw.text((width // 2, 75), subtitle, fill=(60, 60, 60), font=sub_font, anchor="mm")

    # Column widths
    num_cols = len(col_headers)
    col_width = table_width // num_cols

    # Draw table outer border
    table_top = top_margin
    table_bottom = table_top + header_height + len(rows) * row_height
    draw.rectangle([left_margin, table_top, left_margin + table_width, table_bottom], outline=(50, 50, 50), width=2)

    # Header background
    draw.rectangle([left_margin, table_top, left_margin + table_width, table_top + header_height], fill=(235, 232, 222), outline=(50, 50, 50), width=1)

    # Draw column vertical lines and header text
    for i, col in enumerate(col_headers):
        x = left_margin + i * col_width
        next_x = x + col_width if i < num_cols - 1 else left_margin + table_width
        if i > 0:
            draw.line([(x, table_top), (x, table_bottom)], fill=(80, 80, 80), width=1)
        # Header text
        center_x = (x + next_x) // 2
        center_y = table_top + header_height // 2
        draw.text((center_x, center_y), col, fill=(10, 10, 10), font=th_font, anchor="mm")

    # Draw rows
    for r_idx, row in enumerate(rows):
        y = table_top + header_height + r_idx * row_height
        # Horizontal line
        draw.line([(left_margin, y), (left_margin + table_width, y)], fill=(120, 120, 120), width=1)
        for c_idx, cell in enumerate(row):
            x = left_margin + c_idx * col_width
            next_x = x + col_width if c_idx < num_cols - 1 else left_margin + table_width
            center_x = (x + next_x) // 2
            center_y = y + row_height // 2
            draw.text((center_x, center_y), str(cell), fill=(25, 25, 25), font=td_font, anchor="mm")

    # Save PNG
    os.makedirs(SAMPLES_DIR, exist_ok=True)
    os.makedirs(GT_DIR, exist_ok=True)

    img_path = SAMPLES_DIR / f"{filename_base}.png"
    img.save(img_path, format="PNG")
    print(f"Generated {img_path}")

    # Ground truth JSON
    gt_data = {
        "language": "hi",
        "document_type": "legacy_tabular_register",
        "fields": {}
    }
    gt_path = GT_DIR / f"{filename_base}.json"
    with open(gt_path, "w", encoding="utf-8") as f:
        json.dump(gt_data, f, indent=2, ensure_ascii=False)
    print(f"Generated {gt_path}")

def main():
    # Sample 1: Standard Khasra Tabular Register with numbered columns
    create_tabular_sample(
        "legacy_tabular_01",
        "मध्य प्रदेश शासन - राजस्व विभाग: खसरा पंजी",
        ["(1) खसरा नं.", "(2) खाता संख्या", "(3) भूमि स्वामी / कृषक", "(4) रकबा (एकड़)", "(5) भूमि प्रकार"],
        [
            ["101/1", "45", "रामप्रसाद यादव", "2.450", "सिंचित"],
            ["101/2", "45", "महेन्द्र यादव", "1.120", "सिंचित"],
            ["102", "88", "गंगाराम पटेल", "3.800", "दोफसली"],
            ["103/1", "124", "कमला देवी", "0.950", "असिंचित"],
            ["103/2", "124", "श्याम सुंदर", "1.500", "कृषि"],
        ],
        subtitle="तहसील: सीहोर | जिला: सीहोर | प्रारूप क (स्तंभ आधारित पंजीयन)"
    )

    # Sample 2: Tabular format with "स्तंभ 1", "स्तंभ 2" explicit headers
    create_tabular_sample(
        "legacy_tabular_02",
        "अधिकार अभिलेख - खसरा विवरण पंजी",
        ["स्तंभ 1: खसरा क्र.", "स्तंभ 2: खाता संख्या", "स्तंभ 3: काश्तकार / स्वामी", "स्तंभ 4: रकबा (हेक्टेयर)", "स्तंभ 5: लगान / कैफियत"],
        [
            ["214/1", "12", "हरिनारायण शर्मा", "1.250", "रुपये 45.00"],
            ["214/2", "12", "विष्णु शर्मा", "1.100", "रुपये 40.00"],
            ["215", "56", "जगदीश प्रसाद", "2.750", "रुपये 90.00"],
            ["216/A", "99", "आनंदी बाई", "0.650", "रुपये 25.00"],
            ["217", "104", "सुरेश कुमार", "3.400", "रुपये 120.00"],
        ],
        subtitle="ग्राम: धरमपुरी | अनुभाग व तहसील: विदिशा"
    )

    # Sample 3: Multi-column tabular register with 6 columns
    create_tabular_sample(
        "legacy_tabular_03",
        "राजस्व प्रशासन - खसरा खतौनी सारणी",
        ["(1) क्रम संख्या", "(2) खसरा नं", "(3) खाता क्र", "(4) भूमि स्वामी", "(5) रकबा / क्षेत्रफल", "(6) विवरण"],
        [
            ["1", "45/1", "201", "रामनरेश वर्मा", "1.85 एकड़", "सामान्य"],
            ["2", "45/2", "201", "दीपक वर्मा", "0.95 एकड़", "बंधक"],
            ["3", "46", "315", "बालमुकुंद गुप्ता", "4.20 एकड़", "स्वत्वाधिकार"],
            ["4", "47/1", "402", "सुनीता बाई", "2.10 एकड़", "सिंचित"],
            ["5", "47/2", "402", "विनोद कुमार", "1.50 एकड़", "असिंचित"],
        ],
        subtitle="प्रारूप १२ - स्तंभवार विवरण पंजी"
    )

    # Sample 4: Tabular Khasra with columns and table-specific terms
    create_tabular_sample(
        "legacy_tabular_04",
        "खसरा चकबंदी रजिस्टर - ग्राम अभिलेख",
        ["कॉलम 1 (खसरा)", "कॉलम 2 (खाता)", "कॉलम 3 (भूमि स्वामी)", "कॉलम 4 (रकबा)", "कॉलम 5 (प्रकार)"],
        [
            ["305/1", "18", "कैलाश चंद्र", "2.60 एकड़", "नहरी सिंचित"],
            ["305/2", "18", "भागीरथ", "1.40 एकड़", "नहरी सिंचित"],
            ["306", "64", "सत्यनारायण", "3.15 एकड़", "कुआं सिंचित"],
            ["307/1", "82", "मोहन लाल", "0.75 एकड़", "एकफसली"],
            ["307/2", "82", "राधा बाई", "1.80 एकड़", "दोफसली"],
        ],
        subtitle="स्तंभ अनुक्रमांक पंजी | राजस्व रिकॉर्ड"
    )

if __name__ == "__main__":
    main()
