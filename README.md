# CLI User Interface for MongoDB and HL7 File Processing

A guided, interactive CLI that lets you select or enter a MongoDB connection URI, pick a folder containing HL7 (or .txt) files (including nested folders), and then processes each file—reporting progress in real time. Designed for healthcare data pipelines where HL7 messages must land in a MongoDB collection for downstream analytics or integrations.

## Table of Contents

1. [Key Features](#key-features)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Usage](#usage)
   - [Running the CLI](#running-the-cli)
   - [Command-line Options](#command-line-options)
   - [Sample Session](#sample-session)
6. [How It Works](#how-it-works)
7. [Error Handling & Logging](#error-handling--logging)
8. [Project Structure](#project-structure)
9. [Contributing](#contributing)
10. [License](#license)

---

## Key Features

- **MongoDB Connection Selection**
  
  Choose from a list of predefined connection strings or enter a custom MongoDB URI (supports SRV, replica sets, auth).

- **Directory Picker**
  
  Select any local folder; recursive scan for `.hl7` or `.txt` files.

- **Progress Tracking**
  
  Real-time progress bar with counts of processed vs. total files.

- **Customizable Processing**
  
  Plug in custom parsing or validation logic in `src/processor.js` (e.g., using `hl7-standard`).

- **Colorized Output**
  
  Success, warning, and error messages styled with `chalk`.

---

## Prerequisites

- Node.js v14+ (LTS recommended)
- npm or yarn
- A running MongoDB instance (local or cloud)

---

## Installation

1. Clone the repository:

   ```powershell
   git clone https://github.com/XxKodedxX/cli-ui.git
   ```

2. Change into the project directory:

   ```powershell
   cd cli-ui
   ```

3. Install dependencies:

   ```powershell
   npm install
   # or
   yarn install
   ```

---

## Configuration

- **Preset Connections**
  
  Edit `src/config.js` to add or modify named MongoDB URIs.

- **Environment Variables**
  
  Override defaults by setting:

  ```powershell
  $Env:MONGO_URI="mongodb://user:pass@host:port/db"
  ```

---

## Usage

### Running the CLI

```powershell
node run start:cli
```

Follow the prompts:

1. Select a MongoDB connection (preset or custom URI).
2. Choose a directory to scan for HL7 files.
3. Watch the progress bar as files are parsed and inserted.

### Command-line Options

| Option               | Description                                  |
|----------------------|----------------------------------------------|
| `--help`             | Show help and exit                           |
| `--dry-run`          | Parse files without inserting into MongoDB   |
| `--concurrency N`    | Number of files to process in parallel (default: 5) |
| `--filter <pattern>` | Only process files matching glob pattern     |

Example:

```powershell
node src/ui.js --dry-run --filter="batch_*.hl7"
```

### Sample Session

```text
$ node src/ui.js
? Select MongoDB connection:
  > [1] Local — mongodb://localhost:27017/hl7db
    [2] Staging — mongodb+srv://...
    [3] Enter custom URI
? Enter directory to scan: ./samples
Processing 12 files...
[█████──────] 42% 5/12  ETA: 10s
✔ Inserted MessageID=MSG123 into collection hl7_messages
...
✔ All files processed successfully.
```

---

## How It Works

1. **Prompting**  
   Uses `inquirer` to display interactive menus.

2. **Directory Traversal**  
   Uses `fs/promises` and a recursive helper to find `.hl7` and `.txt` files.

3. **Parsing & Validation**  
   Reads each file as text; integrate an HL7 parser in `src/processor.js`.

4. **Database Insertion**  
   Connects with the official `mongodb` driver and writes each message document to the specified collection.

5. **Progress Bar**  
   Powered by `cli-progress`, updated after each file insertion.

---

## Error Handling & Logging

- **Validation Errors**: Logged in yellow; processing continues for other files.
- **Fatal Errors**: Logged in red; aborts the process.
- **Log Redirection**:

  ```powershell
  node src/ui.js > run.log 2>&1
  ```

---

## Project Structure

```text
cli-ui/
├── src/
│   ├── ui.js             # Main entry point & prompts
│   ├── processor.js      # File parsing & DB logic
│   ├── config.js         # Preset URIs & defaults
│   └── utils/            # Helpers (file walk, validation, etc.)
├── test_messages/       # Sample HL7 files for testing
├── package.json         # Project metadata & dependencies
└── README.md            # This documentation
```

---

## Contributing

1. Fork the repository.
2. Create a feature branch:

   ```powershell
   git checkout -b feature/my-feature
   ```

3. Commit your changes:

   ```powershell
   git commit -m "Add awesome feature"
   ```

4. Push to your fork:

   ```powershell
   git push origin feature/my-feature
   ```

5. Open a Pull Request.

---

## License

MIT © XxKodedxX (A.K.A. Reid Howle)