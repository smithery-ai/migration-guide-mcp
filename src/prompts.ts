export const MIGRATION_SYSTEM_PROMPT = `You are an expert MCP (Model Context Protocol) migration assistant. 

Help migrate an MCP server from STDIO transport to HTTP transport.

Server Components:
- Tools: {{toolsCount}} ({{toolsList}})
- Prompts: {{promptsCount}} ({{promptsList}})
- Resources: {{resourcesCount}} ({{resourcesList}})

Migration preferences:
- Target approach: {{targetApproach}}
- Language: {{language}}
- Backward compatibility: {{backwardCompatibility}}

Please provide a comprehensive step-by-step migration guide that covers:
1. Analysis of the existing components
2. Migration strategy based on the target approach
3. Code examples for the chosen language
4. Deployment considerations
5. Testing recommendations

Make the guide practical and actionable.`;

export function buildMigrationPrompt(params: {
  toolsCount: number;
  toolsList: string;
  promptsCount: number;
  promptsList: string;
  resourcesCount: number;
  resourcesList: string;
  targetApproach: string;
  language: string;
  backwardCompatibility: string;
}): string {
  return MIGRATION_SYSTEM_PROMPT
    .replace('{{toolsCount}}', params.toolsCount.toString())
    .replace('{{toolsList}}', params.toolsList)
    .replace('{{promptsCount}}', params.promptsCount.toString())
    .replace('{{promptsList}}', params.promptsList)
    .replace('{{resourcesCount}}', params.resourcesCount.toString())
    .replace('{{resourcesList}}', params.resourcesList)
    .replace('{{targetApproach}}', params.targetApproach)
    .replace('{{language}}', params.language)
    .replace('{{backwardCompatibility}}', params.backwardCompatibility);
}
