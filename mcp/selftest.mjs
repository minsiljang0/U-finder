import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["index.mjs"],
});
const client = new Client({ name: "selftest", version: "0.0.1" });
await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

const issues = await client.callTool({ name: "get_known_issues", arguments: {} });
console.log("KNOWN ISSUES:", issues.content[0].text.slice(0, 200));

const note = await client.callTool({ name: "append_dev_note", arguments: { note: "MCP 서버 셀프테스트 정상 동작 확인" } });
console.log("APPEND NOTE:", note.content[0].text);

const tables = await client.callTool({ name: "list_tables", arguments: {} });
console.log("TABLES:", tables.content[0].text);

await client.close();
process.exit(0);
