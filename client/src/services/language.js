import { useSyncExternalStore } from "react";
let language =
  localStorage.getItem("tripvero-language") === "roman-ur" ? "roman-ur" : "en";
const listeners = new Set();
export function setLanguage(value) {
  language = value === "roman-ur" ? value : "en";
  localStorage.setItem("tripvero-language", language);
  document.documentElement.lang = language === "en" ? "en" : "ur-Latn";
  listeners.forEach((listener) => listener());
}
export function useLanguage() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => language,
  );
}
const roman = {
  "Your next adventure": "Aap ka agla safar",
  "Plan your trip": "Apni trip plan karein",
  "Choose a destination, dates and budget.":
    "Jagah, tareekh aur budget choose karein.",
  "Bring your friends": "Doston ko saath laayein",
  "Share an invite code with your group.": "Group ko invite code dein.",
  "Keep track together": "Mil kar hisaab rakhein",
  "Add expenses, plans and photos in one place.":
    "Kharchay, planning aur tasveerain ek jagah rakhein.",
  Hello: "Assalam o alaikum",
  "Add document": "Document add karein",
  "Edit photo": "Tasveer edit karein",
  "Confirm deletion": "Delete ki tasdeeq",
  "Receive in-app trip notifications": "Trip ki notifications hasil karein",
  "Active · last 24 hours": "Pichlay 24 ghanton mein active",
  "Active · last 7 days": "Pichlay 7 din mein active",
  "New · last 7 days": "Pichlay 7 din mein naye users",
  "Users who logged in": "Login karne walay users",
  Home: "Home",
  "My trips": "Meri trips",
  Profile: "Meri profile",
  Reports: "Reports",
  Activity: "Updates",
  "App admin": "App admin",
  "More tools": "Mazeed options",
  Summary: "Khulasa",
  Overview: "Khulasa",
  Expenses: "Kharchay",
  "Hotels & travel": "Hotel aur safar",
  Plan: "Planning",
  Gallery: "Tasveerain",
  Members: "Members",
  Budget: "Budget",
  Ledger: "Hisaab",
  Settlements: "Adaigi",
  Itinerary: "Safar ka plan",
  Accommodation: "Rehnay ki jagah",
  Transport: "Safar",
  Food: "Khana",
  Checklist: "Kaamon ki list",
  Documents: "Documents",
  Settings: "Settings",
  "New trip": "Nayi trip",
  "Join a trip": "Trip join karein",
  "Create trip": "Trip banayein",
  "Edit trip": "Trip edit karein",
  "Trip name": "Trip ka naam",
  Destination: "Kahan jana hai?",
  "Start date": "Shuru ki tareekh",
  "End date": "Wapsi ki tareekh",
  Currency: "Currency",
  "Estimated budget": "Andazay ka budget",
  "Optional details": "Mazeed details",
  "Trip type": "Trip ki qisam",
  Description: "Details",
  "Cover image URL (optional)": "Cover tasveer ka link (optional)",
  Cancel: "Cancel karein",
  "Save changes": "Save karein",
  Save: "Save karein",
  Delete: "Delete karein",
  Remove: "Hata dein",
  Add: "Add karein",
  Search: "Talash karein",
  "Search this trip": "Is trip mein talash karein",
  "All trips": "Tamam trips",
  "Invite group": "Doston ko bulayein",
  "Add expense": "Kharcha add karein",
  "Trip budget": "Trip ka budget",
  "Total spent": "Kul kharcha",
  Remaining: "Baqi budget",
  "To settle": "Baqi adaigi",
  "Budget details & charts": "Budget ki details aur charts",
  "Active trips": "Chalti trips",
  "Total expenses": "Kul kharchay",
  "You owe": "Aap ne dena hai",
  "You’ll receive": "Aap ko milna hai",
  "Your trips": "Aap ki trips",
  "Your travel overview": "Aap ki trips ka khulasa",
  "Amounts grouped by currency": "Raqam currency ke mutabiq",
  "Archived trips": "Purani trips",
  "Create a trip, invite friends and track expenses.":
    "Trip banayein, doston ko bulayein aur kharchay dekhein.",
  "Try again": "Dobara try karein",
  "Full name": "Poora naam",
  Email: "Email",
  Phone: "Phone",
  Country: "Mulk",
  "Default currency": "Default currency",
  "Preferred language": "App ki zaban",
  Theme: "Theme",
  "Profile photo": "Profile ki tasveer",
  Notifications: "Notifications",
  "Mark all as read": "Sab parh liya",
  "Sign out": "Logout karein",
  Title: "Naam",
  Caption: "Tasveer ki details",
  Category: "Qisam",
  File: "File",
  Upload: "Upload karein",
  "Choose photo from gallery or device": "Gallery ya device se tasveer chunein",
  "Add photo": "Tasveer add karein",
  "Trip gallery": "Trip ki tasveerain",
  Amount: "Raqam",
  Date: "Tareekh",
  Notes: "Notes",
  "Paid by": "Kis ne paisay diye",
  "Split type": "Paisay kaise baantne hain",
  "Record settlement": "Adaigi add karein",
  "Add option": "Option add karein",
  "Remove option": "Option hata dein",
  "Vote / undo vote": "Vote dein / wapas lein",
  "Group shortlist": "Group ke options",
  "Which hotel should we choose?": "Kaunsa hotel lein?",
  "Bus or car?": "Bus ya car?",
  "Option type": "Option ki qisam",
  "Hotel / provider / vehicle name": "Hotel ya gaari ka naam",
  "Return bus fare per person": "Har shakhs ka bus kiraya (ana jana)",
  "Total return distance (km)": "Kul fasla (ana jana, km)",
  "Car efficiency (km/litre)": "Car ki average (km/litre)",
  "Fuel price per litre": "Fuel ki qeemat per litre",
  "Car hire per vehicle (whole trip)": "Har gaari ka kul kiraya",
  "Tolls / parking per vehicle": "Har gaari ke toll aur parking",
  "Passenger seats per car": "Har car mein sawari ki seats",
  Refresh: "Refresh karein",
  "App administration": "Admin dashboard",
  "Registered users": "Registered users",
  Trips: "Trips",
  "Successful logins": "Kamyaab logins",
  Name: "Naam",
  Role: "Role",
  Joined: "Join kiya",
  "Last active": "Aakhri istemal",
  Logins: "Logins",
  "Latest 100 registered users": "Aakhri 100 registered users",
  "See how many people are using Tripvero.":
    "Dekhein kitne log Tripvero istemal kar rahe hain.",
  "Email address": "Email address",
  Password: "Password",
  "Sign in": "Login karein",
  "Create an account": "Account banayein",
  "Welcome back, traveler": "Dobara khush aamdeed",
  "Remember me": "Mujhe yaad rakhein",
  "Forgot password?": "Password bhool gaye?",
  "Confirm password": "Password dobara likhein",
  Loading: "Load ho raha hai",
  "View your itinerary": "Safar ka plan dekhein",
};
export function t(value) {
  return language === "roman-ur" && typeof value === "string"
    ? roman[value] || value
    : value;
}
export function translateChildren(children) {
  return Array.isArray(children)
    ? children.map(translateChildren)
    : typeof children === "string"
      ? t(children.trim())
      : children;
}
