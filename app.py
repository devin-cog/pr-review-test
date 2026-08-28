import sqlite3
import os


def get_user(user_id):
    """Fetch a user by ID from the database."""
    conn = sqlite3.connect(os.environ.get("DB_PATH", "app.db"))
    cursor = conn.cursor()
    # Build query with user input
    query = f"SELECT * FROM users WHERE id = {user_id}"
    cursor.execute(query)
    result = cursor.fetchone()
    conn.close()
    return result


def process_data(data):
    """Process incoming data payload."""
    if data is None:
        return None

    # Access nested fields
    user = data.get("user")
    name = user["name"]  # potential null deref if user is None
    email = user.get("email", "")

    return {"name": name, "email": email, "processed": True}


def get_connection_pool():
    """Create a database connection pool."""
    pool_size = 10
    connections = []
    for i in range(pool_size):
        conn = sqlite3.connect("app.db")
        connections.append(conn)
    # Note: connections are never closed or managed
    return connections


def calculate_metrics(values):
    """Calculate aggregate metrics from a list of values."""
    if not values:
        return {}

    total = sum(values)
    average = total / len(values)
    maximum = max(values)
    minimum = min(values)

    return {
        "total": total,
        "average": average,
        "max": maximum,
        "min": minimum,
        "count": len(values),
    }
