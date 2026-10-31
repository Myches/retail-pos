import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const expectedUrl = "file:C:/ProgramData/RetailPOS/data/retail-pos.db";
const databaseUrl = process.env.RETAIL_POS_DATABASE_URL;

if (databaseUrl !== expectedUrl) {
  console.error("Safety check failed: RETAIL_POS_DATABASE_URL must point to the live POS database.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const rl = createInterface({ input, output });

function askHidden(question) {
  return new Promise((resolve) => {
    output.write(question);

    if (!input.isTTY || !output.isTTY) {
      console.error("\nRun this script directly in an interactive PowerShell terminal.");
      process.exit(1);
    }

    let value = "";
    const onData = (chunk) => {
      const text = chunk.toString();

      for (const char of text) {
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
  const staffCount = await prisma.staff.count();

  if (staffCount > 0) {
    throw new Error("Staff accounts already exist. Initial Admin setup is no longer available.");
  }

  const username = (await rl.question("Choose an Admin username: ")).trim();

  if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username)) {
    throw new Error("Username must be 3–50 characters using letters, numbers, dots, underscores, or hyphens.");
  }

  const password = await askHidden("Choose a password (minimum 12 characters): ");
  const confirmation = await askHidden("Enter the password again: ");

  if (password.length < 12) {
    throw new Error("Password must contain at least 12 characters.");
  }

  if (password !== confirmation) {
    throw new Error("Passwords do not match.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.staff.create({
    data: {
      username,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log(`Admin account "${username}" created successfully.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Admin setup failed.");
  process.exitCode = 1;
} finally {
  rl.close();
  await prisma.$disconnect();
}
