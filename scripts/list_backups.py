
import json
import re
import sqlite3
from datetime import datetime
from pathlib import Path

BACKUP_FOLDER = Path.home() / "Documents" / "RetailPOS-Backups"

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

REQUIRED_TABLES = {
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
            return False, f"Integrity check failed: {integrity}"

        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }

        missing = REQUIRED_TABLES - tables

        if missing:
            return False, f"Missing tables: {sorted(missing)}"

        migrations = {
            row[0]
            for row in connection.execute(
                "SELECT migration_name FROM _prisma_migrations "
                "WHERE finished_at IS NOT NULL "
                "AND rolled_back_at IS NULL"
            ).fetchall()
        }

        if migrations not in SUPPORTED_MIGRATIONS:
            return False, "Migration history is not supported."

        if (
            BUSINESS_SETTINGS_MIGRATION in migrations
            and "BusinessSettings" not in tables
        ):
            return False, "BusinessSettings table is missing."

        if RETURNED_QUANTITY_MIGRATION in migrations:
            columns = {
                row[1]
                for row in connection.execute(
                    'PRAGMA table_info("SaleItem")'
                ).fetchall()
            }

            if "returnedQuantity" not in columns:
                return False, "SaleItem.returnedQuantity column is missing."

        return True, "Integrity and migration checks passed."

    except sqlite3.Error as error:
        return False, f"Database verification failed: {error}"

    finally:
        connection.close()


def main():
    results = []

    if BACKUP_FOLDER.is_dir():
        for database in BACKUP_FOLDER.glob("retail-pos-*.db"):
            if not database.is_file():
                continue

            if not re.fullmatch(
                r"retail-pos-\d{8}-\d{6}\.db",
                database.name,
            ):
                continue

            try:
                valid, message = verify_backup(database)
                details = database.stat()

                results.append({
                    "filename": database.name,
                    "size": details.st_size,
                    "createdAt": datetime.fromtimestamp(
                        details.st_mtime
                    ).astimezone().isoformat(),
                    "verified": valid,
                    "verificationMessage": message,
                })

            except Exception as error:
                results.append({
                    "filename": database.name,
                    "size": 0,
                    "createdAt": "",
                    "verified": False,
                    "verificationMessage": str(error),
                })

    results.sort(
        key=lambda item: item["createdAt"],
        reverse=True,
    )

    print(json.dumps({"backups": results}))


if __name__ == "__main__":
    main()
