import os
import pathlib
from dotenv import load_dotenv
import psycopg2

# Load env
root = pathlib.Path(__file__).resolve().parent.parent
load_dotenv(root / ".env.local")

conn_string = os.getenv("PG_CONN_STRING")
if not conn_string:
    print("❌ PG_CONN_STRING not found in .env.local")
    exit(1)

print(f"Connection string: {conn_string[:40]}...{conn_string[-20:]}")

try:
    conn = psycopg2.connect(conn_string)
    cur = conn.cursor()

    # Test 1: Basic connection
    cur.execute("SELECT version();")
    version = cur.fetchone()[0]
    print(f"✅ Connected to: {version[:60]}...")

    # Test 2: pgvector enabled
    cur.execute("SELECT extversion FROM pg_extension WHERE extname = 'vector';")
    row = cur.fetchone()
    if row:
        print(f"✅ pgvector enabled (v{row[0]})")
    else:
        print("❌ pgvector NOT enabled")

    # Test 3: sec_documents table exists
    cur.execute("SELECT COUNT(*) FROM sec_documents;")
    count = cur.fetchone()[0]
    print(f"✅ sec_documents table exists ({count} rows)")

    # Test 4: Can read existing tables
    cur.execute("SELECT COUNT(*) FROM companies;")
    count = cur.fetchone()[0]
    print(f"✅ companies table accessible ({count} rows)")

    cur.close()
    conn.close()
    print("\n✅ All checks passed — connection is working!")

except Exception as e:
    print(f"\n❌ Connection failed: {e}")
    print("\nCommon fixes:")
    print("  1. Make sure you're using Session mode (port 5432), not Transaction mode (6543)")
    print("  2. Check your database password is correct")
    print("  3. If you see 'no pg_hba.conf entry', add your IP to Supabase allowed IPs")
