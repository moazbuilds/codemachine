/** @jsxImportSource @opentui/solid */
import { createSignal, Show, For } from "solid-js"
import { useTheme } from "@tui/context/theme"
import type { PromptProps, SlashCommand } from "./types"

const SLASH_COMMANDS: SlashCommand[] = [
  { command: "start", description: "Start workflow with current template" },
  { command: "templates", description: "Select and configure workflow templates" },
  { command: "login", description: "Authenticate with AI providers" },
  { command: "logout", description: "Sign out of AI providers" },
  { command: "version", description: "Show CLI version" },
  { command: "help", description: "Show available commands" },
  { command: "exit", description: "Exit the session" },
]

export function Prompt(props: PromptProps) {
  const { theme } = useTheme()
  const [input, setInput] = createSignal("")
  const [showAutocomplete, setShowAutocomplete] = createSignal(false)
  const [selectedIndex, setSelectedIndex] = createSignal(0)

  const filteredCommands = () => {
    const value = input()
    if (!value.startsWith("/")) return []
    const query = value.slice(1).toLowerCase()
    return SLASH_COMMANDS.filter((cmd) =>
      cmd.command.toLowerCase().startsWith(query)
    )
  }

  const handleInput = (value: string) => {
    setInput(value)
    setShowAutocomplete(value.startsWith("/") && filteredCommands().length > 0)
    setSelectedIndex(0)
  }

  const handleSubmit = () => {
    const value = input()
    if (!value.trim()) return

    setInput("")
    setShowAutocomplete(false)
    props.onSubmit(value.trim())
  }

  const handleKeyDown = (evt: any) => {
    if (showAutocomplete() && filteredCommands().length > 0) {
      if (evt.name === "up") {
        setSelectedIndex((prev) => Math.max(0, prev - 1))
        return
      } else if (evt.name === "down") {
        setSelectedIndex((prev) =>
          Math.min(filteredCommands().length - 1, prev + 1)
        )
        return
      } else if (evt.name === "tab" || evt.name === "return") {
        if (evt.name === "tab") {
          const selected = filteredCommands()[selectedIndex()]
          if (selected) {
            setInput(`/${selected.command}`)
            setShowAutocomplete(false)
            return
          }
        }
      }
    }

    if (evt.name === "return") {
      handleSubmit()
    }
  }

  return (
    <box flexDirection="column" gap={0} width="100%" maxWidth={75}>
      <box
        borderColor={theme.border}
        border={["top", "bottom", "left", "right"]}
        paddingLeft={1}
        paddingRight={1}
      >
        <input
          value={input()}
          placeholder={props.placeholder || "Type /start to see the magic"}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          focused
        />
      </box>

      <Show when={showAutocomplete() && filteredCommands().length > 0}>
        <box
          marginTop={1}
          borderColor={theme.border}
          border={["top", "bottom", "left", "right"]}
          paddingLeft={1}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
          backgroundColor={theme.backgroundPanel}
        >
          <box flexDirection="column" gap={0}>
            <For each={filteredCommands()}>
              {(cmd, index) => {
                const isSelected = () => index() === selectedIndex()
                return (
                  <box flexDirection="row" gap={1}>
                    <text fg={isSelected() ? theme.primary : theme.textMuted}>
                      {isSelected() ? "●" : "○"}
                    </text>
                    <text fg={isSelected() ? theme.primary : theme.text}>
                      /{cmd.command}
                    </text>
                    <text fg={theme.textMuted}>- {cmd.description}</text>
                  </box>
                )
              }}
            </For>
          </box>
        </box>
      </Show>

      <Show when={props.hint}>
        <box marginTop={1}>
          <text fg={theme.textMuted}>{props.hint}</text>
        </box>
      </Show>
    </box>
  )
}
