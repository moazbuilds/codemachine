const phaseSequence = ["Planning", "Building", "Testing", "Runtime"] as const;

export type Phase = typeof phaseSequence[number];

export interface PhaseDefinition {
  description: string;
  responsibilities: string[];
  handoff: string;
  next: Phase | null;
}

export const phaseMap: Record<Phase, PhaseDefinition> = {
  Planning: {
    description:
      "Intake objectives, validate assumptions, and decompose work into agent-aligned tasks.",
    responsibilities: [
      "Capture incoming objectives and confirm them against documented architecture assumptions.",
      "Break features into scoped tasks with clear system boundaries and supporting notes.",
      "Align execution plans and log deliverables before handing work to implementation agents.",
    ],
    handoff:
      "Transition approved implementation plans and task graph to Building for execution.",
    next: "Building",
  },
  Building: {
    description:
      "Coordinate implementation agents to evolve code, docs, and assets against the plan.",
    responsibilities: [
      "Prepare the workspace and load agent contexts required to modify the project.",
      "Execute implementation updates across source, architecture docs, and supporting assets.",
      "Stage code and documentation changes together to maintain reviewable cohesion.",
    ],
    handoff:
      "Deliver updated workspace to Testing with staged changes and documentation in place.",
    next: "Testing",
  },
  Testing: {
    description:
      "Validate staged changes through automated suites and QA feedback loops.",
    responsibilities: [
      "Run validation scripts to lint, type-check, and exercise automated test suites.",
      "Author or extend targeted tests and collaborate with QA guidance for acceptance criteria.",
      "Document QA outcomes and regressions, routing unresolved issues back to Planning.",
    ],
    handoff:
      "Promote verified artifacts to Runtime or raise regressions to Planning for follow-up.",
    next: "Runtime",
  },
  Runtime: {
    description:
      "Package, release, and observe the CLI in production environments.",
    responsibilities: [
      "Produce distributable artifacts and verify release entry points before publishing.",
      "Coordinate release promotion through operational scripts and stakeholder notifications.",
      "Monitor deployed telemetry and incidents, feeding learnings into future Planning cycles.",
    ],
    handoff:
      "Feed production telemetry and incidents back into Planning for the next iteration.",
    next: null,
  },
};

export const getNextPhase = (current: Phase): Phase | null => {
  const index = phaseSequence.indexOf(current);

  if (index === -1 || index === phaseSequence.length - 1) {
    return null;
  }

  return phaseSequence[index + 1];
};
