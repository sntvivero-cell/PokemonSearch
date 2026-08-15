import { createClient } from '@supabase/supabase-js'

// Importamos la misma configuración que ya te funciona en la app
// (Ajusta la ruta si tu archivo supabaseClient está en otra subcarpeta)
import { supabase } from './app/lib/supabaseClient'

async function poblarPokemons() {
  console.log("Descargando Pokémon de PokéAPI...")

  const response = await fetch("https://pokeapi.co/api/v2/pokemon?limit=151")
  const data = await response.json()

  for (const [index, p] of data.results.entries()) {
    const resDetalle = await fetch(p.url)
    const detalle = await resDetalle.json()

    const dexNumber = detalle.id
    const name = detalle.name
    const types = detalle.types.map((t: any) => t.type.name)
    const spriteUrl = detalle.sprites.other?.['official-artwork']?.front_default || detalle.sprites.front_default

    const pokemonData = {
      dex_number: dexNumber,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      form: 'Normal',
      generation: 1,
      types: types,
      sprite_url: spriteUrl,
      is_legendary: false,
      is_mythical: false,
    }

    const { error } = await supabase
      .from('pokemons')
      .upsert(pokemonData, { onConflict: 'dex_number,name,form' })

    if (error) {
      console.error(`Error al insertar a ${name}:`, error.message)
    } else {
      console.log(`[${index + 1}/151] Insertado: ${pokemonData.name}`)
    }
  }

  console.log("¡Proceso de importación de Pokémon finalizado con éxito! 🚀")
}

poblarPokemons()