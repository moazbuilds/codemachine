
```markdown
# Task Briefing Package

This package contains all necessary information and strategic guidance for the Coder Agent.

---

## 1. Current Task Details

This is the full specification of the task you must complete.

```json
[Paste the complete JSON object for the target_task here, pretty-printed]
```

---

## 2. Architectural & Planning Context

The following are the relevant sections from the architecture and plan documents, which I found by analyzing the task description.

### Context: [key-or-title-of-first-snippet] (from [source-file.md])

```markdown
[Paste the full extracted text snippet for the first context key here]
```

[... Continue this pattern for ALL documentary context snippets you gathered in Phase 2 ...]

---

## 3. Codebase Analysis & Strategic Guidance

The following analysis is based on my direct review of the current codebase. Use these notes and tips to guide your implementation.

### Relevant Existing Code
*   **File:** `[e.g., src/utils/database.py]`
    *   **Summary:** This file contains the primary database connection and session management logic.
    *   **Recommendation:** You SHOULD import and use the `get_db_session()` function from this file instead of creating a new connection.
*   **File:** `[e.g., src/models/user_model.py]`
    *   **Summary:** This file defines the `User` data model.
    *   **Recommendation:** Your task involves a foreign key to the User. You MUST import the `User` class from this file.

### Implementation Tips & Notes
*   **Tip:** I have confirmed that a utility function for hashing passwords, `hash_password()`, exists in `src/utils/security.py`. You SHOULD reuse it.
*   **Note:** The task requires modifying `src/services/order_service.py`. Be aware that this file is also used by the `Payment` service, so ensure your changes do not break the existing public method signatures.
*   **Warning:** The project's linting configuration (`.eslintrc.js`) is very strict about async/await usage. Ensure all promise-based calls are handled correctly.