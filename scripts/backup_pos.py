
import sqlite3
import re
from datetime import datetime
from pathlib import Path

# Live POS database.
source = Path(r"C:\ProgramData\RetailPOS\data\retail-pos.db")

# Separate backup folder.
backup_folder = Path.home() / "Documents" / "RetailPOS-Backups"

# Keep the 30 newest verified backups.
MAX_BACKUPS = 30

BASE_MIGRATIONS = {
    "20261026095156_init_products",
    "20261026121656_add_stock_movements",
    "20261026125742_add_sales_and_payments",
    "20261026163630_add_sales_returns",
    "20261027130000_add_staff_auth",
}

BUSINESS_SETTINGS_MIGRATION = "20261103124043_add_business_settings"
CHECKOUT_IDEMPOTENCY_MIGRATION = "20261103202231_add_checkout_idempotency"
RETURN_IDEMPOTENCY_MIGRATION = "20261104075046_add_return_idempotency"
RETURNED_QUANTITY_MIGRATION = "20261104093429_track_returned_quantity"

SIX_MIGRATIONS = BASE_MIGRATIONS | {
    BUSINESS_SETTINGS_MIGRATION,
}

EIGHT_MIGRATIONS = SIX_MIGRATIONS | {
    CHECKOUT_IDEMPOTENCY_MIGRATION,
    RETURN_IDEMPOTENCY_MIGRATION,
}

NINE_MIGRATIONS = EIGHT_MIGRATIONS | {
    RETURNED_QUANTITY_MIGRATION,
}

SUPPORTED_MIGRATIONS = (
    BASE_MIGRATIONS,
    SIX_MIGRATIONS,
    EIGHT_MIGRATIONS,
    NINE_MIGRATIONS,
)

BASE_TABLES = {
    "Product",
    "Sale",
    "SaleItem",
    "Payment",
    "StockMovement",
    "SaleReturn",
    "SaleReturnItem",
    "Staff",
    "Session",
    "_prisma_migrations",
}

BUSINESS_SETTINGS_TABLE = "BusinessSettings"


def verify_backup(database):
    connection = sqlite3.connect(
        database.resolve().as_uri() + "?mode=ro",
        uri=True,
        timeout=5,
    )

    try:
        integrity = connection.execute(
            "PRAGMA integrity_check"
        ).fetchone()[0]

        if integrity != "ok":
            return False

        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }

        if not BASE_TABLES.issubset(tables):
            return False

        migrations = {
            row[0]
            for row in connection.execute(
                "SELECT migration_name FROM _prisma_migrations "
                "WHERE finished_at IS NOT NULL "
                "AND rolled_back_at IS NULL"
            ).fetchall()
        }

        if migrations not in SUPPORTED_MIGRATIONS:
            return False

        if (
            BUSINESS_SETTINGS_MIGRATION in migrations
            and BUSINESS_SETTINGS_TABLE not in tables
        ):
            return False

        if RETURNED_QUANTITY_MIGRATION in migrations:
            columns = {
                row[1]
                for row in connection.execute(
                    'PRAGMA table_info("SaleItem")'
                ).fetchall()
            }

            if "returnedQuantity" not in columns:
                return False

        return True

    except sqlite3.Error:
        return False

    finally:
        connection.close()


def cleanup_old_backups():
    verified_backups = []

    for database in backup_folder.glob("retail-pos-*.db"):
        if not re.fullmatch(
            r"retail-pos-\d{8}-\d{6}\.db",
            database.name,
        ):
            continue

        try:
            if verify_backup(database):
                verified_backups.append(database)
        except OSError:
            continue

    verified_backups.sort(
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )

    old_backups = verified_backups[MAX_BACKUPS:]

    deleted = 0

    for database in old_backups:
        try:
            database.unlink()
            deleted += 1
            print(f"Removed old verified backup: {database.name}")
        except OSError as error:
            print(f"Could not remove {database.name}: {error}")

    print(f"Verified backups retained: {len(verified_backups) - deleted}")
    print(f"Old verified backups removed: {deleted}")


def main():
    if not source.exists():
        raise SystemExit(
            f"ERROR: Source database not found: {source}"
        )

    backup_folder.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = backup_folder / f"retail-pos-{timestamp}.db"

    src = None
    dst = None

    try:
        # Open production database read-only.
        src = sqlite3.connect(
            source.as_uri() + "?mode=ro",
            uri=True,
        )

        dst = sqlite3.connect(str(backup_path))

        # Create a consistent SQLite backup.
        src.backup(dst)

        dst.close()
        dst = None

        src.close()
        src = None

        # Strictly verify the completed backup.
        if not verify_backup(backup_path):
            raise RuntimeError(
                "Backup failed integrity or compatibility verification."
            )

        print("SUCCESS: Backup created and verified.")
        print(f"Source: {source}")
        print(f"Backup: {backup_path}")
        print(f"Size: {backup_path.stat().st_size:,} bytes")

        # Only clean up after a successful backup.
        cleanup_old_backups()

    except Exception as error:
        if backup_path.exists():
            backup_path.unlink()

        raise SystemExit(f"BACKUP FAILED: {error}")

    finally:
        if dst is not None:
            dst.close()

        if src is not None:
            src.close()


if __name__ == "__main__":
    main()
