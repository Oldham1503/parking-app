import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { parkingSessions, visitorSessions } from "../../../db/schema";

const BAY_COUNT = 10;
const FUTURE_GRACE_MS = 2 * 60 * 1000;

function actorFromRequest(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email");
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");

  if (encodedName && encoding === "percent-encoded-utf-8") {
    return decodeURIComponent(encodedName);
  }

  return email || "Sites user";
}

function isValidBay(value: unknown): value is number {
  return Number.isInteger(value) && value >= 1 && value <= BAY_COUNT;
}

function toErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";

  if (message.includes("no such table") || message.includes("visitor_sessions")) {
    return "The visitor register database is still being prepared. Try again after deployment has finished.";
  }

  return message;
}

export async function GET() {
  try {
    const db = getDb();
    const visitors = await db
      .select()
      .from(visitorSessions)
      .orderBy(desc(visitorSessions.timeIn), desc(visitorSessions.id))
      .limit(250);

    return Response.json({ visitors });
  } catch (error) {
    return Response.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      visitorName?: string;
      companyName?: string;
      visiting?: string;
      carRegistration?: string;
      doorPassNumber?: string;
      bayNumber?: number | null;
      timeIn?: string;
      notes?: string;
    };

    const visitorName = payload.visitorName?.trim() ?? "";
    const companyName = payload.companyName?.trim() ?? "";
    const visiting = payload.visiting?.trim() ?? "";
    const carRegistration = payload.carRegistration?.trim().toUpperCase() ?? "";
    const doorPassNumber = payload.doorPassNumber?.trim() ?? "";
    const bayNumber = payload.bayNumber ?? null;
    const selectedTimeIn = new Date(payload.timeIn ?? "");
    const notes = payload.notes?.trim() ?? "";

    if (!visitorName || !companyName || !visiting) {
      return Response.json(
        { error: "Visitor name, company name, and who they are visiting are required." },
        { status: 400 }
      );
    }

    if (bayNumber !== null && !isValidBay(bayNumber)) {
      return Response.json({ error: "Choose a valid bay from 1 to 10." }, { status: 400 });
    }

    if (Number.isNaN(selectedTimeIn.getTime())) {
      return Response.json({ error: "Choose a valid time in." }, { status: 400 });
    }

    if (selectedTimeIn.getTime() > Date.now() + FUTURE_GRACE_MS) {
      return Response.json({ error: "Time in cannot be in the future." }, { status: 400 });
    }

    const db = getDb();

    if (bayNumber !== null) {
      const [activeParking] = await db
        .select({ id: parkingSessions.id })
        .from(parkingSessions)
        .where(
          and(
            eq(parkingSessions.bayNumber, bayNumber),
            eq(parkingSessions.status, "Occupied")
          )
        )
        .limit(1);
      const [activeVisitor] = await db
        .select({ id: visitorSessions.id })
        .from(visitorSessions)
        .where(
          and(
            eq(visitorSessions.bayNumber, bayNumber),
            eq(visitorSessions.status, "Signed In")
          )
        )
        .limit(1);

      if (activeParking || activeVisitor) {
        return Response.json({ error: `Bay ${bayNumber} is already occupied.` }, { status: 409 });
      }
    }

    const [visitor] = await db
      .insert(visitorSessions)
      .values({
        visitorName,
        companyName,
        visiting,
        carRegistration,
        doorPassNumber,
        bayNumber,
        timeIn: selectedTimeIn.toISOString(),
        notes,
        status: "Signed In",
        createdBy: actorFromRequest(request),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    return Response.json({ visitor }, { status: 201 });
  } catch (error) {
    return Response.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}
