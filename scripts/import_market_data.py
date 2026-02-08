#!/usr/bin/env python3
"""
Import Market Data and Stock Metrics from CSV to Supabase

Reads market_data.csv and stock_metrics.csv (from Colab export),
upserts into market_data and stock_metrics tables.
Tickers join with the existing companies table.

Usage:
    python scripts/import_market_data.py
    python scripts/import_market_data.py --market-data path/to/market_data.csv --stock-metrics path/to/stock_metrics.csv
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
DEFAULT_MARKET_DATA = os.path.join(_script_dir, 'market_data.csv')
DEFAULT_STOCK_METRICS = os.path.join(_script_dir, 'stock_metrics.csv')
MARKET_DATA_BATCH = 500
STOCK_METRICS_BATCH = 100

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


def read_csv(path, name):
    if not os.path.exists(path):
        print(f"{Fore.RED}Error: {name} not found: {path}")
        print(f"{Fore.YELLOW}Put your Colab-exported CSV in: scripts/{os.path.basename(path)}")
        return None
    df = pd.read_csv(path)
    print(f"{Fore.GREEN}Read {len(df)} rows from {name}")
    return df


def prepare_market_data(df):
    records = []
    for _, row in df.iterrows():
        vol = row.get('volume')
        if pd.isna(vol):
            vol = 0
        try:
            vol = int(vol)
        except (TypeError, ValueError):
            vol = 0
        rec = {
            'ticker': str(row['ticker']).strip(),
            'date': str(row['date']).strip(),
            'open': float(row['open']) if pd.notna(row.get('open')) else None,
            'high': float(row['high']) if pd.notna(row.get('high')) else None,
            'low': float(row['low']) if pd.notna(row.get('low')) else None,
            'close': float(row['close']) if pd.notna(row.get('close')) else None,
            'volume': vol,
        }
        records.append(rec)
    return records


def prepare_stock_metrics(df):
    records = []
    for _, row in df.iterrows():
        records.append({
            'ticker': str(row['ticker']).strip(),
            'avg_volume_20d': int(row['avg_volume_20d']) if pd.notna(row.get('avg_volume_20d')) else None,
            'volatility_20d': float(row['volatility_20d']) if pd.notna(row.get('volatility_20d')) else None,
            'price_change_1m': float(row['price_change_1m']) if pd.notna(row.get('price_change_1m')) else None,
            'price_change_3m': float(row['price_change_3m']) if pd.notna(row.get('price_change_3m')) else None,
            'current_price': float(row['current_price']) if pd.notna(row.get('current_price')) else None,
            'year_high': float(row['year_high']) if pd.notna(row.get('year_high')) else None,
            'year_low': float(row['year_low']) if pd.notna(row.get('year_low')) else None,
            'updated_at': datetime.utcnow().isoformat(),
        })
    return records


def upsert_market_data(records):
    print(f"\n{Fore.CYAN}Upserting market_data (batches of {MARKET_DATA_BATCH})...")
    total = len(records)
    ok = 0
    for i in range(0, total, MARKET_DATA_BATCH):
        batch = records[i:i + MARKET_DATA_BATCH]
        try:
            supabase.table('market_data').upsert(batch, on_conflict='ticker,date').execute()
            ok += len(batch)
            print(f"  {Fore.GREEN}Batch {i // MARKET_DATA_BATCH + 1}: {len(batch)} rows")
        except Exception as e:
            print(f"  {Fore.RED}Batch failed: {e}")
            for r in batch:
                try:
                    supabase.table('market_data').upsert(r, on_conflict='ticker,date').execute()
                    ok += 1
                except Exception as e2:
                    print(f"    {Fore.RED}{r.get('ticker')} {r.get('date')}: {e2}")
    print(f"{Fore.GREEN}market_data: {ok}/{total} rows upserted")
    return ok


def upsert_stock_metrics(records):
    print(f"\n{Fore.CYAN}Upserting stock_metrics (batches of {STOCK_METRICS_BATCH})...")
    total = len(records)
    ok = 0
    for i in range(0, total, STOCK_METRICS_BATCH):
        batch = records[i:i + STOCK_METRICS_BATCH]
        try:
            supabase.table('stock_metrics').upsert(batch, on_conflict='ticker').execute()
            ok += len(batch)
            print(f"  {Fore.GREEN}Batch {i // STOCK_METRICS_BATCH + 1}: {len(batch)} rows")
        except Exception as e:
            print(f"  {Fore.RED}Batch failed: {e}")
            for r in batch:
                try:
                    supabase.table('stock_metrics').upsert(r, on_conflict='ticker').execute()
                    ok += 1
                except Exception as e2:
                    print(f"    {Fore.RED}{r.get('ticker')}: {e2}")
    print(f"{Fore.GREEN}stock_metrics: {ok}/{total} rows upserted")
    return ok


def main():
    parser = argparse.ArgumentParser(description='Import market_data and stock_metrics from CSV')
    parser.add_argument('--market-data', type=str, default='', help='Path to market_data.csv')
    parser.add_argument('--stock-metrics', type=str, default='', help='Path to stock_metrics.csv')
    args = parser.parse_args()

    market_path = resolve_path(args.market_data or None, DEFAULT_MARKET_DATA)
    metrics_path = resolve_path(args.stock_metrics or None, DEFAULT_STOCK_METRICS)

    print(f"\n{Fore.MAGENTA}{Style.BRIGHT}Market Data & Stock Metrics Importer")
    print(f"{Fore.CYAN}market_data: {market_path}")
    print(f"{Fore.CYAN}stock_metrics: {metrics_path}\n")

    df_market = read_csv(market_path, 'market_data.csv')
    df_metrics = read_csv(metrics_path, 'stock_metrics.csv')
    if df_market is None or df_metrics is None:
        sys.exit(1)

    market_records = prepare_market_data(df_market)
    metrics_records = prepare_stock_metrics(df_metrics)

    upsert_market_data(market_records)
    upsert_stock_metrics(metrics_records)

    print(f"\n{Fore.GREEN}{Style.BRIGHT}Done. Join companies with market_data/stock_metrics on ticker.\n")


if __name__ == '__main__':
    main()
