from functools import lru_cache

import httpx
from supabase import Client, create_client

from app.config.settings import Settings


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    settings = Settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase URL and service role key are required.")
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    # On Windows, httpx defaults to HTTP/2 which causes WinError 10035
    # (WSAEWOULDBLOCK) on non-blocking sockets. Replace the postgrest session
    # with an HTTP/1.1-only client while preserving all auth headers.
    old_session = client.postgrest.session
    client.postgrest.session = httpx.Client(
        headers=dict(old_session.headers),
        timeout=old_session.timeout,
        http2=False,
    )
    old_session.close()

    return client
