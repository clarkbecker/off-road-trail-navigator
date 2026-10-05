import pg from 'pg';

async function searchFireLanesInOSM() {
  const query = `[out:json][timeout:30];
area["name"="Burnett County"]["admin_level"="6"]->.searchArea;
(
  way["name"~"Fire",i](area.searchArea);
);
out tags center;
`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'TrailNavDanbury/1.0' },
    body: 'data=' + encodeURIComponent(query),
  });
  const text = await res.text();
  if (!text.startsWith('{')) {
    console.log('Error or busy text:', text.slice(0, 300));
    return;
  }
  const data = JSON.parse(text);
  console.log(`Found ${data.elements?.length || 0} Fire roads/lanes in Burnett County:`);
  for (const e of data.elements || []) {
    console.log(`- ${e.id}: "${e.tags.name}" (${e.tags.highway}) at ${e.center?.lat}, ${e.center?.lon}`);
  }
}

searchFireLanesInOSM().catch(console.error);
