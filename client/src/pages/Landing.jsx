import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  Wallet,
  Split,
  BookOpen,
  HandCoins,
  PieChart,
  Receipt,
  BarChart3,
  Route,
  Radio,
  Menu,
  MapPin,
  Check,
  Compass,
} from "lucide-react";
import { Logo, Button, Progress } from "../components/UI";
import { cover } from "../services/api";
const features = [
  [
    "Group trip planning",
    "The dates, places and people. One shared plan.",
    Users,
  ],
  ["Shared expenses", "Every payment, in one clear picture.", Wallet],
  ["Automatic splitting", "Equal, exact, percentages or shares.", Split],
  ["Personal ledgers", "Know what you paid and what you owe.", BookOpen],
  ["Smart settlements", "Fewer transfers. No mental gymnastics.", HandCoins],
  ["Travel budgeting", "Stay on track, category by category.", PieChart],
  ["Receipt uploads", "Keep the proof next to the payment.", Receipt],
  ["Expense analytics", "See where your travel budget goes.", BarChart3],
  ["Trip itinerary", "Give every day a little direction.", Route],
  ["Real-time updates", "Your whole group stays in the loop.", Radio],
];
export default function Landing() {
  const [menu, setMenu] = useState(false);
  return (
    <div className="landing">
      <nav className="public-nav">
        <Link to="/">
          <Logo />
        </Link>
        <div className={`public-links ${menu ? "open" : ""}`}>
          {[
            ["Features", "features"],
            ["How it works", "how"],
            ["Expense tracking", "expenses"],
            ["Group trips", "group"],
            ["About", "about"],
          ].map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={() => setMenu(false)}>
              {label}
            </a>
          ))}
        </div>
        <div className="nav-actions">
          <Link to="/login">Log in</Link>
          <Link className="btn" to="/register">
            Get started
          </Link>
          <button
            className="icon-btn mobile-menu"
            aria-label="Toggle menu"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
        </div>
      </nav>
      <main>
        <section className="hero">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="pill">
              <Compass size={15} /> A better way to travel together
            </span>
            <h1>
              More memories.
              <br />
              Less <span>money drama.</span>
            </h1>
            <p>
              Travel together without fighting over money. Plan your trip, share
              the costs, and settle up fairly — all in one place.
            </p>
            <div className="hero-actions">
              <Link className="btn" to="/register">
                Start a trip
              </Link>
              <a className="btn secondary" href="#features">
                Explore features
              </a>
            </div>
            <div className="hero-proof">
              <div className="avatar-stack">
                {["A", "S", "U", "H"].map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </div>
              <span>
                Built for the people you travel with.
                <br />
                <b>Friends, families, and everyone in between.</b>
              </span>
            </div>
          </motion.div>
          <motion.div
            className="hero-visual"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <img
              src={cover}
              alt="Turquoise Attabad Lake surrounded by mountains in Hunza"
            />
            <div className="visual-caption">
              <MapPin size={16} /> Hunza, Pakistan
            </div>
            <div className="preview-card">
              <div className="between">
                <span className="eyebrow">YOUR NEXT ADVENTURE</span>
                <span className="badge">4 travelers</span>
              </div>
              <h3>Hunza Adventure</h3>
              <p>One trip. Everyone on the same page.</p>
              <div className="preview-stats">
                <div>
                  <small>Trip budget</small>
                  <strong>PKR 120,000</strong>
                </div>
                <div>
                  <small>Remaining</small>
                  <strong className="green">PKR 41,500</strong>
                </div>
              </div>
              <Progress value={65} />
              <div className="between">
                <small>65% of budget used</small>
                <span className="green">
                  <Check size={14} /> On track
                </span>
              </div>
            </div>
            <div className="floating-receipt">
              <span>
                <Check size={19} />
              </span>
              <div>
                <b>Hotel expense split</b>
                <small>Everyone’s share, sorted.</small>
              </div>
            </div>
          </motion.div>
        </section>
        <div className="landing-strip">
          <span>THE TRIP IS SHARED. THE PLANNING SHOULD BE TOO.</span>
          <span>Plan together</span>
          <span>Spend smarter</span>
          <span>Travel better</span>
        </div>
        <section id="features" className="section">
          <div className="section-heading">
            <span className="eyebrow">EVERYTHING, IN ONE PLACE</span>
            <h2>
              A little less organizing.
              <br />A lot more exploring.
            </h2>
            <p>
              From the first idea to the final settlement, keep your group
              together.
            </p>
          </div>
          <div className="feature-grid">
            {features.map(([title, text, Icon]) => (
              <article key={title}>
                <span className="feature-icon">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="how" className="section how">
          <div className="section-heading">
            <span className="eyebrow">FROM “LET’S GO” TO “ALL SETTLED”</span>
            <h2>Four steps. One great trip.</h2>
          </div>
          <div className="steps">
            {[
              ["Create your trip", "Pick a destination, dates and budget."],
              ["Invite your group", "Share a link. Get everyone on board."],
              ["Record expenses", "Add who paid and how to split it."],
              ["Settle balances", "Follow the plan and close the loop."],
            ].map(([title, text], i) => (
              <article key={title}>
                <span>0{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="expenses" className="section expense-example">
          <div>
            <span className="eyebrow">FAIR SPLITS. CLEAR BALANCES.</span>
            <h2>
              “Who owes who?”
              <br />
              Already figured out.
            </h2>
            <p>
              Ali pays PKR 10,000 for the group in Hunza. Split between Ali,
              Ahmed, Sarim and Usman, everyone’s share is PKR 2,500.
            </p>
            <p>
              Ali receives PKR 7,500. The other three each owe PKR 2,500.
              Tripvero keeps the math clear as your trip grows.
            </p>
            <Link className="btn" to="/register">
              Make your first split
            </Link>
          </div>
          <div className="example-ledger">
            <div className="between">
              <h3>Group ledger</h3>
              <span className="badge">Equal split</span>
            </div>
            {[
              ["Ali", "+7,500"],
              ["Ahmed", "−2,500"],
              ["Sarim", "−2,500"],
              ["Usman", "−2,500"],
            ].map(([name, amount]) => (
              <div className="ledger-example" key={name}>
                <span className="avatar">{name[0]}</span>
                <b>{name}</b>
                <strong className={amount.startsWith("+") ? "green" : "amber"}>
                  PKR {amount}
                </strong>
              </div>
            ))}
            <small>Illustrative example · balances update automatically</small>
          </div>
        </section>
        <section id="group" className="group-banner">
          <span className="eyebrow">GOOD TRIPS START WITH GOOD COMPANY</span>
          <h2>
            Bring your people.
            <br />
            We’ll bring the clarity.
          </h2>
          <p>
            Weekend escapes, family holidays, road trips and big adventures.
          </p>
          <Link className="btn" to="/register">
            Create your first trip
          </Link>
        </section>
      </main>
      <footer id="about">
        <div>
          <Logo />
          <p>Plan Together. Spend Smarter. Travel Better.</p>
          <small>
            Tripvero makes group travel easier to organize and fairer to share.
          </small>
        </div>
        <div>
          <b>Product</b>
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <Link to="/register">Group trips</Link>
        </div>
        <div>
          <b>Company & help</b>
          <Link to="/about">About & contact</Link>
          <Link to="/help">Help center</Link>
        </div>
        <div>
          <b>Legal</b>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </div>
        <small className="copyright">
          © {new Date().getFullYear()} Tripvero · Photography by Shuttergames /{" "}
          <a href="https://unsplash.com/photos/body-of-water-under-hills-at-daytime-9BE8hiqvUM4">
            Unsplash
          </a>
        </small>
      </footer>
    </div>
  );
}
