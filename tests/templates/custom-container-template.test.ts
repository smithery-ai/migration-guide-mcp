import { describe, it, expect } from 'vitest';
import { writeFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { generateCustomContainerMigration } from '../../src/tools/templates/custom-container-template.js';
import type { SmitheryMigrationParams } from '../../src/tools/templates/utils.js';

describe('Custom Container Template - Core Scenarios', () => {
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
        serverName: 'Basic Server',
        serverVersion: '1.0.0',
        includeBackwardCompatibility: false
        // No configSchema provided
      };

      const result = generateCustomContainerMigration(params);

      // Should NOT have config schema when no config is provided
      expect(result).not.toContain('export const configSchema');
      
      // Should NOT have STDIO imports
      expect(result).not.toContain('import { StdioServerTransport }');
      
      // Should have basic Express setup
      expect(result).toContain('import express');
      expect(result).toContain('const app = express()');
      expect(result).toContain("app.all('/mcp'");
      
      // Should have createServer function without config parameter
      expect(result).toContain('export default function createServer()');
      
      // Should have pure HTTP mode (no transport switching)
      expect(result).toContain('app.listen(PORT');
      
      // Should compile successfully
      expect(testCompilation(result, 'no-config-no-compat')).toBe(true);
    });

    it('should generate server: NO config, WITH backwards compatibility', () => {
      const params: SmitheryMigrationParams = {
        tools: [],
        prompts: [],
        resources: [],
        serverName: 'Compat Server',
        serverVersion: '1.0.0',
        includeBackwardCompatibility: true
        // No configSchema provided
      };

      const result = generateCustomContainerMigration(params);

      // Should NOT have config schema when no config is provided
      expect(result).not.toContain('export const configSchema');
      
      // Should HAVE STDIO imports
      expect(result).toContain('import { StdioServerTransport }');
      
      // Should have createServer function without config parameter
      expect(result).toContain('export default function createServer()');
      
      // Should have STDIO mode handling
      expect(result).toContain('const stdioTransport = new StdioServerTransport()');
      expect(result).toContain('MCP Server running in stdio mode');
      
      // Should compile successfully
      expect(testCompilation(result, 'no-config-with-compat')).toBe(true);
    });

    it('should generate server: WITH config, NO backwards compatibility', () => {
      const params: SmitheryMigrationParams = {
        tools: [],
        prompts: [],
        resources: [],
        serverName: 'Config Server',
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

      const result = generateCustomContainerMigration(params);

      // Should HAVE config schema
      expect(result).toContain('export const configSchema = z.object({');
      expect(result).toContain('apiKey: z.string()');
      expect(result).toContain('debug: z.boolean().default(false)');
      
      // Should NOT have STDIO imports
      expect(result).not.toContain('import { StdioServerTransport }');
      
      // Should have config parameter in createServer
      expect(result).toContain('config: z.infer<typeof configSchema>');
      
      // Should compile successfully
      expect(testCompilation(result, 'with-config-no-compat')).toBe(true);
    });

    it('should generate server: WITH config, WITH backwards compatibility', () => {
      const params: SmitheryMigrationParams = {
        tools: [],
        prompts: [],
        resources: [],
        serverName: 'Full Server',
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

      const result = generateCustomContainerMigration(params);

      // Should HAVE config schema
      expect(result).toContain('export const configSchema = z.object({');
      expect(result).toContain('apiKey: z.string()');
      expect(result).toContain('timeout: z.number().default(5000)');
      
      // Should HAVE STDIO imports
      expect(result).toContain('import { StdioServerTransport }');
      
      // Should have both config and STDIO handling
      expect(result).toContain('config: z.infer<typeof configSchema>');
      expect(result).toContain('const stdioTransport = new StdioServerTransport()');
      
      // Should compile successfully
      expect(testCompilation(result, 'with-config-with-compat')).toBe(true);
    });
  });
});
