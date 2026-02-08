#!/usr/bin/env python3
"""
Import S&P 500 Data from CSV to Supabase

Reads the CSV file created by fetch_to_csv.py and bulk imports
the data into the Supabase companies table.

Usage:
    python import_from_csv.py
    python import_from_csv.py --file path/to/custom.csv
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

# Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY')
DEFAULT_CSV_FILE = os.path.join(_script_dir, 'sp500_companies_data.csv')
BATCH_SIZE = 100  # Insert in batches of 100

# Validate environment variables
if not SUPABASE_URL or not SUPABASE_KEY:
    print(f"{Fore.RED}❌ Error: Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.local")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def read_csv(csv_file):
    """Read companies data from CSV file."""
    # Resolve path: if relative, look under project scripts/ then project root
    if not os.path.isabs(csv_file):
        for base in (_script_dir, _project_root):
            candidate = os.path.join(base, csv_file) if os.path.dirname(csv_file) else os.path.join(base, os.path.basename(csv_file))
            if os.path.exists(candidate):
                csv_file = candidate
                break
        else:
            csv_file = os.path.join(_script_dir, os.path.basename(csv_file)) if os.path.dirname(csv_file) else os.path.join(_script_dir, csv_file)

    print(f"\n{Fore.CYAN}Reading CSV file: {csv_file}")
    
    try:
        if not os.path.exists(csv_file):
            print(f"{Fore.RED}Error: CSV file not found: {csv_file}")
            print(f"{Fore.YELLOW}Put your Colab-exported CSV in: scripts/sp500_companies_data.csv")
            sys.exit(1)
        
        df = pd.read_csv(csv_file)
        # Normalize column names (Colab/export may use different casing or Symbol vs ticker)
        col_map = {'Symbol': 'ticker', 'Name': 'name', 'Sector': 'sector', 'Industry': 'industry',
                   'market_cap': 'market_cap', 'Exchange': 'exchange', 'Country': 'country', 'CIK': 'cik', 'is_active': 'is_active'}
        df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns and k != v})
        if 'ticker' not in df.columns and 'Symbol' in df.columns:
            df = df.rename(columns={'Symbol': 'ticker'})
        
        print(f"{Fore.GREEN}Read {len(df)} records from CSV")
        print(f"{Fore.BLUE}Columns: {', '.join(df.columns.tolist())}")
        
        return df
    
    except Exception as e:
        print(f"{Fore.RED}Error reading CSV: {e}")
        sys.exit(1)


def prepare_records(df):
    """Prepare records for database insertion."""
    print(f"\n{Fore.CYAN}Preparing records for import...")
    
    records = []
    ticker_col = 'ticker' if 'ticker' in df.columns else 'Symbol'
    
    for idx, row in df.iterrows():
        try:
            market_cap = row.get('market_cap')
            if pd.notna(market_cap):
                market_cap = int(float(market_cap))
            else:
                market_cap = None
        except (TypeError, ValueError):
            market_cap = None

        cik_val = None
        if 'cik' in df.columns and pd.notna(row.get('cik')):
            try:
                v = row['cik']
                cik_val = str(int(float(v))) if v is not None else None
            except (TypeError, ValueError):
                cik_val = str(v).strip() or None

        record = {
            'ticker': str(row[ticker_col]).strip(),
            'name': str(row['name']).strip() if 'name' in df.columns and pd.notna(row.get('name')) else None,
            'sector': str(row['sector']).strip() if 'sector' in df.columns and pd.notna(row.get('sector')) else None,
            'industry': str(row['industry']).strip() if 'industry' in df.columns and pd.notna(row.get('industry')) else None,
            'market_cap': market_cap,
            'exchange': str(row['exchange']).strip() if 'exchange' in df.columns and pd.notna(row.get('exchange')) else None,
            'country': str(row['country']).strip() if 'country' in df.columns and pd.notna(row.get('country')) else None,
            'cik': cik_val,
            'is_active': bool(row['is_active']) if 'is_active' in df.columns and pd.notna(row.get('is_active')) else True,
            'updated_at': datetime.utcnow().isoformat(),
        }
        record = {k: v for k, v in record.items() if v is not None}
        records.append(record)
    
    print(f"{Fore.GREEN}Prepared {len(records)} records")
    
    return records


def bulk_import(records):
    """Bulk import records to Supabase."""
    print(f"\n{Fore.CYAN}{'='*80}")
    print(f"{Fore.CYAN}Starting bulk import to Supabase...")
    print(f"{Fore.CYAN}{'='*80}\n")
    
    total_records = len(records)
    successful = 0
    failed = 0
    
    # Import in batches
    for i in range(0, total_records, BATCH_SIZE):
        batch = records[i:i+BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1
        total_batches = (total_records + BATCH_SIZE - 1) // BATCH_SIZE
        
        try:
            print(f"{Fore.CYAN}[Batch {batch_num}/{total_batches}] Importing {len(batch)} records...")
            
            # Upsert batch
            result = supabase.table('companies').upsert(
                batch,
                on_conflict='ticker'
            ).execute()
            
            successful += len(batch)
            print(f"{Fore.GREEN}✅ Batch {batch_num} imported successfully ({len(batch)} records)")
            
        except Exception as e:
            failed += len(batch)
            print(f"{Fore.RED}❌ Batch {batch_num} failed: {e}")
            
            # Try individual inserts for failed batch
            print(f"{Fore.YELLOW}⚠️  Retrying batch {batch_num} with individual inserts...")
            for record in batch:
                try:
                    supabase.table('companies').upsert(
                        record,
                        on_conflict='ticker'
                    ).execute()
                    successful += 1
                    failed -= 1
                except Exception as e2:
                    print(f"{Fore.RED}  ❌ Failed to import {record.get('ticker', 'UNKNOWN')}: {e2}")
    
    # Final summary
    print(f"\n{Fore.CYAN}{'='*80}")
    print(f"{Fore.GREEN}✅ Import Complete!")
    print(f"{Fore.CYAN}{'='*80}")
    print(f"{Fore.BLUE}📊 Total records: {total_records}")
    print(f"{Fore.GREEN}✅ Successful: {successful}")
    print(f"{Fore.RED}❌ Failed: {failed}")
    print(f"{Fore.CYAN}{'='*80}\n")
    
    return successful, failed


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Import S&P 500 data from CSV to Supabase')
    parser.add_argument('--file', type=str, default=DEFAULT_CSV_FILE, help='Path to CSV file')
    args = parser.parse_args()
    
    print(f"\n{Fore.MAGENTA}{Style.BRIGHT}{'='*80}")
    print(f"{Fore.MAGENTA}{Style.BRIGHT}  S&P 500 CSV to Supabase Importer")
    print(f"{Fore.MAGENTA}{Style.BRIGHT}{'='*80}\n")
    
    # Read CSV
    df = read_csv(args.file)
    
    # Prepare records
    records = prepare_records(df)
    
    # Bulk import
    successful, failed = bulk_import(records)
    
    if failed == 0:
        print(f"{Fore.GREEN}{Style.BRIGHT}🎉 All records imported successfully!\n")
        print(f"{Fore.CYAN}Next step: Verify the data:")
        print(f"{Fore.YELLOW}  python scripts/verify_data.py\n")
    else:
        print(f"{Fore.YELLOW}⚠️  Import completed with {failed} failures.\n")
        print(f"{Fore.CYAN}Check the errors above and verify the data:")
        print(f"{Fore.YELLOW}  python scripts/verify_data.py\n")


if __name__ == '__main__':
    main()
