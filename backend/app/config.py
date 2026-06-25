from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # `extra='ignore'` lets the .env carry unrelated keys (e.g. DATABASE_URL)
    # without breaking startup. Supabase fields are optional so a missing key
    # only fails if/when something actually tries to use it.
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    groq_api_key: str
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Comma-separated list of allowed CORS origins. In dev this defaults to
    # localhost:3000; in prod set CORS_ALLOW_ORIGINS to the deployed frontend
    # URL (and any preview URLs you want to permit).
    cors_allow_origins: str = "http://localhost:3000"

    # Hard ceiling on stored hands per anonymous user. Beyond this the
    # /history/hand POST returns 409 to stop a single user from pumping the
    # table. Picked large enough that a realistic player will never hit it.
    max_hands_per_user: int = 5000

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]


settings = Settings()



