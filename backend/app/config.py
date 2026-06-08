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


settings = Settings()



