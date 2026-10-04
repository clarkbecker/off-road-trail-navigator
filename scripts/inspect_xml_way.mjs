async function run() {
  const res = await fetch('https://api.openstreetmap.org/api/0.6/way/21447179/full');
  const text = await res.text();
  console.log(text.slice(0, 600));
  const lines = text.split('\n').filter(l => l.includes('<tag '));
  console.log('Tags:\n' + lines.join('\n'));
}
run();
