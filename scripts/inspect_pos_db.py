import sqlite3
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: python inspect_pos_db.py <database-path>")

database = Path(sys.argv[1])

if not database.is_file():
    raise SystemExit(f"Database not found: {database}")

connection = sqlite3.connect(
    database.resolve().as_uri() + "?mode=ro",
    uri=True,
)

try:
    print("Integrity:", connection.execute(
        "PRAGMA integrity_check"
    ).fetchone()[0])

    print("\nTables:")
    for row in connection.execute(
        "SELECT name FROM sqlite_master "
        "WHERE type='table' ORDER BY name"
    ):
        print("-", row[0])

finally:
    connection.close()