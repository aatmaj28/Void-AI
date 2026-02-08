#!/usr/bin/env python3
"""
S&P 500 Companies Data Population Script

Fetches S&P 500 company data from GitHub CSV and yfinance,
then populates the Supabase companies table.

Usage:
    python populate_companies.py           # Run full population
    python populate_companies.py --test    # Test with first 10 stocks
    python populate_companies.py --limit 50  # Process only 50 stocks
"""

import os
import sys
import time
import argparse
import requests
import pandas as pd
import yfinance as yf
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

# Fix Windows console encoding for emoji/Unicode output
if sys.platform == 'win32' and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

try:
    from colorama import init, Fore, Style
    init(autoreset=True)
    HAS_COLOR = True
except ImportError:
    HAS_COLOR = False
    # Fallback for no colorama
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
SP500_CSV_URL = 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv'
DELAY_BETWEEN_REQUESTS = 0.6  # seconds (increase if you see 429 Too Many Requests)
RETRY_DELAY = 8  # seconds to wait before retry after rate limit / transient error
MAX_RETRIES = 3  # retries per ticker before giving up
PROGRESS_INTERVAL = 50  # Print progress every N stocks

# Validate environment variables
if not SUPABASE_URL or not SUPABASE_KEY:
    print(f"{Fore.RED}❌ Error: Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.local")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Statistics
stats = {
    'total': 0,
    'successful': 0,
    'failed': 0,
    'skipped': 0,
    'failed_tickers': []
}


def fetch_sp500_list():
    """Fetch S&P 500 companies list from GitHub CSV."""
    print(f"\n{Fore.CYAN}📥 Fetching S&P 500 list from GitHub...")
    
    try:
        response = requests.get(SP500_CSV_URL, timeout=10)
        response.raise_for_status()
        
        # Parse CSV
        from io import StringIO
        df = pd.read_csv(StringIO(response.text))
        
        # Normalize column names (repo uses Symbol, Security, GICS Sector, CIK)
        if 'Security' in df.columns and 'Name' not in df.columns:
            df = df.rename(columns={'Security': 'Name'})
        if 'GICS Sector' in df.columns and 'Sector' not in df.columns:
            df = df.rename(columns={'GICS Sector': 'Sector'})
        
        print(f"{Fore.GREEN}✅ Fetched {len(df)} companies from CSV")
        print(f"{Fore.BLUE}📊 Columns: {', '.join(df.columns.tolist())}")
        
        return df
    
    except Exception as e:
        print(f"{Fore.RED}❌ Error fetching S&P 500 list: {e}")
        sys.exit(1)


def fetch_yfinance_data(ticker, debug=False):
    """Fetch company data from yfinance."""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        
        if debug:
            print(f"{Fore.CYAN}Debug - Raw info keys: {list(info.keys())[:10]}...")
        
        # Extract relevant fields with fallbacks
        data = {
            'name': info.get('longName') or info.get('shortName'),
            'sector': info.get('sector'),
            'industry': info.get('industry'),
            'market_cap': info.get('marketCap'),
            'exchange': info.get('exchange'),
            'country': info.get('country')
        }
        
        if debug:
            print(f"{Fore.CYAN}Debug - Extracted data: {data}")
        
        return data
    
    except Exception as e:
        print(f"{Fore.YELLOW}⚠️  Error fetching {ticker} from yfinance: {e}")
        if debug:
            import traceback
            traceback.print_exc()
        return None


def _csv_val(csv_data, *keys):
    """Get first non-None value from csv_data for given keys (handles different CSV column names)."""
    for k in keys:
        v = csv_data.get(k)
        if v is not None and (not isinstance(v, str) or str(v).strip()):
            return str(v).strip() if isinstance(v, str) else v
    return None


def upsert_company(ticker, csv_data, yf_data, debug=False):
    """Insert or update company in database."""
    try:
        # Combine CSV (CIK + fallback name/sector) with yfinance data
        cik_raw = _csv_val(csv_data, 'CIK')
        company_data = {
            'ticker': ticker,
            'name': yf_data.get('name') or _csv_val(csv_data, 'Name', 'Security'),
            'sector': yf_data.get('sector') or _csv_val(csv_data, 'Sector', 'GICS Sector'),
            'industry': yf_data.get('industry'),
            'market_cap': yf_data.get('market_cap'),
            'exchange': yf_data.get('exchange'),
            'country': yf_data.get('country'),
            'cik': str(cik_raw) if cik_raw is not None else None,
            'is_active': True,
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Remove None values to avoid overwriting with null
        company_data = {k: v for k, v in company_data.items() if v is not None}
        
        if debug:
            print(f"{Fore.CYAN}Debug - Data to upsert: {company_data}")
        
        # Upsert to database
        result = supabase.table('companies').upsert(
            company_data,
            on_conflict='ticker'
        ).execute()
        
        if debug:
            print(f"{Fore.CYAN}Debug - Upsert result: {result}")
        
        return True
    
    except Exception as e:
        print(f"{Fore.RED}❌ Database error for {ticker}: {e}")
        if debug:
            import traceback
            traceback.print_exc()
        return False


def process_companies(df, limit=None, test_mode=False, debug=False):
    """Process and populate companies data."""
    
    if test_mode:
        limit = 10
        debug = True  # Enable debug in test mode
        print(f"\n{Fore.MAGENTA}🧪 TEST MODE: Processing first 10 stocks only (DEBUG ENABLED)")
    
    if limit:
        df = df.head(limit)
        print(f"\n{Fore.BLUE}📊 Processing {limit} companies...")
    else:
        print(f"\n{Fore.BLUE}📊 Processing all {len(df)} companies...")
    
    stats['total'] = len(df)
    start_time = time.time()
    
    print(f"{Fore.CYAN}{'='*80}")
    print(f"{Fore.CYAN}Starting data population...")
    print(f"{Fore.CYAN}{'='*80}\n")
    
    for idx, row in df.iterrows():
        ticker = row['Symbol']
        
        if debug:
            print(f"\n{Fore.MAGENTA}{'─'*80}")
            print(f"{Fore.MAGENTA}Processing ticker: {ticker}")
        
        # Fetch yfinance data
        yf_data = fetch_yfinance_data(ticker, debug=debug)
        
        if yf_data is None:
            stats['failed'] += 1
            stats['failed_tickers'].append(ticker)
            print(f"{Fore.RED}[{idx+1}/{stats['total']}] ❌ {ticker} - Failed to fetch data")
            time.sleep(DELAY_BETWEEN_REQUESTS)
            continue
        
        # Upsert to database
        success = upsert_company(ticker, row.to_dict(), yf_data, debug=debug)
        
        if success:
            stats['successful'] += 1
            name = yf_data.get('name', 'N/A')
            sector = yf_data.get('sector', 'N/A')
            print(f"{Fore.GREEN}[{idx+1}/{stats['total']}] ✅ {ticker:6s} - {name[:40]:40s} ({sector})")
        else:
            stats['failed'] += 1
            stats['failed_tickers'].append(ticker)
            print(f"{Fore.RED}[{idx+1}/{stats['total']}] ❌ {ticker} - Database insert failed")
        
        if debug:
            print(f"{Fore.MAGENTA}{'─'*80}\n")
        
        # Progress update
        if (idx + 1) % PROGRESS_INTERVAL == 0 and not debug:
            elapsed = time.time() - start_time
            rate = (idx + 1) / elapsed
            remaining = (stats['total'] - (idx + 1)) / rate if rate > 0 else 0
            
            print(f"\n{Fore.CYAN}{'─'*80}")
            print(f"{Fore.CYAN}📊 Progress: {idx+1}/{stats['total']} ({(idx+1)/stats['total']*100:.1f}%)")
            print(f"{Fore.CYAN}⏱️  Elapsed: {elapsed:.1f}s | Estimated remaining: {remaining:.1f}s")
            print(f"{Fore.CYAN}✅ Successful: {stats['successful']} | ❌ Failed: {stats['failed']}")
            print(f"{Fore.CYAN}{'─'*80}\n")
        
        # Rate limiting
        time.sleep(DELAY_BETWEEN_REQUESTS)
    
    # Final summary
    elapsed = time.time() - start_time
    print(f"\n{Fore.CYAN}{'='*80}")
    print(f"{Fore.GREEN}✅ Population Complete!")
    print(f"{Fore.CYAN}{'='*80}")
    print(f"{Fore.BLUE}📊 Total processed: {stats['total']}")
    print(f"{Fore.GREEN}✅ Successful: {stats['successful']}")
    print(f"{Fore.RED}❌ Failed: {stats['failed']}")
    print(f"{Fore.CYAN}⏱️  Total time: {elapsed:.1f}s ({elapsed/60:.1f} minutes)")
    print(f"{Fore.CYAN}{'='*80}\n")
    
    # Log failed tickers
    if stats['failed_tickers']:
        log_file = os.path.join(_script_dir, 'failed_tickers.log')
        with open(log_file, 'w') as f:
            f.write(f"Failed tickers ({len(stats['failed_tickers'])}):\n")
            f.write('\n'.join(stats['failed_tickers']))
        print(f"{Fore.YELLOW}⚠️  Failed tickers logged to: {log_file}")


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Populate S&P 500 companies data')
    parser.add_argument('--test', action='store_true', help='Test mode: process only first 10 stocks')
    parser.add_argument('--limit', type=int, help='Limit number of stocks to process')
    args = parser.parse_args()
    
    print(f"\n{Fore.MAGENTA}{Style.BRIGHT}{'='*80}")
    print(f"{Fore.MAGENTA}{Style.BRIGHT}  S&P 500 Companies Data Population Script")
    print(f"{Fore.MAGENTA}{Style.BRIGHT}{'='*80}\n")
    
    # Fetch S&P 500 list
    df = fetch_sp500_list()
    
    # Process companies
    process_companies(df, limit=args.limit, test_mode=args.test)
    
    print(f"{Fore.GREEN}{Style.BRIGHT}🎉 All done! Check your Supabase dashboard to view the data.\n")


if __name__ == '__main__':
    main()
