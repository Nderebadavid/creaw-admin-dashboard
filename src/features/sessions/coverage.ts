/** Pure curriculum coverage and headline counts for one pillar's sessions. */
import type {
  ActivityTopicOption,
  ActivityTypeOption,
  SessionPeriod,
  SessionSummary,
  TypeCoverage,
} from "./model";

const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** The first day of the period in local time, or null for all time. */
export function periodStart(period: SessionPeriod, today: Date): string | null {
  if (period === "all") return null;
  const month = period === "year" ? 0 : Math.floor(today.getMonth() / 3) * 3;
  return isoDay(new Date(today.getFullYear(), month, 1));
}

export interface CoverageInput {
  types: ActivityTypeOption[];
  topics: ActivityTopicOption[];
  sessions: { id: number; activityTypeId: number; topicId: number | null; freeTopic: string | null; date: string }[];
  attendance: { sessionId: number; participantId: number }[];
  period: SessionPeriod;
  today: Date;
}

export function buildCoverage(input: CoverageInput): { coverage: TypeCoverage[]; summary: SessionSummary } {
  const start = periodStart(input.period, input.today);
  const inPeriod = input.sessions.filter((row) => start === null || row.date >= start);
  const ids = new Set(inPeriod.map((row) => row.id));
  const activeTypes = input.types.filter((type) => type.active);
  const coverage: TypeCoverage[] = activeTypes.map((type) => {
    const ofType = inPeriod.filter((row) => row.activityTypeId === type.id);
    const topics = input.topics
      .filter((topic) => topic.activityTypeId === type.id && topic.active)
      .sort((a, b) => a.sequenceNo - b.sequenceNo)
      .map((topic) => {
        const delivered = ofType.filter((row) => row.topicId === topic.id).map((row) => row.date).sort();
        return {
          topicId: topic.id,
          name: topic.name,
          sequenceNo: topic.sequenceNo,
          sessions: delivered.length,
          lastDelivered: delivered.at(-1) ?? null,
        };
      });
    const others = new Map<string, { name: string; sessions: number; lastDelivered: string }>();
    for (const row of ofType.filter((item) => item.topicId === null && item.freeTopic)) {
      const entry = others.get(row.freeTopic!) ?? { name: row.freeTopic!, sessions: 0, lastDelivered: row.date };
      entry.sessions += 1;
      if (row.date > entry.lastDelivered) entry.lastDelivered = row.date;
      others.set(row.freeTopic!, entry);
    }
    return { activityTypeId: type.id, name: type.name, topics, otherTopics: [...others.values()] };
  });
  const planned = coverage.flatMap((block) => block.topics);
  return {
    coverage,
    summary: {
      sessionsHeld: inPeriod.length,
      peopleReached: new Set(
        input.attendance.filter((row) => ids.has(row.sessionId)).map((row) => row.participantId)
      ).size,
      topicsCovered: planned.filter((topic) => topic.sessions > 0).length,
      topicsPlanned: planned.length,
      activeTypes: activeTypes.length,
    },
  };
}
