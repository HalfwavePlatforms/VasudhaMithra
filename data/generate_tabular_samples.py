"""
Synthetic Multilingual Legacy Tabular Khasra/RTC Register Generator.
Renders authentic government legacy registers with tabular column grids,
Devanagari, Kannada, and Bengali headers,
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

LANG_FONTS = {
    "hi": "NotoSansDevanagari.ttf",
    "kn": "NotoSansKannada.ttf",
    "bn": "NotoSansBengali.ttf",
}


def get_font(lang: str, size: int):
    font_file = LANG_FONTS.get(lang, "NotoSansDevanagari.ttf")
    font_path = FONTS_DIR / font_file
    if font_path.exists():
        try:
            return ImageFont.truetype(str(font_path), size)
        except Exception:
            pass
    return ImageFont.load_default()


def create_tabular_sample(
    filename_base: str,
    title: str,
    col_headers: list[str],
    rows: list[list[str]],
    subtitle: str = "",
    lang: str = "hi",
):
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

    title_font = get_font(lang, 22)
    sub_font = get_font(lang, 15)
    th_font = get_font(lang, 15)
    td_font = get_font(lang, 14)

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
        "language": lang,
        "document_type": "legacy_tabular_register",
        "fields": {}
    }
    gt_path = GT_DIR / f"{filename_base}.json"
    with open(gt_path, "w", encoding="utf-8") as f:
        json.dump(gt_data, f, indent=2, ensure_ascii=False)
    print(f"Generated {gt_path}")


def main():
    # ── Hindi Samples (legacy_tabular_01 to 04) ──
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
        subtitle="तहसील: सीहोर | जिला: सीहोर | प्रारूप क (स्तंभ आधारित पंजीयन)",
        lang="hi",
    )

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
        subtitle="ग्राम: धरमपुरी | अनुभाग व तहसील: विदिशा",
        lang="hi",
    )

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
        subtitle="प्रारूप १२ - स्तंभवार विवरण पंजी",
        lang="hi",
    )

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
        subtitle="स्तंभ अनुक्रमांक पंजी | राजस्व रिकॉर्ड",
        lang="hi",
    )

    # ── Kannada Tabular Samples (legacy_tabular_kn_01 to 05) ──
    create_tabular_sample(
        "legacy_tabular_kn_01",
        "ಕರ್ನಾಟಕ ಸರ್ಕಾರ - ಕಂದಾಯ ಇಲಾಖೆ: ಪಹಣಿ ವಿವರಣಾ ಕೋಷ್ಟಕ",
        ["(೧) ಸರ್ವೆ ನಂ.", "(೨) ಖಾತಾ ಸಂಖ್ಯೆ", "(೩) ಭೂಮಿ ಮಾಲೀಕರು", "(೪) ವಿಸ್ತೀರ್ಣ (ಎಕರೆ)", "(೫) ಭೂ ವರ್ಗೀಕರಣ"],
        [
            ["101/1", "45", "ಬಸವರಾಜ ಹೆಗಡೆ", "2.450", "ನೀರಾವರಿ"],
            ["101/2", "45", "ಮಂಜುನಾಥ ಗೌಡ", "1.120", "ನೀರಾವರಿ"],
            ["102", "88", "ಲಕ್ಷ್ಮಿ ರೆಡ್ಡಿ", "3.800", "ಖುಷ್ಕಿ"],
            ["103/1", "124", "ಶಿವಣ್ಣ ಕುಮಾರ್", "0.950", "ತೋಟ"],
            ["103/2", "124", "ಸುರೇಶ ರಾವ್", "1.500", "ಕೃಷಿ"],
        ],
        subtitle="ತಾಲೂಕು: ಮೈಸೂರು | ಜಿಲ್ಲೆ: ಮೈಸೂರು | ಕಾಲಂ ನಮೂನೆ (ಸ್ತಂಭವಾರು ನಮೂದು)",
        lang="kn",
    )

    create_tabular_sample(
        "legacy_tabular_kn_02",
        "ಹಕ್ಕು ದಾಖಲೆ - ಖಸ್ರಾ ಕಂದಾಯ ವಿವರಣಾ ಪಟ್ಟಿ",
        ["ಸ್ತಂಭ 1: ಸರ್ವೆ ನಂ", "ಸ್ತಂಭ 2: ಖಾತಾ ನಂ", "ಸ್ತಂಭ 3: ಖಾತೇದಾರ / ಮಾಲೀಕ", "ಸ್ತಂಭ 4: ವಿಸ್ತೀರ್ಣ (ಎಕರೆ)", "ಸ್ತಂಭ 5: ಕಂದಾಯ / ಷರಾ"],
        [
            ["214/1", "12", "ವೆಂಕಟೇಶ ಮೂರ್ತಿ", "1.250", "ರೂ 45.00"],
            ["214/2", "12", "ಕೃಷ್ಣಪ್ಪ ಗೌಡ", "1.100", "ರೂ 40.00"],
            ["215", "56", "ನಾರಾಯಣ ಸ್ವಾಮಿ", "2.750", "ರೂ 90.00"],
            ["216/A", "99", "ಪಾರ್ವತಮ್ಮ", "0.650", "ರೂ 25.00"],
            ["217", "104", "ಗೋಪಾಲ ಕೃಷ್ಣ", "3.400", "ರೂ 120.00"],
        ],
        subtitle="ಗ್ರಾಮ: ನೆಲಮಂಗಲ | ತಾಲೂಕು: ನೆಲಮಂಗಲ | ಕಾಲಂ ಆಧಾರಿತ ಖಾತೆ ರಿಜಿಸ್ಟರ್",
        lang="kn",
    )

    create_tabular_sample(
        "legacy_tabular_kn_03",
        "ಕಂದಾಯ ಆಡಳಿತ - ಸರ್ವೆ ವಿಸ್ತೀರ್ಣ ಸಾರಣಿ",
        ["(೧) ಕ್ರಮ ಸಂಖ್ಯೆ", "(೨) ಸರ್ವೆ ನಂ", "(೩) ಖಾತಾ ಕ್ರ", "(೪) ಭೂಮಿ ಸ್ವಾಮಿ", "(೫) ವಿಸ್ತೀರ್ಣ (ಎಕರೆ)", "(೬) ವಿವರಣೆ"],
        [
            ["1", "45/1", "201", "ಆನಂದ ಗೌಡ", "1.85 ಎಕರೆ", "ಸಾಮಾನ್ಯ"],
            ["2", "45/2", "201", "ದೇವಣ್ಣ", "0.95 ಎಕರೆ", "ಬಾಕಿ"],
            ["3", "46", "315", "ಗುಂಡಪ್ಪ", "4.20 ಎಕರೆ", "ಸ್ವಂತ"],
            ["4", "47/1", "402", "ಸುಮಿತ್ರಮ್ಮ", "2.10 ಎಕರೆ", "ನೀರಾವರಿ"],
            ["5", "47/2", "402", "ರಮೇಶ ಬಾಬು", "1.50 ಎಕರೆ", "ಖುಷ್ಕಿ"],
        ],
        subtitle="ನಮೂನೆ ೧೨ - ಕಾಲಂವಾರು ರಿಜಿಸ್ಟರ್ | ಕಂದಾಯ ಇಲಾಖೆ",
        lang="kn",
    )

    create_tabular_sample(
        "legacy_tabular_kn_04",
        "ಪಹಣಿ ಚಕ್‌ಬಂದಿ ರಿಜಿಸ್ಟರ್ - ಗ್ರಾಮ ದಾಖಲೆ",
        ["ಕಾಲಂ 1 (ಸರ್ವೆ)", "ಕಾಲಂ 2 (ಖಾತಾ)", "ಕಾಲಂ 3 (ಭೂ ಮಾಲೀಕ)", "ಕಾಲಂ 4 (ವಿಸ್ತೀರ್ಣ)", "ಕಾಲಂ 5 (ಪ್ರಕಾರ)"],
        [
            ["305/1", "18", "ತಿಮ್ಮಪ್ಪ", "2.60 ಎಕರೆ", "ನಾಲಾ ನೀರಾವರಿ"],
            ["305/2", "18", "ಚನ್ನಬಸವ", "1.40 ಎಕರೆ", "ನಾಲಾ ನೀರಾವರಿ"],
            ["306", "64", "ರಾಜಶೇಖರ", "3.15 ಎಕರೆ", "ಬಾವಿ ನೀರಾವರಿ"],
            ["307/1", "82", "ಬಸವರಾಜು", "0.75 ಎಕರೆ", "ಖುಷ್ಕಿ"],
            ["307/2", "82", "ಗಿರಿಜಮ್ಮ", "1.80 ಎಕರೆ", "ಬಾಗಾಯ್ತು"],
        ],
        subtitle="ಸ್ತಂಭ ಅನುಕ್ರಮ ಪಟ್ಟಿ | ಕಂದಾಯ ದಾಖಲೆ",
        lang="kn",
    )

    create_tabular_sample(
        "legacy_tabular_kn_05",
        "ಕರ್ನಾಟಕ ಭೂದಾಖಲೆ - ಹಕ್ಕು ಪಹಣಿ ತಃಖ್ತೆ",
        ["(1) ಸರ್ವೆ ನಂ", "(2) ಹಿಸ್ಸಾ ನಂ", "(3) ಖಾತೆದಾರ ಹೆಸರು", "(4) ವಿಸ್ತೀರ್ಣ", "(5) ಮ್ಯುಟೇಶನ್"],
        [
            ["410/1", "1", "ಸಿದ್ಧಲಿಂಗಪ್ಪ", "3.10 ಎಕರೆ", "MR 10/2021"],
            ["410/2", "2", "ಕುಮಾರಸ್ವಾಮಿ", "1.90 ಎಕರೆ", "MR 12/2022"],
            ["411", "1", "ಮಲ್ಲಿಕಾರ್ಜುನ", "4.50 ಎಕರೆ", "MR 05/2019"],
            ["412/A", "1", "ಚಂದ್ರಶೇಖರ", "2.20 ಎಕರೆ", "MR 18/2020"],
            ["412/B", "2", "ಭಾಗ್ಯಮ್ಮ", "0.80 ಎಕರೆ", "MR 22/2023"],
        ],
        subtitle="ಗ್ರಾಮ: ಹೆಗ್ಗಡದೇವನಕೋಟೆ | ತಾಲೂಕು: ಮೈಸೂರು | ಸ್ತಂಭವಾರು ತಃಖ್ತೆ",
        lang="kn",
    )

    # ── Bengali Tabular Samples (legacy_tabular_bn_01 to 05) ──
    create_tabular_sample(
        "legacy_tabular_bn_01",
        "পশ্চিমবঙ্গ সরকার - ভূমি ও ভূমি সংস্কার বিভাগ: খতিয়ান তালিকা",
        ["(১) দাগ নং / খসড়া", "(২) খতিয়ান নং", "(৩) রায়ত / ভূম্যধিকারী", "(৪) জমির পরিমাণ (একর)", "(৫) জমির শ্রেণী"],
        [
            ["101/1", "45", "অনিমেষ মুখার্জি", "2.450", "বাস্তু"],
            ["101/2", "45", "দেবাশীষ চ্যাটার্জি", "1.120", "বাস্তু"],
            ["102", "88", "সুব্রত সেনগুপ্ত", "3.800", "আমন ধান"],
            ["103/1", "124", "কমলা দেবী", "0.950", "পতিত"],
            ["103/2", "124", "শ্যামল দাস", "1.500", "বাগান"],
        ],
        subtitle="মৌজা: গোবিন্দপুর | থানা: বারাসাত | কলামভিত্তিক খতিয়ান রেজিস্টার",
        lang="bn",
    )

    create_tabular_sample(
        "legacy_tabular_bn_02",
        "অধিকার রেকর্ড - খসড়া খতিয়ান বিবরণী",
        ["কলাম ১: দাগ ক্র.", "কলাম ২: খতিয়ান সংখ্যা", "কলাম ৩: প্রজাস্বত্ব / মালিক", "কলাম ৪: পরিমাণ (একর)", "কলাম ৫: খাজনা / মন্তব্য"],
        [
            ["214/1", "12", "প্রণব কুমার বসু", "1.250", "টাকা ৪৫.০০"],
            ["214/2", "12", "বিষ্ণু পদ রায়", "1.100", "টাকা ৪০.০০"],
            ["215", "56", "জগদীশ চন্দ্র পাল", "2.750", "টাকা ৯০.০০"],
            ["216/A", "99", "আনন্দময়ী ঘোষ", "0.650", "টাকা ২৫.০০"],
            ["217", "104", "সুরেশ রঞ্জন ধর", "3.400", "টাকা ১২০.০০"],
        ],
        subtitle="মৌজা: শান্তিপুর | জেলা: নদীয়া | কলামভিত্তিক নকশা ও বিবরণী",
        lang="bn",
    )

    create_tabular_sample(
        "legacy_tabular_bn_03",
        "রাজস্ব প্রশাসন - খসড়া খতিয়ান সারণী",
        ["(১) ক্রমিক সংখ্যা", "(২) দাগ নং", "(৩) খতিয়ান নং", "(৪) জমির মালিক", "(৫) জমির পরিমাণ", "(৬) বিবরণ"],
        [
            ["1", "45/1", "201", "নির্মল ব্যানার্জি", "1.85 একর", "সাধারণ"],
            ["2", "45/2", "201", "দীপক চক্রবর্তী", "0.95 একর", "বন্ধকী"],
            ["3", "46", "315", "বালকচন্দ্র মণ্ডল", "4.20 একর", "রায়তি"],
            ["4", "47/1", "402", "সুনীতা সরকার", "2.10 একর", "সেচযোগ্য"],
            ["5", "47/2", "402", "বিনোদ কুমার শীল", "1.50 একর", "বোরো"],
        ],
        subtitle="প্ররূপ ১২ - স্তম্ভভিত্তিক বিবরণী তালিকা | ভূমি দপ্তর",
        lang="bn",
    )

    create_tabular_sample(
        "legacy_tabular_bn_04",
        "খতিয়ান রেকর্ড রেজিস্টার - মৌজা খতিয়ান",
        ["কলাম ১ (দাগ)", "কলাম ২ (খতিয়ান)", "কলাম ৩ (রায়ত)", "কলাম ৪ (পরিমাণ)", "কলাম ৫ (শ্রেণী)"],
        [
            ["305/1", "18", "কৈলাশ চন্দ্র ভৌমিক", "2.60 একর", "আমন"],
            ["305/2", "18", "ভগীরথ দাস", "1.40 একর", "আমন"],
            ["306", "64", "সত্যনারায়ণ দে", "3.15 একর", "পুকুর"],
            ["307/1", "82", "মোহন লাল সাহা", "0.75 একর", "ভিটা"],
            ["307/2", "82", "রাধারানী মণ্ডল", "1.80 একর", "দোফসলী"],
        ],
        subtitle="স্তম্ভ অনুক্রম রেজিস্টার | রাজস্ব দপ্তর",
        lang="bn",
    )

    create_tabular_sample(
        "legacy_tabular_bn_05",
        "পশ্চিমবঙ্গ ভূমি সংস্কার - খতিয়ান জমা বিবরণী",
        ["(১) দাগ নম্বর", "(২) বাটা দাগ", "(৩) জোতদার / মালিক", "(৪) মোট জমি", "(৫) দাখিলা নম্বর"],
        [
            ["510/1", "1", "অশোক কুমার দত্ত", "3.10 একর", "দাগ নং ১০০১"],
            ["510/2", "2", "প্রশান্ত মজুমদার", "1.90 একর", "দাগ নং ১০০২"],
            ["511", "1", "বিপ্লব ভট্টাচার্য", "4.50 একর", "দাগ নং ১০১১"],
            ["512/A", "1", "তপন কুমার সিংহ", "2.20 একর", "দাগ নং ১০১৫"],
            ["512/B", "2", "সন্ধ্যা রানী দাস", "0.80 একর", "দাগ নং ১০২২"],
        ],
        subtitle="মৌজা: দুর্গাপুর | থানা: আসানসোল | কলামওয়ার তালিকা",
        lang="bn",
    )

    print("\nAll multilingual legacy tabular samples generated successfully.")


if __name__ == "__main__":
    main()
