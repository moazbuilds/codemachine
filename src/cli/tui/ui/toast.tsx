/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import { useToast } from "@tui/context/toast"
import { useTheme } from "@tui/context/theme"

const VARIANT_ICONS = {
  success: "✓",
  error: "✗",
  info: "ℹ",
  warning: "⚠",
} as const

export function Toast() {
  const toast = useToast()
  const { theme } = useTheme()

  return (
    <Show when={toast.current}>
      {(currentToast) => (
        <box
          position="absolute"
          top={2}
          right={2}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          backgroundColor={theme.backgroundPanel}
          borderColor={theme[currentToast().variant]}
          border={["left", "right"]}
          zIndex={3000}
        >
          <box flexDirection="row" gap={1}>
            <text fg={theme[currentToast().variant]}>
              {VARIANT_ICONS[currentToast().variant]}
            </text>
            <text fg={theme.text}>{currentToast().message}</text>
          </box>
        </box>
      )}
    </Show>
  )
}
