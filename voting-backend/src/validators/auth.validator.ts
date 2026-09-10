import { z } from 'zod';

// Iraqi and international phone number regex (supports +9647XXXXXXXXX, 07XXXXXXXXX, etc.)
const phoneRegex = /^(\+?964|0)?7[3-9]\d{8}$/;

export const requestOtpSchema = z.object({
  phoneNumber: z
    .string({ required_error: 'رقم الهاتف مطلوب' })
    .trim()
    .refine((val) => phoneRegex.test(val.replace(/\s+/g, '')), {
      message: 'رقم الهاتف غير صالح. يرجى إدخال رقم هاتف عراقي صحيح (مثال: 07805088134 أو +9647805088134)',
    }),
});

export const verifyOtpSchema = z.object({
  phoneNumber: z
    .string({ required_error: 'رقم الهاتف مطلوب' })
    .trim()
    .refine((val) => phoneRegex.test(val.replace(/\s+/g, '')), {
      message: 'رقم الهاتف غير صالح',
    }),
  code: z
    .string({ required_error: 'رمز التحقق مطلوب' })
    .trim()
    .length(6, { message: 'رمز التحقق يجب أن يتكون من 6 أرقام' })
    .regex(/^\d{6}$/, { message: 'رمز التحقق يجب أن يحتوي على أرقام فقط' }),
});
