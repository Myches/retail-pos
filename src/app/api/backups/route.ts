
import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { requireAdmin } from "@/lib/auth";

const execFileAsync = promisify(execFile);

const projectFolder = process.cwd();

export async function GET() {
  const auth = await requireAdmin();

  if (auth.error) {
    return auth.error;
  }

  try {
    const scriptPath = path.join(
      projectFolder,
      "scripts",
      "list_backups.py"
    );

    const { stdout } = await execFileAsync(
      "python",
      [scriptPath],
      {
        cwd: projectFolder,
        timeout: 120000,
        maxBuffer: 1024 * 1024,
      }
    );

    const result = JSON.parse(stdout) as {
      backups: {
        filename: string;
        size: number;
        createdAt: string;
        verified: boolean;
        verificationMessage: string;
      }[];
    };

    if (!Array.isArray(result.backups)) {
      throw new Error("Invalid backup verification response.");
    }

    return NextResponse.json({
      backups: result.backups.map((backup) => ({
        filename: backup.filename,
        size: backup.size,
        createdAt: backup.createdAt,
        verificationStatus: backup.verified
          ? "VERIFIED"
          : "FAILED",
        verificationMessage: backup.verificationMessage,
      })),
    });
  } catch (error) {
    console.error("Could not verify backup files:", error);

    return NextResponse.json(
      { error: "Could not load or verify backup files." },
      { status: 500 }
    );
  }
}

export async function POST() {
  const auth = await requireAdmin();

  if (auth.error) {
    return auth.error;
  }

  try {
    const scriptPath = path.join(
      projectFolder,
      "scripts",
      "backup_pos.py"
    );

    const { stdout } = await execFileAsync(
      "python",
      [scriptPath],
      {
        cwd: projectFolder,
        timeout: 120000,
        maxBuffer: 1024 * 1024,
      }
    );

    const backupMatch = stdout.match(/^Backup:\s*(.+)$/m);

    if (
      !stdout.includes("SUCCESS: Backup created and verified.") ||
      !backupMatch
    ) {
      throw new Error(
        "The backup script did not confirm a verified backup."
      );
    }

    return NextResponse.json({
      message: "Backup created and verified successfully.",
      output: stdout,
    });
  } catch (error) {
    console.error("Could not create backup:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create a backup.",
      },
      { status: 500 }
    );
  }
}