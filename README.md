# logwatch — Node.js Log File Analyzer CLI

A command-line tool that analyzes log files in a directory, tracks errors/warnings/info logs, and optionally watches for real-time changes.

## Features

- **Batch Analysis** — Reads and analyzes multiple `.log` files in parallel using `Promise.all`
- **Stream Processing** — Uses `readline` streams to avoid loading entire files into memory
- **Real-time Monitoring** — Watch mode tracks file changes with automatic debouncing
- **Change Tracking** — Shows diffs when files change (error count deltas, warning changes, etc.)
- **Error Thresholds** — Emits events when a file exceeds error limits
- **Summary Statistics** — Displays largest file, file with most errors, and full breakdown

## Installation

```bash
npm init -y
# No dependencies required — uses Node.js core modules only
```

## Usage

### Basic Analysis (one-time scan)

```bash
node main.js /path/to/logs
```

Scans all `.log` files in the directory and prints a summary table:

```
-----------SUMMARY------------
app1.log | 156 | 12 | 8 | 136 | 4096
app2.log | 203 | 18 | 15 | 170 | 5240
app3.log | 89  | 25 | 10 | 54  | 2048
------------------------------

Largest File : app2.log , Size: 5240
app3.log has the maximum no of errors.
```

### Watch Mode (continuous monitoring)

```bash
node main.js /path/to/logs --watch
```

Analyzes all files, then watches the directory for 60 seconds. When a file changes, it shows the delta:

```
Change detected: app1.log. Reanalyzing file...

Diff: app1.log
Errors: 12 → 18 (+6)
Warns : 8 → 9 (+1)
Info  : 136 → 145 (+9)
---------------------------------
```

## Log File Format

Expected format (one log entry per line):

```
[2024-01-15T10:30:45.123Z] INFO: Server started
[2024-01-15T10:30:46.456Z] ERROR: Connection timeout
[2024-01-15T10:30:47.789Z] WARN: Cache miss
```

The parser looks for the log level (INFO, WARN, ERROR) in the second field after splitting by spaces.

## Architecture

### Core Files

- **main.js** — Entry point, orchestrates directory analysis and watch mode
- **LogFile.js** — Class representing a single log file with stats

### Key Functions

**`analyzeDirectory(directory)`** — Top-level function that:
1. Validates directory exists
2. Reads all files in parallel with `Promise.all`
3. Calls `analyzeFile` for each `.log` file
4. Displays summary
5. Optionally starts watch mode

**`analyzeFile(filePath, meta)`** — For each file:
1. Creates a readable stream
2. Uses `readline` to process line-by-line
3. Counts INFO, WARN, ERROR occurrences
4. Stops early if error count exceeds threshold
5. Emits 'finished' or 'failed' events
6. Returns LogFile instance

**`watchDirectory(directory)`** — Monitors directory for 60 seconds:
1. Uses `fs.watch` with debounce (200ms) to prevent duplicate events
2. Re-analyzes changed file
3. Calculates and displays diff vs previous stats
4. Maintains fileStats Map for tracking changes

### EventEmitter Usage

```javascript
emitter.on('finished', (file) => { /* ... */ });
emitter.on('failed', (file) => { /* ... */ });
emitter.on('error:threshold', (file) => { /* ... */ });
emitter.on('stop', () => { /* watch stops */ });
```

## Week 1 Concepts Demonstrated

### Async/Await
- Parallel file analysis with `Promise.all`
- Sequential vs parallel execution patterns
- Error handling with try/catch

### Event Loop
- EventEmitter and custom events
- setTimeout debouncing in watch mode
- process.nextTick understanding via stream events

### Streams
- `fs.createReadStream` for memory efficiency
- `readline` interface for line-by-line processing
- Avoiding buffer the entire file into memory

### Node.js Core Modules
- `fs/promises` for async file operations
- `fs.watch` for file system monitoring
- `path` for file path manipulation
- `readline` for line-by-line reading
- `events.EventEmitter` for event-driven architecture

### Error Handling
- Per-file error handling (one bad file doesn't crash analyzer)
- Process exit codes (0 for success, 1 for error)
- Graceful shutdown on watch timeout

## Testing

Generate sample log files:

```javascript
const fs = require('fs');
const levels = ['INFO', 'WARN', 'ERROR'];
const messages = [
  'Server started', 'Request received', 'Database connected',
  'Connection timeout', 'Invalid token', 'Rate limit exceeded'
];

for (let i = 1; i <= 5; i++) {
  let content = '';
  const lines = Math.floor(Math.random() * 200) + 50;
  for (let j = 0; j < lines; j++) {
    const level = levels[Math.floor(Math.random() * levels.length)];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    const date = new Date().toISOString();
    content += `[${date}] ${level}: ${msg}\n`;
  }
  fs.writeFileSync(`logs/app${i}.log`, content);
}
```

Then run:
```bash
node main.js ./logs
node main.js ./logs --watch
```

## Design Decisions

**Why Streams?** — For large log files (100MB+), buffering into memory with `readFile` would be wasteful. Streams process line-by-line, keeping memory usage constant.

**Why Debounce?** — `fs.watch` fires multiple events for a single file change on some systems. A 200ms debounce merges rapid-fire events into one analysis.

**Why EventEmitter?** — Decouples file analysis from event handling. Easy to add new listeners (e.g., send Slack notification on error:threshold) without touching the analyzer.

**Why Promise.all?** — Analyzing 100 files serially takes 100x longer than in parallel. All files are independent, so `Promise.all` is safe.

**Early Exit on Error Threshold?** — If a file has >10 errors, we stop reading it to save CPU. In production, you'd log this and alert.

## Potential Improvements

- Stream results to a database instead of logging to console
- Filter by log level (only show ERROR logs for example)
- Parse structured JSON logs instead of text
- Export results to CSV or JSON
- Implement a proper connection pool if analyzing thousands of files
- Add metrics export for Prometheus monitoring

## Exit Codes

- `0` — Success
- `1` — Directory not found, invalid flag, or other error

## Notes

- Watch mode runs for exactly 60 seconds then exits
- Only `.log` files are analyzed; other file types are skipped
- Recursive directory traversal is supported
- Error threshold is set to >10 errors per file (configurable in analyzeFile)
