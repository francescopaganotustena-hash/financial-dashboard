"""Application configuration using pydantic-settings."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Redis
    redis_url: str = Field(default="redis://redis:6379")

    # Benchmark
    default_benchmark: str = Field(default="SPY")

    # API Keys
    newsapi_key: str = Field(default="")
    alpha_vantage_key: str = Field(default="")

    # Cache TTL
    cache_ttl_weekly: int = Field(default=3600)
    cache_ttl_daily: int = Field(default=300)

    # CORS
    cors_origins: List[str] = Field(default=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:3011",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3003",
        "http://127.0.0.1:3011",
        "http://10.0.0.103:3011",
    ])


settings = Settings()
