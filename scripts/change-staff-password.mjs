import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const expectedUrl = "file:C:/ProgramData/RetailPOS/data/retail-pos.db";
const databaseUrl = process.env.RETAIL_POS_DATABASE_URL;

if (databaseUrl !== expectedUrl) {
  console.error("Safety check failed: live POS database not selected.");
  process.exit(1);
}

if (!input.isTTY || !output.isTTY) {
  console.error("Run this script directly in an interactive PowerShell terminal.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const rl = createInterface({ input, output });

function askHidden(question) {
  return new Promise((resolve) => {
    output.write(question);
    let value = "";

    const onData = (chunk) => {
      for (const char of chunk.toString()) {
        if (char === "\u0003") {
          output.write("\nCancelled.\n");
          process.exit(1);
        } else if (char === "\r" || char === "\n") {
          input.off("data", onData);
          input.setRawMode(false);
          input.pause();
          output.write("\n");
          resolve(value);
          return;
        } else if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
        } else if (char >= " ") {
          value += char;
        }
      }
    };

    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

try {
  const username = (await rl.question("Admin username: ")).trim();
  const staff = await prisma.staff.findUnique({ where: { username } });

  if (!staff || staff.role !== "ADMIN") {
    throw new Error("Admin account not found. No changes made.");
  }

  const password = await askHidden("New password (minimum 12 characters): ");
  const confirmation = await askHidden("Enter the new password again: ");

  if (password.length < 12) {
    throw new Error("Password must contain at least 12 characters.");
  }

  if (password !== confirmation) {
    throw new Error("Passwords do not match. No changes made.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.staff.update({
    where: { id: staff.id },
    data: { passwordHash },
  });

  console.log("Admin password updated successfully.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Password update failed.");
  process.exitCode = 1;
} finally {
  rl.close();
  await prisma.$disconnect();
}
