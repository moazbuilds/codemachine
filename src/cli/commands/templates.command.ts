import type { Command } from 'commander';
import * as path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadWorkflowModule, isWorkflowTemplate, WorkflowTemplate } from '../../workflows/index.js';
import { hasTemplateChanged, setActiveTemplate } from '../../shared/workflows/index.js';
import { bootstrapWorkspace } from '../../runtime/services/workspace/index.js';
import { selectFromMenu, type SelectionChoice } from '../presentation/selection-menu.js';
import { isModuleStep } from '../../workflows/templates/types.js';

const packageRoot = (() => {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  let current = moduleDir;
  while (true) {
    if (existsSync(path.join(current, 'package.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return moduleDir;
    current = parent;
  }
})();

const templatesDir = path.resolve(packageRoot, 'templates', 'workflows');

export function printAvailableWorkflowTemplatesHeading(): void {
  console.log('\nAvailable workflow templates:\n');
}

type TemplateChoice = SelectionChoice<string>;


async function handleTemplateSelectionSuccess(template: WorkflowTemplate, templateFilePath: string): Promise<void> {
  const templateFileName = path.basename(templateFilePath);
  const cwd = process.env.CODEMACHINE_CWD || process.cwd();
  const cmRoot = path.join(cwd, '.codemachine');
  const agentsDir = path.join(cmRoot, 'agents');

  console.log(`\nSelected: ${template.name}`);
  console.log(`Template path: ${path.relative(process.cwd(), templateFilePath)}`);
  console.log(`\nSteps:`);

  template.steps.forEach((step, index) => {
    if (isModuleStep(step)) {
      console.log(`  ${index + 1}. ${step.agentName} [${step.agentId}]`);
    } else {
      console.log(`  ${index + 1}. [UI Element]`);
    }
  });

  // Check if template changed and regenerate agents folder
  const changed = await hasTemplateChanged(cmRoot, templateFileName);

  if (changed) {
    console.log('\n🔄 Template changed, regenerating agents...');

    // Delete existing agents folder if it exists
    if (existsSync(agentsDir)) {
      await rm(agentsDir, { recursive: true, force: true });
    }

    // Update active template tracking
    await setActiveTemplate(cmRoot, templateFileName);

    // Regenerate agents folder with new template
    await bootstrapWorkspace({
      cwd,
      templatePath: templateFilePath
    });

    console.log('✅ Agents regenerated successfully');
  } else {
    console.log('\n✓ Template unchanged, agents folder up to date');
    // Still update tracking even if unchanged (in case this is first time setting)
    await setActiveTemplate(cmRoot, templateFileName);
  }

  console.log(`\n✅ Template saved to .codemachine/template.json`);
}

export async function getAvailableTemplates(): Promise<TemplateChoice[]> {
  if (!existsSync(templatesDir)) {
    return [];
  }

  const files = readdirSync(templatesDir).filter(file =>
    file.endsWith('.workflow.js') && !file.startsWith('_example.')
  );
  const templates: TemplateChoice[] = [];

  for (const file of files) {
    try {
      const filePath = path.join(templatesDir, file);
      const template = await loadWorkflowModule(filePath);

      if (isWorkflowTemplate(template)) {
        templates.push({
          title: template.name,
          value: filePath,
          description: `${template.steps.length} step(s) - ${file}`
        });
      }
    } catch (error) {
      // Skip invalid templates
      console.warn(`Warning: Could not load template ${file}:`, error);
    }
  }

  return templates.sort((a, b) => a.title.localeCompare(b.title));
}

export async function selectTemplateByNumber(templateNumber: number): Promise<void> {
  try {
    const templates = await getAvailableTemplates();

    if (templates.length === 0) {
      console.log('No workflow templates found in templates/workflows/');
      return;
    }

    if (templateNumber < 1 || templateNumber > templates.length) {
      console.log(`Invalid selection. Please choose a number between 1 and ${templates.length}.`);
      return;
    }

    const selectedTemplate = templates[templateNumber - 1];
    const template = await loadWorkflowModule(selectedTemplate.value);

    if (isWorkflowTemplate(template)) {
      await handleTemplateSelectionSuccess(template, selectedTemplate.value);
    }
  } catch (error) {
    console.error('Error selecting template:', error instanceof Error ? error.message : String(error));
  }
}

export async function runTemplatesCommand(inSession: boolean = false): Promise<void> {
  try {
    const templates = await getAvailableTemplates();

    if (templates.length === 0) {
      console.log('No workflow templates found in templates/workflows/');
      return;
    }

    printAvailableWorkflowTemplatesHeading();

    const selectedTemplate = await selectFromMenu({
      message: 'Choose a workflow template:',
      choices: templates,
      initial: 0
    });

    if (selectedTemplate) {
      const template = await loadWorkflowModule(selectedTemplate);
      if (isWorkflowTemplate(template)) {
        await handleTemplateSelectionSuccess(template, selectedTemplate);
      }
    } else {
      console.log('No template selected.');
    }
  } catch (error) {
    console.error('Error loading templates:', error);
    // Only exit if not in session mode
    if (!inSession) {
      process.exit(1);
    }
  }
}

export function registerTemplatesCommand(program: Command): void {
  program
    .command('templates')
    .description('List and select workflow templates')
    .action(runTemplatesCommand);
}
