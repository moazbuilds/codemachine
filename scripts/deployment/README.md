# VPS Deployment Scripts

Utilities for running CodeMachine on remote servers (VPS, SSH, cloud instances).

## Problem

When running CodeMachine on remote servers via SSH, you may encounter:
- **Process termination** on SSH disconnect (closing laptop, network issues)
- **UI disappearance** after reconnecting (but process continues running)

## Solution

These scripts provide:
- **Persistent execution** using `nohup` (survives SSH disconnects)
- **Enhanced monitoring** to verify actual process status
- **Graceful shutdown** for cleanup

## Scripts

### `codemachine-persistent.sh`

Launches CodeMachine in persistent mode (survives SSH disconnect).

```bash
# Start in current directory
./scripts/deployment/codemachine-persistent.sh

# Or specify directory
CODEMACHINE_DIR=/path/to/project ./scripts/deployment/codemachine-persistent.sh

# Force restart if already running
./scripts/deployment/codemachine-persistent.sh --force
```

**What it does:**
- Checks if already running (prevents duplicates)
- Launches with `nohup` for SSH disconnect survival
- Creates PID file for tracking
- Logs to `.codemachine/logs/persistent-output.log`

### `codemachine-status.sh`

Shows current status with detailed monitoring.

```bash
./scripts/deployment/codemachine-status.sh
```

**Output:**
- Process status (PID, uptime)
- Running/completed/failed agents
- Recently updated log files
- Last 10 lines of output
- Error log summary (if any)

### `codemachine-stop.sh`

Gracefully stops CodeMachine.

```bash
./scripts/deployment/codemachine-stop.sh
```

**What it does:**
- Tries graceful shutdown (SIGTERM)
- Waits up to 10 seconds
- Force kills if needed (SIGKILL)
- Cleans up PID file

## Quick Start

1. **Start CodeMachine persistently:**
   ```bash
   cd your-project
   /path/to/codemachine/scripts/deployment/codemachine-persistent.sh
   ```

2. **Close laptop / disconnect SSH** (process continues running)

3. **Reconnect and check status:**
   ```bash
   /path/to/codemachine/scripts/deployment/codemachine-status.sh
   ```

4. **Watch logs in real-time:**
   ```bash
   tail -f .codemachine/logs/persistent-output.log
   ```

5. **Stop when done:**
   ```bash
   /path/to/codemachine/scripts/deployment/codemachine-stop.sh
   ```

## Understanding UI Detachment

**What happens after SSH reconnect:**
- ✅ CodeMachine process continues working (verified by status script)
- ❌ Interactive UI disappears (expected behavior)

**Why:** CodeMachine uses Ink (React for CLI) which requires a TTY (terminal connection). When you reconnect via SSH, you get a new terminal that's not connected to the existing UI instance.

**This is NOT a bug** - the process is working correctly, just headless.

**Solutions:**
1. **Monitor via logs** (recommended): Use status script and log files
2. **Start new session**: If you need UI, stop and restart CodeMachine
3. **Use alternative UI**: Consider running a separate status dashboard

## Environment Variables

- `CODEMACHINE_DIR`: Project directory (default: current directory)

## Requirements

- `bash` (tested on Ubuntu 20.04+)
- `jq` (for JSON parsing in status script)
- `codemachine` installed globally

## Troubleshooting

**"Already running" error:**
```bash
./scripts/deployment/codemachine-persistent.sh --force
```

**Process not showing in status:**
- Check if PID file exists: `cat .codemachine/codemachine.pid`
- Manually check process: `ps aux | grep codemachine`

**UI disappeared after reconnect:**
- This is expected - use status script to verify process is working
- Check log files for actual activity: `ls -lht .codemachine/logs/*.log | head`

## See Also

- [VPS Deployment Guide](../../docs/vps-deployment.md)
- [Issue #25: SSH Disconnect Handling](https://github.com/moazbuilds/CodeMachine-CLI/issues/25)
