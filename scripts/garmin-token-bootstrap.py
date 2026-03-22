#!/usr/bin/env python3
"""
Garmin token bootstrap — interactive login with MFA.

Uses garth to authenticate with Garmin Connect. Saves OAuth1 + OAuth2
tokens to ~/.garth/ for use by the local sync script.

Run this:
  - On first setup
  - When tokens expire (~yearly)

Usage:
    python3 scripts/garmin-token-bootstrap.py

Requires:
    pip3 install garth
"""
import os
import sys
from pathlib import Path

try:
    import garth
except ImportError:
    print("ERROR: garth not installed. Run: pip3 install garth")
    sys.exit(1)

output_dir = str(Path.home() / ".garth")

email = os.environ.get("GARMIN_EMAIL") or input("Garmin email: ").strip()
password = os.environ.get("GARMIN_PASSWORD") or input("Garmin password: ").strip()

print(f"\nLogging in as {email}...")
print("(If MFA is required, check your email for the code)\n")

try:
    garth.login(email, password, prompt_mfa=lambda: input("Enter MFA code: ").strip())
except Exception as e:
    print(f"\nERROR: Login failed: {e}")
    sys.exit(1)

garth.save(output_dir)

print(f"\nTokens saved to {output_dir}/")
print(f"  - {output_dir}/oauth1_token.json")
print(f"  - {output_dir}/oauth2_token.json")
print()
print("Next: run the sync script:")
print("  cd dashboard && npx tsx ../scripts/garmin-sync-local.ts")
