import type { Interface } from 'node:readline';
import { createInteractiveSelector } from '../../presentation/interactive-selector.js';
import { getAvailableTemplates, selectTemplateByNumber, printAvailableWorkflowTemplatesHeading } from '../../commands/templates.command.js';

export function createTemplateHandler(rl: Interface, onComplete: () => void) {
  let selector: ReturnType<typeof createInteractiveSelector> | null = null;

  const handleTemplateSelection = async () => {
    const templates = await getAvailableTemplates();

    if (templates.length === 0) {
      console.log('No workflow templates found in templates/workflows/');
      onComplete();
      return;
    }

    printAvailableWorkflowTemplatesHeading();

    selector = createInteractiveSelector(rl, {
      heading: '\nChoose a workflow template:\n',
      choices: templates,
      onSelect: async (templatePath: string) => {
        const templateNumber = templates.findIndex(t => t.value === templatePath) + 1;
        try {
          await selectTemplateByNumber(templateNumber);
        } catch (error) {
          console.error('Error selecting template:', error instanceof Error ? error.message : String(error));
        }
      },
      onComplete
    });

    selector.start();
  };

  return {
    handle: handleTemplateSelection,
    isActive: () => selector?.isActive() ?? false
  };
}
