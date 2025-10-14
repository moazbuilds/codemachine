**CRITICAL:** Your primary task is to generate the Project Plan as a structured, interconnected set of files. The file structure must be balanced to prevent any single file from becoming excessively large, especially the Iteration Plan.

This output MUST be machine-readable using the anchor-and-manifest system to allow downstream agents to perform targeted content retrieval.

---

### **1. Plan Content Generation (`.md` files)**

You will generate the plan's content by splitting it across the following files.

*   **`01_Plan_Overview_and_Setup.md`**
    *   **Contains:** All high-level planning content. This file defines the project's foundation.
        *   `## 1. Project Overview`
        *   `## 2. Core Architecture`
        *   `## 2.1. Key Architectural Artifacts Planned`
        *   `## 3. Directory Structure`

*   **`02_Iteration_I[n].md` (One file per Iteration)**
    *   **Contains:** The detailed breakdown of tasks for a single iteration.
    *   **CRITICAL RULE:** You MUST generate a separate Markdown file for EACH iteration. For a project with 3 iterations, you will create `02_Iteration_I1.md`, `02_Iteration_I2.md`, and `02_Iteration_I3.md`.
    *   Each file should contain the complete content for its iteration, from the `### Iteration [n]` heading to the last field of the final task in that iteration.

*   **`03_Verification_and_Glossary.md`**
    *   **Contains:** The concluding, project-wide strategies and definitions.
        *   `## 5. Verification and Integration Strategy`
        *   `## 6. Glossary`

#### **Content Formatting Rule: Granular Anchors**

Within ALL generated files, you MUST make the content "addressable" by inserting unique anchors. An anchor is a machine-readable HTML comment placed directly before a heading or task definition.

*   **Format:** The anchor format MUST be `<!-- anchor: [unique-kebab-case-key] -->`.
*   **Placement:** Place an anchor before any major heading (e.g., `## 1.`), sub-heading (e.g., `### 2.1.`), and **every single Task definition** (e.g., before `**Task 1.1:**`).

**Example of `02_Iteration_I1.md` with Correct Anchoring:**
```markdown
<!-- anchor: iteration-1-plan -->
### Iteration 1: Setup & Core Models

*   **Iteration ID:** `I1`
*   **Goal:** ...

<!-- anchor: task-i1-t1 -->
*   **Task 1.1:**
    *   **Task ID:** `I1.T1`
    *   **Description:** "Initialize project structure and install dependencies."
    *   ...

<!-- anchor: task-i1-t2 -->
*   **Task 1.2:**
    *   **Task ID:** `I1.T2`
    *   **Description:** "Generate the ERD diagram for the database."
    *   ...
```

---

### **2. Smart Manifest Generation (`plan_manifest.json`)**

After generating the Markdown files, you will generate a single `plan_manifest.json` file. This is the "address book" that indexes the entire project plan.

The manifest MUST contain a root object with a key `locations`, which is an array of "location objects". Each object is an address to a single piece of the plan and MUST have the following structure:

*   `key`: (String) A unique, kebab-case identifier matching the anchor in the Markdown files.
*   `file`: (String) The exact filename where this piece of the plan is located.
*   `start_anchor`: (String) The exact anchor text (`<!-- anchor: ... -->`) that marks the beginning of the content.
*   `description`: (String) A brief, one-sentence description of the section's content.

**Example `plan_manifest.json` for a 2-iteration plan:**
```json
{
  "locations": [
    {
      "key": "core-architecture-summary",
      "file": "01_Plan_Overview_and_Setup.md",
      "start_anchor": "<!-- anchor: core-architecture -->",
      "description": "The summary of the architectural style, tech stack, and key components."
    },
    {
      "key": "directory-structure",
      "file": "01_Plan_Overview_and_Setup.md",
      "start_anchor": "<!-- anchor: directory-structure -->",
      "description": "The proposed file and directory layout for the project."
    },
    {
      "key": "iteration-1-plan",
      "file": "02_Iteration_I1.md",
      "start_anchor": "<!-- anchor: iteration-1-plan -->",
      "description": "The complete plan, goal, and tasks for Iteration 1."
    },
    {
      "key": "task-i1-t1",
      "file": "02_Iteration_I1.md",
      "start_anchor": "<!-- anchor: task-i1-t1 -->",
      "description": "Task I1.T1: Initialize project structure and install dependencies."
    },
    {
      "key": "task-i1-t2",
      "file": "02_Iteration_I1.md",
      "start_anchor": "<!-- anchor: task-i1-t2 -->",
      "description": "Task I1.T2: Generate the ERD diagram for the database."
    },
    {
      "key": "iteration-2-plan",
      "file": "02_Iteration_I2.md",
      "start_anchor": "<!-- anchor: iteration-2-plan -->",
      "description": "The complete plan, goal, and tasks for Iteration 2."
    },
    {
      "key": "verification-strategy",
      "file": "03_Verification_and_Glossary.md",
      "start_anchor": "<!-- anchor: verification-and-integration-strategy -->",
      "description": "The project's strategy for testing, CI/CD, and quality gates."
    }
  ]
}
```

---

### **3. Output Directory**

All generated files (the `.md` content files and the `plan_manifest.json`) MUST be created inside the following directory: `.codemachine/artifacts/plan/`.

**Example final file paths:**
*   `.codemachine/artifacts/plan/01_Plan_Overview_and_Setup.md`
*   `.codemachine/artifacts/plan/02_Iteration_I1.md`
*   `.codemachine/artifacts/plan/plan_manifest.json`
