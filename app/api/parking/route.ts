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

  if (message.includes("no such table") || message.includes("parking_sessions")) {
    return "The parking register database is still being prepared. Try again after the first deployment has finished.";
  }

  return message;
}

export async function GET() {
  try {
    const db = getDb();
    const sessions = await db
      .select()
      .from(parkingSessions)
      .orderBy(desc(parkingSessions.timeIn), desc(parkingSessions.id))
      .limit(250);
    const visitors = await db
      .select()
      .from(visitorSessions)
      .orderBy(desc(visitorSessions.timeIn), desc(visitorSessions.id))
      .limit(250);

    return Response.json({ sessions, visitors });
  } catch (error) {
    return Response.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      bayNumber?: number;
      personName?: string;
      carRegistration?: string;
      timeIn?: string;
      notes?: string;
    };

    const bayNumber = payload.bayNumber;
    const personName = payload.personName?.trim() ?? "";
    const carRegistration = payload.carRegistration?.trim().toUpperCase() ?? "";
    const timeIn = payload.timeIn ?? "";
    const notes = payload.notes?.trim() ?? "";
    const selectedTimeIn = new Date(timeIn);

    if (!isValidBay(bayNumber)) {
      return Response.json({ error: "Choose a valid bay from 1 to 10." }, { status: 400 });
    }

    if (!personName || !carRegistration) {
      return Response.json({ error: "Name and car registration are required." }, { status: 400 });
    }

    if (Number.isNaN(selectedTimeIn.getTime())) {
      return Response.json({ error: "Choose a valid start time." }, { status: 400 });
    }

    if (selectedTimeIn.getTime() > Date.now() + FUTURE_GRACE_MS) {
      return Response.json({ error: "Start time cannot be in the future." }, { status: 400 });
    }

    const db = getDb();
    const activeSession = await db
      .select({ id: parkingSessions.id })
      .from(parkingSessions)
      .where(
        and(
          eq(parkingSessions.bayNumber, bayNumber),
          eq(parkingSessions.status, "Occupied")
        )
      )
      .limit(1);
    const activeVisitor = await db
      .select({ id: visitorSessions.id })
      .from(visitorSessions)
      .where(
        and(
          eq(visitorSessions.bayNumber, bayNumber),
          eq(visitorSessions.status, "Signed In")
        )
      )
      .limit(1);

    if (activeSession.length > 0 || activeVisitor.length > 0) {
      return Response.json({ error: `Bay ${bayNumber} is already occupied.` }, { status: 409 });
    }

    const [session] = await db
      .insert(parkingSessions)
      .values({
        bayNumber,
        personName,
        carRegistration,
        timeIn: selectedTimeIn.toISOString(),
        notes,
        status: "Occupied",
        createdBy: actorFromRequest(request),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    return Response.json({ session }, { status: 201 });
  } catch (error) {
    return Response.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}
