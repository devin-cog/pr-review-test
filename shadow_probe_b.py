# head B probe
def compute_total(items):
    total = 0
    for i in items:
        total += i['amount']
    return total / len(items)
