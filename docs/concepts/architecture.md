# How CodeMachine Works

CodeMachine's core innovation is breaking down complex coding workflows into small, manageable tasks that AI agents can effectively handle. Instead of overwhelming a single agent with an entire project specification—which often fails due to context limitations and complexity—the platform uses workflow templates to decompose work into discrete, achievable steps.

The workflow template establishes a sequence of steps, with each step representing a main agent. These main agents can invoke sub-agents through prompt-driven commands to complete various tasks. Main agents have full capability to write code and orchestrate complex operations, and can utilize sub-agents as needed - though both main and sub-agents are capable of handling any type coding of task.

<p align="center">
  <img src="./images/arch-workflow.png" alt="CodeMachine Workflow Architecture" width="400">
</p>



## What's Next?