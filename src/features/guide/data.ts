export const teams = [
  "Atlas",
  "Orbit",
  "North",
  "Vertex",
  "Meridian",
  "Helix",
  "Vector",
  "Summit",
] as const;
export type Team = (typeof teams)[number];
export type Match = {
  id: string;
  a: Team;
  b: Team | null;
  scoreA?: number;
  scoreB?: number;
  map: string | null;
  status: "done" | "pending" | "scheduled";
  reference?: string;
};
export type Round = {
  name: "quarterfinals" | "semifinals" | "final";
  matches: Match[];
};
export type Event = {
  id: "community" | "weekend" | "night" | "opening";
  status: "live" | "open" | "done";
  format: "BO1" | "BO3";
  slots: number;
  registered: Team[];
  start: number;
  deadline: number;
  image: "setup" | "lan" | "keyboard" | "hero";
  rounds: Round[];
};

function completed(
  id: string,
  a: Team,
  b: Team,
  scoreA: number,
  scoreB: number,
  map: string,
): Match {
  return {
    id,
    a,
    b,
    scoreA,
    scoreB,
    map,
    status: "done",
    reference: `example-${id}`,
  };
}

export function createExamples(): Event[] {
  const now = Date.now();
  const day = 86400000;
  return [
    {
      id: "community",
      status: "live",
      format: "BO1",
      slots: 4,
      registered: ["North", "Orbit", "Helix", "Summit"],
      start: now - 7200000,
      deadline: now - day,
      image: "setup",
      rounds: [
        {
          name: "semifinals",
          matches: [
            completed("live-1", "North", "Orbit", 13, 11, "Mirage"),
            {
              id: "live-2",
              a: "Helix",
              b: "Summit",
              map: "Inferno",
              status: "pending",
            },
          ],
        },
        {
          name: "final",
          matches: [
            {
              id: "live-final",
              a: "North",
              b: null,
              map: null,
              status: "scheduled",
            },
          ],
        },
      ],
    },
    {
      id: "weekend",
      status: "open",
      format: "BO1",
      slots: 8,
      registered: ["Atlas", "Orbit", "North", "Vertex", "Meridian"],
      start: now + 3 * day,
      deadline: now + 2 * day,
      image: "lan",
      rounds: [],
    },
    {
      id: "night",
      status: "open",
      format: "BO3",
      slots: 16,
      registered: ["Helix"],
      start: now + 7 * day,
      deadline: now + 6 * day,
      image: "keyboard",
      rounds: [],
    },
    {
      id: "opening",
      status: "done",
      format: "BO1",
      slots: 8,
      registered: [...teams],
      start: now - 7 * day,
      deadline: now - 8 * day,
      image: "hero",
      rounds: [
        {
          name: "quarterfinals",
          matches: [
            completed("opening-1", "Atlas", "Orbit", 13, 9, "Mirage"),
            completed("opening-2", "North", "Vertex", 8, 13, "Nuke"),
            completed("opening-3", "Meridian", "Helix", 13, 7, "Ancient"),
            completed("opening-4", "Vector", "Summit", 13, 10, "Inferno"),
          ],
        },
        {
          name: "semifinals",
          matches: [
            completed("opening-5", "Atlas", "Vertex", 13, 11, "Inferno"),
            completed("opening-6", "Meridian", "Vector", 10, 13, "Anubis"),
          ],
        },
        {
          name: "final",
          matches: [
            completed("opening-final", "Atlas", "Vector", 13, 10, "Dust II"),
          ],
        },
      ],
    },
  ];
}

export function winner(match: Match) {
  if (match.status !== "done" || !match.b) return null;
  return match.scoreA! > match.scoreB! ? match.a : match.b;
}

export const exampleReference =
  "https://www.faceit.com/en/cs2/room/1-4c7e9b12-3a5d-4f6e-8b21-9d0c3e7a5f18";
export const maps = [
  "Mirage",
  "Inferno",
  "Nuke",
  "Ancient",
  "Anubis",
  "Dust II",
  "Overpass",
];
