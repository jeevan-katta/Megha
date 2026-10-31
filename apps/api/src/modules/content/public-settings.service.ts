import { Entity } from '../records/record.model';
export async function publicSettings() {
  const [records, banner] = await Promise.all([
    Entity.find({ kind: 'settings', status: 'ACTIVE' }).select('data').lean(),
    Entity.findOne({ kind: 'content', status: 'PUBLISHED', 'data.section': 'banner' })
      .sort({ updatedAt: -1 })
      .select('description')
      .lean(),
  ]);
  const settings: Record<string, string> = {};
  for (const record of records)
    if (
      ['support_phone', 'support_email', 'business_address', 'announcement'].includes(
        record.data?.key,
      ) &&
      typeof record.data?.value === 'string'
    )
      settings[record.data.key] = record.data.value;
  if (!settings.announcement && banner?.description) settings.announcement = banner.description;
  return settings;
}
