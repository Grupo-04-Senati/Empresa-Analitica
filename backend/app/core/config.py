import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-in-production")
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "")
SUPABASE_JWKS_URL = os.getenv("SUPABASE_JWKS_URL", "")

DOMAIN = os.getenv("DOMAIN", "nexuscorp.app")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://nexuscorp.app")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is required")
if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL is required")
