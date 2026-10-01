/**
 * Split the managed launch command into argv without a shell. Whitespace
 * separates arguments; a balanced pair of double or single quotes groups an
 * argument that contains spaces (`"C:\Program Files\bun\bun.exe" run main.ts`).
 * Backslashes are literal so Windows paths need no escaping. A command with an
 * unbalanced quote (an apostrophe in a path) keeps the legacy whitespace split,
 * so a configuration that launched before still launches the same way.
 */
export function splitCommandLine(command: string): string[] {
  const args: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let inArgument = false;
  for (const char of command.trim()) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      inArgument = true;
    } else if (/\s/.test(char)) {
      if (inArgument) args.push(current);
      current = '';
      inArgument = false;
    } else {
      current += char;
      inArgument = true;
    }
  }
  if (quote) return command.trim().split(/\s+/);
  if (inArgument) args.push(current);
  return args;
}
