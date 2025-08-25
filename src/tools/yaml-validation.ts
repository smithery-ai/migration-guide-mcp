import { z } from "zod";
import YAML from "yaml";

// Smithery YAML Schema (copied from @smithery/db/schema)
const JSONSchemaSchema: z.ZodType = z
  .lazy(() =>
    z
      .union([
        z.object({
          type: z
            .enum(["string", "number", "boolean", "null"])
            .optional()
            .describe("The type of the variable."),
        }),
        z.object({
          type: z.literal("object").describe("The type of the variable."),
          required: z
            .array(z.string())
            .optional()
            .describe(
              "A list of required keys. Be sure to mark this as true if the command will not run/properly generate without the key.",
            ),
          properties: z.record(JSONSchemaSchema).optional(),
        }),
        z.object({
          type: z.literal("array").describe("The type of the variable."),
          required: z.array(z.string()).optional(),
          items: JSONSchemaSchema.optional().describe(
            "The type of the items in the array.",
          ),
        }),
      ])
      .and(
        z.object({
          default: z
            .unknown()
            .optional()
            .describe(
              "The default is typically used to express that if a value is missing, then the value is semantically the same as if the value was present with the default value. Leave undefined if no default is allowed.",
            ),
          description: z.string().optional(),
        }),
      ),
  )
  .describe(
    "JSON Schema defines the configuration required to initialize the server. All variables are used to template fill the commands. Leave undefined if no config required.",
  );

const StartCommandSchema = z
  .union([
    z.object({
      type: z
        .literal("stdio")
        .describe(
          "stdio MCP servers are typically command line programs that run locally, and may require CLI args or environmental variables to start. You may see `StdioServerTransport` in the codebase (if TypeScript), which is a way to start an MCP server locally.",
        ),
      commandFunction: z.string().describe(
        `A lambda Javascript function that takes in the config object and returns an object of type StdioConnection:

interface StdioConnection {
  command: string,
  args?: string[],
  env?: Record<string, string>,
}

Example:
\`\`\`js
(config) => ({
  command:'npx',
  args:['-y', '@modelcontextprotocol/server-brave-search'],
  env: {
    BRAVE_API_KEY: config.braveApiKey
  }
})
\`\`\``,
      ),
    }),
    z.object({
      type: z
        .literal("http")
        .describe(
          "Streamable HTTP MCP servers are servers that serve their traffic over HTTP. They are web applications. You may see `StreamableHTTPServerTransport` in the codebase (if TypeScript), which is a way to start an MCP server over HTTP.",
        ),
    }),
  ])
  .and(
    z.object({
      configSchema: JSONSchemaSchema.nullish()
        .transform(schema => schema ?? {})
        .describe(
          "The JSON Schema to validate a end-user supplied config object that will be passed to the commandFunction. Configuration variables should always be in camelCase.",
        ),
      exampleConfig: z
        .any()
        .describe(
          "An example config object that satisfies the configSchema. This example is used to help users fill out the form. Make this look as realistic as possible with dummy variables. The example config should showcase all possible configuration variables defined in the configSchema. This example will be used to create test connections to the server.",
        ),
    }),
  )
  .describe("Determines how to start the server.");

const ProjectConfigSchema = z.union([
  z.object({
    runtime: z.literal("typescript"),
    env: z
      .record(z.string(), z.string())
      .optional()
      .describe("The environment to inject when spawning the process."),
  }),
  z.object({
    runtime: z.literal("container").optional(),
    build: z
      .object({
        dockerfile: z
          .string()
          .describe(
            "Path to Dockerfile, relative to this config file (base path). Defaults to the Dockerfile in the current directory.",
          )
          .default("Dockerfile")
          .optional(),
        dockerBuildPath: z
          .string()
          .describe(
            "Path to docker build context, relative to this config file (base path). Defaults to the current directory.",
          )
          .default(".")
          .optional(),
      })
      .optional(),
    startCommand: StartCommandSchema,
    env: z
      .record(z.string(), z.string())
      .optional()
      .describe("The environment to inject when spawning the process."),
  }),
]);

export interface SmitheryYamlValidationParams {
  yamlContent: string;
  filePath?: string;
}

/**
 * Validate a smithery.yaml configuration file and provide detailed feedback
 */
export async function validateSmitheryYaml(params: SmitheryYamlValidationParams): Promise<string> {
  const { yamlContent } = params;
  
  try {
    const parsed = YAML.parse(yamlContent);
    const result = ProjectConfigSchema.safeParse(parsed);
    
    if (result.success) {
      return "Valid smithery.yaml configuration";
    } else {
      const errors = result.error.errors.map(err => 
        `${err.path.join('.') || 'root'}: ${err.message}`
      ).join('\n');
      return `Validation errors:\n${errors}`;
    }
  } catch (error) {
    return `YAML parse error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Export the tool schema for use in the main server
export const YamlValidationToolSchema = {
  name: "validate_smithery_yaml",
  description: "Validate a smithery.yaml configuration file and provide detailed feedback",
  inputSchema: {
    yamlContent: z.string().describe("The content of the smithery.yaml file to validate"),
    filePath: z.string().optional().describe("Optional file path for better error reporting"),
  }
};
