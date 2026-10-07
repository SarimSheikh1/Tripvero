import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config, validateConfig } from "./config/env.js";
import {
  User,
  Trip,
  TripMember,
  Expense,
  Itinerary,
  Checklist,
  Accommodation,
  Activity,
} from "./models/index.js";
import { splitExpense } from "./services/finance.js";
export async function seed() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Development seed is disabled in production");
  const names = ["Ali", "Ahmed", "Sarim", "Usman"],
    users = [];
  for (const name of names) {
    let user = await User.findOne({
      email: `${name.toLowerCase()}@tripvero.test`,
    });
    if (!user)
      user = await User.create({
        name,
        email: `${name.toLowerCase()}@tripvero.test`,
        password: await bcrypt.hash("TripveroDev!2026", 12),
        currency: "PKR",
        country: "Pakistan",
      });
    users.push(user);
  }
  const existing = await Trip.findOne({
    owner: users[0]._id,
    name: "Hunza Adventure",
  });
  if (existing) return existing;
  let trip;
  await mongoose.connection.transaction(async (session) => {
    [trip] = await Trip.create(
      [
        {
          name: "Hunza Adventure",
          destination: "Hunza, Pakistan",
          description:
            "Mountain mornings, lakeside afternoons, and great company.",
          coverImage:
            "https://images.unsplash.com/photo-1569173112611-52a7cd38bea9?auto=format&fit=crop&w=1000&q=80",
          owner: users[0]._id,
          startDate: "2026-10-10",
          endDate: "2026-10-16",
          currency: "PKR",
          budget: 120000,
          type: "Adventure",
          inviteCode: "TRIP-HUNZA-X72K",
          categoryBudgets: {
            Accommodation: 45000,
            Food: 20000,
            Fuel: 20000,
            Activities: 15000,
            Emergency: 20000,
          },
        },
      ],
      { session },
    );
    await TripMember.insertMany(
      users.map((u, i) => ({
        trip: trip._id,
        user: u._id,
        role: i === 0 ? "owner" : i === 1 ? "admin" : "member",
      })),
      { session },
    );
    const details = users.map((u) => ({ user: u._id }));
    for (const [title, amount, category, payer] of [
      ["Hotel", 40000, "Accommodation", 0],
      ["Food", 12500, "Food", 1],
      ["Fuel", 18000, "Fuel", 2],
      ["Activities", 8000, "Activities", 3],
    ])
      await Expense.create(
        [
          {
            trip: trip._id,
            title,
            amount,
            category,
            date: "2026-10-10",
            paidBy: [{ user: users[payer]._id, amount }],
            participants: splitExpense(amount, "equal", details),
            splitType: "equal",
            splitDetails: details,
            createdBy: users[payer]._id,
          },
        ],
        { session },
      );
    await Itinerary.insertMany(
      [
        {
          trip: trip._id,
          createdBy: users[0]._id,
          title: "Leave Islamabad",
          date: "2026-10-10",
          time: "08:00",
          location: "Islamabad",
          position: 0,
          completed: true,
        },
        {
          trip: trip._id,
          createdBy: users[0]._id,
          title: "Lakeside afternoon",
          date: "2026-10-11",
          time: "14:00",
          location: "Attabad Lake",
          position: 1,
        },
      ],
      { session },
    );
    await Checklist.insertMany(
      [
        {
          trip: trip._id,
          createdBy: users[0]._id,
          title: "Pack warm layers",
          category: "Clothes",
          completed: true,
        },
        {
          trip: trip._id,
          createdBy: users[0]._id,
          title: "Download booking confirmations",
          category: "Documents",
        },
      ],
      { session },
    );
    await Accommodation.create(
      [
        {
          trip: trip._id,
          createdBy: users[0]._id,
          title: "Hunza guesthouse",
          city: "Karimabad",
          checkIn: "2026-10-10",
          checkOut: "2026-10-15",
          rooms: 2,
          roomPrice: 4000,
          guests: 4,
          total: 40000,
        },
      ],
      { session },
    );
    await Activity.create(
      [
        {
          trip: trip._id,
          user: users[0]._id,
          text: "Ali created Hunza Adventure.",
          kind: "trip",
        },
      ],
      { session },
    );
  });
  return trip;
}
if (process.argv[1]?.endsWith("seed.js")) {
  validateConfig();
  await mongoose.connect(config.mongo);
  await seed();
  console.log("Development sample data ready. See README for sign-in details.");
  await mongoose.disconnect();
}
