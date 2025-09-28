import { Command } from 'commander';
import { registerCli } from '../cli/commands/register-cli.js';
import { syncCodexConfig } from './services/config-sync.js';
import { bootstrapWorkspace } from './services/workspace-bootstrap.js';

export async function runCodemachineCli(argv: string[] = process.argv): Promise<void> {
  const program = new Command()
    .name('codemachine')
    .description('Codemachine multi-agent CLI orchestrator')
    .option('-d, --dir <path>', 'Target workspace directory', process.cwd());

  program.hook('preAction', async () => {
    const { dir } =
      typeof program.optsWithGlobals === 'function' ? program.optsWithGlobals() : program.opts();
    process.env.CODEMACHINE_CWD = dir || process.cwd();
    await syncCodexConfig();
    await bootstrapWorkspace();
  });

  registerCli(program);
  await program.parseAsync(argv);
}

if (process.argv[1] && process.argv[1].includes('index')) {
  // Entrypoint when invoked directly via tsx/tsx watch during Building phase.
  runCodemachineCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
