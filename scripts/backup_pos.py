
import sqlite3
from datetime import datetime
from pathlib import Path

# Live POS database stored outside the application folder.
source = Path(r"C:\ProgramData\RetailPOS\data\retail-pos.db")

# Backups are kept separately from the live database.
backup_folder = Path.home() / "Documents" / "RetailPOS-Backups"

if not source.exists():
    raise SystemExit(f"ERROR: Source database not found: {source}")

backup_folder.mkdir(parents=True, exist_ok=True)

timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_path = backup_folder / f"retail-pos-{timestamp}.db"

src = None
dst = None

try:
    # Open the live database read-only.
    src = sqlite3.connect(source.as_uri() + "?mode=ro", uri=True)
    dst = sqlite3.connect(str(backup_path))

    # Create a consistent SQLite backup.
    src.backup(dst)
    dst.close()
    dst = None
    src.close()
    src = None

    # Verify the completed backup.
    check = sqlite3.connect(backup_path.as_uri() + "?mode=ro", uri=True)
    try:
        integrity = check.execute("PRAGMA integrity_check").fetchone()[0]
        tables = {
            row[0] for row in check.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }

        required_tables = {"Product", "Sale", "StockMovement"}
        missing = required_tables - tables

        if integrity != "ok":
            raise RuntimeError(f"Integrity check failed: {integrity}")
        if missing:
            raise RuntimeError(f"Expected tables missing: {sorted(missing)}")
    finally:
        check.close()

    print("SUCCESS: Backup created and verified.")
    print(f"Source: {source}")
    print(f"Backup: {backup_path}")
    print(f"Size: {backup_path.stat().st_size:,} bytes")
    print(f"Integrity check: {integrity}")
    print(f"Tables found: {len(tables)}")

except Exception as error:
    if backup_path.exists():
        backup_path.unlink()
    raise SystemExit(f"BACKUP FAILED: {error}")

finally:
    if dst is not None:
        dst.close()
    if src is not None:
        src.close()
