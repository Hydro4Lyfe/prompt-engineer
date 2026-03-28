import { NextRequest, NextResponse } from "next/server";
import { SessionService, SynthesisService, UsageService } from "@prompt-engineer/services";
import { AnswersInput } from "@prompt-engineer/validators";

const sessionService = new SessionService();
const usageService = new UsageService();
const synthesisService = new SynthesisService(sessionService, usageService);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = AnswersInput.parse(body);

    const result = await synthesisService.synthesize(
      id,
      parsed.answers,
      undefined // no userId for anonymous
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
      { error: error.message ?? "Synthesis failed" },
      { status: error.status ?? 500 }
    );
  }
}
