/** @jsxImportSource @opentui/solid */
import { useTheme } from "@tui/context/theme"

export interface HelpRowProps {
  command: string
  description: string
}

export function HelpRow(props: HelpRowProps) {
  const { theme } = useTheme()

  return (
    <box flexDirection="row" gap={2}>
      <box width={14}>
        <text fg={theme.primary}>/{props.command}</text>
      </box>
      <box>
        <text fg={theme.textMuted}>{props.description}</text>
      </box>
    </box>
  )
}
