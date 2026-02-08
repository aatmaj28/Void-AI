#!/usr/bin/env python3
"""
Test if yfinance API is accessible
"""

import yfinance as yf
import time

print("\n🧪 Testing yfinance API access...\n")

test_tickers = ['AAPL', 'MSFT', 'GOOGL']

for ticker in test_tickers:
    try:
        print(f"Testing {ticker}...", end=" ")
        stock = yf.Ticker(ticker)
        info = stock.info
        name = info.get('longName', 'N/A')
        
        if name and name != 'N/A':
            print(f"✅ {name}")
        else:
            print(f"⚠️  No data returned")
        
        time.sleep(2)  # 2 second delay
        
    except Exception as e:
        print(f"❌ Error: {e}")

print("\n✅ Test complete!")
