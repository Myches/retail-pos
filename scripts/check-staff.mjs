import { PrismaClient } from "@prisma/client";

const databaseUrl =
  process.env.RETAIL_POS_DATABASE_URL ??
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Database URL is not configured.");
}

const prisma = new PrismaClient({
  datasourceUrl: databaseUrl,
});

try {
  const staff = await prisma.staff.findMany({
    select: {
      username: true,
      role: true,
      isActive: true,
    },
  });

  console.table(staff);
} finally {
  await prisma.$disconnect();
}