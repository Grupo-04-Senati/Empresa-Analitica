from supabase import create_client, Client
from app.core.config import SUPABASE_URL, SUPABASE_SECRET_KEY

supabase: Client | None = None

def get_supabase() -> Client:
    global supabase
    if supabase is None:
        supabase = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
    return supabase
