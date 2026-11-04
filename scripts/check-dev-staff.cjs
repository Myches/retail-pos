const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const staff = await prisma.staff.findMany({
    select: {
      username: true,
      role: true,
      isActive: true,
    },
  });

  console.log("Development database staff accounts:");
  console.log(staff);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
