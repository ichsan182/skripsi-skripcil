export const USERS_API_URL = 'http://localhost:3000/users';

export const MARKET_DATA_API = {
  yahooFinance: {
    baseUrl: '/rapidapi',
    endpoints: {
      history: '/api/v1/markets/stock/history',
      quotes: '/api/v1/markets/stock/quotes',
    },
  },
  twelvedata: {
    baseUrl: '/twelvedata',
    apiKey: '841550e787a3463d8d0103ae144e6573',
    endpoints: {
      symbolSearch: '/symbol_search',
      timeSeries: '/time_series',
      profile: '/profile',
      indicators: {
        rsi: '/rsi',
        sma: '/sma',
      },
    },
  },
  fred: {
    baseUrl: '/fred/fred',
    apiKey: '50a0b45bb3a983d28871cbc1b6596ea3',
    endpoints: {
      seriesObservations: '/series/observations',
    },
  },
  newsApi: {
    baseUrl: '/newsapi/v2',
    apiKey: '9c8f914b3e8d4b32a4b6a00bd0247c99',
    endpoints: {
      everything: '/everything',
    },
  },
} as const;

export const RAPIDAPI_PROXY_BASE_URL = MARKET_DATA_API.yahooFinance.baseUrl;
