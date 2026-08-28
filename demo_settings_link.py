"""Small helper used by the local Devin Review demo."""


def load_user_settings(raw_settings):
    settings = {}
    for key, value in raw_settings.items():
        settings[key.lower()] = value
    return settings


def get_timeout(raw_settings):
    settings = load_user_settings(raw_settings)
    return int(settings["timeout"])
