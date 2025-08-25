import { describe, it, expect } from 'vitest';
import { writeFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { generateSmitheryCliMigration } from '../../src/tools/templates/smithery-cli-template.js';
import type { SmitheryMigrationParams } from '../../src/tools/templates/utils.js';

describe('Smithery CLI Template - Core Scenarios', () => {
  // Helper function to test if generated code compiles
  const testCompilation = (code: string, testName: string) => {
    const testFile = `tests/generated-${testName}.ts`;
    try {
      writeFileSync(testFile, code);
      // Use tsc to check if the code compiles without emitting files
      execSync(`npx tsc --noEmit --skipLibCheck ${testFile}`, { stdio: 'pipe' });
      return true;
    } catch (error) {
      console.error(`Compilation failed for ${testName}:`, error);
      return false;
    } finally {
      try {
        unlinkSync(testFile);
      } catch {}
    }
  };

  describe('Core Configuration Matrix (2x2)', () => {
    it('should generate server: NO config, NO backwards compatibility', () => {
      const params: SmitheryMigrationParams = {
        tools: [],
        prompts: [],
        resources: [],
        serverName: 'Basic CLI Server',
        serverVersion: '1.0.0',
        includeBackwardCompatibility: false
        // No configSchema provided
      };

      const result = generateSmitheryCliMigration(params);

      // Should have empty config schema
      expect(result).toContain('export const configSchema = z.object({});');
      
      // Should NOT have STDIO imports or main function
      expect(result).not.toContain('import { StdioServerTransport }');
      expect(result).not.toContain('async function main()');
      expect(result).not.toContain('main().catch');
      
      // Should have basic server creation with config parameter
      expect(result).toContain('export default function createServer({');
      expect(result).toContain('config: z.infer<typeof configSchema>');
      expect(result).toContain('const server = new McpServer({');
      
      // Should compile successfully
      expect(testCompilation(result, 'cli-no-config-no-compat')).toBe(true);
    });

    it('should generate server: NO config, WITH backwards compatibility', () => {
      const params: SmitheryMigrationParams = {
        tools: [],
        prompts: [],
        resources: [],
        serverName: 'CLI Compat Server',
        serverVersion: '1.0.0',
        includeBackwardCompatibility: true
        // No configSchema provided
      };

      const result = generateSmitheryCliMigration(params);

      // Should have empty config schema
      expect(result).toContain('export const configSchema = z.object({});');
      
      // Should HAVE STDIO imports and main function
      expect(result).toContain('import { StdioServerTransport }');
      expect(result).toContain('async function main()');
      expect(result).toContain('const server = createServer({');
      expect(result).toContain('main().catch');
      
      // Should compile successfully
      expect(testCompilation(result, 'cli-no-config-with-compat')).toBe(true);
    });

    it('should generate server: WITH config, NO backwards compatibility', () => {
      const params: SmitheryMigrationParams = {
        tools: [],
        prompts: [],
        resources: [],
        serverName: 'CLI Config Server',
        serverVersion: '1.0.0',
        includeBackwardCompatibility: false,
        smitheryYaml: `startCommand:
  type: stdio
  commandFunction: |-
    (config) => ({ command: 'node', args: ['dist/index.js'], env: { API_KEY: config.apiKey } })
  configSchema:
    type: object
    required:
      - apiKey
    properties:
      apiKey:
        type: string
        description: API key for the service
      debug:
        type: boolean
        default: false
        description: Enable debug logging
  exampleConfig:
    apiKey: YOUR_API_KEY
    debug: false`
      };

      const result = generateSmitheryCliMigration(params);

      // Should HAVE config schema
      expect(result).toContain('export const configSchema = z.object({');
      expect(result).toContain('apiKey: z.string()');
      expect(result).toContain('debug: z.boolean().default(false)');
      
      // Should NOT have STDIO imports or main function
      expect(result).not.toContain('import { StdioServerTransport }');
      expect(result).not.toContain('async function main()');
      
      // Should have config parameter in createServer
      expect(result).toContain('config: z.infer<typeof configSchema>');
      
      // Should compile successfully
      expect(testCompilation(result, 'cli-with-config-no-compat')).toBe(true);
    });

    it('should generate server: WITH config, WITH backwards compatibility', () => {
      const params: SmitheryMigrationParams = {
        tools: [],
        prompts: [],
        resources: [],
        serverName: 'CLI Full Server',
        serverVersion: '1.0.0',
        includeBackwardCompatibility: true,
        smitheryYaml: `startCommand:
  type: stdio
  commandFunction: |-
    (config) => ({ command: 'node', args: ['dist/index.js'], env: { API_KEY: config.apiKey, TIMEOUT: config.timeout } })
  configSchema:
    type: object
    required:
      - apiKey
    properties:
      apiKey:
        type: string
        description: API key for the service
      timeout:
        type: number
        default: 5000
        description: Request timeout in milliseconds
  exampleConfig:
    apiKey: YOUR_API_KEY
    timeout: 5000`
      };

      const result = generateSmitheryCliMigration(params);

      // Should HAVE config schema
      expect(result).toContain('export const configSchema = z.object({');
      expect(result).toContain('apiKey: z.string()');
      expect(result).toContain('timeout: z.number().default(5000)');
      
      // Should HAVE STDIO imports and main function
      expect(result).toContain('import { StdioServerTransport }');
      expect(result).toContain('async function main()');
      
      // Should have both config and STDIO handling
      expect(result).toContain('config: z.infer<typeof configSchema>');
      expect(result).toContain('const config = configSchema.parse({');
      expect(result).toContain('apiKey: process.env.APIKEY');
      expect(result).toContain('timeout: process.env.TIMEOUT ? Number(process.env.TIMEOUT) : undefined');
      
      // Should compile successfully
      expect(testCompilation(result, 'cli-with-config-with-compat')).toBe(true);
    });
  });
});
