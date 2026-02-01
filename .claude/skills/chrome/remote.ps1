# Chrome DevTools MCP Setup Script
# Run this on Windows to enable remote Chrome debugging through SSH tunnel
#
# Usage: .\chrome-mcp.ps1 <ssh-host>
# Example: .\chrome-mcp.ps1 lumen
# Example: .\chrome-mcp.ps1 rspaeth@104.131.99.38

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string] $sshHost
)

# Configuration
$chromePort = Get-Random -Minimum 10000 -Maximum 60000
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
# Create a startup page with connection info
$startupPage = "$env:TEMP\chrome-mcp-$chromePort.html"
@"
<!DOCTYPE html>
<html>
<head>
    <title>MCP: $sshHost</title>
    <style>
        body {
            font-family: system-ui, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #eee;
            min-height: 100vh;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            text-align: center;
            padding: 2rem;
        }
        h1 {
            color: #00d4aa;
            margin-bottom: 0.5rem;
        }
        .host {
            font-size: 2rem;
            color: #fff;
            background: rgba(0,212,170,0.2);
            padding: 0.5rem 1.5rem;
            border-radius: 8px;
            display: inline-block;
            margin: 1rem 0;
        }
        .info {
            color: #888;
            font-size: 0.9rem;
        }
        .port {
            color: #00d4aa;
        }
        .config-section {
            margin-top: 2rem;
            text-align: left;
            max-width: 600px;
        }
        .config-section h3 {
            color: #00d4aa;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
        }
        pre {
            background: rgba(0,0,0,0.4);
            border: 1px solid rgba(0,212,170,0.3);
            border-radius: 8px;
            padding: 1rem;
            overflow-x: auto;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.85rem;
            line-height: 1.5;
        }
        code {
            color: #e0e0e0;
        }
        .json-key { color: #9cdcfe; }
        .json-string { color: #ce9178; }
        .json-bracket { color: #ffd700; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Chrome DevTools MCP</h1>
        <div class="host">$sshHost</div>
        <p class="info">Local port: <span class="port">$chromePort</span> &rarr; Remote port: <span class="port">9222</span></p>
        <p class="info">Ready for remote debugging</p>
        <div class="config-section">
            <h3>Remote MCP Configuration</h3>
            <pre><code><span class="json-bracket">{</span>
  <span class="json-key">"mcpServers"</span>: <span class="json-bracket">{</span>
    <span class="json-key">"chrome-devtools"</span>: <span class="json-bracket">{</span>
      <span class="json-key">"command"</span>: <span class="json-string">"npx"</span>,
      <span class="json-key">"args"</span>: <span class="json-bracket">[</span>
        <span class="json-string">"-y"</span>,
        <span class="json-string">"chrome-devtools-mcp@latest"</span>,
        <span class="json-string">"--browser-url=http://127.0.0.1:9222"</span>
      <span class="json-bracket">]</span>
    <span class="json-bracket">}</span>
  <span class="json-bracket">}</span>
<span class="json-bracket">}</span></code></pre>
        </div>
    </div>
</body>
</html>
"@
    | Out-File -FilePath $startupPage -Encoding UTF8

$chromeArgs = @(
    "--remote-debugging-port=$chromePort",
    "--user-data-dir=$env:TEMP\chrome-debug-$chromePort",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-default-apps",
    $startupPage
)

# Start Chrome with remote debugging
$chromeProcess = Start-Process $chromePath -ArgumentList $chromeArgs -PassThru

# Wait for Chrome to start
Start-Sleep -Seconds 2

# Start SSH tunnel (runs in foreground - keep this window open)
# The tunnel forwards remote:9222 -> local:127.0.0.1:$chromePort
Write-Host "Starting SSH tunnel: remote:9222 -> local:$chromePort"
Write-Host "Press Ctrl+C to stop"
Write-Host ""

try {
    ssh -R 9222:127.0.0.1:${chromePort} $sshHost -N -v
} finally {
    Write-Host ""
    Write-Host "Closing Chrome..."
    Stop-Process -Id $chromeProcess.Id -Force -ErrorAction SilentlyContinue
}
