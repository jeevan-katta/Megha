'use client';

import { api, ApiError } from '@/lib/api-client';
import { cityInput, pincodeInput } from '@/lib/input-patterns';
import { indianStates } from '@megha/constants';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const pincodePattern = /^[1-9][0-9]{5}$/;
const cityPattern = new RegExp('^(?:' + cityInput.pattern + ')$');
const OTHER = '__other__';
interface PincodeDetails {
  city: string;
  state: string | null;
  places: string[];
}
type Lookup =
  | { status: 'idle' | 'loading' | 'unavailable' }
  | { status: 'found'; details: PincodeDetails }
  | { status: 'missing' };

/**
 * Address fields with PIN code lookup: a valid PIN fills in the city and state, a PIN that does
 * not exist (or a state that does not match it) blocks the form with a clear message, and if the
 * lookup service is unavailable the customer simply types city and state.
 */
export function AddressFields({
  prefix,
  onPincode,
}: {
  prefix: string;
  onPincode?: (value: string) => void;
}) {
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [lookup, setLookup] = useState<Lookup>({ status: 'idle' });
  // With a found PIN code the city is picked from its areas, or typed after choosing "Other".
  const [typedCity, setTypedCity] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLSelectElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!pincodePattern.test(pincode)) {
      setLookup({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    setLookup({ status: 'loading' });
    api<PincodeDetails>('/checkout/pincode/' + pincode, undefined, 'GET', controller.signal)
      .then((details) => {
        setLookup({ status: 'found', details });
        setTypedCity(false);
        setCity(details.city);
        if (details.state) setState(details.state);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setLookup({
          status: error instanceof ApiError && error.status === 404 ? 'missing' : 'unavailable',
        });
      });
    return () => controller.abort();
  }, [pincode]);
  const expectedState = lookup.status === 'found' ? lookup.details.state : null;
  const stateMismatch = !!expectedState && !!state && state !== expectedState;
  // Browser validation carries the lookup result, so the form cannot be submitted with a PIN
  // code that does not exist or a state that does not match it.
  useEffect(() => {
    pinRef.current?.setCustomValidity(
      lookup.status === 'missing' ? "We couldn't find this PIN code. Please check it." : '',
    );
    stateRef.current?.setCustomValidity(
      stateMismatch ? `PIN code ${pincode} is in ${expectedState}.` : '',
    );
  }, [lookup.status, stateMismatch, pincode, expectedState]);
  // The district first, then local post office areas; only names the city rule accepts.
  const cityOptions =
    lookup.status === 'found'
      ? [...new Set([lookup.details.city, ...lookup.details.places])].filter((place) =>
          cityPattern.test(place),
        )
      : [];
  return (
    <>
      <label>
        Address
        <input
          name={prefix + 'line1'}
          required
          minLength={5}
          maxLength={250}
          autoComplete="address-line1"
          placeholder="Building, street and area"
        />
      </label>
      <label>
        Address line 2 (optional)
        <input
          name={prefix + 'line2'}
          maxLength={250}
          autoComplete="address-line2"
          placeholder="Landmark"
        />
      </label>
      <label>
        PIN code
        <input
          ref={pinRef}
          name={prefix + 'pincode'}
          required
          {...pincodeInput}
          value={pincode}
          onChange={(event) => {
            const value = event.target.value.replace(/\D/g, '').slice(0, 6);
            setPincode(value);
            onPincode?.(value);
          }}
          aria-describedby={prefix + 'pincode-status'}
        />
        <small id={prefix + 'pincode-status'} className={'pincode-status ' + lookup.status}>
          {lookup.status === 'loading' && (
            <>
              <LoaderCircle size={13} className="spin" /> Finding your area…
            </>
          )}
          {lookup.status === 'found' && (
            <>
              <CheckCircle2 size={13} /> {lookup.details.city}
              {lookup.details.state ? ', ' + lookup.details.state : ''}
            </>
          )}
          {lookup.status === 'missing' && "We couldn't find this PIN code. Please check it."}
          {lookup.status === 'unavailable' && 'Please enter your city and state.'}
        </small>
      </label>
      <label>
        City / area
        {cityOptions.length > 0 && !typedCity ? (
          <select
            name={prefix + 'city'}
            required
            autoComplete="address-level2"
            value={city}
            onChange={(event) => {
              if (event.target.value === OTHER) {
                setTypedCity(true);
                setCity('');
                // Focus the text box once it replaces the list.
                setTimeout(() => cityRef.current?.focus(), 0);
              } else setCity(event.target.value);
            }}
          >
            {cityOptions.map((place) => (
              <option key={place} value={place}>
                {place}
              </option>
            ))}
            <option value={OTHER}>Other (type it)</option>
          </select>
        ) : (
          <input
            ref={cityRef}
            name={prefix + 'city'}
            required
            {...cityInput}
            placeholder="Your city or town"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
        )}
        {cityOptions.length > 0 && typedCity && (
          <button
            type="button"
            className="text-button city-list-button"
            onClick={() => {
              setTypedCity(false);
              setCity(cityOptions[0]);
            }}
          >
            Choose from the list
          </button>
        )}
      </label>
      <label>
        State
        <select
          ref={stateRef}
          name={prefix + 'state'}
          required
          autoComplete="address-level1"
          value={state}
          onChange={(event) => setState(event.target.value)}
        >
          <option value="" disabled>
            Choose a state
          </option>
          {indianStates.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        {stateMismatch && (
          <small className="pincode-status missing" role="alert">
            PIN code {pincode} is in {expectedState}.
          </small>
        )}
      </label>
    </>
  );
}
