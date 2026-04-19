import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    app_origin: str = os.getenv("APP_ORIGIN", "http://localhost:3000")
    flask_env: str = os.getenv("FLASK_ENV", "development")
    debug: bool = os.getenv("FLASK_DEBUG", "0") == "1"

    @property
    def is_production(self) -> bool:
        return self.flask_env == "production"
