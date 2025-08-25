import { z } from "zod";
import { SmitheryYamlParams, formatObjectAsYaml } from "./templates/utils.js";

/**
 * Generate smithery.yaml configuration file
 */
export function generateSmitheryYaml(params: SmitheryYamlParams): string {
  const { 
    runtime, 
    startCommandType, 
    configSchema, 
    exampleConfig, 
    env,
    dockerfile,
    dockerBuildPath,
    commandFunction,
  } = params;

  const yamlContent: any = {};

  // Add comment reference
  const comment = "# Smithery configuration file: https://smithery.ai/docs/build/project-config/smithery-yaml\n";

  // Detect if this is a local-only stdio server (no runtime needed)
  const isLocalOnlyStdio = startCommandType === "stdio" && commandFunction;
  
  if (runtime === "typescript") {
    yamlContent.runtime = "typescript";
    if (env) {
      yamlContent.env = env;
    }
  } else if (!isLocalOnlyStdio) {
    // Container runtime (default) - but only add if not local-only stdio
    if (runtime) {
      yamlContent.runtime = runtime;
    }
    
    if (dockerfile || dockerBuildPath) {
      yamlContent.build = {};
      if (dockerfile) {
        yamlContent.build.dockerfile = dockerfile;
      }
      if (dockerBuildPath) {
        yamlContent.build.dockerBuildPath = dockerBuildPath;
      }
    }
  }

  yamlContent.startCommand = {
    type: startCommandType
  };

  if (startCommandType === "stdio" && commandFunction) {
    yamlContent.startCommand.commandFunction = commandFunction;
  }

  yamlContent.startCommand.configSchema = configSchema || {};
  yamlContent.startCommand.exampleConfig = exampleConfig || {};

  if (env) {
    yamlContent.env = env;
  }

  // Convert to YAML string
  const yamlString = Object.entries(yamlContent)
    .map(([key, value]) => {
      if (key === 'startCommand' && typeof value === 'object') {
        const startCommand = value as any;
        let result = `${key}:\n`;
        result += `  type: "${startCommand.type}"\n`;
        
        if (startCommand.commandFunction) {
          result += `  commandFunction:\n    # A JS function that produces the CLI command based on the given config to start the MCP on stdio.\n    |-\n`;
          const lines = startCommand.commandFunction.split('\n');
          lines.forEach(line => {
            result += `    ${line}\n`;
          });
        }
        
        if (startCommand.configSchema !== undefined) {
          result += `  # JSON Schema defining the configuration options for the MCP.\n`;
          result += `  configSchema:\n`;
          if (Object.keys(startCommand.configSchema).length === 0) {
            result += `    {}\n`;
          } else {
            result += formatObjectAsYaml(startCommand.configSchema, 4);
          }
        }
        
        if (startCommand.exampleConfig !== undefined) {
          result += `  exampleConfig:\n`;
          if (Object.keys(startCommand.exampleConfig).length === 0) {
            result += `    {}\n`;
          } else {
            result += formatObjectAsYaml(startCommand.exampleConfig, 4);
          }
        }
        
        return result.trimEnd();
      } else if (key === 'build' && typeof value === 'object') {
        let result = `${key}:\n`;
        const build = value as any;
        if (build.dockerfile) {
          result += `  dockerfile: "${build.dockerfile}"\n`;
        }
        if (build.dockerBuildPath) {
          result += `  dockerBuildPath: "${build.dockerBuildPath}"\n`;
        }
        return result.trimEnd();
      } else if (key === 'env' && typeof value === 'object') {
        let result = `${key}:\n`;
        Object.entries(value as Record<string, string>).forEach(([envKey, envValue]) => {
          result += `  ${envKey}: "${envValue}"\n`;
        });
        return result.trimEnd();
      } else if (typeof value === 'string') {
        return `${key}: "${value}"`;
      } else {
        return `${key}: ${JSON.stringify(value)}`;
      }
    })
    .join('\n');

  return comment + yamlString + '\n';
}

export const SmitheryYamlGeneratorToolSchema = {
  name: "generate_smithery_yaml",
  description: "Generate smithery.yaml configuration file for Smithery deployment",
  inputSchema: {
    serverName: z.string().default("My MCP Server").describe("Name of the server"),
    description: z.string().optional().describe("Description of the server"),
    runtime: z.enum(["container", "typescript"]).default("container").describe("Runtime type"),
    startCommandType: z.enum(["http", "stdio"]).default("http").describe("Start command type"),
    configSchema: z.record(z.any()).optional().describe("JSON Schema for configuration"),
    exampleConfig: z.record(z.any()).optional().describe("Example configuration object"),
    env: z.record(z.string()).optional().describe("Environment variables"),
    dockerfile: z.string().optional().describe("Path to Dockerfile"),
    dockerBuildPath: z.string().optional().describe("Docker build context path"),
    commandFunction: z.string().optional().describe("JavaScript function for stdio command (stdio type only)"),
  }
};
