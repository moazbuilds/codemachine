/**
 * Custom error class for placeholder processing
 */
export class PlaceholderError extends Error {
  constructor(
    message: string,
    public placeholderName: string,
    public filePath: string,
  ) {
    super(message);
    this.name = 'PlaceholderError';
  }
}

/**
 * Creates a detailed error message for a required placeholder that couldn't be loaded
 *
 * @param placeholderName - The name of the placeholder (e.g., "plan_fallback")
 * @param filePath - The file path that was expected
 * @returns A formatted error object
 */
export function createRequiredFileError(
  placeholderName: string,
  filePath: string,
): PlaceholderError {
  const message = `
❌ Error: {${placeholderName}} is required to complete this stage and provide high-quality results.

Expected file: ${filePath}

If you want to step back and skip this stage:
1. Edit .codemachine/template.json
2. Remove the step number from "completedSteps" array

Example:
"completedSteps": [0, 1, 2]  ← Remove the last number to re-run that step

To disable resume from last step (start workflow from beginning):
1. Edit .codemachine/template.json
2. Check if "notCompletedSteps" array is empty: []
3. If not empty, remove all numbers from "notCompletedSteps" array
4. Or set "resumeFromLastStep": false to disable this feature

Example:
"notCompletedSteps": []  ← Empty array means no incomplete steps to resume
"resumeFromLastStep": false  ← Disables the resume feature entirely
`.trim();

  return new PlaceholderError(message, placeholderName, filePath);
}

/**
 * Creates a warning message for an optional placeholder that couldn't be loaded
 * This is logged but doesn't throw an error
 *
 * @param placeholderName - The name of the placeholder
 * @param filePath - The file path that was expected
 */
export function createOptionalFileWarning(
  _placeholderName: string,
  _filePath: string,
): void {
  // Optional placeholders that fail to load are silently skipped
  // No warning is printed to avoid cluttering the output
}

/**
 * Handles placeholder load errors based on whether the placeholder is optional
 *
 * @param placeholderName - The name of the placeholder
 * @param filePath - The file path that failed to load
 * @param isOptional - Whether the placeholder has the ! prefix
 * @param error - The original error
 * @returns Empty string for optional placeholders
 * @throws PlaceholderError for required placeholders
 */
export function handlePlaceholderLoadError(
  placeholderName: string,
  filePath: string,
  isOptional: boolean,
  _error: Error,
): string {
  if (isOptional) {
    // For optional placeholders, log a warning and return empty string
    createOptionalFileWarning(placeholderName, filePath);
    return '';
  }

  // For required placeholders, throw a detailed error
  throw createRequiredFileError(placeholderName, filePath);
}
