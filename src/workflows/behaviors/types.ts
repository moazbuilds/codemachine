export interface BehaviorAction {
  action: 'loop' | 'checkpoint' | 'continue' | 'trigger' | 'stop';
  reason?: string;
  triggerAgentId?: string; // Required when action is 'trigger'
}
