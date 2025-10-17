# Overview

**CodeMachine is an orchestration platform that lets you achieve any complex coding objective through customizable agent workflows. Whether you need to refactor a legacy system, migrate between frameworks, generate documentation, or create entirely new applications, the platform provides the infrastructure to coordinate specialized AI agents for any coding task.**

**CodeMachine's default workflow template enables you to transform specifications directly into production-ready codebases, providing immediate value out of the box. Beyond this foundation, the platform's extensible architecture empowers you to craft custom workflows tailored to your unique development pipeline and requirements.**

## Who It's For

CodeMachine is built for developers, tech leads, and engineering teams who want to accelerate development without sacrificing code quality or architectural consistency.

## What You Can Achieve

### For Individual Developers

- **Full applications generated** - Complete codebases ready for production
- **Zero boilerplate writing** - Focus on features, not setup

### For Engineering Teams

- **Orchestrate any workflow** - From simple tasks to complex migrations
- **Shared agent context** - File-based or memory context preservation
- **Grow without limits** - Same tool for 500 or 10,000 file projects

---

# Quick Start

## Prerequisites
Before starting, ensure your environment meets these requirements:

| Requirement | Minimum Version | Notes |
|------------|----------------|-------|
| Node.js | 20.10.0 | Required for running CodeMachine CLI |
| npm | 9.0.0 | Package manager (pnpm also supported) |
| AI Engine CLI | Latest | At least one: Codex CLI, Claude Code CLI, or Cursor CLI |

## Get your first project generated

```bash
# Install CodeMachine
npm install -g codemachine
```

```bash
# Run CodeMachine inside your project folder
cd my-awesome-project
codemachine
```

Write a sample specifications:
```
Create a small, single-user to-do application that MUST support create, read, update, and delete operations.
```

```bash
# Run the workflow inside CodeMachine shell
/start
```

**Note:** You can use `--spec <path>` to specify a custom specification file path (Default: `.codemachine/inputs/specifications.md`)

## What's Next?
