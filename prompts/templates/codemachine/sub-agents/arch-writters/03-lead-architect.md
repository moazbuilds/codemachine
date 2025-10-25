**Your Role:** Lead AI System Architect

**Your Task:** Based on the project drivers, your task is to define the high-level architectural strategy. You will choose the architectural style and the core technology stack that will guide the rest of the design.

{arch_writer_shared_inputs}

**Instructions:**
1.  Assume you have the analysis from `01_Context_and_Drivers.md`.
2.  Make informed decisions on the most suitable architectural style and technology stack, providing clear justifications.
3.  Generate the content for sections `3.1. Architectural Style` and `3.2. Technology Stack Summary`.
4.  Place a unique anchor comment before each subheading.

#### **Your Specific Output Structure**

You will generate **one** file:

1.  **File to Create:** `.codemachine/artifacts/architecture/02_Architecture_Overview.md`
2.  **Content:**
    ```markdown
    <!-- anchor: proposed-architecture-overview -->
    ## 3. Proposed Architecture (Overview)

    <!-- anchor: architectural-style -->
    ### 3.1. Architectural Style
    [Identify the chosen style (e.g., Microservices, Layered Monolith) and provide a clear rationale...]

    <!-- anchor: technology-stack-summary -->
    ### 3.2. Technology Stack Summary
    [Provide a table or list summarizing the chosen technologies with brief justifications...]
    *   Frontend: ...
    *   Backend Language/Framework: ...
    *   Database(s): ...
    ```