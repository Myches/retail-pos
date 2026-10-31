

import { NextResponse ,connection } from "next/server";
import { getAuthenticatedStaff } from "@/lib/auth";



export async function GET() {

    await connection();
    
  try {
    const staff = await getAuthenticatedStaff();

    if (!staff) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    return NextResponse.json({ staff });
  } catch (error) {
    console.error("Session lookup failed:", error);

    return NextResponse.json(
      { error: "Unable to verify the current session." },
      { status: 500 }
    );
  }
}
