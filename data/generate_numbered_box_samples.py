"""
Synthetic Multilingual Numbered Box RTC (Pahani / 7/12) Generator.
Renders authentic government land-record forms with numbered boxed cells (kn, mr, te),
and generates corresponding ground-truth JSON files with document_type="numbered_box_rtc".
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
    "kn": "NotoSansKannada.ttf",
    "mr": "NotoSansDevanagari.ttf",
    "te": "NotoSansTelugu.ttf",
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


def create_numbered_box_sample(
    filename_base: str,
    title: str,
    subtitle: str,
    boxes_data: list[tuple[str, str]],  # [(label, value), ...]
    lang: str,
    survey_number: str,
    owner_name: str,
):
    """
    Renders an authentic numbered-box RTC layout with bordered cells.
    """
    width = 1000
    top_margin = 115
    bottom_margin = 60
    side_margin = 40
    box_gap_x = 24
    box_gap_y = 16

    cols = 2
    rows = (len(boxes_data) + cols - 1) // cols
    box_width = (width - 2 * side_margin - (cols - 1) * box_gap_x) // cols
    box_height = 56

    total_height = top_margin + rows * box_height + (rows - 1) * box_gap_y + bottom_margin

    img = Image.new("RGB", (width, total_height), color=(253, 251, 247))
    draw = ImageDraw.Draw(img)

    title_font = get_font(lang, 22)
    sub_font = get_font(lang, 15)
    val_font = get_font(lang, 16)
    footer_font = get_font(lang, 13)

    # Document Header
    draw.text((width // 2, 38), title, fill=(20, 20, 20), font=title_font, anchor="mm")
    if subtitle:
        draw.text((width // 2, 72), subtitle, fill=(70, 70, 70), font=sub_font, anchor="mm")

    # Draw divider below title
    draw.line([(side_margin, 95), (width - side_margin, 95)], fill=(120, 120, 120), width=2)

    # Render Numbered Box Grid
    for idx, (label, val) in enumerate(boxes_data):
        r = idx // cols
        c = idx % cols
        bx = side_margin + c * (box_width + box_gap_x)
        by = top_margin + r * (box_height + box_gap_y)

        # Outer box outline
        draw.rectangle([bx, by, bx + box_width, by + box_height], outline=(60, 60, 60), width=2)

        # Draw cell content: e.g. "1. ಸರ್ವೆ ನಂ : 142/2"
        draw.text((bx + 16, by + 18), f"{label} : {val}", fill=(10, 10, 10), font=val_font)

    # Footer Seal text
    footer_y = total_height - 30
    draw.text((side_margin, footer_y), "Official Revenue Record | Digital Extract Verification", fill=(100, 100, 100), font=footer_font)
    draw.text((width - side_margin, footer_y), "Tahasildar / Sub-Registrar Authority", fill=(100, 100, 100), font=footer_font, anchor="ra")

    # Save PNG
    os.makedirs(SAMPLES_DIR, exist_ok=True)
    os.makedirs(GT_DIR, exist_ok=True)

    img_path = SAMPLES_DIR / f"{filename_base}.png"
    img.save(img_path, format="PNG")
    print(f"Generated {img_path}")

    # Ground truth JSON: survey_number and owner_name expected, other fields null
    gt_data = {
        "language": lang,
        "document_type": "numbered_box_rtc",
        "fields": {
            "survey_number": survey_number,
            "owner_name": owner_name,
            "khasra_number": None,
            "khata_number": None,
            "plot_area": None,
            "village": None,
            "tehsil": None,
            "district": None,
            "land_classification": None,
            "mutation_number": None,
        }
    }
    gt_path = GT_DIR / f"{filename_base}.json"
    with open(gt_path, "w", encoding="utf-8") as f:
        json.dump(gt_data, f, indent=2, ensure_ascii=False)
    print(f"Generated {gt_path}")


def main():
    # ── Kannada Numbered Box RTC Samples (numbered_box_kn_01 to 05) ──
    kn_samples = [
        (
            "numbered_box_kn_01",
            "142/2",
            "ಬಸವರಾಜ ಪಾಟೀಲ",
            [
                ("1. ಸರ್ವೆ ನಂ", "142/2"),
                ("2. ಹಿಸ್ಸಾ ನಂ", "1"),
                ("3. ಖಾತೇದಾರರ ಹೆಸರು", "ಬಸವರಾಜ ಪಾಟೀಲ"),
                ("4. ಖಾತಾ ನಂ", "88"),
                ("5. ಒಟ್ಟು ವಿಸ್ತೀರ್ಣ", "2.50 ಎಕರೆ"),
                ("6. ಭೂಮಿ ವರ್ಗೀಕರಣ", "ಕೃಷಿ (ಖುಷ್ಕಿ)"),
                ("7. ಮ್ಯುಟೇಶನ್ ನಂ", "MR-14/2023"),
                ("8. ಕಂದಾಯ", "ರೂ 65.00"),
            ],
            "ಕರ್ನಾಟಕ ಸರ್ಕಾರ - ಕಂದಾಯ ಇಲಾಖೆ: ನಮೂನೆ ೧೬ (ಪಹಣಿ / RTC)",
            "ಹಕ್ಕುಗಳ ದಾಖಲೆ ಮತ್ತು ಪರಿಶೀಲನಾ ಪತ್ರಿಕೆ | ತಾಲೂಕು: ಮೈಸೂರು | ಜಿಲ್ಲೆ: ಮೈಸೂರು",
        ),
        (
            "numbered_box_kn_02",
            "205/3",
            "ಮಂಜುನಾಥ ಗೌಡ",
            [
                ("1. ಸರ್ವೆ ನಂ", "205/3"),
                ("2. ಹಿಸ್ಸಾ ನಂ", "2"),
                ("3. ಖಾತೇದಾರರ ಹೆಸರು", "ಮಂಜುನಾಥ ಗೌಡ"),
                ("4. ಖಾತಾ ನಂ", "112"),
                ("5. ಒಟ್ಟು ವಿಸ್ತೀರ್ಣ", "1.80 ಎಕರೆ"),
                ("6. ಭೂಮಿ ವರ್ಗೀಕರಣ", "ಕೃಷಿ (ನೀರಾವರಿ)"),
                ("7. ಮ್ಯುಟೇಶನ್ ನಂ", "MR-08/2024"),
                ("8. ಕಂದಾಯ", "ರೂ 48.00"),
            ],
            "ಕರ್ನಾಟಕ ಸರ್ಕಾರ - ಕಂದಾಯ ಇಲಾಖೆ: ನಮೂನೆ ೧೬ (ಪಹಣಿ / RTC)",
            "ಹಕ್ಕು ದಾಖಲೆ ಹಾಗೂ ಪಹಣಿ ಪತ್ರಿಕೆ | ತಾಲೂಕು: ನೆಲಮಂಗಲ | ಜಿಲ್ಲೆ: ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ",
        ),
        (
            "numbered_box_kn_03",
            "78/1",
            "ಲಕ್ಷ್ಮಿ ನಾರಾಯಣ",
            [
                ("1. ಸರ್ವೆ ನಂ", "78/1"),
                ("2. ಹಿಸ್ಸಾ ನಂ", "1"),
                ("3. ಖಾತೇದಾರರ ಹೆಸರು", "ಲಕ್ಷ್ಮಿ ನಾರಾಯಣ"),
                ("4. ಖಾತಾ ನಂ", "45"),
                ("5. ಒಟ್ಟು ವಿಸ್ತೀರ್ಣ", "3.10 ಎಕರೆ"),
                ("6. ಭೂಮಿ ವರ್ಗೀಕರಣ", "ಬಾಗಾಯ್ತು ತೋಟ"),
                ("7. ಮ್ಯುಟೇಶನ್ ನಂ", "MR-19/2022"),
                ("8. ಕಂದಾಯ", "ರೂ 90.00"),
            ],
            "ಕರ್ನಾಟಕ ಸರ್ಕಾರ - ಕಂದಾಯ ಇಲಾಖೆ: ನಮೂನೆ ೧೬ (ಪಹಣಿ / RTC)",
            "ಭೂದಾಖಲೆಗಳ ಇಲಾಖೆ - ಪಹಣಿ ವಿವರ ಪತ್ರಿಕೆ | ತಾಲೂಕು: ಮಂಡ್ಯ | ಜಿಲ್ಲೆ: ಮಂಡ್ಯ",
        ),
        (
            "numbered_box_kn_04",
            "319/4",
            "ಶಿವಣ್ಣ ಕುಮಾರ್",
            [
                ("1. ಸರ್ವೆ ನಂ", "319/4"),
                ("2. ಹಿಸ್ಸಾ ನಂ", "4"),
                ("3. ಖಾತೇದಾರರ ಹೆಸರು", "ಶಿವಣ್ಣ ಕುಮಾರ್"),
                ("4. ಖಾತಾ ನಂ", "204"),
                ("5. ಒಟ್ಟು ವಿಸ್ತೀರ್ಣ", "0.95 ಎಕರೆ"),
                ("6. ಭೂಮಿ ವರ್ಗೀಕರಣ", "ಕೃಷಿ ಭೂಮಿ"),
                ("7. ಮ್ಯುಟೇಶನ್ ನಂ", "MR-03/2021"),
                ("8. ಕಂದಾಯ", "ರೂ 25.00"),
            ],
            "ಕರ್ನಾಟಕ ಸರ್ಕಾರ - ಕಂದಾಯ ಇಲಾಖೆ: ನಮೂನೆ ೧೬ (ಪಹಣಿ / RTC)",
            "ಹಕ್ಕು ದಾಖಲೆ ರಿಜಿಸ್ಟರ್ | ತಾಲೂಕು: ಹಾಸನ | ಜಿಲ್ಲೆ: ಹಾಸನ",
        ),
        (
            "numbered_box_kn_05",
            "512/2",
            "ಸುರೇಶ ರಾವ್",
            [
                ("1. ಸರ್ವೆ ನಂ", "512/2"),
                ("2. ಹಿಸ್ಸಾ ನಂ", "2"),
                ("3. ಖಾತೇದಾರರ ಹೆಸರು", "ಸುರೇಶ ರಾವ್"),
                ("4. ಖಾತಾ ನಂ", "67"),
                ("5. ಒಟ್ಟು ವಿಸ್ತೀರ್ಣ", "4.20 ಎಕರೆ"),
                ("6. ಭೂಮಿ ವರ್ಗೀಕರಣ", "ಖುಷ್ಕಿ ಜಮೀನು"),
                ("7. ಮ್ಯುಟೇಶನ್ ನಂ", "MR-27/2023"),
                ("8. ಕಂದಾಯ", "ರೂ 115.00"),
            ],
            "ಕರ್ನಾಟಕ ಸರ್ಕಾರ - ಕಂದಾಯ ಇಲಾಖೆ: ನಮೂನೆ ೧೬ (ಪಹಣಿ / RTC)",
            "ಪಹಣಿ / ಆರ್‌ಟಿಸಿ ಭೂಮಾಲೀಕತ್ವ ವಿವರ | ತಾಲೂಕು: ಶಿವಮೊಗ್ಗ | ಜಿಲ್ಲೆ: ಶಿವಮೊಗ್ಗ",
        ),
    ]

    for fname, s_no, owner, boxes, title, subtitle in kn_samples:
        create_numbered_box_sample(fname, title, subtitle, boxes, "kn", s_no, owner)

    # ── Marathi Numbered Box RTC Samples (numbered_box_mr_01 to 05) ──
    mr_samples = [
        (
            "numbered_box_mr_01",
            "108/3",
            "विठ्ठल तुकाराम कदम",
            [
                ("१. भूमापन क्रमांक", "108/3"),
                ("२. हिस्सा क्रमांक", "3"),
                ("३. खातेदाराचे नाव", "विठ्ठल तुकाराम कदम"),
                ("४. खाते क्रमांक", "52"),
                ("५. एकूण क्षेत्र", "1.75 हेक्टर"),
                ("६. जमीन प्रकार", "जिरायत शेती"),
                ("७. फेरफार क्रमांक", "फेरफार 412"),
                ("८. आकारणी", "रु. 22.50"),
            ],
            "महाराष्ट्र शासन - महसूल विभाग: गाव नमुना ७/१२ (अधिकार अभिलेख व पाहणी)",
            "गाव नमुना सात (अधिकार अभिलेख) आणि गाव नमुना बारा (पाहणी पत्रक) | तालुका: हवेली | जिल्हा: पुणे",
        ),
        (
            "numbered_box_mr_02",
            "245/1",
            "ज्ञानेश्वर बबन पवार",
            [
                ("१. भूमापन क्रमांक", "245/1"),
                ("२. हिस्सा क्रमांक", "1"),
                ("३. खातेदाराचे नाव", "ज्ञानेश्वर बबन पवार"),
                ("४. खाते क्रमांक", "98"),
                ("५. एकूण क्षेत्र", "2.40 हेक्टर"),
                ("६. जमीन प्रकार", "बागायत जमीन"),
                ("७. फेरफार क्रमांक", "फेरफार 615"),
                ("८. आकारणी", "रु. 45.00"),
            ],
            "महाराष्ट्र शासन - महसूल विभाग: गाव नमुना ७/१२ (अधिकार अभिलेख व पाहणी)",
            "अधिकार अभिलेख नोंदवही | गाव: शिवणे | तालुका: बारामती | जिल्हा: पुणे",
        ),
        (
            "numbered_box_mr_03",
            "64/2",
            "अनिता सुरेश शिंदे",
            [
                ("१. भूमापन क्रमांक", "64/2"),
                ("२. हिस्सा क्रमांक", "2"),
                ("३. खातेदाराचे नाव", "अनिता सुरेश शिंदे"),
                ("४. खाते क्रमांक", "34"),
                ("५. एकूण क्षेत्र", "0.95 हेक्टर"),
                ("६. जमीन प्रकार", "जिरायत"),
                ("७. फेरफार क्रमांक", "फेरफार 208"),
                ("८. आकारणी", "रु. 18.00"),
            ],
            "महाराष्ट्र शासन - महसूल विभाग: गाव नमुना ७/१२ (अधिकार अभिलेख व पाहणी)",
            "जमीन महसूल अधिकार पत्रक | तालुका: कराड | जिल्हा: सातारा",
        ),
        (
            "numbered_box_mr_04",
            "315/2",
            "सचिन नारायण देशमुख",
            [
                ("१. भूमापन क्रमांक", "315/2"),
                ("२. हिस्सा क्रमांक", "2"),
                ("३. खातेदाराचे नाव", "सचिन नारायण देशमुख"),
                ("४. खाते क्रमांक", "145"),
                ("५. एकूण क्षेत्र", "3.10 हेक्टर"),
                ("६. जमीन प्रकार", "शेती जमीन"),
                ("७. फेरफार क्रमांक", "फेरफार 890"),
                ("८. आकारणी", "रु. 62.00"),
            ],
            "महाराष्ट्र शासन - महसूल विभाग: गाव नमुना ७/१२ (अधिकार अभिलेख व पाहणी)",
            "गाव नमुना ७/१२ अधिकार अभिलेख | तालुका: नाशिक ग्रामीण | जिल्हा: नाशिक",
        ),
        (
            "numbered_box_mr_05",
            "402/1",
            "प्रमोद रघुनाथ कदम",
            [
                ("१. भूमापन क्रमांक", "402/1"),
                ("२. हिस्सा क्रमांक", "1"),
                ("३. खातेदाराचे नाव", "प्रमोद रघुनाथ कदम"),
                ("४. खाते क्रमांक", "77"),
                ("५. एकूण क्षेत्र", "1.20 हेक्टर"),
                ("६. जमीन प्रकार", "जिरायत शेती"),
                ("७. फेरफार क्रमांक", "फेरफार 335"),
                ("८. आकारणी", "रु. 28.00"),
            ],
            "महाराष्ट्र शासन - महसूल विभाग: गाव नमुना ७/१२ (अधिकार अभिलेख व पाहणी)",
            "महसूल प्रशासन - अधिकार अभिलेख व पिकांची पाहणी | तालुका: औरंगाबाद | जिल्हा: औरंगाबाद",
        ),
    ]

    for fname, s_no, owner, boxes, title, subtitle in mr_samples:
        create_numbered_box_sample(fname, title, subtitle, boxes, "mr", s_no, owner)

    # ── Telugu Numbered Box RTC Samples (numbered_box_te_01 to 05) ──
    te_samples = [
        (
            "numbered_box_te_01",
            "75/1",
            "వెంకటేశ్వర రావు",
            [
                ("1. సర్వే నంబరు", "75/1"),
                ("2. హిస్సా నంబరు", "1"),
                ("3. పట్టాదారు పేరు", "వెంకటేశ్వర రావు"),
                ("4. ఖాతా సంఖ్య", "34"),
                ("5. మొత్తం విస్తీర్ణం", "3.20 ఎకరాలు"),
                ("6. భూమి రకం", "మెట్ట భూమి"),
                ("7. మ్యుటేషన్ రిఫరెన్స్", "MR-22/2024"),
                ("8. శిస్తు", "రూ. 45.00"),
            ],
            "తెలంగాణ ప్రభుత్వం - రెవెన్యూ శాఖ: పహణీ / రికార్డ్ ఆఫ్ రైట్స్ (ROR-1B)",
            "నమూనా 1-B (హక్కుల రికార్డు మరియు పహాణీ పత్రిక) | మండలం: మేడ్చల్ | జిల్లా: రంగారెడ్డి",
        ),
        (
            "numbered_box_te_02",
            "162/3",
            "రమేష్ రెడ్డి",
            [
                ("1. సర్వే నంబరు", "162/3"),
                ("2. హిస్సా నంబరు", "3"),
                ("3. పట్టాదారు పేరు", "రమేష్ రెడ్డి"),
                ("4. ఖాతా సంఖ్య", "91"),
                ("5. మొత్తం విస్తీర్ణం", "2.15 ఎకరాలు"),
                ("6. భూమి రకం", "మాగాణి"),
                ("7. మ్యుటేషన్ రిఫరెన్స్", "MR-15/2023"),
                ("8. శిస్తు", "రూ. 38.00"),
            ],
            "తెలంగాణ ప్రభుత్వం - రెవెన్యూ శాఖ: పహణీ / రికార్డ్ ఆఫ్ రైట్స్ (ROR-1B)",
            "పట్టాదారు పాస్ పుస్తకం & హక్కుల రికార్డు | మండలం: గుంటూరు గ్రామీణ | జిల్లా: గుంటూరు",
        ),
        (
            "numbered_box_te_03",
            "89/2",
            "శ్రీనివాస రావు",
            [
                ("1. సర్వే నంబరు", "89/2"),
                ("2. హిస్సా నంబరు", "2"),
                ("3. పట్టాదారు పేరు", "శ్రీనివాస రావు"),
                ("4. ఖాతా సంఖ్య", "120"),
                ("5. మొత్తం విస్తీర్ణం", "1.50 ఎకరాలు"),
                ("6. భూమి రకం", "తోట భూమి"),
                ("7. మ్యుటేషన్ రిఫరెన్స్", "MR-09/2022"),
                ("8. శిస్తు", "రూ. 30.00"),
            ],
            "తెలంగాణ ప్రభుత్వం - రెవెన్యూ శాఖ: పహణీ / రికార్డ్ ఆఫ్ రైట్స్ (ROR-1B)",
            "హక్కుల వివరాల పహణీ పత్రిక | మండలం: విజయవాడ | జిల్లా: కృష్ణా",
        ),
        (
            "numbered_box_te_04",
            "230/1",
            "లక్ష్మి ప్రసన్న",
            [
                ("1. సర్వే నంబరు", "230/1"),
                ("2. హిస్సా నంబరు", "1"),
                ("3. పట్టాదారు పేరు", "లక్ష్మి ప్రసన్న"),
                ("4. ఖాతా సంఖ్య", "55"),
                ("5. మొత్తం విస్తీర్ణం", "4.80 ఎకరాలు"),
                ("6. భూమి రకం", "వ్యవసాయ మెట్ట"),
                ("7. మ్యుటేషన్ రిఫరెన్స్", "MR-31/2023"),
                ("8. శిస్తు", "రూ. 85.00"),
            ],
            "తెలంగాణ ప్రభుత్వం - రెవెన్యూ శాఖ: పహణీ / రికార్డ్ ఆఫ్ రైట్స్ (ROR-1B)",
            "రెవెన్యూ శాఖ - నమూనా 1-B హక్కుల పత్రిక | మండలం: వరంగల్ | జిల్లా: వరంగల్",
        ),
        (
            "numbered_box_te_05",
            "418/2",
            "కిరణ్ యాదవ్",
            [
                ("1. సర్వే నంబరు", "418/2"),
                ("2. హిస్సా నంబరు", "2"),
                ("3. పట్టాదారు పేరు", "కిరణ్ యాదవ్"),
                ("4. ఖాతా సంఖ్య", "78"),
                ("5. మొత్తం విస్తీర్ణం", "0.85 ఎకరాలు"),
                ("6. భూమి రకం", "మాగాణి భూమి"),
                ("7. మ్యుటేషన్ రిఫరెన్స్", "MR-04/2024"),
                ("8. శిస్తు", "రూ. 20.00"),
            ],
            "తెలంగాణ ప్రభుత్వం - రెవెన్యూ శాఖ: పహణీ / రికార్డ్ ఆఫ్ రైట్స్ (ROR-1B)",
            "పహణీ భూమి హక్కుల వివరాల పత్రిక | మండలం: విశాఖపట్నం | జిల్లా: విశాఖపట్నం",
        ),
    ]

    for fname, s_no, owner, boxes, title, subtitle in te_samples:
        create_numbered_box_sample(fname, title, subtitle, boxes, "te", s_no, owner)

    print("\nAll numbered box RTC samples generated successfully.")


if __name__ == "__main__":
    main()
