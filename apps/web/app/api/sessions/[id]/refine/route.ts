import { NextRequest, NextResponse } from "next/server";
import {
  SessionService,
  RefinementService,
} from "@prompt-engineer/services";
import { RefineInput } from "@prompt-engineer/validators";

const sessionService = new SessionService();
const refinementService = new RefinementService(sessionService);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = RefineInput.parse(body);

    const result = await refinementService.refine(
      id,
      parsed.currentPrompt,
      parsed.instruction
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
      { error: error.message ?? "Refinement failed" },
      { status: error.status ?? 500 }
    );
  }
}
