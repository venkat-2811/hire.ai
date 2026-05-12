from __future__ import annotations

from supabase import Client

from app.database.supabase_client import get_supabase_admin_client, get_supabase_client


def get_db() -> Client:
    """Anon/public Supabase client (foundation helper)."""
    return get_supabase_client()


def get_db_admin() -> Client:
    """Service role Supabase client (foundation helper)."""
    return get_supabase_admin_client()
