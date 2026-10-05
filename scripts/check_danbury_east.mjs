async function checkDanburyEastWays() {
  const ids = [824017910, 824017911, 416775412, 1445229171, 1445229172, 926883166, 21450086];
  for (const id of ids) {
    const res = await fetch(`https://api.openstreetmap.org/api/0.6/way/${id}.json`, {
      headers: { 'User-Agent': 'TrailNavDanbury/1.0' }
    });
    const d = await res.json();
    const w = d.elements?.[0];
    console.log(`Way ${id}: "${w?.tags?.name}" (ref: ${w?.tags?.ref}, highway: ${w?.tags?.highway})`);
  }
}
checkDanburyEastWays();
