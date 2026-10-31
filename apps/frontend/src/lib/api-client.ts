import { notifyMutation } from './query-cache';
interface ApiFailure {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    fieldErrors?: { field: string; message: string }[];
  };
}
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = 'REQUEST_FAILED',
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
const fieldLabels: Record<string, string> = {
  line1: 'Address',
  line2: 'Address line 2',
  pincode: 'PIN code',
  gstin: 'GSTIN',
  phone: 'Phone',
  email: 'Email',
  name: 'Name',
  quantity: 'Quantity',
  description: 'Description',
};
/** Schema messages are written for people; generic library ones get the field's name. */
function readable({ field, message }: { field: string; message: string }) {
  if (!/^(Required|Invalid|String must|Number must|Expected|Array must)/.test(message))
    return message;
  const key = field.split('.').at(-1) ?? '';
  const label =
    fieldLabels[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'This field');
  if (message === 'Required') return label + ' is required.';
  if (message.startsWith('Invalid')) return label + ' is not valid.';
  return label + ': ' + message.charAt(0).toLowerCase() + message.slice(1) + '.';
}
export async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/v1' + path, {
      method: method || (body ? 'POST' : 'GET'),
      credentials: 'include',
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
    });
  } catch (error) {
    // A caller's own cancellation is passed through so it can be ignored.
    if (signal?.aborted) throw error;
    if ((error as Error).name === 'TimeoutError')
      throw new ApiError('The request took too long. Please try again.', 0, 'TIMEOUT');
    throw new ApiError(
      "Can't reach the server. Check your connection and try again.",
      0,
      'NETWORK_ERROR',
    );
  }
  let result: { data: T } & ApiFailure;
  try {
    result = await response.json();
  } catch {
    // A non-JSON 5xx comes from the /api proxy itself, which means the backend isn't answering.
    if (response.status >= 500)
      throw new ApiError(
        'The server is unavailable right now. Please try again shortly.',
        response.status,
        'SERVICE_UNAVAILABLE',
      );
    throw new ApiError(
      'The service returned an unexpected response. Please retry.',
      response.status,
    );
  }
  if (!response.ok) {
    const detail = result.error;
    const fields = [...new Set(detail?.fieldErrors?.map(readable))].join(' ');
    throw new ApiError(
      fields || detail?.message || 'Unable to complete your request.',
      response.status,
      detail?.code,
      detail?.requestId,
    );
  }
  if ((method || (body ? 'POST' : 'GET')) !== 'GET') notifyMutation(path);
  return result.data;
}
