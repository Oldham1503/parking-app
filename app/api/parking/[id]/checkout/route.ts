import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { parkingSessions } from "../../../../../db/schema";

function actorFromRequest(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email");
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");

  if (encodedName && encoding === "percent-encoded-utf-8") {
    return decodeURIComponent(encodedName);
  }

  return email || "Sites user";
}

function toErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";

  if (message.includes("no such table") || message.includes("parking_sessions")) {
    return "The parking register database is still being prepared. Try again after the first deployment has finished.";
  }

  return message;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionId = Number(id);

    if (!Number.isInteger(sessionId) || sessionId < 1) {
      return Response.json({ error: "Invalid parking session." }, { status: 400 });
    }

    const db = getDb();
    const [activeSession] = await db
      .select()
      .from(parkingSessions)
      .where(
        and(
          eq(parkingSessions.id, sessionId),
          eq(parkingSessions.status, "Occupied")
        )
      )
      .limit(1);

    if (!activeSession) {
      return Response.json(
        { error: "This parking session has already been checked out or changed." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const [session] = await db
      .update(parkingSessions)
      .set({
        timeOut: now,
        status: "Completed",
        checkedOutBy: actorFromRequest(request),
        updatedAt: now,
      })
      .where(eq(parkingSessions.id, sessionId))
      .returning();

    return Response.json({ session });
  } catch (error) {
    return Response.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}
