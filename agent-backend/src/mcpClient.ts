import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

/**
 * MCP Client for connecting to the event campaign MCP server
 * Spawns the server as a child process and communicates via stdio
 */
export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;

  constructor() {
    this.client = new Client(
      {
        name: 'event-campaign-agent',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );
  }

  /**
   * Connect to the MCP server
   */
  async connect(serverPath: string): Promise<void> {
    const absolutePath = path.resolve(process.cwd(), serverPath);
    const serverDir = path.dirname(absolutePath);

    this.transport = new StdioClientTransport({
      command: 'tsx',
      args: [absolutePath],
      env: {
        ...process.env,
      },
      cwd: serverDir
    });

    await this.client.connect(this.transport);
    console.log('Connected to MCP server');
  }

  /**
   * List available tools from the MCP server
   */
  async listTools() {
    return await this.client.listTools();
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, args: Record<string, any>) {
    return await this.client.callTool({ name, arguments: args });
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.transport) {
      await this.client.close();
      console.log('Disconnected from MCP server');
    }
  }
}
