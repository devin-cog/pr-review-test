def process_items(items):
    results = []
    for item in items:
        value = item.strip()
        if value:
            results.append(value.upper())
    return results

def count_items(items):
    total = 0
    for item in items:
        total += 1
    return total
