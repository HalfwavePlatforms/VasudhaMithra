# services/gis-service/data/lgd/download_lgd.py
import os
import sys
import shutil
import logging
import csv
import urllib.request

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

LGD_URL = 'https://github.com/ramSeraph/opendata/releases/download/lgd-latest/villages.31Aug2026.csv.7z'
REQUIRED_COLUMNS = ['state_name', 'district_name', 'subdistrict_name', 'village_name', 'village_code']

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SEED_CSV_PATH = os.path.join(CURRENT_DIR, 'seed_lgd_villages.csv')
DEST_CSV_PATH = os.path.join(CURRENT_DIR, 'lgd_villages.csv')
ARCHIVE_PATH = os.path.join(CURRENT_DIR, 'villages.csv.7z')
SCRATCH_CSV = r'C:\Users\deepu\.gemini\antigravity\brain\0be32d6d-9942-4bab-97d5-c006f031834d\scratch\extracted\villages.31Aug2026.csv'

def validate_and_standardize_raw_csv(raw_csv_path: str, out_csv_path: str):
    logger.info(f'Converting and standardizing raw CSV from {raw_csv_path} -> {out_csv_path}')
    count = 0
    sample_rows = []
    with open(raw_csv_path, 'r', encoding='utf-8', errors='ignore') as f_in, \
         open(out_csv_path, 'w', encoding='utf-8', newline='') as f_out:
        reader = csv.DictReader(f_in)
        writer = csv.DictWriter(f_out, fieldnames=REQUIRED_COLUMNS)
        writer.writeheader()
        
        for row in reader:
            # Match columns from official LGD portal format
            v_code = row.get('Village Code') or row.get('village_code') or ''
            v_code = v_code.strip()
            if not v_code:
                continue
            
            st_name = (row.get('State Name(In English)') or row.get('state_name') or '').strip()
            dist_name = (row.get('District Name (In English)') or row.get('district_name') or '').strip()
            subdist_name = (row.get('Sub-District Name (In English)') or row.get('subdistrict_name') or '').strip()
            v_name = (row.get('Village Name (In English)') or row.get('village_name') or '').strip()
            
            clean_row = {
                'state_name': st_name,
                'district_name': dist_name,
                'subdistrict_name': subdist_name,
                'village_name': v_name,
                'village_code': v_code
            }
            writer.writerow(clean_row)
            count += 1
            if count <= 5:
                sample_rows.append(clean_row)
                
    logger.info(f'Standardized {count} village records.')
    logger.info('Sample rows:')
    for s in sample_rows:
        logger.info(f'  {s}')
    return count

def download_lgd(force_seed: bool = False) -> str:
    os.makedirs(CURRENT_DIR, exist_ok=True)
    
    if force_seed or '--seed' in sys.argv:
        logger.info('Using bundled seed fixture (--seed requested or forced)...')
        shutil.copy(SEED_CSV_PATH, DEST_CSV_PATH)
        return DEST_CSV_PATH

    # Check if we already have the standard CSV
    if os.path.exists(DEST_CSV_PATH) and os.path.getsize(DEST_CSV_PATH) > 1024 * 1024:
        logger.info(f'Existing LGD CSV found at {DEST_CSV_PATH}')
        return DEST_CSV_PATH

    # Check if scratch CSV is available locally
    if os.path.exists(SCRATCH_CSV):
        logger.info(f'Found cached raw LGD CSV at {SCRATCH_CSV}')
        validate_and_standardize_raw_csv(SCRATCH_CSV, DEST_CSV_PATH)
        return DEST_CSV_PATH

    # Try downloading official archive
    logger.info(f'Attempting download from {LGD_URL}...')
    try:
        urllib.request.urlretrieve(LGD_URL, ARCHIVE_PATH)
        logger.info(f'Downloaded archive to {ARCHIVE_PATH}')
        
        # Try extracting with py7zr
        import py7zr
        with py7zr.SevenZipFile(ARCHIVE_PATH, mode='r') as z:
            extracted_names = z.getnames()
            z.extractall(CURRENT_DIR)
            
        # Locate extracted CSV
        raw_candidates = [os.path.join(CURRENT_DIR, name) for name in extracted_names if name.endswith('.csv')]
        if raw_candidates:
            raw_path = raw_candidates[0]
            validate_and_standardize_raw_csv(raw_path, DEST_CSV_PATH)
            if raw_path != DEST_CSV_PATH and os.path.exists(raw_path):
                os.remove(raw_path)
            if os.path.exists(ARCHIVE_PATH):
                os.remove(ARCHIVE_PATH)
            return DEST_CSV_PATH
    except Exception as e:
        logger.warning(f'Online download/extraction failed ({e}). Falling back to bundled seed fixture.')

    # Fallback to seed
    if os.path.exists(SEED_CSV_PATH):
        logger.info(f'Copying bundled seed fixture {SEED_CSV_PATH} -> {DEST_CSV_PATH}')
        shutil.copy(SEED_CSV_PATH, DEST_CSV_PATH)
        return DEST_CSV_PATH
    else:
        raise FileNotFoundError('Neither online archive nor seed fixture could be loaded.')

if __name__ == '__main__':
    download_lgd()
