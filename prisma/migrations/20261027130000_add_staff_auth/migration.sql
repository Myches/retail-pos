-- Create staff accounts.
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CASHIER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Staff_username_key" ON "Staff"("username");

-- Store only hashed session tokens, never raw session tokens.
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_staffId_fkey"
        FOREIGN KEY ("staffId") REFERENCES "Staff"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_staffId_idx" ON "Session"("staffId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- Existing sales remain unassigned; new sales can record their staff member.
ALTER TABLE "Sale"
ADD COLUMN "staffId" TEXT REFERENCES "Staff"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
