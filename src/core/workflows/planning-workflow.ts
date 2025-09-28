import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { phaseMap } from "./phase-map.js";

export interface PlanningWorkflowOptions {
  force: boolean;
  specificationPath: string;
}

export const runPlanningWorkflow = async ({
  force,
  specificationPath,
}: PlanningWorkflowOptions): Promise<void> => {
  const absoluteSpecificationPath = resolve(specificationPath);

  console.log(`Validating planning specification at ${absoluteSpecificationPath}`);

  if (!force) {
    let specificationContents: string;

    try {
      specificationContents = await readFile(absoluteSpecificationPath, { encoding: "utf8" });
    } catch (error) {
      throw new Error(
        `Planning specification missing at "${absoluteSpecificationPath}".`,
        { cause: error instanceof Error ? error : undefined },
      );
    }

    if (specificationContents.trim().length === 0) {
      throw new Error(
        `Planning specification at "${absoluteSpecificationPath}" is empty. Provide a populated spec before continuing.`,
      );
    }
  }

  console.log(`Advancing Planning workflow to next phase: ${phaseMap.Planning.next}`);

  // TODO: Generate task graph from planning specification.
};
