import { NextRequest, NextResponse } from "next/server";
import { SessionService, AnalysisService, UsageService } from "@prompt-engineer/services";
import { AnalyzeInput } from "@prompt-engineer/validators";

const sessionService = new SessionService();
const usageService = new UsageService();
const analysisService = new AnalysisService(sessionService, usageService);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = AnalyzeInput.parse(body);

    const result = await analysisService.analyze(
      id,
      parsed.rawPrompt,
      parsed.mode,
      undefined, // no userId for anonymous
      parsed.targetModel,
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
      { error: error.message ?? "Analysis failed" },
      { status: error.status ?? 500 }
    );
  }
}
