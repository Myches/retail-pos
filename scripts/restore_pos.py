
import sqlite3
import shutil
import sys
import os
from datetime import datetime
from pathlib import Path

PRODUCTION_DB = Path(
    r"C:\ProgramData\RetailPOS\data\retail-pos.db"
)

BACKUP_FOLDER = (
    Path.home() / "Documents" / "RetailPOS-Backups"
)

BASE_MIGRATIONS = {
    "20261026095156_init_products",
    "20261026121656_add_stock_movements",
    "20261026125742_add_sales_and_payments",
    "20261026163630_add_sales_returns",
    "20261027130000_add_staff_auth",
}

BUSINESS_SETTINGS_MIGRATION = (
    "20261103124043_add_business_settings"
)

CHECKOUT_IDEMPOTENCY_MIGRATION = (
    "20261103202231_add_checkout_idempotency"
)

RETURN_IDEMPOTENCY_MIGRATION = (
    "20261104075046_add_return_idempotency"
)

RETURNED_QUANTITY_MIGRATION = (
    "20261104093429_track_returned_quantity"
)

SUPPORTED_MIGRATIONS = (
    BASE_MIGRATIONS,
    BASE_MIGRATIONS | {BUSINESS_SETTINGS_MIGRATION},
    BASE_MIGRATIONS | {
        BUSINESS_SETTINGS_MIGRATION,
        CHECKOUT_IDEMPOTENCY_MIGRATION,
        RETURN_IDEMPOTENCY_MIGRATION,
    },
    BASE_MIGRATIONS | {
        BUSINESS_SETTINGS_MIGRATION,
        CHECKOUT_IDEMPOTENCY_MIGRATION,
        RETURN_IDEMPOTENCY_MIGRATION,
        RETURNED_QUANTITY_MIGRATION,
    },
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


def get_columns(connection, table):
    return {
        row[1]
        for row in connection.execute(
            f'PRAGMA table_info("{table}")'
        ).fetchall()
    }


def validate_database(database: Path):
    if not database.is_file():
        raise RuntimeError(f"Database not found: {database}")

    connection = sqlite3.connect(
        database.resolve().as_uri() + "?mode=ro",
        uri=True,
    )

    try:
        integrity = connection.execute(
            "PRAGMA integrity_check"
        ).fetchone()[0]

        if integrity != "ok":
            raise RuntimeError(
                f"Integrity check failed: {integrity}"
            )

        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master "
                "WHERE type='table'"
            ).fetchall()
        }

        missing = REQUIRED_TABLES - tables

        if missing:
            raise RuntimeError(
                f"Missing tables: {sorted(missing)}"
            )

        migrations = {
            row[0]
            for row in connection.execute(
                "SELECT migration_name FROM _prisma_migrations "
                "WHERE finished_at IS NOT NULL "
                "AND rolled_back_at IS NULL"
            ).fetchall()
        }

        if migrations not in SUPPORTED_MIGRATIONS:
            raise RuntimeError(
                "Migration history is not supported.\n"
                f"Found: {sorted(migrations)}"
            )

        if BUSINESS_SETTINGS_MIGRATION in migrations:
            if "BusinessSettings" not in tables:
                raise RuntimeError(
                    "BusinessSettings table is missing."
                )

        if CHECKOUT_IDEMPOTENCY_MIGRATION in migrations:
            sale_columns = get_columns(connection, "Sale")

            required = {
                "idempotencyKey",
                "checkoutRequestHash",
            }

            if not required.issubset(sale_columns):
                raise RuntimeError(
                    "Checkout idempotency columns are missing."
                )

        if RETURN_IDEMPOTENCY_MIGRATION in migrations:
            return_columns = get_columns(
                connection, "SaleReturn"
            )

            required = {
                "idempotencyKey",
                "returnRequestHash",
            }

            if not required.issubset(return_columns):
                raise RuntimeError(
                    "Return idempotency columns are missing."
                )

        if RETURNED_QUANTITY_MIGRATION in migrations:
            sale_item_columns = get_columns(
                connection, "SaleItem"
            )

            if "returnedQuantity" not in sale_item_columns:
                raise RuntimeError(
                    "SaleItem.returnedQuantity is missing."
                )

            triggers = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master "
                    "WHERE type='trigger'"
                ).fetchall()
            }

            required_triggers = {
                "SaleItem_returnedQuantity_insert_check",
                "SaleItem_returnedQuantity_update_check",
            }

            if not required_triggers.issubset(triggers):
                raise RuntimeError(
                    "Returned-quantity safety triggers are missing."
                )

        return len(tables)

    finally:
        connection.close()


def create_sqlite_backup(source: Path, destination: Path):
    src = sqlite3.connect(
        source.resolve().as_uri() + "?mode=ro",
        uri=True,
    )
    dst = sqlite3.connect(str(destination))

    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()


def check_exclusive_access(database: Path):
    connection = sqlite3.connect(
        str(database),
        timeout=2,
    )

    try:
        connection.execute("BEGIN EXCLUSIVE")
        connection.rollback()

    except sqlite3.OperationalError as error:
        raise RuntimeError(
            "Could not obtain exclusive database access. "
            "Close the POS and any other applications using "
            f"the database. Details: {error}"
        )

    finally:
        connection.close()


def main():
    validate_only = (
        len(sys.argv) == 3
        and sys.argv[1] == "--validate-only"
    )

    if validate_only:
        backup_argument = sys.argv[2]
    elif len(sys.argv) == 2:
        backup_argument = sys.argv[1]
    else:
        raise SystemExit(
            "Usage:\n"
            "  Validate only:\n"
            "  python scripts/restore_pos.py "
            "--validate-only <backup-file>\n\n"
            "  Restore:\n"
            "  python scripts/restore_pos.py <backup-file>"
        )

    selected_backup = Path(
        backup_argument
    ).expanduser().resolve()

    if selected_backup.suffix.lower() != ".db":
        raise SystemExit("ERROR: Only .db files are accepted.")

    if selected_backup == PRODUCTION_DB.resolve():
        raise SystemExit(
            "ERROR: Production cannot be its own backup."
        )

    try:
        selected_backup.relative_to(BACKUP_FOLDER.resolve())
    except ValueError:
        raise SystemExit(
            "ERROR: Select a backup from the RetailPOS-Backups folder."
        )

    if not selected_backup.is_file():
        raise SystemExit(
            f"ERROR: Backup not found: {selected_backup}"
        )

    if not validate_production_file():
        raise SystemExit(
            f"ERROR: Production database not found: {PRODUCTION_DB}"
        )

    print("\nValidating selected backup...")

    try:
        table_count = validate_database(selected_backup)
    except Exception as error:
        raise SystemExit(f"VALIDATION FAILED: {error}")

    print("Backup passed integrity and compatibility checks.")
    print(f"Tables found: {table_count}")
    print(f"Backup: {selected_backup}")

    if validate_only:
        print("\nVALIDATION ONLY: Production was not modified.")
        return

    print("\nIMPORTANT:")
    print("- Close the production POS completely.")
    print("- Close any other application using its database.")
    print("- Do not reopen the POS during restoration.")

    confirmation = input(
        "\nType RESTORE to continue: "
    )

    if confirmation != "RESTORE":
        raise SystemExit(
            "Restore cancelled. Production unchanged."
        )

    BACKUP_FOLDER.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")

    rollback_path = (
        BACKUP_FOLDER / f"before-restore-{timestamp}.db"
    )

    temporary_path = PRODUCTION_DB.with_name(
        PRODUCTION_DB.name + ".restore-temp"
    )

    rollback_temp = PRODUCTION_DB.with_name(
        PRODUCTION_DB.name + ".rollback-temp"
    )

    replaced = False

    try:
        print("\nChecking production database access...")
        check_exclusive_access(PRODUCTION_DB)

        print("Exclusive access available.")

        print("\nCreating rollback backup...")

        create_sqlite_backup(
            PRODUCTION_DB,
            rollback_path,
        )

        validate_database(rollback_path)

        print(f"Rollback backup verified: {rollback_path}")

        print("\nPreparing replacement database...")

        if temporary_path.exists():
            temporary_path.unlink()

        shutil.copy2(selected_backup, temporary_path)
        validate_database(temporary_path)

        print("Replacement database verified.")

        print("\nChecking production database access again...")
        check_exclusive_access(PRODUCTION_DB)

        os.replace(temporary_path, PRODUCTION_DB)
        replaced = True

        print("\nVerifying restored production database...")
        validate_database(PRODUCTION_DB)

        print("\nSUCCESS: Production database restored.")
        print(f"Restored from: {selected_backup}")
        print(f"Rollback backup: {rollback_path}")

    except Exception as error:
        print(f"\nRESTORE FAILED: {error}")

        if replaced and rollback_path.is_file():
            try:
                if rollback_temp.exists():
                    rollback_temp.unlink()

                shutil.copy2(rollback_path, rollback_temp)
                validate_database(rollback_temp)

                os.replace(rollback_temp, PRODUCTION_DB)
                validate_database(PRODUCTION_DB)

                print("\nAUTOMATIC ROLLBACK SUCCESSFUL.")
                print("The previous production database has been restored.")

            except Exception as rollback_error:
                print("\nCRITICAL: Automatic rollback failed.")
                print(f"Rollback error: {rollback_error}")
                print(f"Preserved backup: {rollback_path}")
                print("Do not reopen the POS until the database is checked.")

        else:
            print("Production replacement was not completed.")
            print("The original database should remain unchanged.")
            print(f"Rollback backup, if created: {rollback_path}")

        raise SystemExit(1)

    finally:
        if temporary_path.exists():
            temporary_path.unlink()

        if rollback_temp.exists():
            rollback_temp.unlink()


def validate_production_file():
    return PRODUCTION_DB.is_file()


if __name__ == "__main__":
    main()
