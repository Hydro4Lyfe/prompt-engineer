import { NextRequest, NextResponse } from "next/server";
import { SessionService } from "@prompt-engineer/services";

const sessions = new SessionService();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId = body.anonymousId as string | undefined;
    const session = await sessions.create(undefined, anonymousId);
    return NextResponse.json(session, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Failed to create session" },
      { status: error.status ?? 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const anonymousId = searchParams.get("anonymousId");
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);

    if (!anonymousId) {
      return NextResponse.json({ error: "anonymousId required" }, { status: 400 });
    }

    const result = await sessions.listByAnonymousId(anonymousId, cursor, limit);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Failed to list sessions" },
      { status: error.status ?? 500 }
    );
  }
}
