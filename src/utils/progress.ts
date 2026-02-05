export function createProgressSpinner(label = "inferencing") {
  const frames = ["|", "/", "-", "\\"];
  let si = 0;
  const t0 = Date.now();
  return () => {
    const f = frames[si++ % frames.length];
    const sec = Math.floor((Date.now() - t0) / 1000);
    process.stdout.write(`\r${f} ${label}... ${sec}s`);
  };
}
