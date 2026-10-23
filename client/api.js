const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api")
  .trim()
  .replace(/\/+$/, "");

export async function apiRequest(
  path,
  { method = "GET", body, token, signal, query } = {},
) {
  const cleanPath = path.replace(/^\/+/, "");
  const url = new URL(`${API_URL}/${cleanPath}`);

  // Add search, filters, sorting and pagination to the URL.
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  let response;

  try {
    response = await fetch(url.toString(), {
      method,
      signal,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),

        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },

      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Cannot reach the server. Make sure the backend is running.",
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      data?.message || "The request failed. Please try again.",
    );

    error.status = response.status;

    throw error;
  }

  if (data === null) {
    throw new Error("The server returned an invalid response.");
  }

  return data;
}
