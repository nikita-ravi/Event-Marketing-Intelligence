import Anthropic from '@anthropic-ai/sdk';
import { MCPClient } from './mcpClient.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

/**
 * Event Campaign Agent
 * Uses Claude with tool calling to orchestrate MCP tools
 */
export class EventCampaignAgent {
  private anthropic: Anthropic;
  private mcpClient: MCPClient;
  private conversationHistory: Message[] = [];

  constructor(anthropicApiKey: string) {
    this.anthropic = new Anthropic({ apiKey: anthropicApiKey });
    this.mcpClient = new MCPClient();
  }

  async initialize(mcpServerPath: string): Promise<void> {
    await this.mcpClient.connect(mcpServerPath);
    console.log('Agent initialized with MCP server');
  }

  async close(): Promise<void> {
    await this.mcpClient.close();
  }

  /**
   * Convert MCP tools to Anthropic tool format
   */
  private async getAnthropicTools(): Promise<Anthropic.Tool[]> {
    const mcpTools = await this.mcpClient.listTools();

    return mcpTools.tools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      input_schema: tool.inputSchema as Record<string, unknown>,
    }));
  }

  /**
   * Process a user message and return agent response
   */
  async chat(userMessage: string): Promise<string> {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    // Convert conversation history to Anthropic format
    const messages = this.conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Get available tools
    const tools = await this.getAnthropicTools();

    // Initial call to Claude
    let response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
      tools,
    });

    // Handle tool use loop
    while (response.stop_reason === 'tool_use') {
      // Extract tool calls
      const toolCalls = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      // Execute tool calls via MCP
      const toolResults = await Promise.all(
        toolCalls.map(async (toolCall) => {
          console.log(
            `[Tool call] ${toolCall.name}:`,
            JSON.stringify(toolCall.input, null, 2)
          );

          try {
            const result = await this.mcpClient.callTool(
              toolCall.name,
              toolCall.input as Record<string, any>
            );

            // Extract text content from MCP response
            const textContent = result.content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('\n');

            console.log(`[Tool result] ${toolCall.name}: ${textContent.substring(0, 200)}...`);

            return {
              type: 'tool_result' as const,
              tool_use_id: toolCall.id,
              content: textContent,
            };
          } catch (error) {
            console.error(`[Tool error] ${toolCall.name}:`, error);
            return {
              type: 'tool_result' as const,
              tool_use_id: toolCall.id,
              content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              is_error: true,
            };
          }
        })
      );

      // Continue conversation with tool results
      messages.push({
        role: 'assistant',
        content: response.content,
      });

      messages.push({
        role: 'user',
        content: toolResults,
      } as any);

      response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
        tools,
      });
    }

    // Extract final text response
    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    this.conversationHistory.push({
      role: 'assistant',
      content: textContent,
    });

    return textContent;
  }

  /**
   * Reset conversation history
   */
  resetConversation(): void {
    this.conversationHistory = [];
  }

  /**
   * Get current conversation history
   */
  getHistory(): Message[] {
    return [...this.conversationHistory];
  }
}
