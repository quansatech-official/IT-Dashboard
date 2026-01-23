import os


def _get_env(name, default=""):
    return os.environ.get(name, default)


class Settings:
    td_synnex_base_url = _get_env("TD_SYNNEX_BASE_URL", "https://api.streamone.com")
    td_synnex_token_url = _get_env("TD_SYNNEX_TOKEN_URL", "https://api.streamone.com/oauth/token")
    td_synnex_client_id = _get_env("TD_SYNNEX_CLIENT_ID", "")
    td_synnex_client_secret = _get_env("TD_SYNNEX_CLIENT_SECRET", "")
    td_synnex_account_id = _get_env("TD_SYNNEX_ACCOUNT_ID", "")
    also_sftp_host = _get_env("ALSO_SFTP_HOST", "")
    also_sftp_port = int(_get_env("ALSO_SFTP_PORT", "22"))
    also_sftp_user = _get_env("ALSO_SFTP_USER", "")
    also_sftp_password = _get_env("ALSO_SFTP_PASSWORD", "")
    also_sftp_key_path = _get_env("ALSO_SFTP_KEY_PATH", "")
    also_sftp_dir = _get_env("ALSO_SFTP_DIR", "")
    also_feed_db_path = _get_env("ALSO_FEED_DB_PATH", "/data/also_feed.db")
    also_config_path = _get_env("ALSO_CONFIG_PATH", "/data/also_config.json")
    workbench_base_url = _get_env("WORKBENCH_BASE_URL", "http://backend:8000")

    request_timeout_seconds = float(_get_env("REQUEST_TIMEOUT_SECONDS", "20"))


settings = Settings()
