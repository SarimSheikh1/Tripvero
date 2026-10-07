import mongoose from "mongoose";
const { Schema } = mongoose;
const ref = (name, required = true) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  required,
});
const options = { timestamps: true };
const money = { type: Number, min: 0, required: true };
const userSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: String,
    password: { type: String, required: true, select: false },
    avatar: String,
    avatarFile: { type: String, select: false },
    avatarMime: { type: String, select: false },
    country: String,
    currency: { type: String, default: "PKR" },
    language: { type: String, default: "en" },
    settings: {
      theme: { type: String, default: "light" },
      notifications: { type: Boolean, default: true },
    },
    tokenVersion: { type: Number, default: 0, select: false },
    resetHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
  },
  options,
);
export const User = mongoose.model("User", userSchema);
export const Trip = mongoose.model(
  "Trip",
  new Schema(
    {
      name: { type: String, required: true, maxlength: 120 },
      destination: { type: String, required: true },
      description: String,
      coverImage: String,
      owner: ref("User"),
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      currency: { type: String, required: true },
      budget: money,
      type: String,
      status: { type: String, enum: ["active", "archived"], default: "active" },
      inviteCode: { type: String, unique: true },
      categoryBudgets: { type: Map, of: Number, default: {} },
      revision: { type: Number, default: 0 },
    },
    options,
  ),
);
const memberSchema = new Schema(
  {
    trip: ref("Trip"),
    user: ref("User"),
    role: {
      type: String,
      enum: ["owner", "admin", "member", "viewer"],
      default: "member",
    },
  },
  options,
);
memberSchema.index({ trip: 1, user: 1 }, { unique: true });
export const TripMember = mongoose.model("TripMember", memberSchema);
const allocation = new Schema(
  { user: ref("User"), amount: money },
  { _id: false },
);
const expenseSchema = new Schema(
  {
    trip: ref("Trip"),
    title: { type: String, required: true },
    description: String,
    amount: money,
    category: { type: String, required: true },
    date: { type: Date, required: true },
    paidBy: [allocation],
    participants: [allocation],
    splitType: {
      type: String,
      enum: ["equal", "exact", "percentage", "shares"],
      required: true,
    },
    splitDetails: [{ user: ref("User"), value: Number, _id: false }],
    personal: { type: Boolean, default: false },
    receipt: ref("Document", false),
    notes: String,
    createdBy: ref("User"),
  },
  options,
);
expenseSchema.index({ trip: 1, date: -1 });
export const Expense = mongoose.model("Expense", expenseSchema);
export const Settlement = mongoose.model(
  "Settlement",
  new Schema(
    {
      trip: ref("Trip"),
      from: ref("User"),
      to: ref("User"),
      amount: money,
      date: { type: Date, required: true },
      method: { type: String, required: true },
      reference: String,
      proof: ref("Document", false),
      notes: String,
      status: { type: String, default: "completed" },
      createdBy: ref("User"),
    },
    options,
  ),
);
const common = {
  trip: ref("Trip"),
  createdBy: ref("User"),
  title: { type: String, required: true },
  notes: String,
};
export const Accommodation = mongoose.model(
  "Accommodation",
  new Schema(
    {
      ...common,
      city: String,
      checkIn: Date,
      checkOut: Date,
      rooms: Number,
      roomPrice: Number,
      guests: Number,
      bookingReference: String,
      contact: String,
      address: String,
      screenshot: ref("Document", false),
      total: Number,
      expense: ref("Expense", false),
    },
    options,
  ),
);
export const Transport = mongoose.model(
  "Transport",
  new Schema(
    {
      ...common,
      type: String,
      provider: String,
      startLocation: String,
      destination: String,
      date: Date,
      price: Number,
      bookingNumber: String,
      driver: String,
      vehicle: String,
      liters: Number,
      odometer: Number,
      location: String,
      expense: ref("Expense", false),
    },
    options,
  ),
);
export const Food = mongoose.model(
  "Food",
  new Schema(
    {
      ...common,
      type: String,
      restaurant: String,
      date: Date,
      price: Number,
      personal: Boolean,
      expense: ref("Expense", false),
    },
    options,
  ),
);
export const Itinerary = mongoose.model(
  "Itinerary",
  new Schema(
    {
      ...common,
      date: Date,
      time: String,
      location: String,
      cost: Number,
      assigned: [ref("User")],
      position: { type: Number, default: 0 },
      completed: { type: Boolean, default: false },
    },
    options,
  ),
);
export const Checklist = mongoose.model(
  "Checklist",
  new Schema(
    {
      ...common,
      category: String,
      completed: { type: Boolean, default: false },
      assigned: ref("User", false),
    },
    options,
  ),
);
export const Document = mongoose.model(
  "Document",
  new Schema(
    {
      ...common,
      filename: String,
      originalName: String,
      mime: String,
      size: Number,
      category: String,
      provider: { type: String, default: "local" },
    },
    options,
  ),
);
export const GalleryImage = mongoose.model(
  "GalleryImage",
  new Schema(
    { ...common, document: ref("Document"), date: Date, caption: String },
    options,
  ),
);
export const Comment = mongoose.model(
  "Comment",
  new Schema(
    {
      trip: ref("Trip"),
      createdBy: ref("User"),
      targetType: {
        type: String,
        enum: ["expense", "itinerary", "activity"],
        required: true,
      },
      target: Schema.Types.ObjectId,
      text: { type: String, required: true, maxlength: 2000 },
    },
    options,
  ),
);
export const Activity = mongoose.model(
  "Activity",
  new Schema(
    { trip: ref("Trip"), user: ref("User"), text: String, kind: String },
    options,
  ),
);
export const Notification = mongoose.model(
  "Notification",
  new Schema(
    {
      user: ref("User"),
      trip: ref("Trip", false),
      text: String,
      type: String,
      read: { type: Boolean, default: false },
    },
    options,
  ),
);
export const resources = {
  accommodations: Accommodation,
  transport: Transport,
  food: Food,
  itinerary: Itinerary,
  checklist: Checklist,
  documents: Document,
  gallery: GalleryImage,
  comments: Comment,
  activity: Activity,
};

for (const Model of Object.values(resources)) {
  Model.schema.index({ trip: 1, createdAt: -1 });
}
Notification.schema.index({ user: 1, createdAt: -1 });
