import { z } from "zod";

// Define container types that need Dockerfiles
export type DockerContainerType = "ts-custom-container" | "py-custom-container";

export interface DockerfileParams {
  containerType: DockerContainerType;
  serverName?: string;
  nodeVersion?: string;
  pythonVersion?: string;
  // TypeScript specific options
  buildCommand?: string;
  startCommand?: string;
  sourceDir?: string;
  outputDir?: string;
  packageManager?: "npm" | "yarn" | "pnpm";
  // Python specific options
  pythonMainFile?: string;
  requirementsFile?: string;
  useUv?: boolean;
  workingDir?: string;
  // Common options
  additionalPackages?: string[];
  environmentVars?: Record<string, string>;
  includeBackwardCompatibility?: boolean;
}

/**
 * Generate Dockerfile based on container type
 */
export function generateDockerfile(params: DockerfileParams): string {
  const { containerType, serverName, nodeVersion, pythonVersion } = params;

  switch (containerType) {
    case "ts-custom-container":
      return generateTypeScriptDockerfile(params);
    
    case "py-custom-container":
      return generatePythonDockerfile(params);
    
    default:
      throw new Error(`Unsupported container type: ${containerType}`);
  }
}

/**
 * Generate TypeScript custom container Dockerfile
 */
function generateTypeScriptDockerfile(params: DockerfileParams): string {
  const { 
    nodeVersion = "22",
    packageManager = "npm",
    buildCommand = "npm run build",
    startCommand,
    sourceDir = ".",
    outputDir = "dist",
    additionalPackages = [],
    environmentVars = {},
    includeBackwardCompatibility = false
  } = params;
  
  // Determine package manager commands
  const installCmd = packageManager === "npm" ? "npm ci --only=production" :
                     packageManager === "yarn" ? "yarn install --production --frozen-lockfile" :
                     "pnpm install --prod --frozen-lockfile";
  
  const packageFiles = packageManager === "npm" ? "package*.json" :
                       packageManager === "yarn" ? "package.json yarn.lock" :
                       "package.json pnpm-lock.yaml";

  // Default start command based on output directory
  const defaultStartCmd = startCommand || `node ${outputDir}/index.js`;
  
  // Generate additional system packages installation
  const systemPackages = additionalPackages.length > 0 
    ? `\n# Install additional system packages\nRUN apt-get update && apt-get install -y ${additionalPackages.join(' ')} && rm -rf /var/lib/apt/lists/*\n`
    : '';
  
  // Generate environment variables
  const envVars = Object.entries(environmentVars).length > 0
    ? Object.entries(environmentVars).map(([key, value]) => `ENV ${key}="${value}"`).join('\n') + '\n\n'
    : '';

  return `# Dockerfile for TypeScript Custom Container
FROM node:${nodeVersion}-slim

WORKDIR /app${systemPackages}
# Copy package files
COPY ${packageFiles} ./

# Install dependencies
RUN ${installCmd}

# Copy source code
COPY ${sourceDir} .

# Build TypeScript code
RUN ${buildCommand}

${envVars}
${includeBackwardCompatibility ? '# Force HTTP transport mode for Smithery deployment\nENV TRANSPORT=http\n\n' : ''}# Start the HTTP server
CMD ["${defaultStartCmd.split(' ').join('", "')}"]`;
}

/**
 * Generate Python custom container Dockerfile
 */
function generatePythonDockerfile(params: DockerfileParams): string {
  const { 
    pythonVersion = "3.12",
    pythonMainFile = "src/main.py",
    requirementsFile,
    useUv = true,
    workingDir = "/app",
    additionalPackages = [],
    environmentVars = {},
    includeBackwardCompatibility = false
  } = params;
  
  // Generate additional system packages installation
  const systemPackages = additionalPackages.length > 0 
    ? `\n# Install additional system packages\nRUN apk add --no-cache ${additionalPackages.join(' ')}\n`
    : '';
  
  // Generate environment variables
  const envVars = Object.entries(environmentVars).length > 0
    ? Object.entries(environmentVars).map(([key, value]) => `ENV ${key}="${value}"`).join('\n') + '\n\n'
    : '';

  if (useUv) {
    return `# Dockerfile for Python Custom Container (using uv)
# Use a Python image with uv pre-installed
FROM ghcr.io/astral-sh/uv:python${pythonVersion}-alpine

# Install the project into ${workingDir}
WORKDIR ${workingDir}${systemPackages}
# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy from the cache instead of linking since it's a mounted volume
ENV UV_LINK_MODE=copy

# Install the project's dependencies using the lockfile and settings
RUN --mount=type=cache,target=/root/.cache/uv \\
    --mount=type=bind,source=uv.lock,target=uv.lock \\
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \\
    uv sync --locked --no-install-project --no-dev

# Then, add the rest of the project source code and install it
COPY . ${workingDir}
RUN --mount=type=cache,target=/root/.cache/uv \\
    uv sync --locked --no-dev

# Place executables in the environment at the front of the path
ENV PATH="${workingDir}/.venv/bin:$PATH"

# Reset the entrypoint, don't invoke \`uv\`
ENTRYPOINT []

${envVars}
${includeBackwardCompatibility ? '# Force HTTP transport mode for Smithery deployment\nENV TRANSPORT=http\n\n' : ''}# Start the HTTP server
CMD ["python", "${pythonMainFile}"]`;
  } else {
    // Traditional pip-based approach
    const reqFile = requirementsFile || "requirements.txt";
    
    return `# Dockerfile for Python Custom Container (using pip)
FROM python:${pythonVersion}-alpine

WORKDIR ${workingDir}${systemPackages}
# Copy requirements file
COPY ${reqFile} .

# Install Python dependencies
RUN pip install --no-cache-dir -r ${reqFile}

# Copy source code
COPY . .

${envVars}
${includeBackwardCompatibility ? '# Force HTTP transport mode for Smithery deployment\nENV TRANSPORT=http\n\n' : ''}# Start the HTTP server
CMD ["python", "${pythonMainFile}"]`;
  }
}



/**
 * Get container type description
 */
export function getContainerTypeDescription(containerType: DockerContainerType): string {
  switch (containerType) {
    case "ts-custom-container":
      return "TypeScript Custom Container with Node.js and Express";
    case "py-custom-container":
      return "Python Custom Container with FastMCP and uv";
    default:
      return "Unknown container type";
  }
}

// Export the tool schema
export const DockerfileGeneratorToolSchema = {
  name: "generate_dockerfile",
  description: "Generate customizable Dockerfile for custom container deployments (TypeScript or Python) with flexible configuration options",
  inputSchema: {
    containerType: z.enum(["ts-custom-container", "py-custom-container"])
      .describe("Container type: 'ts-custom-container' for TypeScript custom container, 'py-custom-container' for Python custom container"),
    
    // Version options
    nodeVersion: z.string().optional().default("22").describe("Node.js version for TypeScript containers (e.g., '18', '20', '22')"),
    pythonVersion: z.string().optional().default("3.12").describe("Python version for Python containers (e.g., '3.11', '3.12', '3.13')"),
    
    // TypeScript specific options
    packageManager: z.enum(["npm", "yarn", "pnpm"]).optional().default("npm").describe("Package manager for TypeScript projects"),
    buildCommand: z.string().optional().default("npm run build").describe("Build command for TypeScript projects"),
    startCommand: z.string().optional().describe("Custom start command (defaults to 'node dist/index.js')"),
    sourceDir: z.string().optional().default(".").describe("Source directory to copy"),
    outputDir: z.string().optional().default("dist").describe("Build output directory"),
    
    // Python specific options  
    pythonMainFile: z.string().optional().default("src/main.py").describe("Main Python file to run"),
    requirementsFile: z.string().optional().describe("Requirements file (for pip-based installs, defaults to 'requirements.txt')"),
    useUv: z.boolean().optional().default(true).describe("Use uv for Python package management (faster, recommended)"),
    workingDir: z.string().optional().default("/app").describe("Working directory in container"),
    
    // Common options
    additionalPackages: z.array(z.string()).optional().default([]).describe("Additional system packages to install (e.g., ['git', 'curl'])"),
    environmentVars: z.record(z.string()).optional().default({}).describe("Environment variables to set in container"),
    includeBackwardCompatibility: z.boolean().optional().default(false).describe("Include TRANSPORT=http environment variable for servers with stdio/http transport modes"),
  }
};
