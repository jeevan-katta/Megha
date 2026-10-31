'use client';
import { useState } from 'react';
export function AdminImageField({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError('Choose an image smaller than 4 MB.');
      return;
    }
    const body = new FormData();
    body.append('image', file);
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/media', {
        method: 'POST',
        body,
        credentials: 'include',
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'Upload failed.');
      setValue(result.data.url);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-image-field">
      <label>
        Image path or HTTPS URL *
        <input
          name="image"
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <label>
        Upload product image (PNG, JPEG, WebP)
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(event) => void upload(event.target.files?.[0])}
        />
      </label>
      {busy && <p role="status">Uploading image…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {value && (
        <img
          src={value}
          alt="Product preview"
          width={110}
          height={110}
          style={{ objectFit: 'contain' }}
        />
      )}
    </div>
  );
}
