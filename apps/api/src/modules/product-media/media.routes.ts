import { objectId } from '@megha/validation';
import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { storage } from '../../integrations/storage';
import { actor } from '../../middleware/authenticate.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { DomainError } from '../../shared/errors/domain-error';
import { audit } from '../audit/audit.service';
import { Upload } from './upload.model';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 0 },
});
function imageMime(buffer: Buffer): string | null {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP')
    return 'image/webp';
  return null;
}
export const mediaRoutes = Router();
mediaRoutes.post('/', authorize('products'), upload.single('image'), async (req, res) => {
  const file = req.file;
  const mime = file ? imageMime(file.buffer) : null;
  if (!file || !mime || mime !== file.mimetype)
    throw new DomainError('INVALID_IMAGE', 'Upload a PNG, JPEG or WebP image, up to 4 MB.');
  const key = randomUUID();
  await storage.put(key, file.buffer, mime);
  const record = await Upload.create({
    ownerId: actor(res)._id,
    key,
    name: file.originalname.slice(0, 200),
    size: file.size,
    mime,
    public: true,
  });
  await audit(actor(res)._id, 'UPLOAD', 'product-media', String(record._id));
  res.status(201).json({ data: { url: '/api/v1/media/' + record._id } });
});
mediaRoutes.get('/:id', async (req, res) => {
  const record = await Upload.findOne({ _id: objectId.parse(req.params.id), public: true });
  if (!record?.key || !record.mime) throw new DomainError('NOT_FOUND', 'Image not found.', 404);
  res
    .type(record.mime)
    .set('Cache-Control', 'public, max-age=86400')
    .send(await storage.get(record.key));
});
