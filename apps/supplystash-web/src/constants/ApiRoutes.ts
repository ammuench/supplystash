const baseApiUrl = import.meta.env.VITE_API_BASE;

export const API_ROUTES = {
  items: {
    create: `${baseApiUrl}/items`,
    update: (itemId: string) => `${baseApiUrl}/items/${itemId}`,
    delete: (itemId: string) => `${baseApiUrl}/items/${itemId}`,
  },
  homes: {
    create: `${baseApiUrl}/homes`,
    update: (homeId: string) => `${baseApiUrl}/homes/${homeId}`,
    delete: (homeId: string) => `${baseApiUrl}/homes/${homeId}`,
  },
} as const;
