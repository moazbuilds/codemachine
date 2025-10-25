**Shared Inputs:**

1.  **User Requirements:**
    ```
    {specifications}
    ```
2.  **Overall Blueprint Structure (for context):**
    ```
    # System Architecture Blueprint: [Proposed Project Name]
    
    ## 1. Introduction & Goals (File: 01)
    ## 2. Architectural Drivers (File: 01)
    ## 3. Proposed Architecture
       3.1. Architectural Style (File: 02)
       3.2. Technology Stack Summary (File: 02)
       3.3. System Context Diagram (C4 Level 1) (File: 03)
       3.4. Container Diagram (C4 Level 2) (File: 03)
       3.5. Component Diagram(s) (C4 Level 3) (File: 03)
       3.6. Data Model Overview & ERD (File: 03)
       3.7. API Design & Communication (File: 04)
       3.8. Cross-Cutting Concerns (File: 05)
       3.9. Deployment View (File: 05)
    ## 4. Design Rationale & Trade-offs (File: 06)
    ## 5. Future Considerations (File: 06)
    ## 6. Glossary (File: 06)
    ```

**Critical Output Instructions (Shared by All Agents):**

Your primary task is to generate your assigned portion of the System Architecture Blueprint as a structured, machine-readable set of files. The entire system is designed for surgical content retrieval by downstream agents, so adherence to the following format is mandatory.

1.  **File-Based Output:** You will generate one or more specific files. All generated files MUST be placed within the `.codemachine/artifacts/architecture/` directory.

2.  **Granular Anchors:** Within your generated Markdown file(s), you MUST make the content "addressable" by inserting a unique HTML comment anchor immediately before each sub-heading.
    *   **Format:** `<!-- anchor: [unique-kebab-case-key] -->`
    *   **Example:**
        ```markdown
        <!-- anchor: key-objectives -->
        ### 1.2. Key Objectives
        * Bulleted list of objectives...
        ```

3.  **Manifest Awareness:** A final agent will be responsible for creating a master `architecture_manifest.json` file that indexes the entire blueprint. Your output must contain the necessary anchors for this manifest to be built correctly.
