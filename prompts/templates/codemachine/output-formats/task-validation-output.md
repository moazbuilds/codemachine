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
*   **Example Issue 1:** The `getUser` function does not handle cases where the user ID does not exist, causing a null pointer exception.
*   **Example Issue 2:** Test case `test_user_creation_invalid_email` is failing.
*   **Example Issue 3:** There is a linting error in `src/services/user.py` on line 42 due to an unused variable.

---

## Best Approach to Fix

[Provide a single, clear, and actionable instruction set for the Coder Agent. This is the most important part.]

You MUST modify the `getUser` function in `src/services/user.py` to check if the database query returns a result. If the result is null, the function should return `null` instead of attempting to access its properties. Additionally, correct the unused variable `error` on line 42.
```

#### **B) If Verification Succeeds:**

If the code meets all requirements, passes all tests, and has no linting errors, your **only output** is the updated JSON object for the current task, with the `"done"` field set to `true`.

**Action:**
1.  Take the `CURRENT_TASK_JSON` you received as input.
2.  Change the value of the `"done"` key from `false` to `true`.
3.  Output the **entire modified JSON object**. This updated object will be used to overwrite the original task artifact.

**Example:**

*   **If your input `CURRENT_TASK_JSON` is:**
    ```json
    {
      "task_id": "I1.T3",
      "description": "Implement the user logout endpoint.",
      "dependencies": ["I1.T2"],
      "done": false
    }
    ```
*   **Your output will be:**
    ```json
    {
      "task_id": "I1.T3",
      "description": "Implement the user logout endpoint.",
      "dependencies": ["I1.T2"],
      "done": true
    }
    ```