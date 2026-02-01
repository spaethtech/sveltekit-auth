---
name: chrome
description: Setup Chrome DevTools MCP for testing and debugging UI
triggers:
  - chrome
  - browser
  - devtools
  - mcp
  - debugging
  - screenshot
  - ui testing
files:
  - .claude/skills/chrome/local.ps1
  - .claude/skills/chrome/remote.ps1
  - .mcp.json
---

# Chrome DevTools MCP Skill

Use this skill to set up Chrome DevTools MCP for testing, troubleshooting, and debugging during development.

## Interactive Setup Instructions

When this skill is invoked, help the user configure Chrome DevTools MCP:

1. **Detect environment**: Ask whether they are running in WSL (local) or via remote SSH
2. **Check existing config**: Read `.mcp.json` in the project root (if it exists)
3. **Create or update config**: If `.mcp.json` doesn't exist, create it. If it exists, merge in the `chrome-devtools` server entry:

**WSL Local** (port 9223, uses `cmd.exe` to run npx on Windows):
```json
"chrome-devtools": {
  "command": "cmd.exe",
  "args": ["/c", "npx", "-y", "chrome-devtools-mcp@latest", "--browser-url=http://127.0.0.1:9223"]
}
```

**Remote SSH** (port 9222, runs npx directly on the remote server):
```json
"chrome-devtools": {
  "command": "npx",
  "args": ["-y", "chrome-devtools-mcp@latest", "--browser-url=http://127.0.0.1:9222"]
}
```

4. **Check Prettier plugin**: Verify `prettier-plugin-powershell` is installed. If missing, install it:
   ```bash
   npm install -D prettier-plugin-powershell
   ```
   And ensure it's listed in the root `.prettierrc` plugins array.
5. **Provide script**: Show the user how to copy the appropriate PowerShell script to their Windows machine
6. **Remind to restart**: Claude Code must be restarted after `.mcp.json` changes

## Overview

Chrome DevTools MCP enables Claude to interact with the browser programmatically:
- Take page snapshots and screenshots
- Inspect network requests and console messages
- Click elements, fill forms, and navigate
- Debug UI issues in real-time

## Setup Scenarios

Choose the appropriate setup based on your development environment:

| Scenario | Script | Description |
|----------|--------|-------------|
| **WSL Local** | `local.ps1` | Claude Code running in WSL, Chrome on Windows host |
| **Remote SSH** | `remote.ps1` | Claude Code running on remote server via SSH |

## WSL Local Setup

Use this when running Claude Code locally in WSL and you want to debug using Chrome on your Windows host.

### 1. Copy the script to Windows

```powershell
# From PowerShell on Windows (adjust path to your WSL distro and project location)
Copy-Item "\\wsl$\Ubuntu\home\<user>\<project>\.claude\skills\chrome\local.ps1" "$env:USERPROFILE\local.ps1"
```

Or manually copy from: `.claude/skills/chrome/local.ps1`

### 2. Run the script

```powershell
.\local.ps1
```

This starts Chrome with remote debugging on port `9223`.

### 3. Configure MCP

Add to your `.mcp.json` (project root or `~/.claude/`):

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "cmd.exe",
      "args": [
        "/c",
        "npx",
        "-y",
        "chrome-devtools-mcp@latest",
        "--browser-url=http://127.0.0.1:9223"
      ]
    }
  }
}
```

## Remote SSH Setup

Use this when running Claude Code on a remote server (e.g., VPS, cloud instance) accessed via SSH.

### 1. Copy the script to your local Windows machine

```powershell
# From PowerShell on Windows - copy from the repo or manually create
scp user@remote-host:/path/to/project/.claude/skills/chrome/remote.ps1 "$env:USERPROFILE\remote.ps1"
```

Or manually copy from: `.claude/skills/chrome/remote.ps1`

### 2. Run the script with your SSH host

```powershell
.\remote.ps1 <ssh-host>
```

Examples:
```powershell
.\remote.ps1 lumen                    # Using SSH config alias
.\remote.ps1 rspaeth@104.131.99.38    # Using user@host
```

This:
- Starts Chrome with remote debugging on a random port
- Creates an SSH reverse tunnel: `remote:9222` -> `local:random-port`
- Keeps the tunnel open until you close the window

### 3. Configure MCP on the remote server

Add to your `.mcp.json` on the remote server:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest",
        "--browser-url=http://127.0.0.1:9222"
      ]
    }
  }
}
```

## Verifying the Setup

After starting Chrome and configuring MCP, restart Claude Code. The Chrome DevTools tools should be available:

- `mcp__chrome-devtools__take_snapshot` - Get page content
- `mcp__chrome-devtools__take_screenshot` - Capture screenshots
- `mcp__chrome-devtools__click` - Click elements
- `mcp__chrome-devtools__fill` - Fill form inputs
- `mcp__chrome-devtools__navigate_page` - Navigate to URLs
- `mcp__chrome-devtools__list_console_messages` - View console output
- `mcp__chrome-devtools__list_network_requests` - Inspect network traffic

## Troubleshooting

### MCP tools not appearing

1. Ensure Chrome is running with the script (check the startup page shows)
2. Verify `.mcp.json` syntax is valid JSON
3. Restart Claude Code after config changes

### Connection refused (remote)

1. Ensure the SSH tunnel is still open (PowerShell window running)
2. Check that port 9222 isn't blocked by firewall on the remote server
3. Verify the SSH host is correct

### Port already in use (local)

The local script uses a fixed port (9223). Close any existing Chrome debug instances:
```powershell
Get-Process chrome | Where-Object {$_.CommandLine -like "*--remote-debugging-port*"} | Stop-Process
```

## Scripts Reference

| File | Purpose |
|------|---------|
| `local.ps1` | Starts Chrome with debugging for WSL access on port 9223 |
| `remote.ps1` | Starts Chrome + SSH reverse tunnel for remote server access |

Both scripts display a startup page showing the connection details and MCP configuration snippet.

## Prerequisites

### prettier-plugin-powershell

The `.ps1` scripts require CRLF line endings for Windows compatibility. This directory has a nested `.prettierrc` that sets `endOfLine: "crlf"`, but Prettier needs the PowerShell plugin to process these files.

**Check if installed:**
```bash
grep prettier-plugin-powershell package.json
```

**Install if missing:**
```bash
npm install -D prettier-plugin-powershell
```

**Ensure plugin is registered** in the root `.prettierrc`:
```json
"plugins": ["prettier-plugin-svelte", "prettier-plugin-tailwindcss", "prettier-plugin-powershell"]
```
