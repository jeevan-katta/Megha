import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config';
import { DomainError } from '../../shared/errors/domain-error';
import { StorageProvider } from './storage.interface';

export class LocalStorageProvider implements StorageProvider {
  private file(key: string) {
    if (config.production)
      throw new DomainError('STORAGE_DISABLED', 'Local storage is development-only.', 503);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,199}$/.test(key) || key.includes('..'))
      throw new DomainError('INVALID_FILE', 'Invalid file.');
    return path.join(config.uploads, key);
  }
  async put(key: string, body: Buffer) {
    const file = this.file(key);
    await fs.mkdir(config.uploads, { recursive: true });
    await fs.writeFile(file, body);
  }
  async get(key: string) {
    return fs.readFile(this.file(key));
  }
  async remove(key: string) {
    await fs.unlink(this.file(key));
  }
}
