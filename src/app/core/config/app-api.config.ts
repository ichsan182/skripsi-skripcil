export const USERS_API_URL = 'http://localhost:3000/users';

export const MARKET_DATA_API = {
  twelvedata: {
    baseUrl: '/twelvedata',
    apiKey: '841550e787a3463d8d0103ae144e6573',
  },
  fred: {
    baseUrl: '/fred/fred',
    apiKey: '50a0b45bb3a983d28871cbc1b6596ea3',
  },
  newsApi: {
    baseUrl: '/newsapi/v2',
    apiKey: '9c8f914b3e8d4b32a4b6a00bd0247c99',
  },
} as const;

export const RAPIDAPI_PROXY_BASE_URL = '/rapidapi';
