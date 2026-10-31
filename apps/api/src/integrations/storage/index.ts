import { config } from '../../config';
import { DomainError } from '../../shared/errors/domain-error';
import { LocalStorageProvider } from './local-storage.adapter';
import { S3StorageProvider } from './s3-storage.adapter';
import { StorageProvider } from './storage.interface';
class DisabledStorage implements StorageProvider {
  async put(): Promise<void> {
    throw new DomainError('STORAGE_DISABLED', 'File storage is not configured.', 503);
  }
  async get(): Promise<Buffer> {
    throw new DomainError('STORAGE_DISABLED', 'File storage is not configured.', 503);
  }
  async remove(): Promise<void> {
    throw new DomainError('STORAGE_DISABLED', 'File storage is not configured.', 503);
  }
}

export const storage: StorageProvider =
  config.storage === 's3'
    ? new S3StorageProvider()
    : config.storage === 'local'
      ? new LocalStorageProvider()
      : new DisabledStorage();
