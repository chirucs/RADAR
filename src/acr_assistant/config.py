from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="ACR_", extra="ignore")

    anthropic_api_key: str = ""
    llm_model: str = "claude-opus-4-8"
    retrieval_top_k: int = 5
    confidence_threshold: float = 0.15
    kb_path: str = "data/raw/sample_acr_kb.json"
    index_path: str = "data/processed/bm25_index.pkl"
    max_tokens: int = 1500

    def kb_abs(self) -> Path:
        return (PROJECT_ROOT / self.kb_path).resolve()

    def index_abs(self) -> Path:
        return (PROJECT_ROOT / self.index_path).resolve()


def get_settings() -> Settings:
    import os
    s = Settings()
    s.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY", s.anthropic_api_key)
    return s
