/** @jsxImportSource @opentui/solid */
import { TextAttributes } from "@opentui/core"
import { For } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { createRequire } from 'node:module'
import { resolvePackageJson } from '../../../shared/utils/package-json.js'

const CODE_TEXT = [
  '   ██████╗ ██████╗ ██████╗ ███████╗',
  '  ██╔════╝██╔═══██╗██╔══██╗██╔════╝',
  '  ██║     ██║   ██║██║  ██║█████╗  ',
  '  ██║     ██║   ██║██║  ██║██╔══╝  ',
  '  ╚██████╗╚██████╔╝██████╔╝███████╗',
  '   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝',
]

const MACHINE_TEXT = [
  '  ███╗   ███╗ █████╗  ██████╗██╗  ██╗██╗███╗   ██╗███████╗',
  '  ████╗ ████║██╔══██╗██╔════╝██║  ██║██║████╗  ██║██╔════╝',
  '  ██╔████╔██║███████║██║     ███████║██║██╔██╗ ██║█████╗  ',
  '  ██║╚██╔╝██║██╔══██║██║     ██╔══██║██║██║╚██╗██║██╔══╝  ',
  '  ██║ ╚═╝ ██║██║  ██║╚██████╗██║  ██║██║██║ ╚████║███████╗',
  '  ╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝',
]

function getVersion(): string {
  const require = createRequire(import.meta.url)
  const packageJsonPath = resolvePackageJson(import.meta.url, 'logo component')
  const pkg = require(packageJsonPath) as { version: string }
  return pkg.version
}

export function Logo() {
  const { theme } = useTheme()

  return (
    <box flexDirection="column" gap={0}>
      <For each={CODE_TEXT}>
        {(line) => (
          <box>
            <text fg={theme.primary}>{line}</text>
          </box>
        )}
      </For>
      <box height={1} />
      <For each={MACHINE_TEXT}>
        {(line) => (
          <box>
            <text fg={theme.primary} attributes={TextAttributes.BOLD}>
              {line}
            </text>
          </box>
        )}
      </For>
      <box height={1} />
      <box justifyContent="center">
        <text fg={theme.textMuted}>
          Bun Migration Edition • v{getVersion()}
        </text>
      </box>
    </box>
  )
}
