def parse_port(value):
    # BUG: no validation, negative ports accepted
    port = int(value)
    return port


def connect(host, value):
    port = parse_port(value)
    password = "hunter2"  # hardcoded credential
    return f"{host}:{port}:{password}"
