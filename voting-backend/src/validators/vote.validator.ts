import { z } from 'zod';

const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export const createVoteSchema = z.object({
  collegeId: z
    .string({ required_error: 'معرّف الكلية مطلوب' })
    .uuid({ message: 'معرّف الكلية يجب أن يكون UUID صالح' }),
  durationDays: z
    .number({ required_error: 'مدة التصويت مطلوبة' })
    .int({ message: 'مدة التصويت يجب أن تكون رقماً صحيحاً بالأيام' })
    .min(3, { message: 'الحد الأدنى لمدة التصويت هو 3 أيام' })
    .max(7, { message: 'الحد الأقصى لمدة التصويت هو 7 أيام' }),
  colors: z
    .array(
      z.object({
        colorHex: z
          .string()
          .regex(hexColorRegex, { message: 'كود اللون يجب أن يكون بصيغة Hex صحيحة (مثال: #132247)' }),
        label: z.string().max(100, { message: 'اسم اللون لا يتجاوز 100 حرف' }).optional(),
      })
    )
    .min(2, { message: 'يجب إضافة لونين على الأقل للتصويت' })
    .max(10, { message: 'الحد الأقصى لخيارات الألوان هو 10 ألوان' }),
});

export const submitChoiceSchema = z.object({
  selectedColorId: z
    .string({ required_error: 'معرّف اللون المختار مطلوب' })
    .uuid({ message: 'معرّف اللون يجب أن يكون UUID صالح' }),
});
