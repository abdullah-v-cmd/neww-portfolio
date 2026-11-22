export async function parseJsonSafe<T = any>(res: Response): Promise<T> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const raw = await res.text();
  const trimmed = raw.trim();

  if (!trimmed) {
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status} with an empty response.`);
    }
    return {} as T;
  }

  const looksHtml =
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<HTML') ||
    (trimmed.startsWith('<') && contentType.includes('text/html'));

  if (looksHtml) {
    throw new Error(
      `API endpoint returned HTML instead of JSON (HTTP ${res.status}). Please refresh or check backend route availability.`
    );
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      res.ok
        ? 'Server returned a malformed non-JSON response.'
        : `Request failed (HTTP ${res.status}): ${trimmed.slice(0, 140)}`
    );
  }
}
