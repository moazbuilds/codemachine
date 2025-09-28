import { z } from "zod";

import { phaseMap, type Phase } from "../workflows/phase-map.js";

const taskBlueprintSchema = z.object({
  id: z.string().min(1, "Task blueprint id is required"),
  name: z.string().min(1, "Task blueprint name is required"),
  phase: z.string().min(1, "Task blueprint phase is required"),
  description: z.string().min(1, "Task blueprint description is required"),
  acceptanceCriteria: z
    .array(z.string().min(1, "Acceptance criteria entries must be non-empty"))
    .min(1, "Task blueprint acceptance criteria must include at least one item"),
});

const hasPhase = (candidate: string): candidate is Phase =>
  Object.prototype.hasOwnProperty.call(phaseMap, candidate);

export type TaskBlueprint = Omit<z.infer<typeof taskBlueprintSchema>, "phase"> & {
  phase: Phase;
};

export const createTaskBlueprint = (input: unknown): TaskBlueprint => {
  const parsed = taskBlueprintSchema.parse(input);

  if (!hasPhase(parsed.phase)) {
    const validPhases = Object.keys(phaseMap).join(", ");
    throw new Error(
      `Unknown task phase "${parsed.phase}". Expected one of: ${validPhases}.`,
    );
  }

  return {
    ...parsed,
    phase: parsed.phase as Phase,
  };
};

