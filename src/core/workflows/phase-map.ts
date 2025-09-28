export type Phase = 'Planning' | 'Building' | 'Testing' | 'Runtime';

export const phaseMap = {
  Planning: {
    description: 'Planning phase for system design and architecture',
    next: 'Building'
  },
  Building: {
    description: 'Building phase for implementation',
    next: 'Testing'
  },
  Testing: {
    description: 'Testing phase for quality assurance',
    next: 'Runtime'
  },
  Runtime: {
    description: 'Runtime phase for deployment and performance',
    next: null
  }
} as const;