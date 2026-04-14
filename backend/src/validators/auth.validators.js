const { z } = require("zod");

const registerSchema = z.object({
  email: z.string().email("Must be a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be under 100 characters"),
  full_name: z.string().min(1, "Full name is required"),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),
  phone: z
    .string()
    .regex(/^\d{10,13}$/, "Phone must be 10 to 13 digits"),
});

const registerEmployeeSchema = z.object({
  email: z.string().email("Must be a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be under 100 characters"),
  full_name: z.string().min(1, "Full name is required"),
  role: z.enum(["admin", "manager", "staff"]),
  hourly_rate: z.number().positive().optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().email("Must be a valid email address"),
  password: z.string().min(1, "Password is required"),
});

module.exports = { registerSchema, registerEmployeeSchema, loginSchema };
