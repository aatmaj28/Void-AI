#!/usr/bin/env python3
"""
Verify Companies Data Script

Queries the companies table and displays statistics and data quality metrics.

Usage:
    python verify_data.py
"""

import os
import sys
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

# Load environment variables
load_dotenv('.env.local')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print(f"{Fore.RED}❌ Error: Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.local")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def verify_data():
    """Verify companies table data."""
    
    print(f"\n{Fore.CYAN}{'='*80}")
    print(f"{Fore.CYAN}  Companies Table Verification")
    print(f"{Fore.CYAN}{'='*80}\n")
    
    try:
        # Get total count
        result = supabase.table('companies').select('*', count='exact').execute()
        total_count = result.count
        
        print(f"{Fore.GREEN}✅ Total companies: {total_count}")
        
        # Get all data for analysis
        all_data = supabase.table('companies').select('*').execute()
        companies = all_data.data
        
        if not companies:
            print(f"{Fore.YELLOW}⚠️  No data found in companies table")
            return
        
        # Data quality checks
        print(f"\n{Fore.CYAN}{'─'*80}")
        print(f"{Fore.CYAN}Data Quality Checks:")
        print(f"{Fore.CYAN}{'─'*80}\n")
        
        # Check for missing critical fields
        missing_name = sum(1 for c in companies if not c.get('name'))
        missing_ticker = sum(1 for c in companies if not c.get('ticker'))
        missing_sector = sum(1 for c in companies if not c.get('sector'))
        
        print(f"{Fore.BLUE}Missing name: {missing_name}")
        print(f"{Fore.BLUE}Missing ticker: {missing_ticker}")
        print(f"{Fore.BLUE}Missing sector: {missing_sector}")
        
        # Sector distribution
        print(f"\n{Fore.CYAN}{'─'*80}")
        print(f"{Fore.CYAN}Sector Distribution:")
        print(f"{Fore.CYAN}{'─'*80}\n")
        
        sectors = {}
        for company in companies:
            sector = company.get('sector', 'Unknown')
            sectors[sector] = sectors.get(sector, 0) + 1
        
        for sector, count in sorted(sectors.items(), key=lambda x: x[1], reverse=True):
            bar = '█' * (count // 5)
            print(f"{Fore.GREEN}{sector:30s} {count:3d} {bar}")
        
        # Sample records
        print(f"\n{Fore.CYAN}{'─'*80}")
        print(f"{Fore.CYAN}Sample Records (first 5):")
        print(f"{Fore.CYAN}{'─'*80}\n")
        
        for i, company in enumerate(companies[:5], 1):
            print(f"{Fore.MAGENTA}{i}. {company.get('ticker', 'N/A'):6s} - {company.get('name', 'N/A')}")
            print(f"   Sector: {company.get('sector', 'N/A')}")
            print(f"   Industry: {company.get('industry', 'N/A')}")
            print(f"   Market Cap: ${company.get('market_cap', 0):,}" if company.get('market_cap') else "   Market Cap: N/A")
            print(f"   Exchange: {company.get('exchange', 'N/A')}")
            print(f"   Country: {company.get('country', 'N/A')}")
            print()
        
        print(f"{Fore.CYAN}{'='*80}\n")
        print(f"{Fore.GREEN}✅ Verification complete!\n")
        
    except Exception as e:
        print(f"{Fore.RED}❌ Error verifying data: {e}")
        sys.exit(1)


if __name__ == '__main__':
    verify_data()
