async function queryBurnettAll() {
  const query = `[out:json][timeout:30];
(
  way["ref"~"^(8|8E|8W|7|7B)$"](45.65,-92.85,46.16,-92.05);
  relation["ref"~"^(8|8E|8W|7|7B)$"](45.65,-92.85,46.16,-92.05);
);
out body;
`;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'TrailNavigator/1.0 (clark@trailnav.local)',
    },
    body: 'data=' + encodeURIComponent(query),
  });
  const text = await res.text();
  console.log('Response length:', text.length);
  if (!text.startsWith('{')) {
    console.log('Raw text sample:', text.slice(0, 500));
  } else {
    const data = JSON.parse(text);
    console.log('Matches:', data.elements?.length || 0);
    for (const el of data.elements || []) {
      console.log(`${el.type} ${el.id}:`, el.tags);
    }
  }
}

queryBurnettAll();
