_stats: dict | None = None


def get_stats_cache() -> "dict | None":
    return _stats


def set_stats_cache(value: dict) -> None:
    global _stats
    _stats = value


def invalidate_stats_cache() -> None:
    global _stats
    _stats = None
