/** @jsxImportSource @opentui/solid */
import type { JSX } from "solid-js"
import { useTheme } from "@tui/context/theme"

export interface DialogWrapperProps {
  children: JSX.Element
}

export function DialogWrapper(props: DialogWrapperProps) {
  const { theme } = useTheme()

  return (
    <box
      position="absolute"
      left={10}
      right={10}
      top={5}
      bottom={5}
      backgroundColor={theme.backgroundPanel}
      borderColor={theme.border}
      border={["top", "bottom", "left", "right"]}
      padding={2}
      zIndex={2000}
    >
      {props.children}
    </box>
  )
}
