# CLI UI Guidelines

## Palette Tokens
- `primary` (cyan bright): primary actions, banners, and success headlines that need immediate CLI attention.
- `secondary` (gray): neutral labels, gutters, or metadata that should recede behind primary content.
- `success` (green bright): completion states, positive confirmations, or ready-to-run signals.
- `warning` (yellow bright): cautionary messages that require review before proceeding.
- `error` (red bright): blocking failures, invalid input, or remediation instructions.

Keep palette usage consistent so repeated runs remain predictable for returning operators.

## Layout Helpers
- `divider(char = '─', width = 60)`: use between sections to reset visual context. Set width to `0` or less to suppress output, or swap `char` for thematic separators.
- `banner(text)`: wraps the message with `═` dividers using the `primary` color. Reserve for top-level task headings or flow transitions.
- `section(title)`: uppercases the title and underlines with a neutral divider. Ideal for subgroups inside a bannered flow.
- `formatKeyValue(key, value)`: pads the key to a 24-character gutter and prints the value inline. Use for status summaries or option listings; colorize the `value` argument as needed.

```ts
import { banner, section, formatKeyValue, divider, palette } from '../../src/cli/presentation/layout.js';

console.log(banner('Codemachine Deploy'));
console.log(section('Summary'));
console.log(formatKeyValue('Environment', palette.success('production')));
console.log(divider());
```

## Typewriter Rendering
- `renderTypewriter({ text, intervalMs = 12, writer, onChunk })`: streams characters with a default 12 ms cadence.
- Recommended `intervalMs` range is 8-24 ms. Use 8-12 ms for short prompts that benefit from energy; stretch toward 20-24 ms for longer narratives or accessibility-sensitive flows.
- Always mirror animated output to plain logs (e.g., call `logger.info(text)`) so screen readers and transcript tools have a non-animated source.

```ts
import { renderTypewriter } from '../../src/cli/presentation/typewriter.js';

await renderTypewriter({
  text: 'Generating plan...',
  intervalMs: 16,
  onChunk: (_, index) => telemetry.mark(`typewriter-${index}`),
});
```

### Testing Hooks
- Inject `writer` to capture output deterministically in tests: `await renderTypewriter({ text, writer: chunk => buffer.push(chunk) });`.
- Combine with `intervalMs: 0` to remove delays, then assert on `buffer.join('')`.

### Accessibility
- Provide a synchronized plain-text log (`logger.info(text)`) before triggering the animation so assistive tooling receives the full message instantly.
- Avoid relying solely on color; pair palette tokens with explicit copy such as "Success:" or "Warning:".
- Keep animated sequences short and offer a configuration knob that agents can tune when integrating new flows.

## Main Menu
- `renderMainMenu(): Promise<string>`: returns the full branded main menu string composed of a Gemini-inspired ASCII banner, status summary, command list, and a specifications prompt.
- Uses `banner`, `section`, `formatKeyValue`, and `palette` to ensure consistent styling.

Example (string output):

```
<banner: Codemachine>
<gemini-ascii-art>
STATUS
──────
Mode:                   build
COMMANDS
───────
/start                  Plan and build from specifications
/templates              Browse available templates
/<login|logout>         Auth with Codex services
/version                Show CLI version
/help                   Show command help
/mcp                    Manage MCP tools and connections
SPECIFICATIONS
─────────────
Have you written the full specification in .codemachine/inputs/specifications.md?
Add any necessary context files, then run /start to begin.
```

Note: The login/logout label is selected via `nextAuthMenuAction()` from `src/app/services/auth-status.ts`.
