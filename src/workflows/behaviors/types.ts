export interface BehaviorAction {
  action: 'loop' | 'checkpoint' | 'continue' | 'trigger';
  reason?: string;
  triggerAgentId?: string; // Required when action is 'trigger'
}
