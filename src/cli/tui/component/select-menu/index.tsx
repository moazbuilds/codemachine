/** @jsxImportSource @opentui/solid */
import { createSignal, For } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useKeyboard } from "@opentui/solid"
import type { SelectMenuProps } from "./types"

export function SelectMenu<T = string>(props: SelectMenuProps<T>) {
  const { theme } = useTheme()
  console.log("SelectMenu theme", theme)
  const [selectedIndex, setSelectedIndex] = createSignal(0)

  useKeyboard((evt) => {
    if (evt.name === "up") {
      setSelectedIndex((prev) => Math.max(0, prev - 1))
    } else if (evt.name === "down") {
      setSelectedIndex((prev) => Math.min(props.choices.length - 1, prev + 1))
    } else if (evt.name === "return") {
      props.onSelect(props.choices[selectedIndex()].value)
    } else if (evt.name === "escape") {
      props.onCancel?.()
    } else if (evt.name && /^[1-9]$/.test(evt.name)) {
      const num = parseInt(evt.name, 10)
      if (num >= 1 && num <= props.choices.length) {
        props.onSelect(props.choices[num - 1].value)
      }
    }
  })

  return (
    <box flexDirection="column" gap={1}>
      <box marginBottom={1}>
        <text fg={theme.primary}>◆ {props.message}</text>
      </box>

      <For each={props.choices}>
        {(choice, index) => {
          const isSelected = () => index() === selectedIndex()
          return (
            <box flexDirection="column" gap={0}>
              <box flexDirection="row" gap={1}>
                <text fg={isSelected() ? theme.primary : theme.textMuted}>
                  {isSelected() ? "●" : "○"}
                </text>
                <text fg={isSelected() ? theme.primary : theme.text}>
                  {choice.title}
                </text>
              </box>
              {choice.description && (
                <box marginLeft={3}>
                  <text fg={theme.textMuted}>{choice.description}</text>
                </box>
              )}
            </box>
          )
        }}
      </For>

      <box marginTop={1}>
        <text fg={theme.textMuted}>
          ↑/↓ Navigate • Enter to select • Esc to cancel
        </text>
      </box>
    </box>
  )
}
