#!/usr/bin/env python3
"""
Test script to fetch all constituents for S&P 500, S&P 400, and Russell 2000.
Saves the results to scripts/test_index_tickers.csv.
"""

import os
import requests
import pandas as pd
from io import StringIO
from datetime import datetime

# Configuration
SP500_URL = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv"
RUSSELL_2000_URL = "https://raw.githubusercontent.com/ikoniaris/Russell2000/master/russell_2000_components.csv"
WIKIPEDIA_SP400_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_400_companies"

def fetch_sp500():
    print("Fetching S&P 500 constituents...")
    r = requests.get(SP500_URL, timeout=15)
    r.raise_for_status()
    df = pd.read_csv(StringIO(r.text))
    # Columns: Symbol, Name, Sector
    return df[['Symbol', 'Security']].rename(columns={'Symbol': 'Ticker', 'Security': 'Name'})

def fetch_sp400():
    print("Fetching S&P 400 constituents from Wikipedia...")
    headers = {"User-Agent": "VoidAI-TestScript/1.0 (https://github.com)"}
    r = requests.get(WIKIPEDIA_SP400_URL, timeout=15, headers=headers)
    r.raise_for_status()
    tables = pd.read_html(StringIO(r.text), match="Symbol")
    if not tables:
        raise ValueError("No S&P 400 table found on Wikipedia")
    df = tables[0]
    # Wikipedia table columns might vary, but usually has 'Symbol' and 'Company'
    ticker_col = 'Symbol' if 'Symbol' in df.columns else df.columns[0]
    name_col = 'Company' if 'Company' in df.columns else df.columns[1]
    return df[[ticker_col, name_col]].rename(columns={ticker_col: 'Ticker', name_col: 'Name'})

def fetch_russell2000():
    print("Fetching Russell 2000 constituents...")
    r = requests.get(RUSSELL_2000_URL, timeout=15)
    r.raise_for_status()
    df = pd.read_csv(StringIO(r.text))
    df.columns = df.columns.str.strip()
    ticker_col = "Ticker" if "Ticker" in df.columns else df.columns[0]
    name_col = "Name" if "Name" in df.columns else df.columns[1]
    return df[[ticker_col, name_col]].rename(columns={ticker_col: 'Ticker', name_col: 'Name'})

def main():
    try:
        sp500_df = fetch_sp500()
        sp500_df['Index'] = 'S&P 500'
        print(f"  Fetched {len(sp500_df)} S&P 500 tickers.")

        sp400_df = fetch_sp400()
        sp400_df['Index'] = 'S&P 400'
        print(f"  Fetched {len(sp400_df)} S&P 400 tickers.")

        russell_df = fetch_russell2000()
        russell_df['Index'] = 'Russell 2000'
        print(f"  Fetched {len(russell_df)} Russell 2000 tickers.")

        # Combine
        combined_df = pd.concat([sp500_df, sp400_df, russell_df], ignore_index=True)
        
        # Clean up tickers (some might have whitespace)
        combined_df['Ticker'] = combined_df['Ticker'].astype(str).str.strip()
        combined_df['Name'] = combined_df['Name'].astype(str).str.strip()

        # Save to CSV
        output_file = "scripts/test_index_tickers.csv"
        combined_df.to_csv(output_file, index=False)
        
        print("\n" + "="*50)
        print(f"SUCCESS: Saved {len(combined_df)} tickers to {output_file}")
        print("Displaying first 5 rows of each index:")
        print("\n--- S&P 500 ---")
        print(combined_df[combined_df['Index'] == 'S&P 500'].head(5))
        print("\n--- S&P 400 ---")
        print(combined_df[combined_df['Index'] == 'S&P 400'].head(5))
        print("\n--- Russell 2000 ---")
        print(combined_df[combined_df['Index'] == 'Russell 2000'].head(5))
        print("="*50)

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
