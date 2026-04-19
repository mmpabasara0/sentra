import re

from app.utils.supabase_client import get_supabase


UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

DISPLAY_ID_TO_SLUG = {
    "NM-BAG-1001": "aster-carry-pack",
    "NM-HOME-1002": "lumadesk-lamp",
    "NM-KIT-1003": "mira-ceramic-mug",
    "NM-AUD-1004": "voltedge-earbuds",
    "NM-FIT-1005": "forma-training-bottle",
    "NM-HOME-1006": "halo-desk-fan",
    "NM-ELEC-1007": "nova-charge-dock",
    "NM-KITCH-1008": "cinder-brew-kettle",
    "NM-BAG-1009": "cove-sling-bag",
    "NM-FIT-1010": "pulse-yoga-mat",
    "NM-HOME-1011": "pixel-note-stand",
    "NM-HOME-1012": "nori-storage-box",
    "NM-ELEC-1013": "arc-mouse-pad",
    "NM-KITCH-1014": "ridge-lunch-box",
    "NM-HOME-1015": "solace-table-lamp",
    "NM-ACC-1016": "quill-pen-cup",
    "NM-ACC-1017": "atlas-travel-thermos",
    "NM-ELEC-1018": "drift-sound-speaker",
    "NM-HOME-1019": "lattice-wall-shelf",
    "NM-FIT-1020": "stride-recovery-roller",
}


def resolve_product(identifier):
    value = (identifier or "").strip()
    if not value:
        return None

    db = get_supabase()
    if UUID_RE.match(value):
        res = db.table("products").select("*").eq("id", value).limit(1).execute()
    else:
        slug = DISPLAY_ID_TO_SLUG.get(value.upper(), value)
        res = db.table("products").select("*").eq("slug", slug).limit(1).execute()

    return res.data[0] if res.data else None
