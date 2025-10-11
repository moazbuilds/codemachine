**CRITICAL:** Your primary task is to extract all tasks from the Project Plan into a structured, interconnected set of files. The file structure must be split by iteration to ensure no single file becomes excessively large and to allow for efficient processing.

This output MUST be machine-readable using a manifest file to allow the orchestrator to easily locate the tasks for any given iteration.

---

### **1. Task File Generation (`.json` files)**

You will generate the task data by splitting it across the following set of JSON files.

*   **`tasks_I[n].json` (One file per Iteration)**
    *   **Contains:** A JSON array of all task objects belonging to a single iteration.
    *   **CRITICAL RULE:** You MUST generate a separate JSON file for EACH iteration found in the plan. For a project with 3 iterations, you will create `tasks_I1.json`, `tasks_I2.json`, and `tasks_I3.json`.

---

### **2. Smart Manifest Generation (`tasks_manifest.json`)**

After generating all the iteration-specific JSON files, you will generate a single `tasks_manifest.json` file. This is the "address book" that indexes the task files.

The manifest MUST be a simple JSON object where each key is an `Iteration ID` (e.g., "I1", "I2") and its value is the corresponding task filename.

**Example `tasks_manifest.json` for a 2-iteration plan:**
```json
{
  "I1": "tasks_I1.json",
  "I2": "tasks_I2.json"
}
```

---

### **3. Output Directory**

All generated files (the `tasks_I[n].json` files and the `tasks_manifest.json`) MUST be created inside the following directory: `.codemachine/artifacts/tasks/`.

**Example final file paths:**
*   `.codemachine/artifacts/tasks/tasks_I1.json`
*   `.codemachine/artifacts/tasks/tasks_I2.json`
*   `.codemachine/artifacts/tasks/tasks_manifest.json`
