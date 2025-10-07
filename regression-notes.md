# Refactor Regression Notes

- **Keyboard controller expanded toggle**
  - Before: `createKeyboardController` no longer tracked the expanded state or emitted toggle events when Ctrl+E was pressed, leaving the execution UI unable to react.
  - After: Restored `expanded` tracking and `toggle-expanded` emissions so Ctrl+E toggles the state and notifies listeners as before.
- **Typewriter timing semantics**
  - Before: `renderTypewriter` and `renderExecutionScreen` wrote five characters per tick with a 1 ms default interval, breaking the expected paced output and associated timers.
  - After: Reinstated single-character pacing with a 12 ms default interval to match legacy behaviour and unit tests.
- **Workflow validation export**
  - Before: `validateSpecification` stopped being re-exported via the workflows module, so consumers (and tests) received `undefined`.
  - After: Re-exported the function through `workflows/execution/queue.ts`, restoring compatibility with existing imports.
- **Build and validation scripts**
  - Before: `npm run build` still targeted `src/app/index.ts` and `npm run validate` invoked `scripts/ci/validate.sh`, both paths removed during the refactor.
  - After: Updated the scripts to point at `src/runtime/index.ts` and `scripts/validate.sh`, allowing the standard build and validation flows to succeed.
