# VPS and Remote Server Deployment

Guide for running CodeMachine on remote servers via SSH.

## Overview

CodeMachine can run on remote servers (VPS, cloud instances) for long-running workflows. However, the interactive UI requires special handling when connecting via SSH.

## Key Concepts

### Process vs UI

CodeMachine consists of two layers:
- **Compute layer**: Agent orchestration, code generation (continues running)
- **UI layer**: Interactive terminal display (requires TTY connection)

When SSH disconnects, the UI detaches but **the compute layer continues working**.

### SSH Disconnect Behavior

**Standard launch** (`codemachine start`):
- Process may terminate on SSH disconnect (systemd behavior)
- UI lost on reconnect (Ink framework limitation)

**Persistent launch** (using provided scripts):
- ✅ Process survives SSH disconnect (`nohup` + `PPID=1`)
- ❌ UI still detaches on reconnect (expected)
- ✅ Monitor via logs and status scripts

## Quick Start

### 1. Install CodeMachine on Server

```bash
ssh user@your-server
npm install -g codemachine
cd your-project
```

### 2. Launch Persistently

```bash
# Clone or copy deployment scripts to your server
# Then launch:
./scripts/deployment/codemachine-persistent.sh
```

### 3. Disconnect Safely

Close laptop, disconnect SSH - **process continues running**.

### 4. Reconnect and Monitor

```bash
ssh user@your-server
cd your-project

# Check status
./scripts/deployment/codemachine-status.sh

# Watch live logs
tail -f .codemachine/logs/persistent-output.log
```

## Deployment Scripts

See [scripts/deployment/README.md](../scripts/deployment/README.md) for detailed documentation.

### Available Scripts

- `codemachine-persistent.sh` - Launch with SSH disconnect survival
- `codemachine-status.sh` - Enhanced monitoring and status
- `codemachine-stop.sh` - Graceful shutdown

## Understanding UI Detachment

### What You'll See

**After SSH reconnect:**
```
$ ./scripts/deployment/codemachine-status.sh
✅ Process: RUNNING (PID: 123456)
   Uptime: 02:34:56

📊 Agent Status:
   🔄 code-generation-step-9: Code Generation Agent (RUNNING)
   ✅ context-manager-step-8: Context Manager Agent
```

**Why UI disappears:**
1. CodeMachine uses Ink (React for CLI)
2. Ink requires persistent TTY (terminal) connection
3. SSH reconnect = new terminal = new TTY
4. Existing UI instance can't "attach" to new TTY

### This is Expected Behavior

**Not a bug:** Process working correctly, just headless.

**Evidence of correct operation:**
- Status script shows running agents
- Log files continuously updated
- Registry.json shows agent completions
- File timestamps confirm recent activity

## Monitoring Strategies

### 1. Status Script (Recommended)

```bash
# Quick status check
./scripts/deployment/codemachine-status.sh

# Continuous monitoring
watch -n 5 ./scripts/deployment/codemachine-status.sh
```

### 2. Log Files

```bash
# Real-time output
tail -f .codemachine/logs/persistent-output.log

# Check errors
tail -f .codemachine/logs/persistent-error.log

# Recent agent logs
ls -lht .codemachine/logs/*.log | head -5
```

### 3. Registry Inspection

```bash
# Check agent status
jq '.["context-manager-step-8"]' .codemachine/logs/registry.json

# Failed agents
jq 'to_entries[] | select(.value.status == "failed")' .codemachine/logs/registry.json
```

## Production Deployment

### Using systemd (Advanced)

For production environments, consider systemd service:

```ini
# /etc/systemd/system/codemachine@.service
[Unit]
Description=CodeMachine for %i
After=network.target

[Service]
Type=simple
User=codemachine
WorkingDirectory=/home/codemachine/projects/%i
ExecStart=/usr/local/bin/codemachine start
Restart=always
StandardOutput=append:/home/codemachine/projects/%i/.codemachine/logs/systemd-output.log
StandardError=append:/home/codemachine/projects/%i/.codemachine/logs/systemd-error.log

[Install]
WantedBy=multi-user.target
```

Start service:
```bash
sudo systemctl start codemachine@myproject
sudo systemctl enable codemachine@myproject  # Auto-start on boot
```

### Using tmux/screen (Alternative)

If you prefer tmux/screen over nohup:

```bash
# Start in tmux
tmux new -s codemachine
cd your-project
codemachine start
# Detach: Ctrl+B, then D

# Reattach later
tmux attach -t codemachine
```

**Note:** UI still detaches on SSH disconnect, but tmux session persists.

## Troubleshooting

### Process Dies on SSH Disconnect

**Problem:** Using standard `codemachine start` without persistence.

**Solution:** Use `codemachine-persistent.sh` script.

**Why:** Standard Node.js processes may receive SIGHUP on SSH disconnect.

### UI Disappeared but Want it Back

**Problem:** Process running but no interactive UI.

**Options:**

1. **Accept headless operation** (recommended):
   ```bash
   # Monitor via logs
   tail -f .codemachine/logs/persistent-output.log
   ```

2. **Stop and restart**:
   ```bash
   ./scripts/deployment/codemachine-stop.sh
   ./scripts/deployment/codemachine-persistent.sh
   ```

3. **Wait for completion**:
   - Check status script for agent progress
   - Let workflow finish headless
   - Results still generated correctly

### How to Know if Really Working?

**Check these indicators:**

1. **Process exists:**
   ```bash
   ./scripts/deployment/codemachine-status.sh
   # Shows PID and uptime
   ```

2. **Logs updating:**
   ```bash
   ls -lht .codemachine/logs/*.log | head
   # Timestamps should be recent
   ```

3. **Agents progressing:**
   ```bash
   jq 'to_entries[] | select(.value.status == "running")' .codemachine/logs/registry.json
   # Shows currently running agents
   ```

4. **Files being modified:**
   ```bash
   ls -lht src/ | head
   # Code files should have recent timestamps
   ```

## Best Practices

### For VPS Deployment

1. **Use persistent launcher** - Don't rely on TTY attachment
2. **Monitor via logs** - Status script + log files, not UI
3. **Set up notifications** - Email/Slack on completion (custom script)
4. **Regular backups** - Git commits, backup specs
5. **Resource monitoring** - CPU/memory usage (CodeMachine can be intensive)

### For Long Workflows

1. **Checkpoint progress** - CodeMachine saves state automatically
2. **Watch for loops** - Task Completion Checker may trigger iterations
3. **Error monitoring** - Check `persistent-error.log` periodically
4. **Disk space** - Log files can grow large

### Security Considerations

1. **API keys** - Use environment variables, not hardcoded
2. **SSH keys** - Prefer key-based auth over passwords
3. **Firewall** - CodeMachine doesn't open ports, but check dependencies
4. **User permissions** - Run as non-root user

## Common Workflows

### 1. Launch and Forget

```bash
ssh server
cd project
./scripts/deployment/codemachine-persistent.sh
exit  # Safe to disconnect
```

### 2. Monitor Periodically

```bash
ssh server
./scripts/deployment/codemachine-status.sh
exit
```

### 3. Watch in Real-Time

```bash
ssh server
tail -f project/.codemachine/logs/persistent-output.log
# Ctrl+C to stop watching
exit
```

### 4. Clean Shutdown

```bash
ssh server
cd project
./scripts/deployment/codemachine-stop.sh
exit
```

## FAQ

**Q: Can I reconnect to the UI after SSH disconnect?**
A: No, Ink UI doesn't support reconnection. Use status script and logs.

**Q: Is my workflow still running if UI disappeared?**
A: Yes! Check status script and log file timestamps to verify.

**Q: How do I know when workflow is complete?**
A: Status script will show no running agents. Check registry.json for completion.

**Q: Can I run multiple workflows simultaneously?**
A: Each project directory has its own CodeMachine instance. Run in different directories.

**Q: What if I accidentally start two instances?**
A: Persistent launcher prevents duplicates. Use `--force` to restart.

## See Also

- [Deployment Scripts README](../scripts/deployment/README.md)
- [Architecture Overview](architecture.md)
- [Customizing Workflows](customizing-workflows.md)
- [GitHub Issue #25: SSH Disconnect Handling](https://github.com/moazbuilds/CodeMachine-CLI/issues/25)
