import type { Command } from 'commander';
import * as path from 'node:path';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import prompts from 'prompts';
import { loadWorkflowModule, isWorkflowTemplate } from '../../core/workflows/manager/template-loader.js';

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
const settingsPath = path.resolve(packageRoot, 'config', 'settings.js');

interface TemplateChoice {
  title: string;
  value: string;
  description?: string;
}

function updateSettingsFile(templateFileName: string): void {
  try {
    // Ensure config directory exists
    const configDir = path.dirname(settingsPath);
    if (!existsSync(configDir)) {
      throw new Error(`Config directory does not exist: ${configDir}`);
    }

    // Create the new settings content
    const settingsContent = `module.exports = {
  workflow: {
    template: '${templateFileName}',
  },
};
`;

    // Write the updated settings
    writeFileSync(settingsPath, settingsContent, 'utf8');
    console.log(`✅ Updated config/settings.js with template: ${templateFileName}`);
  } catch (error) {
    console.error('❌ Failed to update settings.js:', error instanceof Error ? error.message : String(error));
    console.log(`\nPlease manually update your config/settings.js with:`);
    console.log(`  workflow: { template: '${templateFileName}' }`);
  }
}

export async function getAvailableTemplates(): Promise<TemplateChoice[]> {
  if (!existsSync(templatesDir)) {
    return [];
  }

  const files = readdirSync(templatesDir).filter(file => file.endsWith('.workflow.js'));
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
      const templateFileName = path.basename(selectedTemplate.value);

      console.log(`\nSelected: ${template.name}`);
      console.log(`Template path: ${path.relative(process.cwd(), selectedTemplate.value)}`);
      console.log(`\nSteps:`);
      template.steps.forEach((step, index) => {
        console.log(`  ${index + 1}. ${step.agentName} [${step.agentId}]`);
      });

      // Automatically update settings.js
      updateSettingsFile(templateFileName);
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

    console.log('\nAvailable workflow templates:\n');

    const response = await prompts({
      type: 'select',
      name: 'selectedTemplate',
      message: 'Choose a workflow template:',
      choices: templates,
      initial: 0
    });

    if (response.selectedTemplate) {
      const template = await loadWorkflowModule(response.selectedTemplate);
      if (isWorkflowTemplate(template)) {
        const templateFileName = path.basename(response.selectedTemplate);

        console.log(`\nSelected: ${template.name}`);
        console.log(`Template path: ${path.relative(process.cwd(), response.selectedTemplate)}`);
        console.log(`\nSteps:`);
        template.steps.forEach((step, index) => {
        console.log(`  ${index + 1}. ${step.agentName} [${step.agentId}]`);
        });

        // Automatically update settings.js
        updateSettingsFile(templateFileName);
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
