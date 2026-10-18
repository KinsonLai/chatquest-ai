import { createHmac } from "node:crypto";
export function advance(
  world,
  seed,
  previous,
  minutes,
  destination = previous.location,
) {
  const state = structuredClone(previous),
    events = [],
    step = world.rules.tick_minutes,
    end = state.clock + minutes;
  const last = Math.floor(state.clock / step),
    next = Math.floor(end / step);
  for (let tick = last + 1; tick <= next; tick++)
    for (const rule of world.events) {
      const at = tick * step,
        prior = state.world.cooldowns[rule.id] ?? -1000000;
      if (at - prior < rule.cooldown_minutes) continue;
      const roll =
        createHmac("sha256", seed)
          .update(`${tick}:${rule.id}`)
          .digest()
          .readUInt32BE() / 4294967296;
      if (roll >= rule.chance) continue;
      const event = {
        id: `${rule.id}:${tick}`,
        kind: rule.id,
        title: rule.title,
        description: rule.description,
        minute: at,
        locations: rule.locations,
        visibility: rule.visibility,
      };
      state.world.cooldowns[rule.id] = at;
      events.push(event);
    }
  state.clock = end;
  state.location = destination;
  state.world.recent = [...state.world.recent, ...events].slice(-24);
  return {
    state,
    events,
    observations: events.filter(
      (e) => e.visibility === "public" && e.locations.includes(destination),
    ),
    qualification:
      "Deterministic world events, not a claim that every character observed them. Observation uses the declared destination; travel-path visibility is GM-authored.",
  };
}
