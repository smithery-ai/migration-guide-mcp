import { z } from "zod";
import YAML from "yaml";

export type MigrationPath = "local-stdio-only" | "ts-smithery-cli" | "ts-custom-container" | "py-custom-container";

export interface MigrationOverviewParams {
  migrationPath: MigrationPath;
  includeBackwardCompatibility?: boolean;
  needsFileSystemAccess?: boolean;
  needsLocalApps?: boolean;
  existingSmitheryYaml?: string; // Optional existing smithery.yaml content to analyze
}

export interface MigrationOverview {
  migrationPath: MigrationPath;
  title: string;
  description: string;
  prerequisites: string[];
  filesNeeded: Array<{
    filename: string;
    description: string;
    required: boolean;
    generated?: boolean;
  }>;
  projectStructure: {
    description: string;
    structure: string;
  };
  deploymentSteps: string[];
  additionalNotes: string[];
  nextSteps: string[];
}

/**
 * Analyze existing smithery.yaml to determine if session config is needed
 */
export function analyzeSmitheryYamlForSessionConfig(yamlContent: string): boolean {
  try {
    const parsed = YAML.parse(yamlContent);
    
    // Check if there's a configSchema defined in startCommand
    const hasConfigSchema = parsed?.startCommand?.configSchema && 
      Object.keys(parsed.startCommand.configSchema).length > 0;
    
    // Check if there's an exampleConfig with actual values
    const hasExampleConfig = parsed?.startCommand?.exampleConfig && 
      Object.keys(parsed.startCommand.exampleConfig).length > 0;
    
    return hasConfigSchema || hasExampleConfig;
  } catch (error) {
    // If we can't parse the YAML, default to false
    return false;
  }
}

/**
 * Generate migration overview based on the chosen migration path
 */
export function generateMigrationOverview(params: MigrationOverviewParams): MigrationOverview {
  const { 
    migrationPath, 
    includeBackwardCompatibility = false, 
    needsFileSystemAccess = false,
    needsLocalApps = false,
    existingSmitheryYaml
  } = params;

  // If smithery.yaml is provided, analyze it to determine session config needs
  const detectedSessionConfig = existingSmitheryYaml 
    ? analyzeSmitheryYamlForSessionConfig(existingSmitheryYaml)
    : false;

  // Derive needsLocalAccess from the specific needs
  const needsLocalAccess = needsFileSystemAccess || needsLocalApps;
  
  const commonParams = { includeBackwardCompatibility, needsLocalAccess, needsFileSystemAccess, needsLocalApps, needsSessionConfig: detectedSessionConfig };

  switch (migrationPath) {
    case "local-stdio-only":
      return generateLocalStdioOverview(commonParams);
    
    case "ts-smithery-cli":
      return generateSmitheryCLIOverview(commonParams);
    
    case "ts-custom-container":
      return generateTypeScriptContainerOverview(commonParams);
    
    case "py-custom-container":
      return generatePythonContainerOverview(commonParams);
    
    default:
      throw new Error(`Unsupported migration path: ${migrationPath}`);
  }
}

function generateLocalStdioOverview(params: { includeBackwardCompatibility: boolean; needsLocalAccess: boolean; needsFileSystemAccess: boolean; needsLocalApps: boolean; needsSessionConfig: boolean; }): MigrationOverview {
  const { needsFileSystemAccess, needsLocalApps } = params;
  
  const localReasons: string[] = [];
  if (needsFileSystemAccess) localReasons.push("File system access required");
  if (needsLocalApps) localReasons.push("Local application integration needed");
  
  return {
    migrationPath: "local-stdio-only",
    title: "Local STDIO Servers - Contact Support",
    description: "Your server needs local file system access or local application integration. We're actively working on improving support for local servers and would love to work with you personally to get yours set up - no migration work needed on your end!",
    prerequisites: [
      "Nothing! We'll handle the setup for you."
    ],
    filesNeeded: [],
    projectStructure: {
      description: "Keep your existing project structure - no changes needed",
      structure: "No changes to your existing codebase required"
    },
    deploymentSteps: [
      "📧 Email us: contact@smithery.ai",
      "💬 Join our Discord: https://discord.gg/sKd9uycgH9",
      "We'll work with you directly to get your server set up - no work needed on your end!"
    ],
    additionalNotes: [],
    nextSteps: []
  };
}

function generateSmitheryCLIOverview(params: { includeBackwardCompatibility: boolean; needsLocalAccess: boolean; needsFileSystemAccess: boolean; needsLocalApps: boolean; needsSessionConfig: boolean; }): MigrationOverview {
  const { includeBackwardCompatibility } = params;
  
  return {
    migrationPath: "ts-smithery-cli",
    title: "TypeScript with Smithery CLI Migration (RECOMMENDED)",
    description: "RECOMMENDED: This is the recommended approach for TypeScript projects. Migrate to HTTP transport using Smithery CLI with automatic deployment and containerization. This is the simplest migration path with built-in development tools and requires minimal configuration.",
    prerequisites: [
      "Node.js 18+ installed",
      "Existing TypeScript MCP server with STDIO transport",
      "GitHub repository for deployment",
      "Basic understanding of MCP concepts"
    ],
    filesNeeded: [
      {
        filename: "src/index.ts (or main entry file)",
        description: "Entry point file that exports the createServer function",
        required: true,
        generated: true
      },
      {
        filename: "package.json",
        description: "Updated with Smithery CLI scripts and module field pointing to createServer export",
        required: true,
        generated: false
      },
      {
        filename: "yarn.lock or pnpm-lock.yaml",
        description: "Lock file required if using yarn or pnpm (not needed for npm)",
        required: false,
        generated: false
      },
      {
        filename: "smithery.yaml",
        description: "Smithery configuration (runtime: typescript)",
        required: true,
        generated: true
      },
      ...(includeBackwardCompatibility ? [{
        filename: "tsconfig.json",
        description: "TypeScript configuration for STDIO builds",
        required: false,
        generated: false
      }] : [])
    ],
    projectStructure: {
      description: "Reference TypeScript project structure optimized for Smithery CLI",
      structure: `my-mcp-server/
├── src/
│   └── index.ts          # Main server file (exported createServer)
├── package.json          # Updated with Smithery CLI config
├── smithery.yaml         # Smithery runtime configuration
├── tsconfig.json         # TypeScript configuration
└── README.md            # Documentation`
    },
    deploymentSteps: [
      "1. Update package.json with Smithery CLI scripts and module field pointing to createServer export",
      "2. Add build and dev scripts: \"build\": \"npx @smithery/cli build\", \"dev\": \"npx @smithery/cli dev\"",
      "3. Generate new src/index.ts with exported createServer function",
      "4. Update smithery.yaml with runtime: typescript",
      "5. Test locally with 'npm run dev' (interactive playground)",
      "6. Push changes to your GitHub repository",
      "7. Wait a few minutes for auto-deploy, or manually trigger deployment from your Smithery server dashboard if it doesn't start automatically",
    ],
    additionalNotes: [
      "No Dockerfile needed - Smithery CLI handles containerization",
      "Session-based configuration management",
      "Required scripts: \"build\": \"npx @smithery/cli build\", \"dev\": \"npx @smithery/cli dev\"",
      "Include your lock file (yarn.lock or pnpm-lock.yaml) if using yarn/pnpm - this helps detect your package manager",
      "The 'module' field in package.json must point to the file that exports createServer (e.g., './src/index.ts')",
      ...(includeBackwardCompatibility ? ["STDIO backward compatibility included"] : []),
    ],
    nextSteps: [
      "Use 'create_migration_template' tool with mode 'ts-smithery-cli'",
      "Use 'generate_smithery_yaml' tool for smithery.yaml configuration",
      "Use 'validate_package_json' tool with migrationPath 'ts-smithery-cli' to ensure all required scripts and dependencies are present"
    ]
  };
}

function generateTypeScriptContainerOverview(params: { includeBackwardCompatibility: boolean; needsLocalAccess: boolean; needsFileSystemAccess: boolean; needsLocalApps: boolean; needsSessionConfig: boolean; }): MigrationOverview {
  const { includeBackwardCompatibility } = params;
  
  return {
    migrationPath: "ts-custom-container",
    title: "TypeScript Custom Container Migration",
    description: "Migrate to HTTP transport using custom Express server with full Docker control. Provides maximum flexibility for middleware and custom logic.",
    prerequisites: [
      "Node.js 18+ installed",
      "Docker installed and running",
      "Understanding of Express.js and middleware",
      "Existing TypeScript MCP server",
      "GitHub repository for deployment"
    ],
    filesNeeded: [
      {
        filename: "src/index.ts",
        description: "Main server file with Express app and MCP request handler",
        required: true,
        generated: true
      },
      {
        filename: "Dockerfile",
        description: "Custom Docker container configuration",
        required: true,
        generated: true
      },
      {
        filename: "package.json",
        description: "Updated with Express dependencies and scripts",
        required: true,
        generated: false
      },
      {
        filename: "smithery.yaml",
        description: "Smithery configuration (runtime: container, type: http)",
        required: true,
        generated: true
      },
      {
        filename: "tsconfig.json",
        description: "TypeScript configuration for building",
        required: true,
        generated: false
      },
      ...(includeBackwardCompatibility ? [{
        filename: ".env.example",
        description: "Environment variables template",
        required: false,
        generated: false
      }] : [])
    ],
    projectStructure: {
      description: "Reference TypeScript project with Express server and Docker containerization",
      structure: `my-mcp-server/
├── src/
│   └── index.ts          # Express server with MCP handlers
├── dist/                 # Built JavaScript output
├── Dockerfile            # Custom container configuration
├── package.json          # Express dependencies and build scripts
├── smithery.yaml         # Container runtime configuration
├── tsconfig.json         # TypeScript build configuration
└── README.md            # Documentation`
    },
    deploymentSteps: [
      "1. Generate Express-based src/index.ts with MCP request handlers",
      "2. Create custom Dockerfile with Node.js and build steps",
      "3. Update package.json with Express dependencies",
      "4. Create smithery.yaml with container runtime configuration",
      "5. Test locally: 'npm run build && docker build -t server . && docker run -p 8081:8081 -e PORT=8081 server'",
      "6. Push changes to your GitHub repository",
      "7. Wait a few minutes for auto-deploy, or manually trigger deployment from your Smithery server dashboard if it doesn't start automatically",
      "8. Smithery builds and deploys your custom container"
    ],
    additionalNotes: [
      "Full control over Express middleware and routing",
      "Custom Docker environment configuration",
      "Advanced CORS and security configurations",
      "Per-request configuration parsing from URL parameters",
      "IMPORTANT: Server must listen on process.env.PORT (Smithery provides this, defaults to 8081)",
      ...(includeBackwardCompatibility ? ["STDIO backward compatibility with TRANSPORT env var"] : []),
    ],
    nextSteps: [
      "Use 'create_migration_template' tool with mode 'ts-custom-container'",
      "Use 'generate_dockerfile' tool with containerType 'ts-custom-container'",
      "Use 'generate_smithery_yaml' tool for container runtime configuration",
      "Update package.json with Express, CORS, and other dependencies"
    ]
  };
}

function generatePythonContainerOverview(params: { includeBackwardCompatibility: boolean; needsLocalAccess: boolean; needsFileSystemAccess: boolean; needsLocalApps: boolean; needsSessionConfig: boolean; }): MigrationOverview {
  const { includeBackwardCompatibility, needsSessionConfig } = params;
  
  return {
    migrationPath: "py-custom-container",
    title: "Python Custom Container Migration",
    description: "Migrate to HTTP transport using FastMCP with custom middleware and Docker control. Ideal for Python-based MCP servers with advanced configuration needs.",
    prerequisites: [
      "Python 3.11+ installed",
      "uv or pip package manager",
      "Docker installed and running",
      "Understanding of FastAPI/Starlette middleware",
      "Existing Python MCP server",
      "GitHub repository for deployment"
    ],
    filesNeeded: [
      {
        filename: "src/main.py",
        description: "Main server file with FastMCP and HTTP transport",
        required: true,
        generated: true
      },
      ...(needsSessionConfig ? [{
        filename: "src/middleware.py",
        description: "Custom middleware for Smithery configuration handling (access tokens, session settings)",
        required: true,
        generated: true
      }] : []),
      {
        filename: "Dockerfile",
        description: "Custom Docker container with Python and uv/pip",
        required: true,
        generated: true
      },
      {
        filename: "pyproject.toml",
        description: "Python project configuration with FastMCP dependencies",
        required: true,
        generated: false
      },
      {
        filename: "smithery.yaml",
        description: "Smithery configuration (runtime: container, type: http)",
        required: true,
        generated: true
      },
      {
        filename: "uv.lock",
        description: "Dependency lock file (if using uv)",
        required: false,
        generated: false
      }
    ],
    projectStructure: {
      description: "Reference Python project structure with FastMCP server and Docker containerization",
      structure: `my-mcp-server/
├── src/
│   ├── main.py           # FastMCP server with HTTP transport${needsSessionConfig ? `
│   └── middleware.py     # Custom Smithery config middleware` : ''}
├── Dockerfile            # Custom Python container
├── pyproject.toml        # Python dependencies and config
├── uv.lock              # Dependency lock file (uv)
├── smithery.yaml         # Container runtime configuration
└── README.md            # Documentation`
    },
    deploymentSteps: [
      "1. Generate FastMCP-based src/main.py with HTTP transport",
      ...(needsSessionConfig ? ["2. Create src/middleware.py for configuration handling"] : []),
      `${needsSessionConfig ? '3' : '2'}. Create custom Dockerfile with Python and dependency management`,
      `${needsSessionConfig ? '4' : '3'}. Update pyproject.toml with FastMCP and required dependencies`,
      `${needsSessionConfig ? '5' : '4'}. Create smithery.yaml with container runtime configuration`,
      `${needsSessionConfig ? '6' : '5'}. Test locally: 'uv sync && docker build -t server . && docker run -p 8081:8081 -e PORT=8081 server'`,
      `${needsSessionConfig ? '7' : '6'}. Push changes to your GitHub repository`,
      `${needsSessionConfig ? '8' : '7'}. Wait a few minutes for auto-deploy, or manually trigger deployment from your Smithery server dashboard if it doesn't start automatically`
    ],
    additionalNotes: [
      "FastMCP provides simple decorator-based tool registration",
      ...(needsSessionConfig ? ["Per-request configuration access through middleware"] : ["No middleware needed if no session configuration required"]),
      ...(includeBackwardCompatibility ? ["STDIO backward compatibility with TRANSPORT env var"] : []),
      "CORS handling for browser-based MCP clients",
      "IMPORTANT: Server must listen on int(os.environ.get('PORT', 8081)) - Smithery provides PORT env var",
    ],
    nextSteps: [
      "Use 'create_migration_template' tool with mode 'py-custom-container'",
      "Use 'generate_dockerfile' tool with containerType 'py-custom-container'",
      "Use 'generate_smithery_yaml' tool for container runtime configuration",
      "Create pyproject.toml with FastMCP and uvicorn dependencies"
    ]
  };
}

/**
 * Format migration overview as readable text
 */
export function formatMigrationOverview(overview: MigrationOverview): string {
  const {
    title,
    description,
    prerequisites,
    filesNeeded,
    projectStructure,
    deploymentSteps,
    additionalNotes,
    nextSteps
  } = overview;

  return `# ${title}

## Overview
${description}

## Prerequisites
${prerequisites.map(prereq => `- ${prereq}`).join('\n')}

## Required Files
${filesNeeded.map(file => 
  `- **${file.filename}** ${file.required ? '(Required)' : '(Optional)'} ${file.generated ? '(Generated)' : '(Manual)'}
  ${file.description}`
).join('\n')}

## Project Structure
${projectStructure.description}

\`\`\`
${projectStructure.structure}
\`\`\`

## Deployment Steps
${deploymentSteps.map(step => step).join('\n')}

## Additional Notes
${additionalNotes.map(note => note).join('\n')}

## Next Steps
${nextSteps.map(step => `- ${step}`).join('\n')}`;
}

// Export the tool schema
export const MigrationOverviewToolSchema = {
  name: "get_migration_overview",
  description: "Get a comprehensive overview of migration requirements, files needed, and deployment steps for your chosen migration path. IMPORTANT: 'ts-smithery-cli' is the RECOMMENDED approach unless the user explicitly requests a different path - it's the simplest with built-in tools and automatic deployment. Includes local STDIO option for servers that need file system or local app access. Can automatically detect session config needs from existing smithery.yaml. Use this as the first step when helping users migrate from Smithery hosted servers.",
  inputSchema: {
    migrationPath: z.enum(["ts-smithery-cli", "ts-custom-container", "py-custom-container"])
      .describe("Migration path: 'ts-smithery-cli' for TypeScript with Smithery CLI (RECOMMENDED - recommended approach for TypeScript projects, simplest approach), 'ts-custom-container' for TypeScript custom container, 'py-custom-container' for Python custom container"),
    includeBackwardCompatibility: z.boolean().optional().default(false)
      .describe("Whether you plan to include STDIO backward compatibility. WARNING: This adds significant complexity - verify with user if they actually need it before enabling."),
    needsFileSystemAccess: z.boolean().optional().default(false)
      .describe("Whether your server needs to read/write local files (automatically suggests local-stdio-only)"),
    needsLocalApps: z.boolean().optional().default(false)
      .describe("Whether your server needs to interact with local applications (automatically suggests local-stdio-only)"),
    existingSmitheryYaml: z.string().optional()
      .describe("Optional existing smithery.yaml content to automatically analyze for session configuration requirements"),
  }
};
