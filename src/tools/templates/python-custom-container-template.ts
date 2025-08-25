import { z } from "zod";
import { 
  McpTool, 
  McpPrompt, 
  McpResource, 
  SmitheryMigrationParams,
  sanitizeId,
  extractConfigSchemaFromSmitheryYaml
} from "./utils.js";

/**
 * Generate Python code for custom container migration using templates
 */
export function generatePythonCustomContainerMigration(params: SmitheryMigrationParams): string {
  const { tools, prompts, resources, serverName, serverVersion, includeBackwardCompatibility, smitheryYaml } = params;

  // Extract config schema from smithery yaml
  const extractedConfigSchema = smitheryYaml 
    ? extractConfigSchemaFromSmitheryYaml(smitheryYaml)
    : undefined;

  // Generate the complete Python file for custom container
  return generatePythonTemplate({
    tools,
    prompts,
    resources,
    serverName,
    serverVersion,
    includeBackwardCompatibility,
    configSchema: extractedConfigSchema
  });
}

function generatePythonTemplate(params: {
  tools: McpTool[];
  prompts: McpPrompt[];
  resources: McpResource[];
  serverName: string;
  serverVersion: string;
  includeBackwardCompatibility: boolean;
  configSchema?: Record<string, any>;
}): string {
  const { tools, prompts, resources, serverName, serverVersion, includeBackwardCompatibility, configSchema } = params;

  // Generate imports
  const imports = generatePythonImports(includeBackwardCompatibility);
  
  // Generate server initialization
  const serverInit = generateServerInit(serverName);
  
  // Generate config handling functions (only if config schema provided)
  const configFunctions = configSchema && Object.keys(configSchema).length > 0 ? generateConfigFunctions() : '';
  
  // Generate middleware (only if config schema provided)
  const middleware = configSchema && Object.keys(configSchema).length > 0 ? generateMiddleware() : '';
  
  // Generate tools
  const toolsCode = generatePythonToolsCode(tools, configSchema);
  
  // Generate prompts
  const promptsCode = generatePythonPromptsCode(prompts);
  
  // Generate resources
  const resourcesCode = generatePythonResourcesCode(resources);
  
  // Generate main function
  const mainFunction = generatePythonMainFunction(includeBackwardCompatibility, configSchema && Object.keys(configSchema).length > 0);

  return `${imports}

${serverInit}
${configFunctions ? `\n${configFunctions}\n` : ''}
${toolsCode}

${promptsCode}

${resourcesCode}

${mainFunction}
${middleware ? `\n${middleware}` : ''}
`;
}

function generatePythonImports(includeBackwardCompatibility: boolean): string {
  let imports = `# src/main.py
import os
import uvicorn
from mcp.server.fastmcp import FastMCP
from starlette.middleware.cors import CORSMiddleware
from typing import Optional`;

  if (includeBackwardCompatibility) {
    imports += `
import contextvars`;
  }

  return imports;
}

function generateServerInit(serverName: string): string {
  return `# Initialize MCP server
mcp = FastMCP(name="${serverName}")`;
}

function generateConfigFunctions(): string {
  return `def get_request_config() -> dict:
    """Get full config from current request context."""
    try:
        # Access the current request context from FastMCP
        import contextvars
        
        # Try to get from request context if available
        request = contextvars.copy_context().get('request')
        if hasattr(request, 'scope') and request.scope:
            return request.scope.get('smithery_config', {})
    except:
        pass
    return {}

def get_config_value(key: str, default=None):
    """Get a specific config value from current request."""
    config = get_request_config()
    return config.get(key, default)`;
}

function generatePythonToolsCode(tools: McpTool[], configSchema?: Record<string, any>): string {
  if (tools.length === 0) {
    return `# No tools to register`;
  }

  const toolsCode = tools.map(tool => {
    const functionName = sanitizeId(tool.name).replace(/-/g, '_');
    
    // Generate config access code based on actual schema
    let configAccessCode = '';
    if (configSchema && configSchema.properties) {
      const configProperties = Object.keys(configSchema.properties);
      const httpConfigCode = configProperties.map(prop => {
        const propSchema = configSchema.properties[prop];
        const defaultValue = propSchema.default !== undefined ? 
          (typeof propSchema.default === 'string' ? `"${propSchema.default}"` : propSchema.default) : 
          'None';
        return `    ${prop.replace(/([A-Z])/g, '_$1').toLowerCase()} = get_config_value("${prop}", ${defaultValue})`;
      }).join('\n');
      
      const envVarCode = configProperties.map(prop => {
        const propSchema = configSchema.properties[prop];
        const envVar = prop.replace(/([A-Z])/g, '_$1').toUpperCase();
        const defaultValue = propSchema.default !== undefined ? 
          (typeof propSchema.default === 'string' ? `"${propSchema.default}"` : propSchema.default) : 
          'None';
        return `    # ${prop.replace(/([A-Z])/g, '_$1').toLowerCase()} = os.getenv("${envVar}", ${defaultValue})`;
      }).join('\n');
      
      if (httpConfigCode) {
        configAccessCode = `    # Get config values (HTTP mode uses request context, stdio mode uses environment variables)
${httpConfigCode}
${envVarCode}
    
    # TODO: Add your validation logic here using the config values
    `;
      }
    } else {
      configAccessCode = `    # Get config values (HTTP mode uses request context, stdio mode uses environment variables)
    # No config schema provided - add your config access here if needed
    `;
    }
    
    return `# Tool: ${tool.name}
@mcp.tool()
def ${functionName}() -> str:
    """${tool.description}"""
${configAccessCode}
    # TODO: Implement tool logic for ${tool.name}
    return f"Tool ${tool.name} executed successfully"`;
  }).join('\n\n');

  return `# Register tools
${toolsCode}`;
}

function generatePythonPromptsCode(prompts: McpPrompt[]): string {
  if (prompts.length === 0) {
    return `# No prompts to register`;
  }

  const promptsCode = prompts.map(prompt => {
    const functionName = sanitizeId(prompt.name).replace(/-/g, '_');
    
    return `# Prompt: ${prompt.name}
@mcp.prompt()
def ${functionName}() -> str:
    """${prompt.description}"""
    # TODO: Implement prompt logic for ${prompt.name}
    return "${prompt.template || 'Prompt template here'}"`;
  }).join('\n\n');

  return `# Register prompts
${promptsCode}`;
}

function generatePythonResourcesCode(resources: McpResource[]): string {
  if (resources.length === 0) {
    return `# No resources to register`;
  }

  const resourcesCode = resources.map(resource => {
    const functionName = sanitizeId(resource.name).replace(/-/g, '_');
    const isHttpsUrl = resource.uri.startsWith('https://');
    
    if (isHttpsUrl) {
      return `# Resource: ${resource.name}
@mcp.resource("${resource.uri}")
def ${functionName}() -> str:
    """${resource.description}"""
    import requests
    try:
        response = requests.get("${resource.uri}")
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        raise ValueError(f"Failed to fetch resource ${resource.uri}: {str(e)}")`;
    } else {
      return `# Resource: ${resource.name}
@mcp.resource("${resource.uri}")
def ${functionName}() -> str:
    """${resource.description}"""
    # TODO: Implement resource handler for ${resource.uri}
    return "Resource content here"`;
    }
  }).join('\n\n');

  return `# Register resources
${resourcesCode}`;
}

function generatePythonMainFunction(includeBackwardCompatibility: boolean, hasConfig: boolean = false): string {
  if (includeBackwardCompatibility) {
    // Full version with stdio support
    let mainFunction = `def main():
    transport_mode = os.getenv("TRANSPORT", "stdio")
    
    if transport_mode == "http":
        # HTTP mode with config extraction from URL parameters
        print("MCP Server starting in HTTP mode...")
        
        # Setup Starlette app with CORS for cross-origin requests
        app = mcp.streamable_http_app()
        
        # IMPORTANT: add CORS middleware for browser based clients
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["*"],
            expose_headers=["mcp-session-id", "mcp-protocol-version"],
            max_age=86400,
        )

        ${hasConfig ? '# Apply custom middleware for config extraction (per-request API key handling)\n        app = SmitheryConfigMiddleware(app)\n\n        ' : ''}# Use Smithery-required PORT environment variable
        port = int(os.environ.get("PORT", 8081))
        print(f"Listening on port {port}")

        uvicorn.run(app, host="0.0.0.0", port=port, log_level="debug")
    else:
        # Optional: add stdio transport for backwards compatibility
        # You can publish this to uv for users to run locally
        print("MCP Server starting in stdio mode...")
        
        # In stdio mode, config comes from environment variables
        # Tools will read directly from environment using os.getenv() as needed
        
        # Run with stdio transport (default)
        mcp.run()

if __name__ == "__main__":
    main()`;
    return mainFunction;
  } else {
    // HTTP-only version for Smithery deployment
    return `def main():
    # HTTP mode for Smithery deployment
    print("MCP Server starting in HTTP mode...")
    
    # Setup Starlette app with CORS for cross-origin requests
    app = mcp.streamable_http_app()
    
    # IMPORTANT: add CORS middleware for browser based clients
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["mcp-session-id", "mcp-protocol-version"],
        max_age=86400,
    )

    ${hasConfig ? '# Apply custom middleware for config extraction (per-request API key handling)\n    app = SmitheryConfigMiddleware(app)\n\n    ' : ''}# Use Smithery-required PORT environment variable
    port = int(os.environ.get("PORT", 8081))
    print(f"Listening on port {port}")

    uvicorn.run(app, host="0.0.0.0", port=port, log_level="debug")

if __name__ == "__main__":
    main()`;
  }
}

function generateMiddleware(): string {
  return `# src/middleware.py - Custom middleware for Smithery configuration
import json
import base64
from urllib.parse import parse_qs, unquote

class SmitheryConfigMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get('type') == 'http':
            query = scope.get('query_string', b'').decode()
            
            if 'config=' in query:
                try:
                    config_b64 = unquote(parse_qs(query)['config'][0])
                    config = json.loads(base64.b64decode(config_b64))
                    
                    # Inject full config into request scope for per-request access
                    scope['smithery_config'] = config
                except Exception as e:
                    print(f"SmitheryConfigMiddleware: Error parsing config: {e}")
                    scope['smithery_config'] = {}
            else:
                scope['smithery_config'] = {}
        
        await self.app(scope, receive, send)`;
}

// Export the tool schema
export const PythonCustomContainerMigrationToolSchema = {
  name: "generate_python_custom_container_migration",
  description: "Generate Python code for migrating an MCP server to custom container format using FastMCP",
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
    configSchema: z.record(z.any()).optional().describe("JSON schema for server configuration (will be used for config handling)"),
  }
};
