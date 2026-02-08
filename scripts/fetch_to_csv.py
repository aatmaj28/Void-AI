#!/usr/bin/env python3
"""
Fetch S&P 500 Data to CSV

Fetches S&P 500 company data from GitHub CSV and yfinance,
then saves it to a local CSV file for later import.

Usage:
    python fetch_to_csv.py           # Fetch all ~500 companies
    python fetch_to_csv.py --test    # Test with first 10 stocks
    python fetch_to_csv.py --limit 50  # Fetch only 50 stocks
"""

import os
import sys
import time
import argparse
import requests
import pandas as pd
import yfinance as yf
from datetime import datetime

try:
    from colorama import init, Fore, Style
    init(autoreset=True)
except ImportError:
    class Fore:
        GREEN = RED = YELLOW = CYAN = BLUE = MAGENTA = ""
    class Style:
        BRIGHT = RESET_ALL = ""

# Configuration
SP500_CSV_URL = 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv'
OUTPUT_FILE = 'scripts/sp500_companies_data.csv'
DELAY_BETWEEN_REQUESTS = 1.5  # Increased to 1.5s to avoid rate limiting (was 0.5s)
PROGRESS_INTERVAL = 50

# Statistics
stats = {
    'total': 0,
    'successful': 0,
    'failed': 0,
    'failed_tickers': []
}


def fetch_sp500_list():
    """Fetch S&P 500 companies list from GitHub CSV."""
    print(f"\n{Fore.CYAN}📥 Fetching S&P 500 list from GitHub...")
    
    try:
        response = requests.get(SP500_CSV_URL, timeout=10)
        response.raise_for_status()
        
        from io import StringIO
        df = pd.read_csv(StringIO(response.text))
        
        print(f"{Fore.GREEN}✅ Fetched {len(df)} companies from CSV")
        print(f"{Fore.BLUE}📊 CSV Columns: {', '.join(df.columns.tolist())}")
        
        return df
    
    except Exception as e:
        print(f"{Fore.RED}❌ Error fetching S&P 500 list: {e}")
        sys.exit(1)


def fetch_yfinance_data(ticker):
    """Fetch company data from yfinance."""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        
        # Check if we got valid data
        if not info or len(info) == 0:
            return None
        
        # Extract relevant fields - match Colab code exactly
        data = {
            'name': info.get('longName'),
            'sector': info.get('sector'),
            'industry': info.get('industry'),
            'market_cap': info.get('marketCap'),
            'exchange': info.get('exchange'),
            'country': info.get('country')
        }
        
        # If we didn't get at least a name, consider it failed
        if not data['name']:
            return None
        
        return data
    
    except Exception as e:
        # Silently return None on error
        return None


def process_companies(df, limit=None, test_mode=False):
    """Process companies and build data list."""
    
    if test_mode:
        limit = 10
        print(f"\n{Fore.MAGENTA}🧪 TEST MODE: Processing first 10 stocks only")
    
    if limit:
        df = df.head(limit)
        print(f"\n{Fore.BLUE}📊 Processing {limit} companies...")
    else:
        print(f"\n{Fore.BLUE}📊 Processing all {len(df)} companies...")
    
    stats['total'] = len(df)
    start_time = time.time()
    
    print(f"{Fore.CYAN}{'='*80}")
    print(f"{Fore.CYAN}Starting data fetching...")
    print(f"{Fore.CYAN}{'='*80}\n")
    
    companies_data = []
    
    for idx, row in df.iterrows():
        ticker = row['Symbol']
        
        # Fetch yfinance data
        yf_data = fetch_yfinance_data(ticker)
        
        if yf_data is None or yf_data.get('name') is None:
            stats['failed'] += 1
            stats['failed_tickers'].append(ticker)
            print(f"{Fore.YELLOW}[{idx+1}/{stats['total']}] ⚠️  {ticker:6s} - Failed to fetch (using CSV data only)")
            
            # Use CSV data as fallback
            company_record = {
                'ticker': ticker,
                'name': row.get('Name', ''),
                'sector': row.get('Sector', ''),
                'industry': '',
                'market_cap': None,
                'exchange': '',
                'country': '',
                'cik': row.get('CIK', ''),
                'is_active': True
            }
        else:
            stats['successful'] += 1
            name = yf_data.get('name', row.get('Name', 'N/A'))
            sector = yf_data.get('sector', row.get('Sector', 'N/A'))
            
            company_record = {
                'ticker': ticker,
                'name': yf_data.get('name') or row.get('Name', ''),
                'sector': yf_data.get('sector') or row.get('Sector', ''),
                'industry': yf_data.get('industry', ''),
                'market_cap': yf_data.get('market_cap'),
                'exchange': yf_data.get('exchange', ''),
                'country': yf_data.get('country', ''),
                'cik': row.get('CIK', ''),
                'is_active': True
            }
            
            print(f"{Fore.GREEN}[{idx+1}/{stats['total']}] ✅ {ticker:6s} - {name[:40]:40s} ({sector})")
        
        companies_data.append(company_record)
        
        # Progress update
        if (idx + 1) % PROGRESS_INTERVAL == 0:
            elapsed = time.time() - start_time
            rate = (idx + 1) / elapsed
            remaining = (stats['total'] - (idx + 1)) / rate if rate > 0 else 0
            
            print(f"\n{Fore.CYAN}{'─'*80}")
            print(f"{Fore.CYAN}📊 Progress: {idx+1}/{stats['total']} ({(idx+1)/stats['total']*100:.1f}%)")
            print(f"{Fore.CYAN}⏱️  Elapsed: {elapsed:.1f}s | Estimated remaining: {remaining:.1f}s")
            print(f"{Fore.CYAN}✅ Successful: {stats['successful']} | ⚠️  Partial: {stats['failed']}")
            print(f"{Fore.CYAN}{'─'*80}\n")
        
        # Rate limiting
        time.sleep(DELAY_BETWEEN_REQUESTS)
    
    # Final summary
    elapsed = time.time() - start_time
    print(f"\n{Fore.CYAN}{'='*80}")
    print(f"{Fore.GREEN}✅ Data Fetching Complete!")
    print(f"{Fore.CYAN}{'='*80}")
    print(f"{Fore.BLUE}📊 Total processed: {stats['total']}")
    print(f"{Fore.GREEN}✅ Full data: {stats['successful']}")
    print(f"{Fore.YELLOW}⚠️  Partial data (CSV only): {stats['failed']}")
    print(f"{Fore.CYAN}⏱️  Total time: {elapsed:.1f}s ({elapsed/60:.1f} minutes)")
    print(f"{Fore.CYAN}{'='*80}\n")
    
    return companies_data


def save_to_csv(companies_data, output_file):
    """Save companies data to CSV file."""
    print(f"{Fore.CYAN}💾 Saving data to CSV...")
    
    try:
        df = pd.DataFrame(companies_data)
        df.to_csv(output_file, index=False)
        
        print(f"{Fore.GREEN}✅ Data saved to: {output_file}")
        print(f"{Fore.BLUE}📊 Total records: {len(df)}")
        print(f"{Fore.BLUE}📋 Columns: {', '.join(df.columns.tolist())}")
        
        # Show preview
        print(f"\n{Fore.CYAN}{'─'*80}")
        print(f"{Fore.CYAN}Preview (first 3 rows):")
        print(f"{Fore.CYAN}{'─'*80}")
        print(df.head(3).to_string())
        print(f"{Fore.CYAN}{'─'*80}\n")
        
        return True
    
    except Exception as e:
        print(f"{Fore.RED}❌ Error saving to CSV: {e}")
        return False


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Fetch S&P 500 data to CSV')
    parser.add_argument('--test', action='store_true', help='Test mode: fetch only first 10 stocks')
    parser.add_argument('--limit', type=int, help='Limit number of stocks to fetch')
    args = parser.parse_args()
    
    print(f"\n{Fore.MAGENTA}{Style.BRIGHT}{'='*80}")
    print(f"{Fore.MAGENTA}{Style.BRIGHT}  S&P 500 Data Fetcher - CSV Export")
    print(f"{Fore.MAGENTA}{Style.BRIGHT}{'='*80}\n")
    
    # Fetch S&P 500 list
    df = fetch_sp500_list()
    
    # Process companies
    companies_data = process_companies(df, limit=args.limit, test_mode=args.test)
    
    # Save to CSV
    if save_to_csv(companies_data, OUTPUT_FILE):
        print(f"{Fore.GREEN}{Style.BRIGHT}🎉 Success! CSV file ready for import.\n")
        print(f"{Fore.CYAN}Next step: Run the import script to load data into Supabase:")
        print(f"{Fore.YELLOW}  python scripts/import_from_csv.py\n")
    else:
        print(f"{Fore.RED}❌ Failed to save CSV file.\n")
        sys.exit(1)


if __name__ == '__main__':
    main()
