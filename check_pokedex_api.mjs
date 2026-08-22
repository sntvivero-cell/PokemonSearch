const res = await fetch('https://pokemon-go-api.github.io/pokemon-go-api/api/pokedex.json');
const pokedex = await res.json();
const mewtwo = pokedex.find((p) => p.dexNr === 150);
console.log('Top-level keys:', Object.keys(mewtwo));
console.log('names:', JSON.stringify(mewtwo.names));
console.log('regionForms:', JSON.stringify(mewtwo.regionForms, null, 2));
console.log('megaEvolutions keys:', mewtwo.megaEvolutions && !Array.isArray(mewtwo.megaEvolutions) ? Object.keys(mewtwo.megaEvolutions) : mewtwo.megaEvolutions);
console.log('assetForms:', JSON.stringify(mewtwo.assetForms, null, 2));
console.log('temporaryEvolutions/other keys check:', Object.keys(mewtwo).filter(k => /form|armor|evol|temp|dynamax/i.test(k)));
