/**
 * The five demo trips. Day offsets count from the seed day so trips are always
 * upcoming. The owner (`ME`) hosts Meghalaya and Lisbon, has joined Maya's
 * San Diego trip, and has a pending request on Tenzin's Bhutan trip, so every
 * side of the join flow is visible right after a reset.
 */
import { BALANCED, ME, PERSONAS, type DemoTrip } from './demoPeople'

const { priya, marco, aiko, tenzin, maya, lukas } = PERSONAS
const WELCOME = 'Request accepted. Chat is unlocked and the trip is shared. Welcome aboard! 🎉'

const MEGHALAYA: DemoTrip = {
  key: 'meghalaya',
  title: 'Meghalaya root bridges',
  destination: 'Meghalaya, India',
  lat: 25.467,
  lng: 91.3662,
  startOffset: 9,
  days: 3,
  host: ME,
  members: [ME, priya, aiko],
  listing: {
    description: 'Living root bridges, the clearest river in India and canyon sunsets. One spot left for someone fit enough for 3,500 steps.',
    vibes: ['Adventure', 'Nature', 'Foodie'],
    openSpots: 1,
  },
  prefs: {
    [ME]: BALANCED,
    [priya]: { dailyBudget: 40, pace: 'packed', interests: 'hiking, local food', dietary: 'vegetarian', wakeTime: '06:00' },
    [aiko]: { dailyBudget: 50, pace: 'packed', interests: 'hiking, waterfalls', wakeTime: '05:30' },
  },
  stops: [
    { day: 0, start: '14:00', end: '15:00', title: 'Police Bazaar, Shillong', category: 'transport', lat: 25.5763, lng: 91.883, cost: 0 },
    { day: 0, start: '16:00', end: '17:00', title: "Ward's Lake", category: 'sight', lat: 25.5786, lng: 91.8865, cost: 1, outdoor: true },
    { day: 0, start: '19:30', end: '20:30', title: 'Jadoh at Police Bazaar', category: 'food', lat: 25.577, lng: 91.885, cost: 4 },
    { day: 1, start: '07:00', end: '12:00', title: 'Double Decker Living Root Bridge', category: 'activity', lat: 25.2531, lng: 91.6806, cost: 2, outdoor: true, notes: 'About 3,500 steps down from Tyrna. Bring water.' },
    { day: 1, start: '12:30', end: '14:00', title: 'Rainbow Falls', category: 'sight', lat: 25.2493, lng: 91.682, cost: 0, outdoor: true },
    { day: 1, start: '16:30', end: '17:30', title: 'Nohkalikai Falls', category: 'sight', lat: 25.2786, lng: 91.6849, cost: 1, outdoor: true },
    { day: 2, start: '09:30', end: '11:30', title: 'Mawlynnong Village', category: 'sight', lat: 25.2016, lng: 91.9161, cost: 1 },
    { day: 2, start: '12:30', end: '14:30', title: 'Umngot River, Dawki', category: 'activity', lat: 25.1868, lng: 92.0236, cost: 8, outdoor: true },
    { day: 2, start: '17:00', end: '18:00', title: 'Laitlum Canyons', category: 'sight', lat: 25.4583, lng: 91.9581, cost: 0, outdoor: true },
  ],
  chat: [
    { from: priya, text: 'Root bridge day starts at 7. Trust me, the steps are easier before the heat.' },
    { from: aiko, text: 'In! Packing my trail shoes. Dawki on the last day is a must.' },
    { from: ME, text: '@Hive we have a free hour near Sohra on day 2 if it rains. Anything good indoors?' },
  ],
  hive: {
    text: 'Arwah Cave is 10 minutes from Sohra market and stays dry when the cliffs are fogged in. Fits nicely before Nohkalikai.',
    card: {
      name: 'Arwah Cave',
      why: 'A lit limestone cave with fossils in the walls, reached by a short jungle path with valley views.',
      category: 'sight',
      day: 1,
      lat: 25.2895,
      lng: 91.7272,
      rating: 4.3,
      ratingCount: 3100,
      mustTry: ['Fossil chamber', 'Viewpoint on the walk in'],
      nearbyFood: ['Sohra market jadoh stalls', 'Orange Roots, Sohra'],
      thingsToDo: ['Nohkalikai Falls', 'Mawsmai Cave'],
      tips: ['Wear shoes with grip', 'Torch helps in the back chambers'],
      costPerPersonUsd: 1,
    },
  },
  requests: [
    {
      requester: priya,
      pitch: 'Hi! I have done the root bridge trek twice and know the vegetarian spots in Shillong. Would love to come along.',
      status: 'accepted',
      replies: [
        { from: 'system', text: WELCOME },
        { from: priya, text: 'Yay! I will bring a list of jadoh stalls.' },
      ],
    },
    {
      requester: lukas,
      pitch: 'Hallo! Backpacking India until March. I hike most weekends and I am fine with dorms and long jeep rides.',
      status: 'pending',
      replies: [],
    },
  ],
}

const LISBON: DemoTrip = {
  key: 'lisbon',
  title: 'Lisbon long weekend',
  destination: 'Lisbon, Portugal',
  lat: 38.7223,
  lng: -9.1393,
  startOffset: 18,
  days: 3,
  host: ME,
  members: [ME, marco],
  listing: {
    description: 'Three slow days of pastéis, tiled alleys and fado. Looking for one or two easygoing people who like walking and eating.',
    vibes: ['Foodie', 'Culture', 'Photography'],
    openSpots: 2,
  },
  prefs: {
    [ME]: BALANCED,
    [marco]: { dailyBudget: 110, pace: 'balanced', interests: 'photography, sunsets, wine', wakeTime: '07:30' },
  },
  stops: [
    { day: 0, start: '12:30', end: '14:00', title: 'Time Out Market Lisboa', category: 'food', lat: 38.7069, lng: -9.1459, cost: 18 },
    { day: 0, start: '15:00', end: '16:45', title: 'Miradouro de Santa Luzia', category: 'sight', lat: 38.7116, lng: -9.1301, cost: 0, outdoor: true, notes: 'Wander down through Alfama after.' },
    { day: 0, start: '17:00', end: '17:45', title: 'Tram 28', category: 'transport', lat: 38.7107, lng: -9.1335, cost: 3 },
    { day: 0, start: '20:00', end: '21:30', title: 'Taberna da Rua das Flores', category: 'food', lat: 38.7105, lng: -9.1438, cost: 30, notes: 'No reservations, so arrive early.' },
    { day: 1, start: '09:30', end: '10:30', title: 'Belém Tower', category: 'sight', lat: 38.6916, lng: -9.216, cost: 8, outdoor: true },
    { day: 1, start: '10:45', end: '12:15', title: 'Jerónimos Monastery', category: 'sight', lat: 38.6979, lng: -9.2068, cost: 12 },
    { day: 1, start: '12:20', end: '13:00', title: 'Pastéis de Belém', category: 'food', lat: 38.6975, lng: -9.2032, cost: 6 },
    { day: 1, start: '15:00', end: '17:00', title: 'LX Factory', category: 'activity', lat: 38.7036, lng: -9.1784, cost: 0 },
    { day: 1, start: '18:30', end: '19:30', title: 'Miradouro da Senhora do Monte', category: 'sight', lat: 38.7193, lng: -9.1327, cost: 0, outdoor: true },
    { day: 2, start: '10:00', end: '13:00', title: 'Pena Palace', category: 'sight', lat: 38.7876, lng: -9.3906, cost: 20, outdoor: true, fixedTime: true },
    { day: 2, start: '15:00', end: '16:30', title: 'Cabo da Roca', category: 'sight', lat: 38.7804, lng: -9.4989, cost: 0, outdoor: true },
    { day: 2, start: '21:00', end: '23:00', title: 'Clube de Fado', category: 'activity', lat: 38.7106, lng: -9.13, cost: 35 },
  ],
  chat: [
    { from: ME, text: 'Booked the flights! Landing Friday at 10:40.' },
    { from: marco, text: 'Perfect. Santa Luzia is best around 4pm when the light is soft, so I moved it after lunch.' },
    { from: ME, text: '@Hive we finish LX Factory around 5 on day 2. Somewhere for a drink with a view nearby?' },
  ],
  hive: {
    text: 'Park is a rooftop bar on top of a car park in Bairro Alto, 15 minutes from LX Factory by tram, with the whole river at sunset.',
    card: {
      name: 'Park Bar Lisboa',
      why: 'A garden rooftop with views of the 25 de Abril bridge. Sunset crowds are relaxed and drinks are fairly priced.',
      category: 'food',
      day: 1,
      lat: 38.7101,
      lng: -9.1477,
      rating: 4.3,
      ratingCount: 9800,
      mustTry: ['Gin tónico', 'Sunset from the west rail'],
      nearbyFood: ['Taberna da Rua das Flores', 'A Cevicheria'],
      thingsToDo: ['Miradouro de Santa Catarina', 'Bica funicular'],
      tips: ['Take the lift to the top floor of the car park', 'Arrive 30 minutes before sunset'],
      costPerPersonUsd: 12,
    },
  },
  requests: [
    {
      requester: marco,
      pitch: 'Ciao! I shoot street photography and Lisbon has been on my list for years. Happy to send everyone the photos after.',
      status: 'accepted',
      replies: [
        { from: 'system', text: WELCOME },
        { from: marco, text: 'Obrigado! I already have three sunset spots in mind.' },
      ],
    },
    {
      requester: maya,
      pitch: 'Hey! I am in Europe for a conference that week. I would love the food stops and the Sintra day, and I am super flexible.',
      status: 'pending',
      replies: [],
    },
  ],
}

const SAN_DIEGO: DemoTrip = {
  key: 'san-diego',
  title: 'San Diego sun & tacos',
  destination: 'San Diego, USA',
  lat: 32.7157,
  lng: -117.1611,
  startOffset: 30,
  days: 3,
  host: maya,
  members: [maya, ME, marco],
  listing: {
    description: 'A local’s San Diego: sea lions at La Jolla, kayaking the caves, fish tacos and Sunset Cliffs. One spot for a beach person.',
    vibes: ['Chill', 'Foodie', 'Nature'],
    openSpots: 1,
  },
  prefs: {
    [maya]: { dailyBudget: 120, pace: 'balanced', interests: 'ocean, wildlife, tacos', wakeTime: '06:30' },
    [ME]: BALANCED,
    [marco]: { dailyBudget: 130, pace: 'chill', interests: 'photography, sunsets', wakeTime: '08:00' },
  },
  stops: [
    { day: 0, start: '11:00', end: '13:00', title: 'Balboa Park', category: 'sight', lat: 32.7341, lng: -117.1446, cost: 0, outdoor: true },
    { day: 0, start: '13:30', end: '16:00', title: 'San Diego Zoo', category: 'activity', lat: 32.7353, lng: -117.149, cost: 76, fixedTime: true },
    { day: 0, start: '17:00', end: '18:30', title: 'Sunset Cliffs Natural Park', category: 'sight', lat: 32.7187, lng: -117.2556, cost: 0, outdoor: true, notes: 'Stay on the trail, the edges crumble.' },
    { day: 0, start: '19:15', end: '20:45', title: 'Liberty Public Market', category: 'food', lat: 32.7398, lng: -117.2107, cost: 20 },
    { day: 1, start: '08:00', end: '09:00', title: 'La Jolla Cove', category: 'sight', lat: 32.8504, lng: -117.2713, cost: 0, outdoor: true, notes: 'Sea lions on the rocks, keep 15 m away.' },
    { day: 1, start: '09:30', end: '11:30', title: 'La Jolla Sea Caves kayak', category: 'activity', lat: 32.851, lng: -117.269, cost: 55, outdoor: true, fixedTime: true },
    { day: 1, start: '12:00', end: '13:00', title: 'The Taco Stand La Jolla', category: 'food', lat: 32.8474, lng: -117.2735, cost: 12 },
    { day: 1, start: '15:00', end: '17:30', title: 'Torrey Pines State Natural Reserve', category: 'activity', lat: 32.9206, lng: -117.2524, cost: 0, outdoor: true },
    { day: 2, start: '09:30', end: '11:00', title: 'Old Town San Diego', category: 'sight', lat: 32.7549, lng: -117.1975, cost: 0 },
    { day: 2, start: '11:30', end: '13:30', title: 'USS Midway Museum', category: 'sight', lat: 32.7137, lng: -117.1751, cost: 34 },
    { day: 2, start: '16:00', end: '18:00', title: 'Coronado Beach', category: 'activity', lat: 32.6859, lng: -117.1831, cost: 0, outdoor: true },
    { day: 2, start: '19:30', end: '21:30', title: 'Gaslamp Quarter', category: 'food', lat: 32.7114, lng: -117.16, cost: 35 },
  ],
  chat: [
    { from: maya, text: 'Kayak slot is 9:30 on day 2. The water is calmest then and the caves are open at low tide.' },
    { from: marco, text: 'Bringing the waterproof camera. Sunset Cliffs on day 1 is perfect for the long lens.' },
    { from: ME, text: '@Hive best fish tacos near Pacific Beach for the last night?' },
  ],
  hive: {
    text: 'Oscar’s Mexican Seafood in Pacific Beach is the local favorite. It is a tiny walk-up, so go before 7 to beat the line.',
    card: {
      name: 'Oscar’s Mexican Seafood',
      why: 'Smoked fish and grilled shrimp tacos with a creamy chipotle sauce. Cheap, fast and right by the beach.',
      category: 'food',
      day: 2,
      lat: 32.8022,
      lng: -117.2552,
      rating: 4.7,
      ratingCount: 5400,
      mustTry: ['Smoked fish taco', 'Surf and turf taco', 'Ceviche tostada'],
      nearbyFood: ['Kono’s Cafe', 'Crystal Pier'],
      thingsToDo: ['Crystal Pier sunset', 'Pacific Beach boardwalk'],
      tips: ['Order at the window, eat on the bench', 'Cash and cards both fine'],
      costPerPersonUsd: 14,
    },
  },
  requests: [
    {
      requester: ME,
      pitch: 'Hi Maya! Kayaking the caves and fish tacos sound perfect. I am easygoing and happy to split car rental.',
      status: 'accepted',
      replies: [
        { from: 'system', text: WELCOME },
        { from: maya, text: 'So glad you are in! Bring a hoodie, the mornings are cold on the water.' },
      ],
    },
  ],
}

const BHUTAN: DemoTrip = {
  key: 'bhutan',
  title: 'Bhutan dzongs & Tiger’s Nest',
  destination: 'Paro, Bhutan',
  lat: 27.4305,
  lng: 89.4133,
  startOffset: 41,
  days: 4,
  host: tenzin,
  members: [tenzin, aiko],
  listing: {
    description: 'Four unhurried days from Paro to Punakha with a local: the Tiger’s Nest climb, Dochula Pass and the evening ceremony in Thimphu.',
    vibes: ['Culture', 'Adventure', 'Nature'],
    openSpots: 2,
  },
  prefs: {
    [tenzin]: { dailyBudget: 150, pace: 'chill', interests: 'monasteries, hiking, local food', wakeTime: '06:30' },
    [aiko]: { dailyBudget: 160, pace: 'balanced', interests: 'hiking, architecture', wakeTime: '06:00' },
  },
  stops: [
    { day: 0, start: '11:00', end: '12:00', title: 'Paro International Airport', category: 'transport', lat: 27.4032, lng: 89.4246, cost: 0 },
    { day: 0, start: '13:00', end: '14:30', title: 'Rinpung Dzong', category: 'sight', lat: 27.4287, lng: 89.4164, cost: 5 },
    { day: 0, start: '15:00', end: '16:00', title: 'Kyichu Lhakhang', category: 'sight', lat: 27.444, lng: 89.379, cost: 5 },
    { day: 0, start: '19:00', end: '20:30', title: 'Sonam Trophel Restaurant', category: 'food', lat: 27.4307, lng: 89.4155, cost: 12 },
    { day: 1, start: '07:00', end: '13:00', title: 'Tiger’s Nest Monastery', category: 'activity', lat: 27.4919, lng: 89.3632, cost: 15, outdoor: true, fixedTime: true, notes: 'Two to three hours up. Shoulders covered inside.' },
    { day: 1, start: '13:30', end: '14:30', title: 'Taktsang Cafeteria', category: 'food', lat: 27.4876, lng: 89.363, cost: 10 },
    { day: 2, start: '08:30', end: '09:30', title: 'Dochula Pass', category: 'sight', lat: 27.4894, lng: 89.75, cost: 0, outdoor: true },
    { day: 2, start: '11:30', end: '13:00', title: 'Punakha Dzong', category: 'sight', lat: 27.5823, lng: 89.8634, cost: 5 },
    { day: 2, start: '13:30', end: '14:15', title: 'Punakha Suspension Bridge', category: 'sight', lat: 27.5869, lng: 89.8631, cost: 0, outdoor: true },
    { day: 2, start: '15:30', end: '16:30', title: 'Chimi Lhakhang', category: 'sight', lat: 27.5536, lng: 89.8646, cost: 0, outdoor: true },
    { day: 3, start: '09:30', end: '10:30', title: 'Buddha Dordenma', category: 'sight', lat: 27.443, lng: 89.6447, cost: 0, outdoor: true },
    { day: 3, start: '11:00', end: '12:00', title: 'Centenary Farmers Market', category: 'food', lat: 27.4741, lng: 89.6377, cost: 5 },
    { day: 3, start: '17:00', end: '18:00', title: 'Tashichho Dzong', category: 'sight', lat: 27.4908, lng: 89.636, cost: 5, fixedTime: true, notes: 'Flag-lowering ceremony at 17:00.' },
  ],
  chat: [
    { from: tenzin, text: 'We start Tiger’s Nest at 7 so we are up before the tour buses. Ponies are there for the first half if anyone wants.' },
    { from: aiko, text: 'Walking all the way! Can we fit a hot stone bath one evening?' },
    { from: tenzin, text: '@Hive find us a farmhouse hot stone bath near Paro for the Tiger’s Nest evening.' },
  ],
  hive: {
    text: 'Gangtey Palace Hotel in Paro does a traditional dotsho hot stone bath. Book it for 18:00 after the hike, your legs will thank you.',
    card: {
      name: 'Gangtey Palace Hot Stone Bath',
      why: 'River stones are heated in a fire, then dropped into a wooden tub with artemisia leaves. Ideal after the big climb.',
      category: 'activity',
      day: 1,
      lat: 27.4335,
      lng: 89.4179,
      rating: 4.6,
      ratingCount: 820,
      mustTry: ['Dotsho stone bath', 'Butter tea after'],
      nearbyFood: ['Sonam Trophel Restaurant', 'Champaca Cafe'],
      thingsToDo: ['Paro town evening walk', 'Rinpung Dzong at night'],
      tips: ['Book a day ahead', 'Ask for a cooler tub if you overheat'],
      costPerPersonUsd: 30,
    },
  },
  requests: [
    {
      requester: ME,
      pitch: 'Hi Tenzin! Bhutan has been a dream for years. I hike regularly, travel light, and I would love a local to show us the dzongs.',
      status: 'pending',
      replies: [],
    },
  ],
}

const TOKYO: DemoTrip = {
  key: 'tokyo',
  title: 'Tokyo food crawl',
  destination: 'Tokyo, Japan',
  lat: 35.6762,
  lng: 139.6503,
  startOffset: 55,
  days: 3,
  host: aiko,
  members: [aiko, priya],
  listing: {
    description: 'A local-led eating tour: early fish market, standing sushi, tiny Golden Gai bars. I know the spots tourists miss.',
    vibes: ['Foodie', 'Nightlife', 'Culture'],
    openSpots: 2,
  },
  prefs: {
    [aiko]: { dailyBudget: 120, pace: 'packed', interests: 'ramen, izakaya, design', wakeTime: '07:00' },
    [priya]: { dailyBudget: 100, pace: 'balanced', interests: 'street food, markets', dietary: 'vegetarian', wakeTime: '07:00' },
  },
  stops: [
    { day: 0, start: '08:00', end: '10:00', title: 'Tsukiji Outer Market', category: 'food', lat: 35.6654, lng: 139.7707, cost: 25 },
    { day: 0, start: '11:00', end: '13:00', title: 'teamLab Planets', category: 'activity', lat: 35.6491, lng: 139.7898, cost: 28, fixedTime: true },
    { day: 0, start: '18:00', end: '19:00', title: 'Fuunji Ramen', category: 'food', lat: 35.6869, lng: 139.6965, cost: 9 },
    { day: 0, start: '19:30', end: '21:00', title: 'Omoide Yokocho', category: 'food', lat: 35.693, lng: 139.6995, cost: 20 },
    { day: 1, start: '09:00', end: '10:00', title: 'Meiji Jingu', category: 'sight', lat: 35.6764, lng: 139.6993, cost: 0, outdoor: true },
    { day: 1, start: '10:30', end: '12:00', title: 'Takeshita Street', category: 'sight', lat: 35.6716, lng: 139.7031, cost: 10 },
    { day: 1, start: '17:00', end: '18:30', title: 'Shibuya Sky', category: 'sight', lat: 35.6585, lng: 139.7024, cost: 15, fixedTime: true },
    { day: 1, start: '19:00', end: '20:00', title: 'Uogashi Nihon-Ichi', category: 'food', lat: 35.6595, lng: 139.6988, cost: 20 },
    { day: 2, start: '09:00', end: '10:30', title: 'Senso-ji', category: 'sight', lat: 35.7148, lng: 139.7967, cost: 0 },
    { day: 2, start: '10:30', end: '11:30', title: 'Nakamise Shopping Street', category: 'food', lat: 35.7119, lng: 139.7965, cost: 10 },
    { day: 2, start: '13:00', end: '14:30', title: 'Isetan Shinjuku Depachika', category: 'food', lat: 35.6918, lng: 139.7046, cost: 15 },
    { day: 2, start: '21:00', end: '23:00', title: 'Golden Gai', category: 'food', lat: 35.694, lng: 139.7046, cost: 25 },
  ],
  chat: [
    { from: aiko, text: 'Fuunji line is shorter right at 6pm. I put it before Omoide Yokocho.' },
    { from: priya, text: 'Love it. I will need a vegetarian ramen somewhere though!' },
    { from: priya, text: '@Hive vegetarian ramen near Shinjuku for day 1?' },
  ],
  hive: {
    text: 'T’s Tantan inside Tokyo Station is fully vegan and the sesame tantanmen is excellent. It is 15 minutes from Shinjuku on the Chuo line.',
    card: {
      name: 'T’s Tantan',
      why: 'A 100% vegan ramen counter inside Tokyo Station, known for creamy sesame tantanmen and gyoza.',
      category: 'food',
      day: 0,
      lat: 35.6812,
      lng: 139.7671,
      rating: 4.4,
      ratingCount: 4200,
      mustTry: ['Golden sesame tantanmen', 'Vegan gyoza'],
      nearbyFood: ['Tokyo Ramen Street', 'Gransta food hall'],
      thingsToDo: ['Imperial Palace East Gardens', 'Marunouchi lights'],
      tips: ['Inside the ticket gates, Keiyo street side', 'Lunch line is shortest at 11:00'],
      costPerPersonUsd: 10,
    },
  },
  requests: [
    {
      requester: lukas,
      pitch: 'Konnichiwa! I am in Tokyo on those dates and I eat anything, very adventurous. Happy to split taxis home from Golden Gai.',
      status: 'pending',
      replies: [],
    },
  ],
}

export const DEMO_TRIPS: DemoTrip[] = [MEGHALAYA, LISBON, SAN_DIEGO, BHUTAN, TOKYO]
