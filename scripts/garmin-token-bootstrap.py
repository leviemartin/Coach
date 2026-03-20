#!/usr/bin/env python3
"""
Minimal Garmin token generator for Railway bootstrap.

Bypasses garmin_connector.py entirely. Uses garth directly, which
supports prompt_mfa on all versions. Generates tokens locally,
then you upload them to Railway via CLI.

Usage:
    python3 scripts/garmin-token-bootstrap.py [output_dir]

    Default output: /tmp/garmin_tokens_fresh/
"""
import os
import sys
from pathlib import Path

try:
    import garth
    from garth import sso as garth_sso
except ImportError:
    print("ERROR: garth not installed. Run: pip3 install garth")
    sys.exit(1)

output_dir = sys.argv[1] if len(sys.argv) > 1 else "/tmp/garmin_tokens_fresh"

email = os.environ.get("GARMIN_EMAIL") or input("Garmin email: ").strip()
password = os.environ.get("GARMIN_PASSWORD") or input("Garmin password: ").strip()

print(f"\nLogging in as {email}...")
print("(If MFA is required, check your email for the code)\n")

try:
    garth.login(email, password, prompt_mfa=lambda: input("Enter MFA code: ").strip())
except Exception as e:
    print(f"\nERROR: Login failed: {e}")
    sys.exit(1)

Path(output_dir).mkdir(parents=True, exist_ok=True)
garth.client.dump(output_dir)

print(f"\nTokens saved to {output_dir}/")
print(f"  - {output_dir}/oauth1_token.json")
print(f"  - {output_dir}/oauth2_token.json")
print()
print("Next: upload to Railway with:")
print(f'  railway ssh --project=PROJECT --environment=ENV --service=SERVICE -- \\')
print(f'    "cat > /data/garmin/.tokens/oauth1_token.json" < {output_dir}/oauth1_token.json')
print(f'  railway ssh --project=PROJECT --environment=ENV --service=SERVICE -- \\')
print(f'    "cat > /data/garmin/.tokens/oauth2_token.json" < {output_dir}/oauth2_token.json')
