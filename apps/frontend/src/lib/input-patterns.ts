// HTML `pattern` attributes are compiled with the regex `v` flag, so brackets and hyphens inside a
// character class must be escaped. The API validates the same rules with the same messages.
export const phoneInput = {
  type: 'tel',
  // 10-digit Indian mobile starting 6–9, optionally with +91, 91 or 0 and a space or dash.
  pattern: '(\\+91[\\- ]?|91[\\- ]?|0)?[6-9][0-9]{4}[\\- ]?[0-9]{5}',
  title: 'Enter a valid 10-digit mobile number, for example 98765 43210.',
  autoComplete: 'tel',
  inputMode: 'tel',
  maxLength: 16,
} as const;
export const emailInput = {
  type: 'email',
  pattern:
    '[^\\s@]+@[A-Za-z0-9]([A-Za-z0-9\\-]*[A-Za-z0-9])?(\\.[A-Za-z0-9]([A-Za-z0-9\\-]*[A-Za-z0-9])?)*\\.[A-Za-z]{2,}',
  title: 'Enter a valid email address, for example name@company.com.',
  autoComplete: 'email',
  maxLength: 254,
} as const;
export const cityInput = {
  pattern: "[A-Za-z][A-Za-z .'\\(\\)\\-]{1,79}",
  title: 'Enter a valid city name (letters only).',
  autoComplete: 'address-level2',
  maxLength: 80,
} as const;
export const gstinInput = {
  pattern: '[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z][Zz][0-9A-Za-z]',
  title: 'Enter a valid 15-character GSTIN, or leave it blank.',
  maxLength: 15,
} as const;
export const pincodeInput = {
  pattern: '[1-9][0-9]{5}',
  title: 'Enter a 6-digit PIN code.',
  inputMode: 'numeric',
  autoComplete: 'postal-code',
  maxLength: 6,
} as const;
