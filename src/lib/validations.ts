import { z } from 'zod';

// Child form validation
export const addChildSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),
  dateOfBirth: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const date = new Date(val);
        const now = new Date();
        return date <= now;
      },
      { message: 'Date of birth cannot be in the future' }
    )
    .refine(
      (val) => {
        if (!val) return true;
        const date = new Date(val);
        const minDate = new Date('1900-01-01');
        return date >= minDate;
      },
      { message: 'Please enter a valid date' }
    ),
});

export type AddChildFormData = z.infer<typeof addChildSchema>;

// Expense form validation
export const addExpenseSchema = z.object({
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'Amount must be greater than 0',
    })
    .refine((val) => parseFloat(val) <= 1000000, {
      message: 'Amount cannot exceed $1,000,000',
    }),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(500, 'Description must be less than 500 characters'),
  expenseDate: z
    .string()
    .min(1, 'Date is required')
    .refine(
      (val) => {
        const date = new Date(val);
        const now = new Date();
        now.setHours(23, 59, 59, 999);
        return date <= now;
      },
      { message: 'Expense date cannot be in the future' }
    ),
  category: z.string().min(1, 'Category is required'),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
});

export type AddExpenseFormData = z.infer<typeof addExpenseSchema>;

// Document upload validation
export const documentUploadSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Document title is required')
    .max(200, 'Title must be less than 200 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  category: z.string().min(1, 'Category is required'),
  file: z
    .custom<File>()
    .refine((file) => file instanceof File, { message: 'Please select a file' })
    .refine((file) => file.size <= 20 * 1024 * 1024, {
      message: 'File size must be less than 20MB',
    }),
});

export type DocumentUploadFormData = z.infer<typeof documentUploadSchema>;

// Helper to validate a single field using a full object schema
export function validateField<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  field: keyof z.infer<T>,
  data: Partial<z.infer<T>>
): string | null {
  const result = schema.safeParse(data);
  if (result.success) return null;
  
  const fieldError = result.error.errors.find((e) => e.path[0] === field);
  return fieldError?.message || null;
}

// Hook-like validation state manager
export function createValidationState<T extends Record<string, unknown>>() {
  const errors: Partial<Record<keyof T, string>> = {};
  
  return {
    errors,
    setError: (field: keyof T, message: string | null) => {
      if (message) {
        errors[field] = message;
      } else {
        delete errors[field];
      }
    },
    clearErrors: () => {
      Object.keys(errors).forEach((key) => delete errors[key as keyof T]);
    },
    hasErrors: () => Object.keys(errors).length > 0,
  };
}
