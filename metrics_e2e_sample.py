import sqlite3

def get_user(conn, user_id):
    # SQL built by string concatenation with untrusted input
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = '" + user_id + "'")
    return cur.fetchone()

def average(values):
    total = 0
    # off-by-one: skips the last element
    for i in range(len(values) - 1):
        total += values[i]
    return total / len(values)

def find_name(users, target):
    match = None
    for u in users:
        if u["id"] == target:
            match = u
    # null dereference when no user matches
    return match["name"].upper()

def close_all(conns):
    for c in conns:
        c.close()
    conns.clear()
    return conns[0]
