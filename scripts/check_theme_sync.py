#!/usr/bin/env python3
"""
VasudhaMithra Theme Synchronization Checker
Asserts that frontend/upload-portal/src/theme.css and frontend/dashboard/src/theme.css
remain strictly synchronized.
"""

import sys
import re
from pathlib import Path

def parse_css_vars(content: str) -> dict[str, str]:
    var_pattern = re.compile(r"(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);")
    return {k.strip(): v.strip() for k, v in var_pattern.findall(content)}

def main():
    repo_root = Path(__file__).resolve().parent.parent
    file_upload = repo_root / "frontend" / "upload-portal" / "src" / "theme.css"
    file_dash = repo_root / "frontend" / "dashboard" / "src" / "theme.css"

    if not file_upload.exists():
        print(f"ERROR: {file_upload} not found", file=sys.stderr)
        sys.exit(1)
    if not file_dash.exists():
        print(f"ERROR: {file_dash} not found", file=sys.stderr)
        sys.exit(1)

    text_upload = file_upload.read_text(encoding="utf-8").strip().replace("\r\n", "\n")
    text_dash = file_dash.read_text(encoding="utf-8").strip().replace("\r\n", "\n")

    if text_upload == text_dash:
        vars_count = len(parse_css_vars(text_upload))
        print(f"[OK] SUCCESS: Both theme.css files are 100% identical ({vars_count} variables).")
        sys.exit(0)

    # Detailed difference breakdown
    vars_upload = parse_css_vars(text_upload)
    vars_dash = parse_css_vars(text_dash)

    all_keys = sorted(set(vars_upload.keys()) | set(vars_dash.keys()))
    discrepancies = []

    for key in all_keys:
        val_u = vars_upload.get(key)
        val_d = vars_dash.get(key)
        if val_u != val_d:
            discrepancies.append(f"  {key}:\n    upload-portal: {val_u}\n    dashboard:     {val_d}")

    if discrepancies:
        print("ERROR: Theme token mismatch between upload-portal and dashboard:", file=sys.stderr)
        for d in discrepancies:
            print(d, file=sys.stderr)
    else:
        print("NOTE: Variable values match, but file whitespace/comments differ.", file=sys.stderr)

    sys.exit(1)

if __name__ == "__main__":
    main()
