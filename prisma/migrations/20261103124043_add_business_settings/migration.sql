-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "businessName" TEXT NOT NULL DEFAULT 'My Shop',
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "receiptFooter" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
