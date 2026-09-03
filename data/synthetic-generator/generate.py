"""
Multilingual Synthetic Land Record Generator (7 Languages: en, hi, kn, mr, bn, ta, te).
Renders authentic government land-record layout formats using Google Noto Sans fonts,
applies realistic scan-artifact augmentation, and writes synchronized ground-truth JSON files.
"""
import argparse
import json
import os
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONTS_DIR = Path(__file__).parent / "fonts"

LANG_CONFIGS = {
    "en": {
        "name": "English",
        "font_file": "DejaVuSans.ttf",
        "font_bold": "DejaVuSans-Bold.ttf",
        "titles": [
            "GOVERNMENT OF MP / KARNATAKA: RECORD OF RIGHTS / RTC (FORM 16)",
            "REVENUE DEPARTMENT: MUTATION REGISTER EXTRACT (FORM XII)",
            "SUB-REGISTRAR OFFICE: REGISTERED SALE DEED",
        ],
        "labels": {
            "survey_number": "Survey No",
            "khasra_number": "Khasra No",
            "khata_number": "Khata No",
            "owner_name": "Owner / Khatedar",
            "plot_area": "Plot Extent / Area",
            "village": "Village (Gram)",
            "tehsil": "Taluk / Tehsil",
            "district": "District (Zilla)",
            "land_classification": "Land Classification",
            "mutation_number": "Mutation Ref No",
        },
        "owners": ["Ramesh Kumar", "Suresh Sharma", "Anita Patel", "Vijay Verma", "Meena Yadav", "Basavaraj Gowda"],
        "villages": ["Rampur", "Kothari", "Sultanpur", "Devgaon", "Bhairavpur", "Nelamangala"],
        "tehsils": ["Sehore", "Vidisha", "Raisen", "Hoshangabad", "Bengaluru South"],
        "districts": ["Bhopal", "Indore", "Gwalior", "Jabalpur", "Bengaluru"],
        "classifications": ["Agricultural (Irrigated)", "Agricultural (Dry)", "Residential", "Commercial"],
        "area_unit": "acre",
    },
    "hi": {
        "name": "Hindi",
        "font_file": "NotoSansDevanagari.ttf",
        "font_bold": "NotoSansDevanagari.ttf",
        "titles": [
            "मध्य प्रदेश शासन - राजस्व विभाग: खसरा / अधिकार अभिलेख (प्रपत्र १६)",
            "राजस्व विभाग - नामांतरण पंजी उद्धरण (प्रारूप १२)",
            "उप-पंजीयक कार्यालय - पंजीकृत विक्रय पत्र",
        ],
        "labels": {
            "survey_number": "सर्वे क्र",
            "khasra_number": "खसरा क्र",
            "khata_number": "खाता क्र",
            "owner_name": "खातेदार का नाम",
            "plot_area": "क्षेत्रफल (विस्तार)",
            "village": "ग्राम",
            "tehsil": "तहसील",
            "district": "जिला",
            "land_classification": "भूमि प्रकार",
            "mutation_number": "नामांतरण पंजी क्र",
        },
        "owners": ["रमेश कुमार शर्मा", "सुरेश पटेल", "अनीता वर्मा", "विजय यादव", "मीना कुमारी"],
        "villages": ["कोटहरी", "रामपुर", "सुल्तानपुर", "देवगांव", "भैरवपुर"],
        "tehsils": ["सीहोर", "विदिशा", "रायसेन", "होशंगाबाद"],
        "districts": ["भोपाल", "इंदौर", "ग्वालियर", "जबलपुर"],
        "classifications": ["कृषि (सिंचित)", "कृषि (असिंचित)", "आवासीय", "व्यावसायिक"],
        "area_unit": "एकड़",
    },
    "kn": {
        "name": "Kannada",
        "font_file": "NotoSansKannada.ttf",
        "font_bold": "NotoSansKannada.ttf",
        "titles": [
            "ಕರ್ನಾಟಕ ಸರ್ಕಾರ - ಕಂದಾಯ ಇಲಾಖೆ: ಪಹಣಿ / ಆರ್‌ಟಿಸಿ (ನಮೂನೆ ೧೬)",
            "ಕಂದಾಯ ಇಲಾಖೆ - ಮ್ಯುಟೇಶನ್ ರಿಜಿಸ್ಟರ್ ಸಾರಾಂಶ (ನಮೂನೆ ೧೨)",
            "ಉಪನೋಂದಣಾಧಿಕಾರಿ ಕಚೇರಿ - ನೋಂದಾಯಿತ ಕ್ರಯ ಪತ್ರ",
        ],
        "labels": {
            "survey_number": "ಸರ್ವೆ ನಂ",
            "khasra_number": "ಖಸ್ರಾ ನಂ",
            "khata_number": "ಖಾತಾ ನಂ",
            "owner_name": "ಖಾತೇದಾರರ ಹೆಸರು",
            "plot_area": "ವಿಸ್ತೀರ್ಣ",
            "village": "ಗ್ರಾಮ",
            "tehsil": "ತಾಲೂಕು",
            "district": "ಜಿಲ್ಲೆ",
            "land_classification": "ಭೂ ವರ್ಗೀಕರಣ",
            "mutation_number": "ಮ್ಯುಟೇಶನ್ ನಂ",
        },
        "owners": ["ಬಸವರಾಜ ಹೆಗಡೆ", "ಮಂಜುನಾಥ ಗೌಡ", "ಲಕ್ಷ್ಮಿ ರೆಡ್ಡಿ", "ಶಿವಣ್ಣ ಕುಮಾರ್", "ಸುರೇಶ ರಾವ್"],
        "villages": ["ಹೆಗ್ಗಡದೇವನಕೋಟೆ", "ನೆಲಮಂಗಲ", "ರಾಮನಗರ", "ಹೊಸಕೋಟೆ", "ಮಳವಳ್ಳಿ"],
        "tehsils": ["ಬೆಂಗಳೂರು ದಕ್ಷಿಣ", "ಮೈಸೂರು", "ಹಾಸನ", "ಮಂಡ್ಯ"],
        "districts": ["ಬೆಂಗಳೂರು", "ಮೈಸೂರು", "ಹಾಸನ", "ಶಿವಮೊಗ್ಗ"],
        "classifications": ["ಕೃಷಿ (ನೀರಾವರಿ)", "ಕೃಷಿ (ಖುಷ್ಕಿ)", "ವಸತಿ", "ವಾಣಿಜ್ಯ"],
        "area_unit": "ಎಕರೆ",
    },
    "mr": {
        "name": "Marathi",
        "font_file": "NotoSansDevanagari.ttf",
        "font_bold": "NotoSansDevanagari.ttf",
        "titles": [
            "महाराष्ट्र शासन - महसूल विभाग: गाव नमुना ७/१२ (अधिकार अभिलेख)",
            "महसूल विभाग - फेरफार नोंदवही उतारा (नमुना १२)",
            "दुय्यम निबंधक कार्यालय - खरेदीखत",
        ],
        "labels": {
            "survey_number": "सर्व्हे क्र / गट क्र",
            "khasra_number": "खसरा क्र",
            "khata_number": "खाते क्र",
            "owner_name": "खातेदाराचे नाव",
            "plot_area": "एकूण क्षेत्रफळ",
            "village": "गाव",
            "tehsil": "तालुका",
            "district": "जिल्हा",
            "land_classification": "जमीन प्रकार",
            "mutation_number": "फेरफार क्र",
        },
        "owners": ["सुरेश पाटील", "ज्ञानेश्वर पवार", "अनिता शिंदे", "प्रमोद कदम", "सचिन देशमुख"],
        "villages": ["देवगाव", "रामपूर", "कोथळी", "शिवणे", "वाघोली"],
        "tehsils": ["हवेली", "बारामती", "नागपूर ग्रामीण", "कराड"],
        "districts": ["पुणे", "नागपूर", "नाशिक", "औरंगाबाद"],
        "classifications": ["शेती (बागायत)", "शेती (जिरायत)", "निवासी", "व्यावसायिक"],
        "area_unit": "एकर",
    },
    "bn": {
        "name": "Bengali",
        "font_file": "NotoSansBengali.ttf",
        "font_bold": "NotoSansBengali.ttf",
        "titles": [
            "পশ্চিমবঙ্গ সরকার - ভূমি সংস্কার দপ্তর: খতিয়ান / আরওআর",
            "ভূমি দপ্তর - মিউটেশন রেজিস্টার এক্সট্রাক্ট",
            "সাব-রেজিস্ট্রার কার্যালয় - রেজিস্টার্ড বিক্রয় দলিল",
        ],
        "labels": {
            "survey_number": "দাগ নং",
            "khasra_number": "খসড়া নং",
            "khata_number": "খতিয়ান নং",
            "owner_name": "রায়তের নাম",
            "plot_area": "জমির পরিমাণ",
            "village": "মৌজা",
            "tehsil": "থানা / ব্লক",
            "district": "জেলা",
            "land_classification": "জমির শ্রেণি",
            "mutation_number": "মিউটেশন কেস নং",
        },
        "owners": ["অরিন্দম মুখার্জী", "অনিতা বর্মা", "সুব্রত দাস", "দেবব্রত ঘোষ", "মৌসুমী সেন"],
        "villages": ["রামপুর", "সুলতানপুর", "নারায়ণপুর", "শ্যামনগর", "গোপালপুর"],
        "tehsils": ["বারাসাত", "বর্ধমান", "হুগলি", "দুর্গাপুর"],
        "districts": ["উত্তর ২৪ পরগনা", "কলকাতা", "হাওড়া", "বর্ধমান"],
        "classifications": ["কৃষি (নাল)", "কৃষি (ডাঙা)", "বাস্তু", "বাণিজ্যিক"],
        "area_unit": "একর",
    },
    "ta": {
        "name": "Tamil",
        "font_file": "NotoSansTamil.ttf",
        "font_bold": "NotoSansTamil.ttf",
        "titles": [
            "தமிழ்நாடு அரசு - வருவாய்த் துறை: பட்டா / சிட்டா பதிவு",
            "வருவாய்த் துறை - பெயர் மாற்றம் / பட்டா மாறுதல் சான்று",
            "சார்-பதிவாளர் அலுவலகம் - பதிவு செய்யப்பட்ட கிரயப் பத்திரம்",
        ],
        "labels": {
            "survey_number": "சர்வே எண்",
            "khasra_number": "கஸ்ரா எண்",
            "khata_number": "பட்டா எண்",
            "owner_name": "நில உரிமையாளர்",
            "plot_area": "நிலப் பரப்பளவு",
            "village": "கிராமம்",
            "tehsil": "வட்டம்",
            "district": "மாவட்டம்",
            "land_classification": "நில வகைப்பாடு",
            "mutation_number": "மாறுதல் குறிப்பு எண்",
        },
        "owners": ["விஜய் குமார்", "செந்தில் நாதன்", "மீனா சுந்தரம்", "முருகன் செல்வம்", "கவிதா ராஜன்"],
        "villages": ["ராமபுரம்", "தேவகோட்டை", "சுல்தான்பேட்டை", "பூந்தமல்லி", "சோழிங்கநல்லூர்"],
        "tehsils": ["தாம்பரம்", "மதுரை வடக்கு", "கோயம்புத்தூர் தெற்கு", "சேலம்"],
        "districts": ["சென்னை", "காஞ்சிபுரம்", "கோயம்புத்தூர்", "மதுரை"],
        "classifications": ["நஞ்சை நிலம்", "புஞ்சை நிலம்", "குடியிருப்பு", "வணிகம்"],
        "area_unit": "ஏக்கர்",
    },
    "te": {
        "name": "Telugu",
        "font_file": "NotoSansTelugu.ttf",
        "font_bold": "NotoSansTelugu.ttf",
        "titles": [
            "ఆంధ్రప్రదేశ్ / తెలంగాణ ప్రభుత్వం - రెవెన్యూ శాఖ: పహాణీ / 1B అడంగల్",
            "రెవెన్యూ శాఖ - మ్యుటేషన్ రిజిస్టర్ సారాంశం",
            "సబ్-రిజిస్ట్రార్ కార్యాలయం - రిజిస్టర్డ్ సేల్ డీడ్",
        ],
        "labels": {
            "survey_number": "సర్వే నంబరు",
            "khasra_number": "ఖస్రా నంబరు",
            "khata_number": "ఖాతా నంబరు",
            "owner_name": "పట్టాదారు పేరు",
            "plot_area": "విస్తీర్ణం",
            "village": "గ్రామం",
            "tehsil": "మండలం",
            "district": "జిల్లా",
            "land_classification": "భూమి వర్గీకరణ",
            "mutation_number": "మ్యుటేషన్ రిఫరెన్స్ నం",
        },
        "owners": ["కిరణ్ యాదవ్", "రమేష్ రెడ్డి", "శ్రీనివాస రావు", "లక్ష్మి ప్రసన్న", "వెంకటేశ్వర్లు"],
        "villages": ["కొత్తూరు", "రాంపురం", "సుల్తాన్‌పూర్", "దేవపల్లి", "భైరవపట్నం"],
        "tehsils": ["మేడ్చల్", "విజయవాడ గ్రామీణ", "గుంటూరు", "వరంగల్"],
        "districts": ["హైదరాబాద్", "రంగారెడ్డి", "కృష్ణా", "విశాఖపట్నం"],
        "classifications": ["వ్యవసాయం (మాగాణి)", "వ్యవసాయం (మెట్ట)", "నివాస స్థలం", "వాణిజ్యం"],
        "area_unit": "ఎకరాలు",
    },
}


def get_font(lang_code: str, size: int):
    cfg = LANG_CONFIGS[lang_code]
    font_path = FONTS_DIR / cfg["font_file"]
    if font_path.exists():
        try:
            return ImageFont.truetype(str(font_path), size)
        except Exception:
            pass

    # Windows fallback
    win_nirmala = Path("C:/Windows/Fonts/Nirmala.ttf")
    if win_nirmala.exists():
        try:
            return ImageFont.truetype(str(win_nirmala), size)
        except Exception:
            pass

    try:
        return ImageFont.truetype("DejaVuSans.ttf", size)
    except IOError:
        return ImageFont.load_default()


def generate_document_record(lang_code: str, idx: int) -> dict:
    cfg = LANG_CONFIGS[lang_code]
    title = cfg["titles"][idx % len(cfg["titles"])]
    survey_no = f"{random.randint(100, 999)}/{random.randint(1, 20)}"
    owner = random.choice(cfg["owners"])

    # Discrepancy test case in 1 out of 4 records
    if idx % 4 == 0:
        area_val = round(random.uniform(7.5, 12.0), 2)
    else:
        area_val = round(random.uniform(1.2, 5.0), 2)

    area_str = f"{area_val} {cfg['area_unit']}"
    mutation_no = f"MR-{random.randint(10, 99)}/{random.randint(2021, 2025)}"

    return {
        "lang": lang_code,
        "title": title,
        "survey_number": survey_no,
        "khasra_number": str(random.randint(1000, 9999)),
        "khata_number": str(random.randint(100, 999)),
        "owner_name": owner,
        "plot_area": area_str,
        "village": random.choice(cfg["villages"]),
        "tehsil": random.choice(cfg["tehsils"]),
        "district": random.choice(cfg["districts"]),
        "land_classification": random.choice(cfg["classifications"]),
        "mutation_number": mutation_no,
    }


def render_document(record: dict, out_path: str, apply_artifacts: bool = True):
    lang_code = record["lang"]
    cfg = LANG_CONFIGS[lang_code]
    labels = cfg["labels"]

    img = Image.new("RGB", (940, 740), color="white")
    draw = ImageDraw.Draw(img)

    font_title = get_font(lang_code, 18)
    font_body = get_font(lang_code, 15)
    font_footer = get_font(lang_code, 12)

    draw.text((40, 24), record["title"], font=font_title, fill="#0B3B60")
    draw.line((40, 60, 900, 60), fill="#0B3B60", width=2)

    y = 88
    field_order = [
        "survey_number",
        "khasra_number",
        "khata_number",
        "owner_name",
        "plot_area",
        "village",
        "tehsil",
        "district",
        "land_classification",
        "mutation_number",
    ]

    for key in field_order:
        lbl = labels.get(key, key)
        val = record.get(key, "")
        draw.text((60, y), f"{lbl}: {val}", font=font_body, fill="#1F2937")
        y += 38

    draw.line((40, y + 10, 900, y + 10), fill="#CBD5E1", width=1)
    footer_text = f"Digital India Land Records Modernization Programme (DILRMP - SIH 26018) | Script: {cfg['name']}"
    draw.text((40, y + 20), footer_text, font=font_footer, fill="#64748B")

    # Apply realistic scan artifacts
    if apply_artifacts:
        rot_angle = random.uniform(-2.5, 2.5)
        img = img.rotate(rot_angle, resample=Image.Resampling.BICUBIC, expand=False, fillcolor="white")
        if random.random() > 0.5:
            img = img.filter(ImageFilter.GaussianBlur(radius=0.4))

    img.save(out_path, quality=92)


def save_ground_truth(record: dict, gt_path: str):
    gt = {
        "language": record["lang"],
        "document_type": record["title"],
        "fields": {
            "survey_number": record["survey_number"],
            "khasra_number": record["khasra_number"],
            "khata_number": record["khata_number"],
            "owner_name": record["owner_name"],
            "plot_area": record["plot_area"],
            "village": record["village"],
            "tehsil": record["tehsil"],
            "district": record["district"],
            "land_classification": record["land_classification"],
            "mutation_number": record["mutation_number"],
        },
    }
    with open(gt_path, "w", encoding="utf-8") as f:
        json.dump(gt, f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--language", type=str, default=None, help="Filter by specific language code: en, hi, kn, mr, bn, ta, te")
    parser.add_argument("--count", type=int, default=None, help="Number of documents to generate when using --language")
    parser.add_argument("--count-per-lang", type=int, default=7, help="Count per language when generating all")
    parser.add_argument("--out", type=str, default="../sample-documents")
    parser.add_argument("--ground-truth", type=str, default="../ground-truth")
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    os.makedirs(args.ground_truth, exist_ok=True)

    if args.language:
        if args.language not in LANG_CONFIGS:
            raise ValueError(f"Unknown language: {args.language}. Choices: {list(LANG_CONFIGS.keys())}")
        languages = [args.language]
        count = args.count or args.count_per_lang
    else:
        languages = ["en", "hi", "kn", "mr", "bn", "ta", "te"]
        count = args.count_per_lang

    doc_idx = 0
    generated_summary = {}

    for lang in languages:
        generated_summary[lang] = 0
        for i in range(count):
            record = generate_document_record(lang, i)
            base_name = f"doc_{lang}_{i:02d}"
            img_path = os.path.join(args.out, f"{base_name}.png")
            gt_path = os.path.join(args.ground_truth, f"{base_name}.json")

            render_document(record, img_path, apply_artifacts=True)
            save_ground_truth(record, gt_path)
            doc_idx += 1
            generated_summary[lang] += 1

    total_docs = sum(generated_summary.values())
    print("=" * 70)
    print(f"MULTILINGUAL SYNTHETIC DATASET GENERATION COMPLETE ({total_docs} TOTAL DOCS)")
    print("=" * 70)
    for lang, cnt in generated_summary.items():
        cfg = LANG_CONFIGS[lang]
        print(f"  • {cfg['name']:<12} ({lang}): {cnt} documents generated")
    print(f"\nImages saved to:      {args.out}")
    print(f"Ground truth saved to: {args.ground_truth}")
    print("=" * 70)


if __name__ == "__main__":
    main()



