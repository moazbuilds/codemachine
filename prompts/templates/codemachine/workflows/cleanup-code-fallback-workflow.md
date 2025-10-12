# Cleanup Code Fallback File — Role Prompt

## Mission
Delete the fallback prompt file `.codemachine/prompts/code_fallback.md` if it exists in the current workspace.

## Steps
1. Check if the file exists by running:
   - `ls -la .codemachine/prompts` (ignore errors if directory is missing)
   - `test -f .codemachine/prompts/code_fallback.md && echo "FOUND" || echo "NOT_FOUND"`
2. If the file exists, delete it safely:
   - `rm .codemachine/prompts/code_fallback.md`
3. Verify deletion:
   - `test -f .codemachine/prompts/code_fallback.md && echo "STILL_PRESENT" || echo "DELETED"`

## Output Requirements
- State whether the file was found.
- If found, confirm successful deletion.
- If not found, state no action was required.

## Safety Rules
- Only delete the exact file: `.codemachine/prompts/code_fallback.md`.
- Do not delete any other files or directories.
- Do not create or modify other files.

## Success Criteria
- The file does not exist after the operation, or it was not present to begin with.

