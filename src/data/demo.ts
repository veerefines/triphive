/**
 * Demo world seeded by Settings → Demo data (owner only, src/server/demo.ts).
 *
 * Plain typed data, no randomness: six persona travelers (src/data/demoPeople.ts),
 * five trips with real coordinates (src/data/demoTrips.ts), reviews, group chat
 * with @Hive asks, and join requests. `ME` stands for whoever runs the seed
 * (the app owner).
 */
import { PERSONAS, type DemoReview } from './demoPeople'

export * from './demoPeople'
export { DEMO_TRIPS } from './demoTrips'

const { priya, marco, aiko, tenzin, maya, lukas } = PERSONAS

export const DEMO_REVIEWS: DemoReview[] = [
  { by: aiko, place: 'Double Decker Living Root Bridge', destination: 'Meghalaya, India', rating: 5, text: 'Brutal steps, magical bridge. Swim in the natural pool at the bottom.', spentUsd: 3 },
  { by: lukas, place: 'Double Decker Living Root Bridge', destination: 'Meghalaya, India', rating: 5, text: 'Start before 7 and you get the bridge to yourself for a while.', spentUsd: 2 },
  { by: marco, place: 'Umngot River, Dawki', destination: 'Meghalaya, India', rating: 4, text: 'Clear as glass before noon. Shared boats keep it cheap.', spentUsd: 9 },
  { by: priya, place: 'Jadoh at Police Bazaar', destination: 'Meghalaya, India', rating: 4, text: 'Ask for the veg version, they make it with potato and it is great.', spentUsd: 3 },
  { by: marco, place: 'Time Out Market Lisboa', destination: 'Lisbon, Portugal', rating: 4, text: 'Go before 1pm or tables vanish. The croquetas stall is the move.', spentUsd: 20 },
  { by: priya, place: 'Time Out Market Lisboa', destination: 'Lisbon, Portugal', rating: 5, text: 'A whole food tour under one roof. Try the bifana.', spentUsd: 16 },
  { by: aiko, place: 'Pastéis de Belém', destination: 'Lisbon, Portugal', rating: 5, text: 'Still warm from the oven. Sit inside, the takeaway line is the long one.', spentUsd: 5 },
  { by: aiko, place: 'Pena Palace', destination: 'Lisbon, Portugal', rating: 4, text: 'Book the first slot. The fog lifts around 11 and the colors pop.', spentUsd: 22 },
  { by: maya, place: 'La Jolla Cove', destination: 'San Diego, USA', rating: 5, text: 'Sea lions, pelicans and garibaldi in the shallows. Go at low tide.', spentUsd: 0 },
  { by: lukas, place: 'La Jolla Sea Caves kayak', destination: 'San Diego, USA', rating: 5, text: 'Paddled into the caves and saw leopard sharks underneath. Worth every dollar.', spentUsd: 55 },
  { by: marco, place: 'Sunset Cliffs Natural Park', destination: 'San Diego, USA', rating: 5, text: 'Best sunset light of the whole trip. Bring a jacket.', spentUsd: 0 },
  { by: priya, place: 'The Taco Stand La Jolla', destination: 'San Diego, USA', rating: 4, text: 'The veggie taco holds its own. Fast and cheap.', spentUsd: 11 },
  { by: aiko, place: 'Tiger’s Nest Monastery', destination: 'Paro, Bhutan', rating: 5, text: 'Hard climb, unreal payoff. The cafeteria halfway up has the best view.', spentUsd: 15 },
  { by: lukas, place: 'Tiger’s Nest Monastery', destination: 'Paro, Bhutan', rating: 5, text: 'Took me 2.5 hours up. Leave the camera in the locker and just look.', spentUsd: 15 },
  { by: marco, place: 'Punakha Dzong', destination: 'Paro, Bhutan', rating: 5, text: 'Jacarandas, rivers on both sides and red robes everywhere. Photographer heaven.', spentUsd: 5 },
  { by: tenzin, place: 'Centenary Farmers Market', destination: 'Paro, Bhutan', rating: 4, text: 'Try the dried yak cheese and the red rice. Weekends are liveliest.', spentUsd: 6 },
  { by: priya, place: 'Tsukiji Outer Market', destination: 'Tokyo, Japan', rating: 5, text: 'Tamagoyaki on a stick at 8am is a life goal.', spentUsd: 30 },
  { by: marco, place: 'Fuunji Ramen', destination: 'Tokyo, Japan', rating: 5, text: 'Best tsukemen I have had. The line moves quickly.', spentUsd: 10 },
  { by: tenzin, place: 'Omoide Yokocho', destination: 'Tokyo, Japan', rating: 4, text: 'Smoky, cramped and perfect. Yakitori and a highball.', spentUsd: 22 },
  { by: maya, place: 'Golden Gai', destination: 'Tokyo, Japan', rating: 4, text: 'Every bar seats six. Some charge a cover, check the sign by the door.', spentUsd: 28 },
]
