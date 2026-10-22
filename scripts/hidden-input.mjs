export async function hiddenInput(prompt) {
  if (!process.stdin.isTTY) throw new Error('Run this setup in an interactive school-managed terminal. Do not pass passwords as command arguments.');
  process.stderr.write(prompt + ' (hidden): ');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = () => {
      process.stdin.off('data', read);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stderr.write('\n');
    };
    const read = (chunk) => {
      for (const c of chunk.toString()) {
        if (c === '\u0003') { finish(); reject(new Error('Cancelled.')); return; }
        if (c === '\r' || c === '\n') { finish(); resolve(value); return; }
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1);
        else if (c >= ' ' && value.length < 128) value += c;
      }
    };
    process.stdin.on('data', read);
  });
}
