import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SessionService } from "@prompt-engineer/services";
import { PromptVersion } from "@prompt-engineer/validators";

const sessionService = new SessionService();

const PatchVersionsInput = z.object({
  versions: z.array(PromptVersion),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = PatchVersionsInput.parse(body);

    // Verify ownership before updating
    const anonymousId =
      new URL(req.url).searchParams.get("anonymousId") ?? undefined;
    await sessionService.getById(id, undefined, anonymousId);

    const lastVersion = parsed.versions[parsed.versions.length - 1];

    await sessionService.updateData(id, {
      versions: parsed.versions,
      ...(lastVersion && { finalPrompt: lastVersion.prompt }),
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message ?? "Update failed" },
      { status: error.status ?? 500 }
    );
  }
}
