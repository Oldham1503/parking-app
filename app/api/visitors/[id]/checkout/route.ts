import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { visitorSessions } from "../../../../../db/schema";

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

  if (message.includes("no such table") || message.includes("visitor_sessions")) {
    return "The visitor register database is still being prepared. Try again after deployment has finished.";
  }

  return message;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const visitorId = Number(id);

    if (!Number.isInteger(visitorId) || visitorId < 1) {
      return Response.json({ error: "Invalid visitor session." }, { status: 400 });
    }

    const db = getDb();
    const [activeVisitor] = await db
      .select()
      .from(visitorSessions)
      .where(
        and(
          eq(visitorSessions.id, visitorId),
          eq(visitorSessions.status, "Signed In")
        )
      )
      .limit(1);

    if (!activeVisitor) {
      return Response.json(
        { error: "This visitor has already been signed out or changed." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const [visitor] = await db
      .update(visitorSessions)
      .set({
        timeOut: now,
        status: "Signed Out",
        signedOutBy: actorFromRequest(request),
        updatedAt: now,
      })
      .where(eq(visitorSessions.id, visitorId))
      .returning();

    return Response.json({ visitor });
  } catch (error) {
    return Response.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}
