import { NextRequest, NextResponse } from "next/server";
import {
  SessionService,
  RefinementService,
} from "@prompt-engineer/services";
import { RegenerateInput } from "@prompt-engineer/validators";

const sessionService = new SessionService();
const refinementService = new RefinementService(sessionService);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = RegenerateInput.parse(body);

    const result = await refinementService.regenerate(
      id,
      parsed.steeringInputs
    );

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message ?? "Regeneration failed" },
      { status: error.status ?? 500 }
    );
  }
}
