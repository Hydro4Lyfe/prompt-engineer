import { NextRequest, NextResponse } from "next/server";
import { SessionService } from "@prompt-engineer/services";

const sessions = new SessionService();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const anonymousId = new URL(req.url).searchParams.get("anonymousId") ?? undefined;
    const session = await sessions.getById(id, undefined, anonymousId);
    return NextResponse.json(session);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Session not found" },
      { status: error.status ?? 500 }
    );
  }
}
