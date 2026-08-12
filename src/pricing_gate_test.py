def compute_total(items):
    total = 0
    for i in items:
        total += i["price"] * i["qty"]
    return total / len(items)
