// Static IATA → coordinate map for all airports used in NexusRecover scenarios
export const AIRPORT_COORDS = {
  // Toronto-area (hub + alternates)
  YYZ: { lat: 43.6777, lng: -79.6248, name: 'Toronto Pearson' },
  YTZ: { lat: 43.6275, lng: -79.3962, name: 'Billy Bishop' },
  YHM: { lat: 43.1736, lng: -79.9350, name: 'John C. Munro Hamilton' },

  // Canadian origins
  YUL: { lat: 45.4706, lng: -73.7408, name: 'Montréal-Trudeau' },
  YOW: { lat: 45.3225, lng: -75.6692, name: 'Ottawa Macdonald-Cartier' },
  YVR: { lat: 49.1967, lng: -123.1815, name: 'Vancouver Intl' },
  YYC: { lat: 51.1215, lng: -114.0076, name: 'Calgary Intl' },
  YEG: { lat: 53.3097, lng: -113.5800, name: 'Edmonton Intl' },

  // US origins
  JFK: { lat: 40.6413, lng: -73.7781, name: 'New York JFK' },
  EWR: { lat: 40.6895, lng: -74.1745, name: 'Newark Liberty' },
  BOS: { lat: 42.3656, lng: -71.0096, name: 'Boston Logan' },
  ORD: { lat: 41.9742, lng: -87.9073, name: "Chicago O'Hare" },
  MDW: { lat: 41.7868, lng: -87.7522, name: 'Chicago Midway' },
  DFW: { lat: 32.8998, lng: -97.0403, name: 'Dallas/Fort Worth' },
  MIA: { lat: 25.7959, lng: -80.2870, name: 'Miami Intl' },
  LAX: { lat: 33.9425, lng: -118.4081, name: 'Los Angeles Intl' },
  SFO: { lat: 37.6213, lng: -122.3790, name: 'San Francisco Intl' },
  SEA: { lat: 47.4502, lng: -122.3088, name: 'Seattle-Tacoma' },
  ATL: { lat: 33.6407, lng: -84.4277, name: 'Atlanta Hartsfield' },
  DEN: { lat: 39.8561, lng: -104.6737, name: 'Denver Intl' },
  PHX: { lat: 33.4373, lng: -112.0078, name: 'Phoenix Sky Harbor' },
  LGA: { lat: 40.7769, lng: -73.8740, name: 'New York LaGuardia' },
  IAD: { lat: 38.9531, lng: -77.4565, name: 'Washington Dulles' },
  DCA: { lat: 38.8521, lng: -77.0377, name: 'Reagan National' },
}
