import sqlite3
from pathlib import Path

db = Path("prisma/dev.db").resolve()
connection = sqlite3.connect(f"file:{db.as_posix()}?mode=ro", uri=True)
connection.row_factory = sqlite3.Row

try:
    returns = connection.execute("""
        SELECT
            r.returnNumber,
            r.idempotencyKey,
            r.returnRequestHash,
            r.refundAmountPesewas,
            r.refundMethod,
            s.receiptNumber,
            COUNT(i.id) AS itemCount
        FROM SaleReturn r
        JOIN Sale s ON s.id = r.saleId
        LEFT JOIN SaleReturnItem i ON i.saleReturnId = r.id
        GROUP BY r.id
        ORDER BY r.createdAt DESC
        LIMIT 10
    """).fetchall()

    print("Recent returns:")
    for r in returns:
        print({
            "returnNumber": r["returnNumber"],
            "receiptNumber": r["receiptNumber"],
            "hasIdempotencyKey": bool(r["idempotencyKey"]),
            "hasRequestHash": bool(r["returnRequestHash"]),
            "refundAmountPesewas": r["refundAmountPesewas"],
            "refundMethod": r["refundMethod"],
            "itemCount": r["itemCount"],
        })

    totals = connection.execute("""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN idempotencyKey IS NOT NULL THEN 1 ELSE 0 END) AS withKey,
            SUM(CASE WHEN returnRequestHash IS NOT NULL THEN 1 ELSE 0 END) AS withHash
        FROM SaleReturn
    """).fetchone()

    print("\nReturn totals:")
    print(dict(totals))
finally:
    connection.close()
