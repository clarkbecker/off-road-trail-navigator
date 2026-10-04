async function testOverpass() {
  const query = `[out:json][timeout:30];
(
  relation["route"="atv"](45.65,-92.85,46.15,-92.05);
  relation["route"="snowmobile"](45.65,-92.85,46.15,-92.05);
  way["name"~"Trail 8|Trail 7",i](45.65,-92.85,46.15,-92.05);
  relation["name"~"Trail 8|Trail 7",i](45.65,-92.85,46.15,-92.05);
  way["ref"~"^(7|7B|8|8E|8W)$",i](45.65,-92.85,46.15,-92.05);
  relation["ref"~"^(7|7B|8|8E|8W)$",i](45.65,-92.85,46.15,-92.05);
);
out tags;
`;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'TrailNavigator/1.0 (clark@trailnav.local)',
      },
      body: 'data=' + encodeURIComponent(query),
    });
    const text = await res.text();
    const data = JSON.parse(text);
    console.log('Total elements found:', data.elements ? data.elements.length : 0);
    if (data.elements) {
      for (const el of data.elements) {
        console.log(`[${el.type} ${el.id}] ref: ${el.tags?.ref || 'N/A'}, name: ${el.tags?.name || 'N/A'}, route: ${el.tags?.route || el.tags?.highway || 'N/A'}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

testOverpass();
