const res = await fetch('https://pokemon-go-api.github.io/pokemon-go-api/api/pokedex.json');
const pokedex = await res.json();

for (const dexNr of [249, 250]) {
  const p = pokedex.find((x) => x.dexNr === dexNr);
  console.log(`\n=== dex ${dexNr} (${p.names.English}) ===`);
  console.log('id:', p.id);
  console.log('base assets:', JSON.stringify(p.assets));
  console.log('regionForms:', JSON.stringify(p.regionForms, null, 2));
  console.log('megaEvolutions:', JSON.stringify(p.megaEvolutions, null, 2));
  console.log('assetForms:', JSON.stringify(p.assetForms, null, 2));
  console.log('all top-level keys:', Object.keys(p));
}
