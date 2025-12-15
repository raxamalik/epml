import { z } from "zod";

/**
 * Common validation schemas
 */

export const emailSchema = z.string().email("Invalid email address");

export const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

export const phoneSchema = z.string().optional().or(z.literal(""));

export const nameSchema = z.string().min(1, "Name is required");

export const addressSchema = z.string().min(1, "Address is required");

/**
 * Manager form schema
 */
export const managerFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: emailSchema,
  phone: phoneSchema,
  role: z.enum(["manager", "store_owner"]).default("manager"),
  isActive: z.boolean().default(true),
  storeId: z.number().optional(),
  password: passwordSchema.optional(),
});

export type ManagerFormData = z.infer<typeof managerFormSchema>;

/**
 * Store form schema
 */
export const storeFormSchema = z.object({
  name: z.string().min(1, "Store name is required"),
  address: z.string().min(1, "Address is required"),
  phone: phoneSchema,
  isActive: z.boolean().default(true),
  ownerEmail: emailSchema.optional(),
  ownerPassword: passwordSchema.optional(),
}).refine((data) => {
  // If ownerEmail is provided, ownerPassword is required
  if (data.ownerEmail && !data.ownerPassword) {
    return false;
  }
  // If ownerPassword is provided, ownerEmail is required
  if (data.ownerPassword && !data.ownerEmail) {
    return false;
  }
  return true;
}, {
  message: "Both email and password are required to create a store owner",
  path: ["ownerEmail"],
});

export type StoreFormData = z.infer<typeof storeFormSchema>;

/**
 * Company form schema
 */
export const companyFormSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  registrationNumber: z.string().optional().or(z.literal("")),
  vatNumber: z.string().optional().or(z.literal("")),
  address: z.string().min(1, "Address is required"),
  email: emailSchema,
  phone: z.string().min(1, "Phone is required"),
  contactPerson: z.string().min(1, "Contact person is required"),
  password: passwordSchema.optional(),
  maxBranches: z.number().min(1).default(1),
});

export type CompanyFormData = z.infer<typeof companyFormSchema>;

