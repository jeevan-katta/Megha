import { indianStates } from '@megha/constants';
import { Schema } from 'mongoose';
import { config } from '../../config';
import { defineModel } from '../../database/model';
import { DomainError } from '../../shared/errors/domain-error';

/** PIN codes rarely change, so each lookup is kept; India Post is only asked once per PIN. */
const Pincode = defineModel(
  'Pincode',
  new Schema(
    {
      pincode: { type: String, required: true, unique: true },
      found: { type: Boolean, required: true },
      city: String,
      state: String,
      places: [String],
    },
    { timestamps: true },
  ),
);
export interface PincodeDetails {
  pincode: string;
  city: string;
  state: string | null;
  places: string[];
}
const memory = new Map<string, PincodeDetails | null>();
const normalState = (name = '') =>
  indianStates.find((state) => state.toLowerCase() === name.trim().toLowerCase()) ??
  (/delhi/i.test(name) ? 'Delhi' : /dadra|daman/i.test(name) ? indianStates[7] : null);

/**
 * City and state for an Indian PIN code. Returns `null` when the PIN code does not exist and
 * `undefined` when it could not be checked (service down or disabled), so callers never block a
 * customer because a lookup failed.
 */
export async function lookupPincode(pincode: string): Promise<PincodeDetails | null | undefined> {
  if (memory.has(pincode)) return memory.get(pincode);
  const cached = await Pincode.findOne({ pincode }).lean();
  if (cached) {
    const details = cached.found
      ? {
          pincode,
          city: cached.city ?? '',
          state: cached.state ?? null,
          places: cached.places ?? [],
        }
      : null;
    memory.set(pincode, details);
    return details;
  }
  if (config.pincodeLookup === 'disabled') return undefined;
  try {
    const response = await fetch('https://api.postalpincode.in/pincode/' + pincode, {
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return undefined;
    const [result] = (await response.json()) as {
      Status: string;
      PostOffice: { Name: string; District: string; State: string }[] | null;
    }[];
    if (result?.Status === 'Error' || !result?.PostOffice?.length) {
      await Pincode.updateOne({ pincode }, { $set: { found: false } }, { upsert: true });
      memory.set(pincode, null);
      return null;
    }
    if (result.Status !== 'Success') return undefined;
    const offices = result.PostOffice;
    const details: PincodeDetails = {
      pincode,
      city: offices[0].District,
      state: normalState(offices[0].State),
      places: [...new Set(offices.map((office) => office.Name))].slice(0, 20),
    };
    await Pincode.updateOne(
      { pincode },
      { $set: { found: true, city: details.city, state: details.state, places: details.places } },
      { upsert: true },
    );
    memory.set(pincode, details);
    return details;
  } catch {
    return undefined;
  }
}

/** Refuses an address whose PIN code does not exist or belongs to another state. */
export async function checkAddressPincode(address: { pincode: string; state: string }, label = '') {
  const details = await lookupPincode(address.pincode);
  if (details === null)
    throw new DomainError(
      'PINCODE_NOT_FOUND',
      `We couldn't find PIN code ${address.pincode}${label}. Please check it.`,
      400,
    );
  if (details?.state && details.state !== address.state)
    throw new DomainError(
      'PINCODE_STATE_MISMATCH',
      `PIN code ${address.pincode} is in ${details.state}${label}. Please check the state or PIN code.`,
      400,
    );
}
export { Pincode };
