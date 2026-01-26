#!/usr/bin/env python3
"""
Quick fix for SQLite database locking - Enable WAL mode
Run this in your whisper-backend directory
"""

import sqlite3
import os
import sys

DB_PATH = 'speech_analysis.db'

print("=" * 60)
print("🔧 Quick Fix: Enable SQLite WAL Mode")
print("=" * 60)

# Check if database exists
if not os.path.exists(DB_PATH):
    print(f"\n❌ Database not found: {DB_PATH}")
    print(f"Current directory: {os.getcwd()}")
    print("\nMake sure you run this from the whisper-backend directory")
    sys.exit(1)

print(f"\n📁 Database found: {DB_PATH}")

try:
    # Connect with timeout
    print("\n🔌 Connecting to database...")
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    
    # Enable WAL mode
    print("📝 Enabling WAL mode...")
    result = conn.execute('PRAGMA journal_mode=WAL;').fetchone()
    conn.commit()
    
    if result[0].lower() == 'wal':
        print(f"   ✅ WAL mode enabled successfully")
    else:
        print(f"   ⚠️  Unexpected result: {result[0]}")
    
    # Set busy timeout
    print("\n⏱️  Setting busy timeout...")
    conn.execute('PRAGMA busy_timeout = 30000;')
    timeout_result = conn.execute('PRAGMA busy_timeout;').fetchone()
    conn.commit()
    print(f"   ✅ Busy timeout set to {timeout_result[0]}ms (30 seconds)")
    
    # Verify
    print("\n🔍 Verifying configuration...")
    mode = conn.execute('PRAGMA journal_mode;').fetchone()
    print(f"   Journal mode: {mode[0]}")
    
    conn.close()
    
    print("\n" + "=" * 60)
    print("✅ SUCCESS! Database configured for better concurrency")
    print("=" * 60)
    print("\n📋 Next steps:")
    print("   1. Restart your backend server")
    print("   2. Try logging in again")
    print("   3. The 'database is locked' error should be gone!")
    print("\n💡 Tip: If you still have issues, check FIX_DATABASE_LOCKING.md")
    
except sqlite3.OperationalError as e:
    print(f"\n❌ SQLite error: {e}")
    print("\n💡 Possible solutions:")
    print("   - Close any programs that have the database open")
    print("   - Stop the backend server and try again")
    print("   - Check file permissions")
    sys.exit(1)
    
except Exception as e:
    print(f"\n❌ Unexpected error: {e}")
    sys.exit(1)