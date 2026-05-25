import yaml
from pathlib import Path

CONFIG_PATH = Path("/app/server_config.yml")

def load_config():
    if not CONFIG_PATH.exists():
        return {}

    with open(CONFIG_PATH, "r") as file:
        return yaml.safe_load(file) or {}

def save_config(config):
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)

    with open(CONFIG_PATH, "w") as file:
        file.write(yaml.safe_dump(config, sort_keys=False))

def get_config_value(path):
    config = load_config()
    value = config

    for key in path.split("."):
        value = value[key]

    return value
