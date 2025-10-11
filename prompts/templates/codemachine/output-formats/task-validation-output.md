### **Output Specification**

Your output depends entirely on the outcome of the verification. You will perform **only one** of the following two actions.

#### **A) If Verification Fails:**

If the code is incorrect, incomplete, fails tests, or has linting errors, your **only output** is to create or overwrite the file `.codemachine/prompts/code_fallback.md`. The content of this file MUST be a new, detailed prompt for the Coder Agent, instructing it how to fix the specific errors.

**Format for `code_fallback.md`:**

```markdown
# Code Refinement Task

The previous code submission did not pass verification. You must fix the following issues and resubmit your work.

---

## Original Task Description

[Paste the original TASK_DESCRIPTION here for context]

---

## Issues Detected

[Provide a concise, bulleted list of everything that was wrong. Be specific.]
*   **Test Failure:** The test case `test_user_creation_invalid_email` is failing because the API returned a 500 error instead of a 400 error.
*   **Linting Error:** There is a linting error in `src/services/user.py` on line 42 due to an unused variable `err`.

---

## Best Approach to Fix

[Provide a single, clear, and actionable instruction set for the Coder Agent.]

You MUST modify the `create_user` function in `src/services/user.py`. Add a `try...catch` block to handle potential database errors during user creation and return a proper 400-level error response. Also, you must remove the unused variable `err` on line 42 to fix the linting issue.
```

#### **B) If Verification Succeeds:**

If the code meets all requirements, passes all tests, and has no linting errors, your **only action** is to find the correct task list file in `.codemachine/artifacts/tasks/` and update it to mark the current task as done.

**Action Workflow:**
1.  **Identify Target File:** From the `CURRENT_TASK_JSON` input, extract the value of the `iteration_id` key (e.g., "I1"). Use this to construct the exact file path: `.codemachine/artifacts/tasks/tasks_{iteration_id}.json`.
2.  **Load Task List:** Read the full content of the JSON file you identified. This file contains an array of all tasks for that iteration.
3.  **Find and Modify Task:** Iterate through the array of tasks you just loaded. Find the specific task object where the `task_id` matches the `task_id` from your `CURRENT_TASK_JSON` input. Change the value of its `"done"` key from `false` to `true`.

**Example:**

*   Your `CURRENT_TASK_JSON` has `task_id: "I1.T2"` and `iteration_id: "I1"`.
*   You will target the file `.codemachine/artifacts/tasks/tasks_I1.json`.
*   **Content of the file BEFORE you act:**
    ```json
    [
      { "task_id": "I1.T1", "description": "...", "done": true },
      { "task_id": "I1.T2", "description": "Implement the login endpoint.", "done": false },
      { "task_id": "I1.T3", "description": "Implement the logout endpoint.", "done": false }
    ]
    ```
*   **Content of the file AFTER you act:**
    ```json
    [
      { "task_id": "I1.T1", "description": "...", "done": true },
      { "task_id": "I1.T2", "description": "Implement the login endpoint.", "done": true },
      { "task_id": "I1.T3", "description": "Implement the logout endpoint.", "done": false }
    ]
    ```