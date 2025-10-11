**CRITICAL:** Your primary task is to generate the System Architecture Blueprint as a structured, interconnected set of files. The file structure must be balanced to ensure no single file becomes excessively large, while maintaining a logical grouping of topics.

This output MUST be machine-readable using the anchor-and-manifest system to allow downstream agents to perform surgical content retrieval.

---

### **1. Blueprint Content Generation (`.md` files)**

You will generate the blueprint's content, splitting it across the following set of thematically grouped and balanced Markdown files.

*   **`01_Context_and_Drivers.md`**
    *   **Contains:** All content from `## 1. Introduction & Goals` and `## 2. Architectural Drivers`. This file covers the "Why" and "What" of the project.

*   **`02_Architecture_Overview.md`**
    *   **Contains:** The high-level architectural decisions from `## 3. Proposed Architecture`.
        *   `3.1. Architectural Style`
        *   `3.2. Technology Stack Summary`

*   **`03_System_Structure_and_Data.md`**
    *   **Contains:** The static structural views from `## 3. Proposed Architecture`.
        *   `3.3. System Context Diagram (C4 Level 1)`
        *   `3.4. Container Diagram (C4 Level 2)`
        *   `3.5. Component Diagram(s) (C4 Level 3)`
        *   `3.6. Data Model Overview & ERD`

*   **`04_Behavior_and_Communication.md`**
    *   **Contains:** The dynamic, behavioral views from `## 3. Proposed Architecture`.
        *   `3.7. API Design & Communication` (including the Sequence Diagram)

*   **`05_Operational_Architecture.md`**
    *   **Contains:** The operational and cross-cutting aspects from `## 3. Proposed Architecture`.
        *   `3.8. Cross-Cutting Concerns`
        *   `3.9. Deployment View`

*   **`06_Rationale_and_Future.md`**
    *   **Contains:** The concluding metadata sections.
        *   `## 4. Design Rationale & Trade-offs`
        *   `## 5. Future Considerations`
        *   `## 6. Glossary`

#### **Content Formatting Rule: Granular Anchors**

Within ALL of these files, you MUST make the content "addressable" by inserting unique anchors. An anchor is a machine-readable HTML comment placed directly before a heading.

*   **Format:** The anchor format MUST be `<!-- anchor: [unique-kebab-case-key] -->`.
*   **Placement:** Place an anchor immediately before any sub-heading (e.g., `### 3.1`, `#### 3.8.1`) that represents a distinct concept a future agent might need to reference.

---

### **2. Smart Manifest Generation (`architecture_manifest.json`)**

After generating the Markdown files, you will generate a single `architecture_manifest.json` file. This is the "address book" that indexes the entire blueprint.

The manifest MUST contain a root object with a key `locations`, which is an array of "location objects". Each object is an address to a single piece of architectural knowledge and MUST have the following structure:

*   `key`: (String) A unique, kebab-case identifier matching the anchor in the Markdown files.
*   `file`: (String) The exact filename where this piece of knowledge is located (filename only, not the full path).
*   `start_anchor`: (String) The exact anchor text (`<!-- anchor: ... -->`) that marks the beginning of the content.
*   `description`: (String) A brief, one-sentence description of the section's content.

---

### **3. Output Directory**

**All generated files** (the `.md` content files and the `architecture_manifest.json`) MUST be created inside the following directory: `.codemachine/artifacts/architecture/`.

**Example final file paths:**
*   `.codemachine/artifacts/architecture/01_Context_and_Drivers.md`
*   `.codemachine/artifacts/architecture/02_Architecture_Overview.md`
*   ...etc.
*   `.codemachine/artifacts/architecture/architecture_manifest.json`