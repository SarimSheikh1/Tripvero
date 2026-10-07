import { z } from "zod";
const text = z.string().trim().min(1).max(200),
  optional = z.string().trim().max(4000).optional(),
  objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier"),
  date = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  amount = z.coerce.number().finite().nonnegative().max(1e10),
  positive = amount.refine((v) => v > 0, "Amount must be positive");
export const registerSchema = z
  .object({
    name: text,
    email: z.email().transform((v) => v.toLowerCase()),
    phone: optional,
    password: z.string().min(10).max(128),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export const loginSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
  remember: z.boolean().optional(),
});
export const profileSchema = z.object({
  name: text,
  email: z.email().transform((v) => v.toLowerCase()),
  phone: optional,
  country: optional,
  currency: z.enum(["PKR", "USD", "AED", "SAR", "EUR", "GBP"]),
  language: z.enum(["en", "roman-ur", "ur", "ar"]).optional(),
  settings: z
    .object({ theme: z.enum(["light", "dark"]), notifications: z.boolean() })
    .optional(),
});
export const tripSchema = z
  .object({
    name: text,
    destination: text,
    description: optional,
    coverImage: z.string().max(2000).optional(),
    startDate: date,
    endDate: date,
    currency: z.enum(["PKR", "USD", "AED", "SAR", "EUR", "GBP"]),
    budget: amount,
    type: z
      .enum([
        "Friends",
        "Family",
        "Couple",
        "Business",
        "Solo",
        "Road Trip",
        "Adventure",
        "Religious",
        "Other",
      ])
      .default("Friends"),
  })
  .refine((v) => new Date(v.endDate) >= new Date(v.startDate), {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });
export const expenseSchema = z.object({
  title: text,
  description: optional,
  amount: positive,
  category: text,
  date,
  paidBy: z
    .array(z.object({ user: objectId, amount }))
    .min(1)
    .max(100),
  splitDetails: z
    .array(z.object({ user: objectId, value: amount.optional() }))
    .min(1)
    .max(100),
  splitType: z.enum(["equal", "exact", "percentage", "shares"]),
  personal: z.boolean().default(false),
  receipt: objectId.nullish(),
  notes: optional,
});
export const settlementSchema = z
  .object({
    from: objectId,
    to: objectId,
    amount: positive,
    date,
    method: z.enum([
      "Cash",
      "Bank Transfer",
      "EasyPaisa",
      "JazzCash",
      "Card",
      "Other",
    ]),
    reference: optional,
    proof: objectId.nullish(),
    notes: optional,
  })
  .refine((v) => v.from !== v.to, { message: "Choose two different members" });
const base = { title: text, notes: optional };
export const resourceSchemas = {
  accommodations: z
    .object({
      ...base,
      city: optional,
      checkIn: date,
      checkOut: date,
      rooms: z.coerce.number().int().min(1).max(500),
      roomPrice: amount,
      guests: z.coerce.number().int().min(1),
      bookingReference: optional,
      contact: optional,
      address: optional,
      screenshot: objectId.nullish(),
      createExpense: z.boolean().optional(),
      paidBy: objectId.optional(),
    })
    .refine(
      (v) => new Date(v.checkOut) > new Date(v.checkIn),
      "Check-out must be after check-in",
    ),
  transport: z.object({
    ...base,
    type: z.enum([
      "Car",
      "Bike",
      "Bus",
      "Train",
      "Flight",
      "Taxi",
      "Rental Vehicle",
      "Fuel",
      "Other",
    ]),
    provider: optional,
    startLocation: optional,
    destination: optional,
    date,
    price: amount,
    bookingNumber: optional,
    driver: optional,
    vehicle: optional,
    liters: amount.optional(),
    odometer: amount.optional(),
    location: optional,
    createExpense: z.boolean().optional(),
    paidBy: objectId.optional(),
  }),
  food: z.object({
    ...base,
    type: z.enum([
      "Breakfast",
      "Lunch",
      "Dinner",
      "Snacks",
      "Restaurant",
      "Groceries",
    ]),
    restaurant: optional,
    date,
    price: amount,
    personal: z.boolean().optional(),
    createExpense: z.boolean().optional(),
    paidBy: objectId.optional(),
  }),
  itinerary: z.object({
    ...base,
    date,
    time: z.string().regex(/^\d{2}:\d{2}$/),
    location: optional,
    cost: amount.optional(),
    assigned: z.array(objectId).optional(),
    position: z.coerce.number().int().nonnegative().optional(),
    completed: z.boolean().optional(),
  }),
  checklist: z.object({
    ...base,
    category: text,
    completed: z.boolean().optional(),
    assigned: objectId.nullish(),
  }),
  comments: z.object({
    text: z.string().trim().min(1).max(2000),
    targetType: z.enum(["expense", "itinerary", "activity"]),
    target: objectId,
  }),
};
export const parse = (schema, data) => schema.parse(data);
