import { z } from "zod";
import { 
  McpTool, 
  McpPrompt, 
  McpResource, 
  SmitheryMigrationParams,
  generateResourcesCode,
  generatePromptsCode,
  generateServerReturn,
  generateZodSchemaFromJson,
  generateEnvConfigParsing,
  extractConfigSchemaFromSmitheryYaml
} from "./utils.js";

/**
 * Generate TypeScript code for custom container migration using templates
 */
export function generateCustomContainerMigration(params: SmitheryMigrationParams): string {
  const { tools, prompts, resources, serverName, serverVersion, includeBackwardCompatibility, smitheryYaml } = params;
  
  // Extract config schema from smithery yaml
  const extractedConfigSchema = smitheryYaml 
    ? extractConfigSchemaFromSmitheryYaml(smitheryYaml)
    : undefined;
  
  // Generate the complete TypeScript file for custom container
  return generateCustomContainerTemplate({
    tools,
    prompts,
    resources,
    serverName,
    serverVersion,
    includeBackwardCompatibility,
    configSchema: extractedConfigSchema
  });
}

function generateCustomContainerTemplate(params: {
  tools: McpTool[];
  prompts: McpPrompt[];
  resources: McpResource[];
  serverName: string;
  serverVersion: string;
  includeBackwardCompatibility: boolean;
  configSchema?: Record<string, any>;
}): string {
  const { tools, prompts, resources, serverName, serverVersion, includeBackwardCompatibility, configSchema } = params;

  // Generate imports for custom container
  const imports = generateCustomContainerImports(includeBackwardCompatibility);
  
  // Generate Express app setup
  const expressSetup = generateExpressSetup();
  
  // Generate config schema (only if provided)
  const configSchemaCode = configSchema && Object.keys(configSchema).length > 0 ? generateCustomContainerConfigSchema(configSchema) : '';
  
  // Generate config parsing functions
  const configFunctions = generateConfigFunctions();
  
  // Generate server creation function
  const serverCreation = generateCustomContainerServerCreation(serverName, serverVersion);
  
  // Generate resources
  const resourcesCode = generateResourcesCode(resources);
  
  // Generate tools
  const toolsCode = generateCustomContainerToolsCode(tools, configSchema && Object.keys(configSchema).length > 0);
  
  // Generate prompts
  const promptsCode = generatePromptsCode(prompts);
  
  // Generate server return
  const serverReturn = generateServerReturn();
  
  // Generate MCP request handler
  const mcpHandler = generateMcpRequestHandler(!!configSchemaCode);
  
  // Generate main function
  const mainFunction = generateCustomContainerMainFunction(includeBackwardCompatibility, !!configSchemaCode, configSchema);

  return `${imports}

${expressSetup}
${configSchemaCode ? `\n${configSchemaCode}\n` : ''}
${configSchemaCode ? configFunctions : ''}

export default function createServer(${configSchemaCode ? `{
  config,
}: {
  config: z.infer<typeof configSchema>;
}` : ''}) {
${serverCreation}

${resourcesCode}

${toolsCode}

${promptsCode}

${serverReturn}
}

${mcpHandler}

${mainFunction}
`;
}

function generateCustomContainerImports(includeBackwardCompatibility: boolean = false): string {
  let imports = `import express, { Request, Response } from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";`;
  
  if (includeBackwardCompatibility) {
    imports += `
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";`;
  }
  
  return imports;
}

function generateExpressSetup(): string {
  return `const app = express();
const PORT = process.env.PORT || 8081;

// CORS configuration for browser-based MCP clients
app.use(cors({
  origin: '*', // Configure appropriately for production
  exposedHeaders: ['Mcp-Session-Id', 'mcp-protocol-version'],
  allowedHeaders: ['Content-Type', 'mcp-session-id'],
}));

app.use(express.json());`;
}

function generateCustomContainerConfigSchema(actualConfigSchema?: Record<string, any>): string {
  if (actualConfigSchema && Object.keys(actualConfigSchema).length > 0) {
    // Convert JSON schema to Zod schema representation
    const schemaString = generateZodSchemaFromJson(actualConfigSchema);
    return `// Configuration schema extracted from your existing server
export const configSchema = z.object({
${schemaString}
});`;
  } else {
    return `// Configuration schema for custom container
export const configSchema = z.object({});`;
  }
}

function generateConfigFunctions(): string {
  return `// Parse configuration from query parameters
function parseConfig(req: Request) {
  const configParam = req.query.config as string;
  if (configParam) {
    return JSON.parse(Buffer.from(configParam, 'base64').toString());
  }
  return {};
}`;
}

function generateCustomContainerServerCreation(serverName: string, serverVersion: string): string {
  return `  const server = new McpServer({
    name: "${serverName}",
    version: "${serverVersion}",
  });`;
}

function generateCustomContainerToolsCode(tools: McpTool[], hasConfig: boolean = false): string {
  if (tools.length === 0) {
    return `  // No tools to register`;
  }

  // Generate config-related comments and logs only if config exists
  const configComment = hasConfig ? `
      // TODO: Use the config parameter for API calls, timeout settings, etc.` : '';
  const configLog = hasConfig ? `
      console.log('Available config:', config);` : '';

  const toolsCode = tools.map(tool => {
    const inputSchemaString = tool.inputSchema ? 
      `      inputSchema: {\n${generateZodSchemaFromJson(tool.inputSchema, "        ")}\n      }` :
      `      inputSchema: {}`;

    return `  // Tool: ${tool.name}
  server.registerTool(
    "${tool.name}",
    {
      title: "${tool.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}",
      description: "${tool.description}",
${inputSchemaString}
    },
    async (params) => {
      // TODO: Implement tool handler for ${tool.name}${configComment}
      console.log('Tool ${tool.name} called with params:', params);${configLog}
      return {
        content: [{
          type: "text",
          text: "Tool ${tool.name} executed successfully"
        }]
      };
    }
  );`;
  }).join('\n\n');

  return `  // Register tools
${toolsCode}`;
}

function generateMcpRequestHandler(hasConfig: boolean): string {
  if (hasConfig) {
    return `// Handle MCP requests at /mcp endpoint
app.all('/mcp', async (req: Request, res: Response) => {
  try {
    // Parse configuration
    const rawConfig = parseConfig(req);
    
    // Validate and parse configuration
    const config = configSchema.parse(rawConfig);
    
    const server = createServer({ config });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Clean up on request close
    res.on('close', () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});`;
  } else {
    return `// Handle MCP requests at /mcp endpoint
app.all('/mcp', async (req: Request, res: Response) => {
  try {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Clean up on request close
    res.on('close', () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});`;
  }
}

function generateCustomContainerMainFunction(includeBackwardCompatibility: boolean, hasConfig: boolean, configSchema?: Record<string, any>): string {
  if (!includeBackwardCompatibility) {
    // Without backward compatibility, pure HTTP mode
    return `
// Main function to start the HTTP server
async function main() {
  app.listen(PORT, () => {
    console.log(\`MCP HTTP Server listening on port \${PORT}\`);
  });
}

// Start the server
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});`;
  }

  // With backward compatibility, support both HTTP and STDIO modes
  let mainFunction = `// Main function to start the server in the appropriate mode
async function main() {
  const transport = process.env.TRANSPORT || 'stdio';
  
  if (transport === 'http') {
    // Run in HTTP mode
    app.listen(PORT, () => {
      console.log(\`MCP HTTP Server listening on port \${PORT}\`);
    });
  }`;

  if (includeBackwardCompatibility) {
    if (hasConfig) {
      const configParsing = generateEnvConfigParsing(configSchema);
      mainFunction += ` else {
    // Optional: if you need backward compatibility, add stdio transport
    // Parse config from environment variables
    ${configParsing}

    // Create server with configuration
    const server = createServer({ config });

    // Start receiving messages on stdin and sending messages on stdout
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    console.error("MCP Server running in stdio mode");
  }`;
    } else {
      mainFunction += ` else {
    // Optional: if you need backward compatibility, add stdio transport
    const server = createServer();

    // Start receiving messages on stdin and sending messages on stdout
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    console.error("MCP Server running in stdio mode");
  }`;
    }
  } else {
    mainFunction += ` else {
    console.error("STDIO mode not enabled. Set TRANSPORT=http to run in HTTP mode.");
    process.exit(1);
  }`;
  }

  mainFunction += `
}

// Start the server
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});`;

  return mainFunction;
}

// Export the tool schema
export const CustomContainerMigrationToolSchema = {
  name: "generate_custom_container_migration",
  description: "Generate TypeScript code for migrating an MCP server to custom container format with Express HTTP server",
  inputSchema: {
    tools: z.array(z.object({
      name: z.string(),
      description: z.string(),
      inputSchema: z.record(z.any()).optional(),
      handler: z.string().optional()
    })).default([]).describe("MCP tools to migrate"),
    prompts: z.array(z.object({
      name: z.string(),
      description: z.string(),
      argsSchema: z.record(z.any()).optional(),
      template: z.string().optional()
    })).default([]).describe("MCP prompts to migrate"),
    resources: z.array(z.object({
      name: z.string(),
      uri: z.string(),
      description: z.string(),
      mimeType: z.string().optional(),
      handler: z.string().optional()
    })).default([]).describe("MCP resources to migrate"),
    serverName: z.string().default("My MCP Server").describe("Name of the server"),
    serverVersion: z.string().default("1.0.0").describe("Version of the server"),
    includeBackwardCompatibility: z.boolean().default(false).describe("Whether to include backward compatibility code"),
    configSchema: z.record(z.any()).optional().describe("JSON schema for server configuration (will be converted to Zod schema)"),
  }
};
