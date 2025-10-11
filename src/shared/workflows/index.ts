// Template tracking functions
export {
  getActiveTemplate,
  setActiveTemplate,
  hasTemplateChanged,
  getTemplatePathFromTracking,
} from './template.js';

// Step tracking functions
export {
  getCompletedSteps,
  markStepCompleted,
  clearCompletedSteps,
  getNotCompletedSteps,
  markStepStarted,
  removeFromNotCompleted,
  clearNotCompletedSteps,
} from './steps.js';
