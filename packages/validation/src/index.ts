import { indianStates } from '@megha/constants';
import { z } from 'zod';
export * from './admin';
export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid record identifier');
/** Shared fields with messages written for customers; they are shown as they are. */
export const phoneMessage = 'Enter a valid 10-digit mobile number, for example 98765 43210.';
/**
 * Indian mobile numbers: 10 digits starting 6–9, optionally written with +91, 91 or 0 in front
 * and spaces or dashes. Stored as the plain 10 digits couriers and SMS gateways expect.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, '').replace(/^(?:\+?91|0)(?=\d{10}$)/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, phoneMessage));
export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9][0-9]{5}$/, 'Enter a 6-digit PIN code.');
export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
    'Enter a valid 15-character GSTIN, or leave it blank.',
  );
export const personNameSchema = z
  .string()
  .trim()
  .min(2, 'Enter your full name.')
  .max(100, 'Name is too long.');
export const emailMessage = 'Enter a valid email address, for example name@company.com.';
/** Stricter than a bare "@": needs a domain with a dot and a 2+ letter ending, no spaces. */
export const emailSchema = z
  .string()
  .trim()
  .max(254, emailMessage)
  .email(emailMessage)
  .regex(
    /^[^\s@]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/,
    emailMessage,
  );
export const cartItemSchema = z
  .object({ productId: objectId, quantity: z.number().int().min(1).max(100) })
  .strict();
export const cartSchema = z.array(cartItemSchema).min(1).max(100);
export const storedCartSchema = z.array(cartItemSchema).max(100);
export const addressSchema = z.object({
  line1: z
    .string()
    .trim()
    .min(5, 'Enter the full address (at least 5 characters).')
    .max(250)
    .regex(/[A-Za-z]/, 'Enter the full address, including the street or area name.'),
  line2: z.string().trim().max(250).optional(),
  city: z
    .string()
    .trim()
    .regex(/^[A-Za-z][A-Za-z .'()-]{1,79}$/, 'Enter a valid city name (letters only).'),
  state: z.enum(indianStates, { errorMap: () => ({ message: 'Choose a state.' }) }),
  pincode: pincodeSchema,
});
export const checkoutSchema = z
  .object({
    items: cartSchema,
    customer: z.object({
      name: personNameSchema,
      email: emailSchema,
      phone: phoneSchema,
      company: z.string().max(150).optional(),
      gstin: gstinSchema.optional(),
    }),
    address: addressSchema,
    billingAddress: addressSchema.optional(),
    shippingService: z.enum(['standard', 'express']).default('standard'),
    /** The total the customer saw, in paise; the order is refused if prices changed since. */
    expectedTotal: z.number().int().nonnegative().optional(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export type CheckoutInput = z.infer<typeof checkoutSchema>;
/** Cart quote; with a PIN code the total includes the chosen delivery option. */
export const quoteSchema = z
  .object({
    items: cartSchema,
    pincode: pincodeSchema.optional(),
    shippingService: z.enum(['standard', 'express']).default('standard'),
  })
  .strict();
export const shippingRateSchema = z.object({ pincode: pincodeSchema, items: cartSchema }).strict();
export const returnReasons = [
  'DAMAGED',
  'WRONG_ITEM',
  'NOT_COMPATIBLE',
  'DEFECTIVE',
  'NO_LONGER_NEEDED',
  'OTHER',
] as const;
export const returnRequestSchema = z
  .object({
    items: z
      .array(z.object({ productId: z.string().min(1).max(64), quantity: z.number().int().min(1) }))
      .min(1)
      .max(100),
    reason: z.enum(returnReasons),
    comments: z.string().trim().max(2000).default(''),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export const loginSchema = z.object({
  email: emailSchema.transform((s) => s.toLowerCase()),
  password: z
    .string()
    .min(10, 'Use at least 10 characters for your password.')
    .max(128, 'Password is too long.'),
});
export const registerSchema = loginSchema.extend({ name: personNameSchema });
export const forgotPasswordSchema = z.object({
  email: emailSchema.transform((s) => s.toLowerCase()),
});
export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'This reset link is not valid. Request a new one.'),
  password: loginSchema.shape.password,
});
export const profileSchema = z
  .object({
    name: personNameSchema,
    phone: z.union([z.literal(''), phoneSchema]).optional(),
    company: z.string().max(150).optional(),
    gstin: gstinSchema.optional(),
  })
  .strict();
export const requestSchema = z
  .object({
    title: z.string().trim().min(2, 'Enter a subject.').max(200),
    name: personNameSchema,
    email: emailSchema,
    phone: phoneSchema,
    description: z
      .string()
      .trim()
      .min(5, 'Describe your requirement in a few words.')
      .max(5000, 'Please keep the description under 5000 characters.'),
    data: z
      .object({
        company: z.string().max(150).nullable().optional(),
        machine: z.string().max(150).nullable().optional(),
        partNumber: z.string().max(100).nullable().optional(),
        quantity: z.number().int().min(1).max(10000).optional(),
        location: z.string().max(250).nullable().optional(),
      })
      .strict()
      .default({}),
  })
  .strict();
export type RequestInput = z.infer<typeof requestSchema>;
