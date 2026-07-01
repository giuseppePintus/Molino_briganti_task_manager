import * as fs from 'fs';
import * as path from 'path';

const AUDIT_LOG_FILE = process.env.NAS_AUDIT_LOG_FILE
  || '/data/nas/logs/task-manager-audit.jsonl';

function ensureAuditLogDirectory(): void {
  const directory = path.dirname(AUDIT_LOG_FILE);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

export async function appendAuditLog(entry: Record<string, unknown>): Promise<void> {
  ensureAuditLogDirectory();

  const line = `${JSON.stringify({
    ts: new Date().toISOString(),
    ...entry,
  })}\n`;

  await fs.promises.appendFile(AUDIT_LOG_FILE, line, 'utf-8');
}

export function getAuditLogFilePath(): string {
  return AUDIT_LOG_FILE;
}