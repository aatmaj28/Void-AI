#!/usr/bin/env python3
"""
Import Analyst Coverage from CSV to Supabase

Reads analyst_coverage.csv (from Colab export),
upserts into analyst_coverage table.
Tickers join with the existing companies table.

Usage:
    python scripts/import_analyst_coverage.py
    python scripts/import_analyst_coverage.py --file path/to/analyst_coverage.csv
"""

import os
import sys
import argparse
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

try:
    from colorama import init, Fore, Style
    init(autoreset=True)
except ImportError:
    class Fore:
        GREEN = RED = YELLOW = CYAN = BLUE = MAGENTA = ""
    class Style:
        BRIGHT = RESET_ALL = ""

# Load environment variables (from project root)
_script_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_script_dir)
load_dotenv(os.path.join(_project_root, '.env.local'))

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY')
DEFAULT_CSV = os.path.join(_script_dir, 'analyst_coverage.csv')
BATCH_SIZE = 100

if not SUPABASE_URL or not SUPABASE_KEY:
    print(f"{Fore.RED}Error: Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.local")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def resolve_path(path, default_path):
    if path and os.path.isabs(path):
        return path
    if path:
        for base in (_script_dir, _project_root):
            candidate = os.path.join(base, path)
            if os.path.exists(candidate):
                return candidate
        return os.path.join(_script_dir, os.path.basename(path))
    return default_path


def read_csv(path):
    if not os.path.exists(path):
        print(f"{Fore.RED}Error: CSV not found: {path}")
        print(f"{Fore.YELLOW}Put your Colab-exported CSV in: scripts/analyst_coverage.csv")
        return None
    df = pd.read_csv(path)
    print(f"{Fore.GREEN}Read {len(df)} rows from analyst_coverage.csv")
    return df


def prepare_records(df):
    records = []
    for _, row in df.iterrows():
        analyst_count = row.get('analyst_count')
        if pd.isna(analyst_count):
            analyst_count = 0
        try:
            analyst_count = int(analyst_count)
        except (TypeError, ValueError):
            analyst_count = 0

        rec_key = row.get('recommendation_key')
        if pd.notna(rec_key) and str(rec_key).strip():
            rec_key = str(rec_key).strip()
        else:
            rec_key = None

        rec = {
            'ticker': str(row['ticker']).strip(),
            'analyst_count': analyst_count,
            'recommendation_key': rec_key,
            'recommendation_mean': float(row['recommendation_mean']) if pd.notna(row.get('recommendation_mean')) else None,
            'target_mean_price': float(row['target_mean_price']) if pd.notna(row.get('target_mean_price')) else None,
            'target_high_price': float(row['target_high_price']) if pd.notna(row.get('target_high_price')) else None,
            'target_low_price': float(row['target_low_price']) if pd.notna(row.get('target_low_price')) else None,
            'updated_at': datetime.utcnow().isoformat(),
        }
        rec = {k: v for k, v in rec.items() if v is not None or k in ('analyst_count', 'updated_at')}
        records.append(rec)
    return records


def upsert_batches(records):
    print(f"\n{Fore.CYAN}Upserting analyst_coverage (batches of {BATCH_SIZE})...")
    total = len(records)
    ok = 0
    for i in range(0, total, BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        try:
            supabase.table('analyst_coverage').upsert(batch, on_conflict='ticker').execute()
            ok += len(batch)
            print(f"  {Fore.GREEN}Batch {i // BATCH_SIZE + 1}: {len(batch)} rows")
        except Exception as e:
            print(f"  {Fore.RED}Batch failed: {e}")
            for r in batch:
                try:
                    supabase.table('analyst_coverage').upsert(r, on_conflict='ticker').execute()
                    ok += 1
                except Exception as e2:
                    print(f"    {Fore.RED}{r.get('ticker')}: {e2}")
    print(f"{Fore.GREEN}analyst_coverage: {ok}/{total} rows upserted")
    return ok


def main():
    parser = argparse.ArgumentParser(description='Import analyst_coverage from CSV')
    parser.add_argument('--file', type=str, default='', help='Path to analyst_coverage.csv')
    args = parser.parse_args()

    csv_path = resolve_path(args.file or None, DEFAULT_CSV)
    print(f"\n{Fore.MAGENTA}{Style.BRIGHT}Analyst Coverage Importer")
    print(f"{Fore.CYAN}File: {csv_path}\n")

    df = read_csv(csv_path)
    if df is None:
        sys.exit(1)

    records = prepare_records(df)
    upsert_batches(records)
    print(f"\n{Fore.GREEN}{Style.BRIGHT}Done. Join companies with analyst_coverage on ticker.\n")


if __name__ == '__main__':
    main()
