import { WEEKDAYS, type DaySchedule, type Schedule, type Weekday } from "./types";

/** getDay() met dimanche à 0, alors que le flux compte du lundi au dimanche */
export function weekdayOf(date: Date): Weekday {
  const index = (date.getDay() + 6) % 7;
  return WEEKDAYS[index] as Weekday;
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export type OpenState =
  | { status: "unknown" }
  | { status: "open"; allDay: true }
  | { status: "open"; allDay: false; until: string }
  | { status: "closed"; nextOpening: string | null };

/** Ouverte maintenant ? Les plages qui passent minuit sont gérées. */
export function openStateAt(
  schedule: Schedule | null,
  now: Date = new Date(),
): OpenState {
  if (!schedule) return { status: "unknown" };

  const today = schedule[weekdayOf(now)];
  if (!today) return { status: "unknown" };

  if (today.open && today.allDay) return { status: "open", allDay: true };

  if (today.open) {
    const current = now.getHours() * 60 + now.getMinutes();
    for (const period of today.periods) {
      const from = minutesOf(period.opening);
      const to = minutesOf(period.closing);
      const crossesMidnight = to <= from;
      const inside = crossesMidnight
        ? current >= from || current < to
        : current >= from && current < to;
      if (inside) {
        return { status: "open", allDay: false, until: period.closing };
      }
    }

    // fermée là, mais ça rouvre plus tard dans la journée
    const upcoming = today.periods
      .map((period) => period.opening)
      .filter((opening) => minutesOf(opening) > current)
      .sort()[0];
    if (upcoming) return { status: "closed", nextOpening: upcoming };
  }

  return { status: "closed", nextOpening: nextOpeningDay(schedule, now) };
}

/** « Lundi 08:00 » — la prochaine ouverture dans les 7 jours qui viennent */
function nextOpeningDay(schedule: Schedule, now: Date): string | null {
  const startIndex = (now.getDay() + 6) % 7;
  for (let offset = 1; offset <= 7; offset += 1) {
    const weekday = WEEKDAYS[(startIndex + offset) % 7] as Weekday;
    const day: DaySchedule | undefined = schedule[weekday];
    if (!day?.open) continue;
    if (day.allDay) return weekday;
    const opening = [...day.periods].map((p) => p.opening).sort()[0];
    return opening ? `${weekday} ${opening}` : weekday;
  }
  return null;
}

/** le petit résumé affiché : « Ouvert jusqu'à 19:00 » */
export function describeOpenState(state: OpenState): string {
  switch (state.status) {
    case "unknown":
      return "Horaires inconnus";
    case "open":
      return state.allDay ? "Ouvert 24h/24" : `Ouvert jusqu'à ${state.until}`;
    case "closed":
      return state.nextOpening ? `Fermé · ouvre ${state.nextOpening}` : "Fermé";
  }
}
