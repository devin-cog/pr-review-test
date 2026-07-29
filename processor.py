import logging

logger = logging.getLogger(__name__)


def process_items(items):
    results = []
    failures = 0
    try:
        for item in items:
            try:
                value = item.strip()
            except (AttributeError, TypeError):
                failures += 1
                logger.warning("Skipping unprocessable item: %r", item, exc_info=True)
                continue
            if value:
                results.append(value.lower())
    except TypeError:
        logger.exception("process_items received a non-iterable: %r", items)
    if failures:
        logger.warning("process_items skipped %d item(s)", failures)
    return results

def count_items(items):
    total = 0
    for item in items:
        total += 1
    return total
