import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { homedir } from "os";
import path from "path";
import { requireAdmin } from "@/lib/auth";

const backupFolder = path.join(
  homedir(),
  "Documents",
  "RetailPOS-Backups"
);

type RouteContext = {
  params: Promise<{ filename: string }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const auth = await requireAdmin();

  if (auth.error) {
    return auth.error;
  }

  try {
    const { filename } = await params;

    // Only allow standard POS backup filenames.
    if (!/^retail-pos-\d{8}-\d{6}\.db$/.test(filename)) {
      return NextResponse.json(
        { error: "Invalid backup filename." },
        { status: 400 }
      );
    }

    const filePath = path.join(backupFolder, filename);
    const details = await stat(filePath);

    if (!details.isFile()) {
      return NextResponse.json(
        { error: "Backup file not found." },
        { status: 404 }
      );
    }

    const file = await readFile(filePath);

    return new Response(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(file.length),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return NextResponse.json(
        { error: "Backup file not found." },
        { status: 404 }
      );
    }

    console.error("Could not download backup:", error);

    return NextResponse.json(
      { error: "Could not download backup." },
      { status: 500 }
    );
  }
}