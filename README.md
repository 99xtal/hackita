# Hackita - Bitbucket Activity Analyzer (TypeScript)

A TypeScript command-line tool to analyze Bitbucket repository activity over the past 7 days.

## Features

- 📊 Analyze commits and pull requests from the last 7 days
- 👥 Track activity by contributor
- 🔍 Support for **all repositories** in a workspace (automatic pagination)
- 📈 Generate detailed activity reports
- 🔐 Secure authentication with Bitbucket App Passwords

## Prerequisites

- Node.js 16.0.0 or higher
- TypeScript (installed as dev dependency)
- Bitbucket App Password with 'Repositories: Read' permission

## Installation

1. Clone or download the project
2. Install dependencies:
   ```bash
   npm install
   ```

## Setup

### Method 1: Configuration File

1. Create a configuration file:
   ```bash
   npm run dev -- --create-config
   ```

2. Edit `bitbucket-config.json` with your details:
   ```json
   {
     "workspace": "your-workspace-name",
     "username": "your-username",
     "appPassword": "your-app-password",
     "excludeRepos": ["repo-to-exclude"]
   }
   ```

### Method 2: Environment Variables

Set the following environment variables:
```bash
export BITBUCKET_USERNAME="your-username"
export BITBUCKET_APP_PASSWORD="your-app-password"
export BITBUCKET_WORKSPACE="your-workspace-name"
```

## Creating a Bitbucket App Password

1. Go to Bitbucket Settings → Personal Settings → App passwords
2. Click "Create app password"
3. Give it a name (e.g., "Activity Analyzer")
4. Select permissions: **Repositories: Read**
5. Create and copy the password

## Usage

### Development Mode (TypeScript)
```bash
# Run directly with ts-node
npm run dev

# With verbose output
npm run dev -- --verbose

# Show help
npm run dev -- --help
```

### Production Mode (Compiled JavaScript)
```bash
# Build the project
npm run build

# Run the compiled version
npm start

# With verbose output
npm start -- --verbose
```

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Run in development mode with ts-node |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run the compiled JavaScript version |
| `npm run watch` | Compile TypeScript in watch mode |
| `npm run clean` | Remove compiled files |
| `npm test` | Build and run the compiled version |

### Command Line Options

| Option | Description |
|--------|-------------|
| `--help`, `-h` | Show help message |
| `--create-config` | Create sample configuration file |
| `--verbose`, `-v` | Show detailed commit and PR information |

## Example Output

```
🚀 Bitbucket Activity Analyzer Starting...

🏢 Analyzing workspace: my-workspace
🔍 Fetching repositories...
📄 Page 1... 100 repos
📄 Page 2... 50 repos

📁 Total repositories found: 150 (across 2 pages)
📅 Date range: 2024-01-15 to 2024-01-22

📊 Processing repositories...
📁 repo1... 3 commits, 1 PRs
📁 repo2... 0 commits, 0 PRs
📁 repo3... 2 commits, 0 PRs

📊 BITBUCKET ACTIVITY REPORT - LAST 7 DAYS
============================================================

🚀 COMMITS SUMMARY
----------------------------------------
📝 John Doe: 3 commits
📝 Jane Smith: 2 commits

🔄 PULL REQUESTS SUMMARY
----------------------------------------
🔀 John Doe: 1 pull requests

📈 OVERALL STATS
----------------------------------------
Total Commits: 5
Total Pull Requests: 1
Active Contributors: 2
Repositories Analyzed: 5
```

## Development

### Project Structure
```
hackita/
├── hackita.ts          # Main TypeScript source file
├── package.json        # Node.js dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── dist/              # Compiled JavaScript (after build)
└── README.md          # This file
```

### TypeScript Features Used
- ✅ Strict type checking
- ✅ Interface definitions for API responses
- ✅ Generic type parameters for HTTP requests
- ✅ Optional properties and union types
- ✅ Proper error handling with type assertions

### Repository Name Handling
- ✅ **Automatic lowercase conversion** - All repository names are converted to lowercase before API calls
- ✅ **Space-to-hyphen conversion** - Spaces in repository names are converted to hyphens for cleaner URLs
- ✅ **Parentheses removal** - Parentheses ( and ) are completely removed from repository names
- ✅ **Safe character preservation** - Hyphens (-) and underscores (_) are preserved without encoding
- ✅ **Selective URL encoding** - Only unsafe special characters are encoded (e.g., #, &, +, %)
- ✅ **Fallback strategies** - Multiple page sizes attempted if API limits are hit

**Examples:**
- `"TheSourceV2"` → `"thesourcev2"`
- `"The Source"` → `"the-source"`
- `"Composite (Archived)"` → `"composite-archived"` (parentheses removed)
- `"repo_with_underscores"` → `"repo_with_underscores"` (preserved)
- `"repo-with-hyphens"` → `"repo-with-hyphens"` (preserved)
- `"My Project (Version 2)"` → `"my-project-version-2"` (parentheses removed, spaces→hyphens)
- `"Test (Beta) & Special#Chars"` → `"test-beta-%26-special%23chars"` (complete transformation)

## Troubleshooting

### "Configuration not found" Error
Make sure you have either:
1. A `bitbucket-config.json` file with valid credentials, OR
2. Environment variables set: `BITBUCKET_USERNAME`, `BITBUCKET_APP_PASSWORD`, `BITBUCKET_WORKSPACE`

### "HTTP 401" Error
- Check your app password is correct
- Ensure the app password has 'Repositories: Read' permission
- Verify your username is correct

### "HTTP 404" Error
- Check the workspace name is correct
- Ensure your user has access to the workspace

## License

MIT License 