const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  if (process.env.DATABASE_URL !== "file:./dev.db") {
    throw new Error("Safety check failed: development database only.");
  }

  const username = process.env.INITIAL_ADMIN_USERNAME;
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!username || username.trim().length < 3 || username.length > 50) {
    throw new Error("Username must be between 3 and 50 characters.");
  }

  if (!password || password.length < 8 || password.length > 200) {
    throw new Error("Password must be between 8 and 200 characters.");
  }

  const prisma = new PrismaClient();

  try {
    const count = await prisma.staff.count();

    if (count !== 0) {
      throw new Error("Staff accounts already exist. Nothing was changed.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const staff = await prisma.staff.create({
      data: {
        username: username.trim(),
        passwordHash,
        role: "ADMIN",
        isActive: true,
      },
      select: {
        username: true,
        role: true,
        isActive: true,
      },
    });

    console.log("Development administrator created:", staff);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error("Setup failed:", error.message);
  process.exitCode = 1;
});
