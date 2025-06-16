import { supabase } from "./supabase";

export const authorizedFetch = async <T>(
  url: string,
  options: RequestInit = {
    method: "get",
  }
): Promise<T> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers || {});

  // Add access token when we have it
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  // Normalize method to uppercase so it matches the server’s CORS allowMethods
  const method = (options.method ?? "GET").toString().toUpperCase();
  const fetchOptions: RequestInit = {
    ...options,
    method,
    headers,
  };

  // Perform the fetch request
  const response = await fetch(url as string, fetchOptions);

  if (!response.ok) {
    throw new Error(`Fetch error: ${response.status} ${response.statusText}`);
  }

  // Parse and return the JSON response typed as T
  const data: T = await response.json();
  return data;
};
