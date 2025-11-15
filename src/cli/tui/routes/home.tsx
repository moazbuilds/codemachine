/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import { Logo } from "@tui/component/logo"
import { HelpRow } from "@tui/component/help-row"
import { Prompt } from "@tui/component/prompt"
import { SelectMenu } from "@tui/component/select-menu"
import { Toast } from "@tui/ui/toast"
import { DialogWrapper } from "@tui/ui/dialog-wrapper"
import { useTheme } from "@tui/context/theme"
import { useToast } from "@tui/context/toast"
import { useDialog } from "@tui/context/dialog"
import { useSession } from "@tui/context/session"
import { useRenderer } from "@opentui/solid"
import { registry } from "../../../infra/engines/index.js"
import { handleLogin, handleLogout } from "../../commands/auth.command.js"
import { getAvailableTemplates, selectTemplateByNumber } from "../../commands/templates.command.js"
import { runWorkflowQueue } from "../../../workflows/index.js"
import { createRequire } from "node:module"
import { resolvePackageJson } from "../../../shared/utils/package-json.js"

export function Home() {
  const { theme } = useTheme()
  const toast = useToast()
  const dialog = useDialog()
  const session = useSession()
  const renderer = useRenderer()

  const statusHint = () => {
    const parts = []
    parts.push(`Template: ${session.templateName.toUpperCase()}`)
    parts.push(`${session.workflowCount} workflows`)
    if (session.lastRun) {
      const ago = Math.floor((Date.now() - session.lastRun.getTime()) / 1000 / 60)
      parts.push(`Last run: ${ago} minutes ago`)
    }
    return parts.join(" • ")
  }

  const getVersion = () => {
    const require = createRequire(import.meta.url)
    const packageJsonPath = resolvePackageJson(import.meta.url, "home route")
    const pkg = require(packageJsonPath) as { version: string }
    return pkg.version
  }

  const handleCommand = async (command: string) => {
    const cmd = command.toLowerCase()

    if (cmd === "/start") {
      // Unmount OpenTUI to release terminal control
      renderer.destroy()

      // Run workflow with Ink UI
      const cwd = process.env.CODEMACHINE_CWD || process.cwd()
      const specificationPath = "" // Will be determined by workflow runner
      await runWorkflowQueue({ cwd, specificationPath })

      // Workflow completes -> process.exit()
      return
    }

    if (cmd === "/templates" || cmd === "/template") {
      const templates = await getAvailableTemplates()
      const choices = templates.map((t, index) => ({
        title: t.title,
        value: index + 1,
        description: t.description,
      }))

      dialog.show(
        <SelectMenu
          message="Choose a workflow template:"
          choices={choices}
          onSelect={async (templateNumber: number) => {
            dialog.close()
            try {
              await selectTemplateByNumber(templateNumber)
              toast.show({
                variant: "success",
                message: "Template activated!",
              })
            } catch (error) {
              toast.show({
                variant: "error",
                message: error instanceof Error ? error.message : String(error),
              })
            }
          }}
          onCancel={() => dialog.close()}
        />
      )
      return
    }

    if (cmd === "/login") {
      const providers = registry.getAll().map((engine) => ({
        title: engine.metadata.name,
        value: engine.metadata.id,
        description: engine.metadata.description,
      }))

      dialog.show(
        <SelectMenu
          message="Choose authentication provider to login:"
          choices={providers}
          onSelect={async (providerId: string) => {
            dialog.close()
            await dialog.handleInteractiveCommand(
              `${providers.find((p) => p.value === providerId)?.title} Authentication`,
              async () => {
                await handleLogin(providerId)
              }
            )
            toast.show({
              variant: "success",
              message: "Logged in successfully!",
            })
          }}
          onCancel={() => dialog.close()}
        />
      )
      return
    }

    if (cmd === "/logout") {
      const providers = registry.getAll().map((engine) => ({
        title: engine.metadata.name,
        value: engine.metadata.id,
        description: engine.metadata.description,
      }))

      dialog.show(
        <SelectMenu
          message="Choose authentication provider to logout:"
          choices={providers}
          onSelect={async (providerId: string) => {
            dialog.close()
            try {
              await handleLogout(providerId)
              toast.show({
                variant: "success",
                message: "Logged out successfully!",
              })
            } catch (error) {
              toast.show({
                variant: "error",
                message: error instanceof Error ? error.message : String(error),
              })
            }
          }}
          onCancel={() => dialog.close()}
        />
      )
      return
    }

    if (cmd === "/version") {
      toast.show({
        variant: "info",
        message: `CodeMachine v${getVersion()}`,
      })
      return
    }

    if (cmd === "/help" || cmd === "/h") {
      toast.show({
        variant: "info",
        message: "Available commands: /start, /templates, /login, /logout, /version, /help, /exit",
        duration: 5000,
      })
      return
    }

    if (cmd === "/exit" || cmd === "/quit") {
      process.exit(0)
    }

    // Unknown command
    toast.show({
      variant: "error",
      message: `Unknown command: ${command}. Type /help for options.`,
    })
  }

  return (
    <box flexGrow={1} justifyContent="center" alignItems="center" paddingLeft={2} paddingRight={2} gap={1}>
      <Logo />

      <box width={60}>
        <text fg={theme.border}>{'═'.repeat(60)}</text>
      </box>

      <box width={60} flexDirection="column" gap={0}>
        <HelpRow command="start" description="Start workflow with current template" />
        <HelpRow command="templates" description="Select and configure workflow templates" />
        <HelpRow command="login" description="Authenticate with AI providers" />
        <HelpRow command="help" description="Show available commands" />
      </box>

      <box width={60}>
        <text fg={theme.border}>{'═'.repeat(60)}</text>
      </box>

      <Prompt onSubmit={handleCommand} hint={statusHint()} />

      <Toast />

      <Show when={dialog.current}>
        <DialogWrapper>{dialog.current}</DialogWrapper>
      </Show>
    </box>
  )
}
