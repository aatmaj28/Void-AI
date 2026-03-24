#!/usr/bin/env python3
"""
Generate Alerts based on the latest pipeline data.

Reads:
- alert_settings
- coverage_gap_scores
- stock_metrics
- analyst_coverage

Writes:
- alerts
"""

import os
import sys
import numpy as np
import pandas as pd
from datetime import datetime
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv
from supabase import create_client, Client

_script_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_script_dir)
load_dotenv(os.path.join(_project_root, '.env.local'))

GMAIL_USER = os.getenv('GMAIL_USER')
GMAIL_APP_PASSWORD = os.getenv('GMAIL_APP_PASSWORD')
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY') or os.getenv('SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print('Error: Missing SUPABASE_URL or SUPABASE_ANON_KEY result.')
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def fetch_all(table_name, select_query="*"):
    all_data = []
    page_size = 1000
    offset = 0
    while True:
        res = supabase.table(table_name).select(select_query).range(offset, offset + page_size - 1).execute()
        data = res.data or []
        all_data.extend(data)
        if len(data) < page_size:
            break
        offset += page_size
    return pd.DataFrame(all_data)

def send_alert_email(to_email, alerts):
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print("    ⚠️ Email credentials missing. Cannot send email.")
        return
        
    html = f"""
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0c0a09; color: #e4e4e7; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #18181b; padding: 30px; border-radius: 12px; border: 1px solid #27272a; }}
            .header {{ text-align: center; border-bottom: 1px solid #3f3f46; padding-bottom: 20px; margin-bottom: 20px; }}
            .header h1 {{ color: #a855f7; margin: 0; font-size: 24px; }}
            .header p {{ color: #a1a1aa; margin-top: 8px; font-size: 14px; }}
            .alert {{ background-color: #27272a; padding: 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #a855f7; }}
            .alert.high {{ border-left-color: #ef4444; }}
            .alert.medium {{ border-left-color: #f59e0b; }}
            .alert.warning {{ border-left-color: #eab308; }}
            .title {{ font-weight: bold; font-size: 16px; margin-bottom: 8px; color: #ffffff; display: flex; align-items: center; gap: 8px; }}
            .ticker {{ background-color: #3b0764; color: #d8b4fe; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px; font-family: monospace; }}
            .message {{ font-size: 14px; color: #a1a1aa; margin: 0; line-height: 1.5; }}
            .footer {{ text-align: center; margin-top: 30px; font-size: 12px; color: #71717a; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>VOID.AI Alerts</h1>
                <p>You have {len(alerts)} new alerts today matching your criteria.</p>
            </div>
            <div class="content">
    """
    
    for alert in alerts:
        severity_class = alert.get("severity", "medium")
        html += f"""
            <div class="alert {severity_class}">
                <div class="title"><span class="ticker">{alert['ticker']}</span>{alert['title']}</div>
                <p class="message">{alert['message']}</p>
            </div>
        """
        
    html += """
            </div>
            <div class="footer">
                Manage your notification preferences on the Void AI Alerts Dashboard.
            </div>
        </div>
    </body>
    </html>
    """
    
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"VOID.AI: {len(alerts)} New Alpha Opportunities & Alerts 🚀"
    msg["From"] = f"Void AI Alerts <{GMAIL_USER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))
    
    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.send_message(msg)
        print(f"    ✉️ Email digest sent successfully to {to_email}")
    except Exception as e:
        print(f"    ❌ Failed to send email to {to_email}: {e}")

def generate_alerts():
    print("\n============================================================")
    print("Alerts Generation Engine")
    print("============================================================")

    print("Fetching existing alerts to prevent duplicates...")
    today_start = datetime.utcnow().strftime("%Y-%m-%dT00:00:00Z")
    recent_alerts_res = supabase.table("alerts").select("user_email, ticker, type").gte("created_at", today_start).execute()
    existing_alerts = set()
    for row in (recent_alerts_res.data or []):
        existing_alerts.add((row["user_email"], row["ticker"], row["type"]))

    print("Fetching settings and stock data...")
    settings_df = fetch_all("alert_settings")
    if settings_df.empty:
        print("No user alert settings found. Skipping.")
        return

    metrics_df = fetch_all("stock_metrics")
    scores_df = fetch_all("coverage_gap_scores")
    coverage_df = fetch_all("analyst_coverage")

    if metrics_df.empty or scores_df.empty:
        print("Missing required stock data.")
        return

    data = metrics_df.merge(scores_df, on="ticker", how="inner")
    if not coverage_df.empty:
        data = data.merge(coverage_df, on="ticker", how="left")

    alerts_to_insert = []
    count_generated = 0
    
    # Store per-user alerts so we can email them in bulk
    user_daily_alerts = {}

    for _, settings in settings_df.iterrows():
        email = settings.get("user_email")
        if not email: continue
        
        user_daily_alerts[email] = []

        print(f"  Evaluating alerts for user: {email}...")

        if settings.get("volume_spike"):
            vol_multiplier = settings.get("volume_threshold", 2.0)
            spikes = data[(data["volume"] > 0) & (data["avg_volume_20d"] > 0) & (data["volume"] >= data["avg_volume_20d"] * vol_multiplier)]
            for _, row in spikes.head(10).iterrows():
                if (email, row["ticker"], "volume_spike") in existing_alerts:
                    continue
                ratio = row["volume"] / max(row["avg_volume_20d"], 1)
                new_alert = {
                    "user_email": email,
                    "ticker": row["ticker"],
                    "type": "volume_spike",
                    "severity": "high" if ratio > 3 else "medium",
                    "title": f"Volume Spike on {row['ticker']}",
                    "message": f"{row['ticker']} is trading at {ratio:.1f}x its average 20-day volume."
                } 
                user_daily_alerts[email].append(new_alert)
                alerts_to_insert.append(new_alert)

        if settings.get("gap_increase"):
            gap_threshold = settings.get("gap_threshold", 50)
            high_gaps = data[data["gap_score"] >= (70 + gap_threshold / 2)]
            for _, row in high_gaps.head(10).iterrows():
                if (email, row["ticker"], "gap_increase") in existing_alerts:
                    continue
                new_alert = {
                    "user_email": email,
                    "ticker": row["ticker"],
                    "type": "gap_increase",
                    "severity": "high" if row["gap_score"] > 85 else "medium",
                    "title": "High Gap Score Detected",
                    "message": f"Gap Score for {row['ticker']} reached {row['gap_score']:.1f}, indicating a strong void opportunity."
                } 
                user_daily_alerts[email].append(new_alert)
                alerts_to_insert.append(new_alert)

        if settings.get("coverage_change") and "coverage_momentum" in data.columns:
            drops = data[data["coverage_momentum"] < 0]
            for _, row in drops.head(5).iterrows():
                if (email, row["ticker"], "coverage_change") in existing_alerts:
                    continue
                new_alert = {
                    "user_email": email,
                    "ticker": row["ticker"],
                    "type": "coverage_change",
                    "severity": "warning",
                    "title": "Analyst Coverage Dropped",
                    "message": f"Analysts are dropping coverage on {row['ticker']}. Current estimate count is low."
                } 
                user_daily_alerts[email].append(new_alert)
                alerts_to_insert.append(new_alert)

        if settings.get("new_opportunity") and "confidence" in data.columns:
            new_opps = data[data["confidence"] > 80]
            for _, row in new_opps.head(5).iterrows():
                if (email, row["ticker"], "new_opportunity") in existing_alerts:
                    continue
                new_alert = {
                    "user_email": email,
                    "ticker": row["ticker"],
                    "type": "new_opportunity",
                    "severity": "medium",
                    "title": "New Void Identified",
                    "message": f"Strong confidence ({row['confidence']:.0f}%) of a structural opportunity in {row['ticker']}."
                } 
                user_daily_alerts[email].append(new_alert)
                alerts_to_insert.append(new_alert)

    if len(alerts_to_insert) > 0:
        print(f"Generated {len(alerts_to_insert)} total alerts. Upserting to Supabase...")
        batch_size = 100
        for i in range(0, len(alerts_to_insert), batch_size):
            batch = alerts_to_insert[i:i + batch_size]
            try:
                supabase.table("alerts").insert(batch).execute()
                count_generated += len(batch)
            except Exception as e:
                print(f"Error inserting alerts: {e}")
        print(f"Delivered {count_generated} alerts to database!")
        
        # Send emails to users who opted in and have alerts
        print("Processing email notifications...")
        for _, settings in settings_df.iterrows():
            email = settings.get("user_email")
            if not email: continue
            
            wants_email = settings.get("email_notifications", False)
            user_alerts = user_daily_alerts.get(email, [])
            
            if wants_email and len(user_alerts) > 0:
                print(f"  Sending digest to {email} ({len(user_alerts)} alerts)...")
                send_alert_email(email, user_alerts)
                
    else:
        print("No new alerts triggered.")
    
    print("=" * 60 + "\n")
    return count_generated

def main():
    generate_alerts()

if __name__ == "__main__":
    main()