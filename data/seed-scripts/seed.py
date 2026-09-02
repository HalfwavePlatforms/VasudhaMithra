"""
Seeds the running system with sample documents so your dashboard/review queue
isn't empty when judges walk up. Run AFTER docker-compose is up and you've
generated sample docs with synthetic-generator/generate.py.

Usage: python seed.py --dir ../sample-documents --api http://localhost:8000
"""
import argparse
import glob
import os
import requests


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", type=str, default="../sample-documents")
    parser.add_argument("--api", type=str, default="http://localhost:8000")
    args = parser.parse_args()

    files = sorted(glob.glob(os.path.join(args.dir, "*.png")))
    if not files:
        print(f"No .png files found in {args.dir} — run synthetic-generator/generate.py first")
        return

    for path in files:
        with open(path, "rb") as f:
            resp = requests.post(f"{args.api}/records/upload", files={"file": f})
        if resp.ok:
            print(f"Seeded {os.path.basename(path)} -> {resp.json()}")
        else:
            print(f"Failed to seed {os.path.basename(path)}: {resp.status_code} {resp.text}")


if __name__ == "__main__":
    main()
