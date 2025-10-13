# Contributing to CodeMachine

First off, thank you for considering contributing to CodeMachine! It's people like you that make CodeMachine such a great tool.

We welcome contributions in various forms, including but not limited to:
- New features and enhancements
- Bug fixes
- Documentation improvements
- New templates and workflows

This document focuses on creating new templates and workflows.

## Getting Started

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** to your local machine.
3.  **Install the dependencies**:
    ```bash
    npm install
    ```
4.  **Build the project**:
    ```bash
    npm run build
    ```
5.  **Link the package**: To test your changes globally, use `npm link`:
    ```bash
    npm link
    ```

## The Config Directory

The `config` directory is the heart of CodeMachine's configuration. It's where you define agents, modules, and placeholders that can be used in your workflows and templates. Understanding this directory is crucial for customizing and extending CodeMachine.

Here's a breakdown of the files in the `config` directory:

-   `main.agents.js`: Defines the main agents that can be used as steps in a workflow.
-   `sub.agents.js`: Defines the sub-agents that can be used for parallel execution within a workflow.
-   `modules.js`: Defines special modules that can be used as steps in a workflow. Modules can have custom behaviors, such as looping.
-   `placeholders.js`: Defines placeholders that can be used in your prompt templates. This allows you to inject dynamic content into your prompts.

By modifying these files, you can add new agents, create custom modules, and define your own placeholders to tailor CodeMachine to your specific needs.



Prompt templates are essential for guiding the behavior of the AI agents. They are located in the `prompts/templates` directory.

### Template Structure

The `prompts/templates` directory is organized into subdirectories, each representing a different template set. For example, the `codemachine` directory contains the templates for the core CodeMachine workflow.

Each template is a Markdown file (`.md`) that defines the prompt for a specific agent. The file name corresponds to the agent's ID. For example, `01-architecture-agent.md` is the template for the `architecture-agent`.

### Creating a New Template

1.  **Choose a template set**: Decide which template set your new template belongs to, or create a new directory if needed.
2.  **Create a new Markdown file**: The file name should be descriptive of the agent's purpose.
3.  **Write the template**: The content of the file should be a clear and concise prompt that guides the agent's behavior. You can use placeholders in the format `{{placeholder_name}}` to insert dynamic content. The available placeholders are defined in the `config/placeholders.js` file.

## Creating Workflows

Workflows define the sequence of steps and agents that are executed to achieve a specific goal. They are located in the `templates/workflows` directory.

### Workflow Structure

A workflow is a JavaScript file that exports a workflow definition object. The object has the following properties:

-   `name`: The name of the workflow.
-   `steps`: An array of steps to be executed in sequence.
-   `subAgentIds`: An array of sub-agent IDs that can be used in the workflow.

### Creating a New Workflow

1.  **Create a new JavaScript file** in the `templates/workflows` directory. The file name should be descriptive of the workflow's purpose (e.g., `my-new-workflow.workflow.js`).
2.  **Define the workflow object**: Create a JavaScript object with the `name`, `steps`, and `subAgentIds` properties.
3.  **Define the steps**: Each step is an object that defines the agent to be executed and its parameters. You can use the `resolveStep`, `resolveModule`, and `resolveFolder` functions to create steps. These functions load agents, modules, and folders defined in the `config` directory.

    -   `resolveStep(agentId, parameters)`: Loads a main agent defined in `config/main.agents.js`.
    -   `resolveModule(moduleId, parameters)`: Loads a module defined in `config/modules.js`.
    -   `resolveFolder(folderId, parameters)`: Loads a folder of agents defined in `config/main.agents.js`. This is useful for applying the same parameters to a group of agents.
4.  **Add sub-agents**: If your workflow uses sub-agents, add their IDs to the `subAgentIds` array.

### Example Workflow

Here is an example of a simple workflow:

```javascript
export default {
  name: 'My New Workflow',
  steps: [
    resolveStep('my-agent', { /* parameters */ }),
    resolveModule('my-module', { /* parameters */ }),
  ],
  subAgentIds: ['my-sub-agent'],
};
```

## Submitting Changes

1.  **Create a new branch** for your changes.
2.  **Commit your changes** with a clear and descriptive commit message.
3.  **Push your changes** to your fork on GitHub.
4.  **Create a pull request** to the main repository.

We will review your pull request as soon as possible. Thank you for your contribution!
