from app.utils.supabase_client import get_supabase


def log_activity(user_id, action_type, entity_type=None, entity_id=None, metadata=None):
    payload = {
        "user_id": user_id,
        "action_type": action_type,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "metadata_json": metadata or {},
    }
    return get_supabase().table("activity_logs").insert(payload).execute()
