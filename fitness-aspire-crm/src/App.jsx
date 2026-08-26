import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { storage } from "./lib/storage";
import {
  LayoutDashboard, Users, Kanban, BellRing, CalendarCheck, Megaphone,
  TrendingUp, FileText, AlertTriangle, Settings as SettingsIcon, Sun,
  Search, Plus, X, ChevronRight, ChevronDown, Phone, Mail, MessageCircle,
  Instagram, Trophy, Flame, Snowflake, Thermometer, Clock, Check,
  ArrowUpRight, ArrowDownRight, Trash2, Pencil, Download, Filter, Menu,
  CircleDot, Target, Wallet, UserCheck, CalendarX, Activity, Save, RotateCcw
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";

/* ============================================================
   FITNESS ASPIRE — SALES CRM & LEAD MANAGEMENT (V1)
   Data persists through src/lib/storage.js (localStorage now, Supabase later).
   ============================================================ */

const STORAGE_KEY = "fa-crm-data-v1";

/* ---------- Palette (ink + gold, mono numerals) ---------- */
const ACCENT = "#C08F3E";
const INK = "#072E2A";
const CHART_COLORS = ["#C08F3E", "#1C7A5E", "#43769F", "#BE4630", "#6A5AA0", "#2E8B84", "#A8557E", "#8A968F"];

/* ---------- Pipeline stages ---------- */
const STAGES = [
  { id: "new", label: "New Lead", color: "bg-slate-400" },
  { id: "contacted", label: "Contacted", color: "bg-sky-400" },
  { id: "replied", label: "Replied", color: "bg-sky-500" },
  { id: "qualified", label: "Qualified", color: "bg-violet-500" },
  { id: "trial_offered", label: "Trial Offered", color: "bg-pink-500" },
  { id: "trial_booked", label: "Trial Booked", color: "bg-cyan-500" },
  { id: "trial_completed", label: "Trial Completed", color: "bg-indigo-500" },
  { id: "proposal", label: "Proposal Sent", color: "bg-amber-500" },
  { id: "follow_up", label: "Follow-Up", color: "bg-rose-500" },
  { id: "won", label: "Won", color: "bg-emerald-600" },
  { id: "lost", label: "Lost", color: "bg-slate-500" },
];
const stageLabel = (id) => STAGES.find((s) => s.id === id)?.label || id;
const stageIndex = (id) => STAGES.findIndex((s) => s.id === id);
const OPEN_STAGES = STAGES.filter((s) => s.id !== "won" && s.id !== "lost").map((s) => s.id);

/* Probability weighting for forecast (by stage) */
const STAGE_PROB = {
  new: 0.05, contacted: 0.1, replied: 0.15, qualified: 0.25,
  trial_offered: 0.35, trial_booked: 0.5, trial_completed: 0.65,
  proposal: 0.75, follow_up: 0.6, won: 1, lost: 0,
};
const TEMP_PROB = { hot: 1.3, warm: 1.0, cold: 0.6 };

const TEMPS = [
  { id: "hot", label: "Hot", dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700 border-rose-200", icon: Flame },
  { id: "warm", label: "Warm", dot: "bg-orange-500", chip: "bg-orange-50 text-orange-700 border-orange-200", icon: Thermometer },
  { id: "cold", label: "Cold", dot: "bg-sky-500", chip: "bg-sky-50 text-sky-700 border-sky-200", icon: Snowflake },
];
const tempMeta = (id) => TEMPS.find((t) => t.id === id) || TEMPS[1];

const APPT_STATUSES = ["Booked", "Confirmed", "Completed", "No-Show", "Cancelled", "Rescheduled"];
const FOLLOWUP_TYPES = ["WhatsApp", "Phone Call", "Email", "Instagram DM", "Other"];
const PAYMENT_STATUSES = ["Unpaid", "Deposit Paid", "Paid in Full", "Instalment"];

/* ---------- Default settings (all editable in Settings) ---------- */
const DEFAULT_SETTINGS = {
  leadSources: ["Instagram", "Facebook", "TikTok", "Threads", "WhatsApp", "Website", "Referral", "Google", "Walk-in", "Other"],
  lostReasons: ["Price", "Not ready", "No response", "Chose another trainer", "Location", "Timing", "Family decision", "Not interested", "Health issue", "Other"],
  platforms: ["Instagram", "Facebook", "TikTok", "Google", "Threads", "Other"],
  locations: ["Mount Austin", "Taman Molek", "Bukit Indah", "Setia Tropika", "Online"],
  goals: ["Fat loss", "Muscle gain", "General fitness", "Strength", "Rehab / mobility", "Sports performance"],
  packages: [
    { id: "p1", name: "12 Sessions", sessions: 12, price: 1800 },
    { id: "p2", name: "24 Sessions", sessions: 24, price: 3200 },
    { id: "p3", name: "36 Sessions", sessions: 36, price: 4500 },
    { id: "p4", name: "Group Class — 3 months", sessions: 36, price: 1200 },
  ],
  trainers: [
    { id: "t1", name: "Coach Aiman" },
    { id: "t2", name: "Coach Reena" },
    { id: "t3", name: "Coach Danish" },
  ],
  notifications: {
    overdueFollowUp: true, trialReminder: true, noShowFollowUp: true,
    inactiveLead: true, hotLeadNoFollowUp: true, staleStage: true,
    inactiveDays: 7, staleStageDays: 14,
  },
};

const DEFAULT_USERS = [
  { id: "u1", name: "Andrea", role: "admin", email: "andrea@fitnessaspire.my", active: true },
  { id: "u2", name: "Nadia", role: "sales", email: "nadia@fitnessaspire.my", active: true },
  { id: "u3", name: "Wei Jie", role: "sales", email: "weijie@fitnessaspire.my", active: true },
  { id: "u4", name: "Faiz", role: "sales", email: "faiz@fitnessaspire.my", active: true },
];

/* ---------- Date helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = new Date();
const todayISO = toISO(TODAY);
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return toISO(d); };
const daysDiff = (a, b) => Math.round((new Date(a + "T00:00:00") - new Date(b + "T00:00:00")) / 86400000);
const fmtDate = (iso) => { if (!iso) return "—"; const d = new Date(iso + "T00:00:00"); return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
const fmtDateFull = (iso) => { if (!iso) return "—"; const d = new Date(iso + "T00:00:00"); return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
const monthKey = (iso) => iso.slice(0, 7);

const RM = (n) => "RM" + Math.round(n || 0).toLocaleString("en-MY");
const RM0 = (n) => "RM" + (n || 0).toLocaleString("en-MY", { maximumFractionDigits: 0 });
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const num = (n, d = 1) => (isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : 0);

const uid = (p = "id") => p + "_" + Math.random().toString(36).slice(2, 9);

/* ---------- Date range presets ---------- */
function rangeFor(preset, custom) {
  const d = new Date(TODAY);
  const iso = toISO(d);
  switch (preset) {
    case "today": return { from: iso, to: iso, label: "Today" };
    case "week": {
      const dow = (d.getDay() + 6) % 7;
      return { from: addDays(iso, -dow), to: addDays(iso, 6 - dow), label: "This week" };
    }
    case "month": {
      const from = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { from, to: toISO(last), label: "This month" };
    }
    case "lastmonth": {
      const f = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const l = new Date(d.getFullYear(), d.getMonth(), 0);
      return { from: toISO(f), to: toISO(l), label: "Last month" };
    }
    case "quarter": {
      const q = Math.floor(d.getMonth() / 3);
      const f = new Date(d.getFullYear(), q * 3, 1);
      const l = new Date(d.getFullYear(), q * 3 + 3, 0);
      return { from: toISO(f), to: toISO(l), label: "This quarter" };
    }
    case "ytd": return { from: `${d.getFullYear()}-01-01`, to: iso, label: "Year to date" };
    case "custom": return { from: custom.from, to: custom.to, label: "Custom" };
    default: return { from: `${d.getFullYear()}-01-01`, to: iso, label: "All time" };
  }
}
const inRange = (iso, r) => iso && iso >= r.from && iso <= r.to;

/* ============================================================
   SEED DATA
   ============================================================ */
const FIRST = ["Sarah", "Aina", "Michelle", "Jason", "Nurul", "Adam", "Priya", "Wei Ling", "Hafiz", "Chloe", "Daniel", "Farah", "Ryan", "Siti", "Marcus", "Amirah", "Kelvin", "Divya", "Zainal", "Rachel", "Ben", "Hui Min", "Iqbal", "Grace", "Shafiq", "Melissa", "Arjun", "Yusof", "Tania", "Kah Wai", "Liyana", "Dominic", "Rina", "Haziq", "Joanne", "Firdaus", "Elaine", "Nabil", "Vanessa", "Syafiq", "Karen", "Zulkifli", "Natasha", "Jin Hao", "Alia"];
const LAST = ["Tan", "Abdullah", "Lee", "Kumar", "Ismail", "Lim", "Rahman", "Ng", "Yusuf", "Wong", "Chandran", "Hassan", "Chin", "Aziz", "Loh", "Musa", "Teo", "Ravi", "Omar", "Goh"];

function seedData() {
  const users = DEFAULT_USERS;
  const settings = DEFAULT_SETTINGS;
  const sales = users.filter((u) => u.role === "sales" || u.role === "admin");

  const campaigns = [
    { id: "c1", name: "IG Reels — Fat Loss Challenge", platform: "Instagram", type: "Lead Generation", start: addDays(todayISO, -75), end: addDays(todayISO, 15), budget: 4000, spend: 3250 },
    { id: "c2", name: "FB Lead Form — Free Trial", platform: "Facebook", type: "Lead Generation", start: addDays(todayISO, -60), end: addDays(todayISO, 30), budget: 3000, spend: 2480 },
    { id: "c3", name: "TikTok — Transformation Series", platform: "TikTok", type: "Awareness", start: addDays(todayISO, -45), end: addDays(todayISO, 10), budget: 2000, spend: 1740 },
    { id: "c4", name: "Google Search — PT Johor Bahru", platform: "Google", type: "Search", start: addDays(todayISO, -90), end: addDays(todayISO, 20), budget: 3500, spend: 3120 },
    { id: "c5", name: "Threads — Community Build", platform: "Threads", type: "Awareness", start: addDays(todayISO, -30), end: addDays(todayISO, 30), budget: 800, spend: 520 },
  ];

  const srcByCampaign = { Instagram: "Instagram", Facebook: "Facebook", TikTok: "TikTok", Google: "Google", Threads: "Threads" };
  const organicSources = ["Referral", "Walk-in", "Website", "WhatsApp"];

  const leads = [], activities = [], followups = [], appointments = [], notes = [];
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  const N = 46;
  for (let i = 0; i < N; i++) {
    const created = addDays(todayISO, -rint(0, 88));
    const useCampaign = Math.random() < 0.68;
    const camp = useCampaign ? rnd(campaigns) : null;
    const source = camp ? srcByCampaign[camp.platform] : rnd(organicSources);
    const owner = rnd(sales);
    const pkg = rnd(settings.packages);
    const age = daysDiff(todayISO, created);

    // Stage distribution weighted by lead age
    let stage;
    const r = Math.random();
    if (age > 45) stage = r < 0.34 ? "won" : r < 0.72 ? "lost" : rnd(["follow_up", "proposal", "trial_completed"]);
    else if (age > 20) stage = r < 0.2 ? "won" : r < 0.42 ? "lost" : rnd(["proposal", "follow_up", "trial_completed", "trial_booked", "qualified"]);
    else if (age > 7) stage = rnd(["contacted", "replied", "qualified", "trial_offered", "trial_booked", "trial_completed", "proposal", "follow_up", "won", "lost"]);
    else stage = rnd(["new", "new", "contacted", "replied", "qualified", "trial_offered", "trial_booked"]);

    const temp = stage === "won" ? "hot" : stage === "lost" ? "cold"
      : stageIndex(stage) >= 5 ? rnd(["hot", "hot", "warm"]) : rnd(["hot", "warm", "warm", "cold"]);

    const discount = Math.random() < 0.35 ? rint(1, 5) * 100 : 0;
    const finalPrice = pkg.price - discount;

    const id = "L" + String(1000 + i);
    const lead = {
      id,
      name: `${rnd(FIRST)} ${rnd(LAST)}`,
      phone: "+601" + rint(1, 9) + "-" + rint(200, 999) + " " + rint(1000, 9999),
      email: "",
      gender: Math.random() < 0.55 ? "Female" : "Male",
      age: rint(21, 52),
      location: rnd(settings.locations),
      preferredLocation: rnd(settings.locations),
      createdAt: created,
      source,
      campaignId: camp ? camp.id : null,
      adName: camp ? rnd(["Creative A", "Creative B", "Carousel 01", "Video 15s"]) : "",
      ownerId: owner.id,
      trainerId: rnd(settings.trainers).id,
      stage,
      temperature: temp,
      goal: rnd(settings.goals),
      packageId: pkg.id,
      estValue: finalPrice,
      lostReason: stage === "lost" ? rnd(settings.lostReasons) : null,
      wonAt: null,
      deal: null,
      updatedAt: created,
      createdBy: owner.name,
      updatedBy: owner.name,
    };
    lead.email = lead.name.toLowerCase().replace(/[^a-z]/g, ".") + "@gmail.com";

    // Activity trail
    const push = (date, type, text) => activities.push({ id: uid("act"), leadId: id, date, type, text, by: owner.name });
    push(created, "created", `Lead created from ${source}${camp ? " — " + camp.name : ""}`);

    let cursor = created;
    const si = stageIndex(stage);
    if (si >= 1) { cursor = addDays(cursor, rint(0, 1)); push(cursor, "message", "WhatsApp intro message sent"); }
    if (si >= 2) { cursor = addDays(cursor, rint(0, 2)); push(cursor, "reply", "Prospect replied — asked about pricing"); }
    if (si >= 3) { cursor = addDays(cursor, rint(0, 2)); push(cursor, "stage", `Qualified — goal: ${lead.goal}`); }
    if (si >= 4) { cursor = addDays(cursor, rint(0, 2)); push(cursor, "stage", "Free trial session offered"); }

    // Appointment
    if (si >= 5 && stage !== "lost") {
      const trialDate = si === 5 ? addDays(todayISO, rint(-1, 6)) : addDays(cursor, rint(1, 4));
      let status = "Booked";
      if (trialDate < todayISO) status = Math.random() < 0.78 ? "Completed" : Math.random() < 0.6 ? "No-Show" : "Cancelled";
      else if (trialDate === todayISO) status = "Confirmed";
      if (si >= 6) status = Math.random() < 0.85 ? "Completed" : "No-Show";
      appointments.push({
        id: uid("apt"), leadId: id, date: trialDate, time: rnd(["08:00", "09:30", "11:00", "17:00", "18:30", "20:00"]),
        trainerId: lead.trainerId, location: lead.preferredLocation, status,
        notes: "", createdAt: cursor, updatedAt: cursor,
      });
      push(cursor, "appointment", `Trial booked — ${fmtDate(trialDate)}`);
      if (status === "Completed") push(trialDate, "appointment", "Trial completed");
      if (status === "No-Show") push(trialDate, "alert", "Prospect did not show up for trial");
      cursor = trialDate > cursor ? trialDate : cursor;
    }

    if (si >= 7) {
      cursor = addDays(cursor, rint(0, 2));
      push(cursor, "deal", `${pkg.name} package sent — ${RM(finalPrice)}`);
      lead.deal = {
        packageId: pkg.id, packageName: pkg.name, sessions: pkg.sessions,
        price: pkg.price, discount, finalPrice,
        deposit: stage === "won" ? Math.round(finalPrice * (Math.random() < 0.5 ? 0.3 : 1)) : 0,
        paymentStatus: stage === "won" ? (Math.random() < 0.5 ? "Deposit Paid" : "Paid in Full") : "Unpaid",
        expectedClose: addDays(cursor, rint(2, 14)),
      };
    }
    if (si >= 8 && stage !== "won" && stage !== "lost") {
      cursor = addDays(cursor, rint(1, 3));
      push(cursor, "message", "Follow-up message sent");
    }
    if (stage === "won") {
      cursor = addDays(cursor, rint(1, 6));
      if (cursor > todayISO) cursor = todayISO;
      lead.wonAt = cursor;
      if (!lead.deal) {
        lead.deal = { packageId: pkg.id, packageName: pkg.name, sessions: pkg.sessions, price: pkg.price, discount, finalPrice, deposit: finalPrice, paymentStatus: "Paid in Full", expectedClose: cursor };
      }
      push(cursor, "won", `Converted to client — ${RM(lead.deal.finalPrice)}`);
    }
    if (stage === "lost") {
      cursor = addDays(cursor, rint(1, 8));
      if (cursor > todayISO) cursor = todayISO;
      push(cursor, "lost", `Marked lost — ${lead.lostReason}`);
    }
    lead.updatedAt = cursor;

    // Follow-ups for open leads
    if (OPEN_STAGES.includes(stage)) {
      const offset = rint(-6, 5);
      followups.push({
        id: uid("fu"), leadId: id, date: addDays(todayISO, offset),
        time: rnd(["09:00", "10:30", "14:00", "16:00", "19:00"]),
        type: rnd(FOLLOWUP_TYPES), note: rnd([
          "Check if she has decided on the 24-session package",
          "Send trial confirmation + location pin",
          "Ask about preferred training time",
          "Share transformation testimonials",
          "Confirm budget and start date",
          "Re-engage — no reply since last message",
        ]),
        completed: false, createdAt: lead.updatedAt, completedAt: null, ownerId: owner.id,
      });
      // some completed history
      if (Math.random() < 0.5) {
        followups.push({
          id: uid("fu"), leadId: id, date: addDays(todayISO, -rint(7, 20)), time: "11:00",
          type: rnd(FOLLOWUP_TYPES), note: "Initial outreach", completed: true,
          createdAt: created, completedAt: addDays(todayISO, -rint(7, 20)), ownerId: owner.id,
        });
      }
    }
    if (Math.random() < 0.3) {
      notes.push({ id: uid("nt"), leadId: id, text: rnd([
        "Works shift hours — prefers evening sessions after 8pm.",
        "Referred by an existing client, price sensitive but keen.",
        "Recovering from a knee injury, needs low-impact programming.",
        "Comparing us with a gym in Bukit Indah. Emphasise coach ratio.",
        "Wants to start after payday (end of month).",
      ]), by: owner.name, createdAt: lead.updatedAt });
    }

    leads.push(lead);
  }

  return {
    version: 1, users, settings, campaigns, leads, activities, followups, appointments, notes,
    currentUserId: "u1", dismissedAlerts: [],
  };
}

/* ============================================================
   UI ATOMS
   ============================================================ */
const Card = ({ className = "", children, ...p }) => (
  <div className={`bg-white border border-slate-200 rounded-xl ${className}`} {...p}>{children}</div>
);

const SectionTitle = ({ children, sub, right }) => (
  <div className="flex items-end justify-between gap-4 mb-3">
    <div>
      <h2 className="text-sm font-semibold text-slate-900 tracking-tight">{children}</h2>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
    {right}
  </div>
);

const Label = ({ children }) => (
  <span className="t10 font-semibold uppercase tracking-widest text-slate-400">{children}</span>
);

const Btn = ({ variant = "default", size = "md", className = "", children, ...p }) => {
  const base = "inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-amber-400";
  const sizes = { sm: "text-xs px-2.5 py-1.5", md: "text-sm px-3.5 py-2", lg: "text-sm px-5 py-2.5" };
  const variants = {
    default: "bg-slate-900 text-white hover:bg-slate-800",
    accent: "bg-amber-500 text-slate-900 hover:bg-amber-400",
    ghost: "text-slate-600 hover:bg-slate-100",
    outline: "border border-slate-300 text-slate-700 bg-white hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
    subtle: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    success: "bg-emerald-600 text-white hover:bg-emerald-500",
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...p}>{children}</button>;
};

const Input = ({ className = "", ...p }) => (
  <input className={`w-full text-sm px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 ${className}`} {...p} />
);
const Select = ({ className = "", children, ...p }) => (
  <select className={`w-full text-sm px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 ${className}`} {...p}>{children}</select>
);
const Textarea = ({ className = "", ...p }) => (
  <textarea className={`w-full text-sm px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 ${className}`} {...p} />
);

const Field = ({ label, children }) => (
  <div className="space-y-1"><Label>{label}</Label>{children}</div>
);

const StageBadge = ({ stage }) => {
  const s = STAGES.find((x) => x.id === stage) || STAGES[0];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full ${s.color}`} />{s.label}
    </span>
  );
};

const TempChip = ({ t, showLabel = true }) => {
  const m = tempMeta(t);
  return (
    <span className={`inline-flex items-center gap-1 t11 font-medium px-1.5 py-0.5 rounded border ${m.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{showLabel && m.label}
    </span>
  );
};

const ApptBadge = ({ status }) => {
  const map = {
    "Booked": "bg-slate-100 text-slate-700 border-slate-200",
    "Confirmed": "bg-sky-50 text-sky-700 border-sky-200",
    "Completed": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "No-Show": "bg-rose-50 text-rose-700 border-rose-200",
    "Cancelled": "bg-slate-100 text-slate-500 border-slate-200",
    "Rescheduled": "bg-amber-50 text-amber-700 border-amber-200",
  };
  return <span className={`inline-block t11 font-medium px-2 py-0.5 rounded border ${map[status]}`}>{status}</span>;
};

const Stat = ({ label, value, sub, tone = "default", icon: Icon }) => {
  const tones = {
    default: { text: "text-slate-900", edge: "#93A29C" },
    good: { text: "text-emerald-700", edge: "#1C7A5E" },
    bad: { text: "text-rose-700", edge: "#BE4630" },
    accent: { text: "text-amber-600", edge: "#C08F3E" },
  };
  const t = tones[tone] || tones.default;
  return (
    <Card className="p-3.5 pt-3">
      <div className="stat-edge mb-2.5" style={{ backgroundColor: t.edge, opacity: tone === "default" ? 0.35 : 0.9, width: 22 }} />
      <div className="flex items-start justify-between gap-2">
        <Label>{label}</Label>
        {Icon && <Icon size={14} className="text-slate-300 shrink-0" />}
      </div>
      <div className={`mt-1.5 font-mono text-xl font-semibold tabular-nums tracking-tight ${t.text}`}>{value}</div>
      {sub && <div className="t11 text-slate-500 mt-0.5">{sub}</div>}
    </Card>
  );
};

const Empty = ({ icon: Icon = CircleDot, title, hint, action }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <Icon size={22} className="text-slate-300 mb-2" />
    <p className="text-sm font-medium text-slate-700">{title}</p>
    {hint && <p className="text-xs text-slate-500 mt-1 max-w-xs">{hint}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);

function Modal({ open, onClose, title, children, wide, footer }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto bg-slate-900 bg-opacity-40">
      <div className={`bg-white rounded-xl shadow-xl w-full ${wide ? "max-w-4xl" : "max-w-lg"} my-4`}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl z-10">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500"><X size={16} /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
      <Check size={14} className="text-amber-400" />{msg}
    </div>
  );
}

const Th = ({ children, className = "", ...p }) => (
  <th className={`text-left t10 font-semibold uppercase tracking-widest text-slate-400 px-3 py-2 whitespace-nowrap ${className}`} {...p}>{children}</th>
);
const Td = ({ children, className = "", ...p }) => (
  <td className={`px-3 py-2.5 text-sm text-slate-700 ${className}`} {...p}>{children}</td>
);

const ChartBox = ({ title, sub, children, height = 220, right }) => (
  <Card className="p-4">
    <SectionTitle sub={sub} right={right}>{title}</SectionTitle>
    <div style={{ height }}>{children}</div>
  </Card>
);

const tooltipStyle = {
  contentStyle: { fontSize: 12, borderRadius: 8, border: "1px solid #E4DED2", boxShadow: "0 8px 24px -8px rgba(7,46,42,0.18)" },
  labelStyle: { fontSize: 11, color: "#6E7F7A", fontWeight: 600 },
};
const axisProps = { tick: { fontSize: 11, fill: "#93A29C" }, axisLine: false, tickLine: false };

/* ============================================================
   DERIVED METRICS ENGINE
   ============================================================ */
function useDerived(db) {
  return useMemo(() => {
    const { leads, appointments, followups, campaigns, activities } = db;
    const byLead = (id) => leads.find((l) => l.id === id);

    const apptsByLead = {};
    appointments.forEach((a) => { (apptsByLead[a.leadId] = apptsByLead[a.leadId] || []).push(a); });
    const fuByLead = {};
    followups.forEach((f) => { (fuByLead[f.leadId] = fuByLead[f.leadId] || []).push(f); });
    const actByLead = {};
    activities.forEach((a) => { (actByLead[a.leadId] = actByLead[a.leadId] || []).push(a); });

    const openFollowups = followups.filter((f) => !f.completed);
    const nextFollowup = {};
    openFollowups.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((f) => {
      if (!nextFollowup[f.leadId]) nextFollowup[f.leadId] = f;
    });

    const lastTouch = {};
    activities.forEach((a) => {
      if (!lastTouch[a.leadId] || a.date > lastTouch[a.leadId]) lastTouch[a.leadId] = a.date;
    });

    const dealValue = (l) => (l.deal ? l.deal.finalPrice : l.estValue || 0);
    const wonLeads = leads.filter((l) => l.stage === "won");
    const revenue = wonLeads.reduce((s, l) => s + dealValue(l), 0);

    return { byLead, apptsByLead, fuByLead, actByLead, nextFollowup, lastTouch, dealValue, wonLeads, revenue, openFollowups };
  }, [db]);
}

/* Follow-up urgency */
function fuState(f) {
  if (f.completed) return { key: "done", label: "Completed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" };
  const d = daysDiff(f.date, todayISO);
  if (d < 0) return { key: "overdue", label: `${Math.abs(d)}d overdue`, cls: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" };
  if (d === 0) return { key: "today", label: "Due today", cls: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" };
  if (d === 1) return { key: "tomorrow", label: "Tomorrow", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" };
  return { key: "upcoming", label: `In ${d}d`, cls: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" };
}

/* ============================================================
   ALERTS ENGINE
   ============================================================ */
function buildAlerts(db, D) {
  const cfg = db.settings.notifications;
  const out = [];
  const add = (a) => out.push({ ...a, id: `${a.type}:${a.leadId || a.refId || ""}` });

  db.leads.forEach((l) => {
    if (l.stage === "won" || l.stage === "lost") return;
    const nf = D.nextFollowup[l.id];
    const touched = D.lastTouch[l.id] || l.createdAt;
    const idle = daysDiff(todayISO, touched);
    const stageAge = daysDiff(todayISO, l.updatedAt);
    const appts = (D.apptsByLead[l.id] || []).slice().sort((a, b) => b.date.localeCompare(a.date));
    const lastAppt = appts[0];

    if (cfg.overdueFollowUp && nf && nf.date < todayISO)
      add({ type: "overdue", priority: 1, leadId: l.id, title: `Follow-up ${Math.abs(daysDiff(nf.date, todayISO))} day(s) overdue`, detail: nf.note });
    if (cfg.hotLeadNoFollowUp && l.temperature === "hot" && !nf)
      add({ type: "hot_nofu", priority: 1, leadId: l.id, title: "Hot lead with no follow-up scheduled", detail: `Sitting in ${stageLabel(l.stage)}` });
    if (cfg.noShowFollowUp && lastAppt && lastAppt.status === "No-Show" && (!nf || nf.date < todayISO))
      add({ type: "noshow", priority: 1, leadId: l.id, title: "Trial no-show needs a re-book", detail: `Missed ${fmtDate(lastAppt.date)}` });
    if (l.stage === "trial_completed" && !l.deal)
      add({ type: "trial_nosale", priority: 1, leadId: l.id, title: "Trial completed but no package offered", detail: "Send a proposal" });
    if (l.stage === "new" && daysDiff(todayISO, l.createdAt) >= 1)
      add({ type: "uncontacted", priority: 2, leadId: l.id, title: "New lead not contacted yet", detail: `Created ${fmtDate(l.createdAt)}` });
    if (l.stage === "proposal" && stageAge >= 3)
      add({ type: "proposal_silent", priority: 2, leadId: l.id, title: "Proposal sent, no response", detail: `${stageAge} days since sent` });
    if (cfg.inactiveLead && idle >= cfg.inactiveDays)
      add({ type: "inactive", priority: 2, leadId: l.id, title: `No activity for ${idle} days`, detail: `Last touch ${fmtDate(touched)}` });
    if (cfg.staleStage && stageAge >= cfg.staleStageDays)
      add({ type: "stale", priority: 3, leadId: l.id, title: `Stuck in ${stageLabel(l.stage)} for ${stageAge} days`, detail: "Move it forward or mark lost" });
  });

  if (cfg.trialReminder) {
    db.appointments.forEach((a) => {
      const l = D.byLead(a.leadId);
      if (!l) return;
      if (a.date === todayISO && ["Booked", "Confirmed"].includes(a.status))
        add({ type: "trial_today", priority: 1, leadId: l.id, refId: a.id, title: `Trial today at ${a.time}`, detail: `${a.location}` });
      else if (a.date === addDays(todayISO, 1) && ["Booked", "Confirmed"].includes(a.status))
        add({ type: "trial_tmr", priority: 2, leadId: l.id, refId: a.id, title: `Trial tomorrow at ${a.time}`, detail: "Send a confirmation message" });
    });
  }
  const dismissed = new Set(db.dismissedAlerts || []);
  return out.filter((a) => !dismissed.has(a.id)).sort((a, b) => a.priority - b.priority);
}

const PRIORITY_META = {
  1: { label: "Urgent", cls: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  2: { label: "Needs attention", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  3: { label: "Watchlist", cls: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

/* ============================================================
   CSV EXPORT
   ============================================================ */
function downloadCSV(filename, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============================================================
   MAIN APP
   ============================================================ */
const NAV = [
  { id: "today", label: "Today", icon: Sun },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "leads", label: "Leads", icon: Users },
  { id: "pipeline", label: "Pipeline", icon: Kanban },
  { id: "followups", label: "Follow-Ups", icon: BellRing },
  { id: "appointments", label: "Appointments", icon: CalendarCheck },
  { id: "marketing", label: "Marketing", icon: Megaphone },
  { id: "sales", label: "Sales", icon: TrendingUp },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "alerts", label: "Alerts", icon: AlertTriangle },
  { id: "settings", label: "Settings", icon: SettingsIcon, adminOnly: true },
];

export default function FitnessAspireCRM() {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("today");
  const [openLeadId, setOpenLeadId] = useState(null);
  const [toast, setToast] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [preset, setPreset] = useState("month");
  const [custom, setCustom] = useState({ from: addDays(todayISO, -30), to: todayISO });
  const [search, setSearch] = useState("");
  const [leadModal, setLeadModal] = useState(null);
  const saveTimer = useRef(null);

  /* ---- load ---- */
  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get(STORAGE_KEY);
        if (res && res.value) { setDb(JSON.parse(res.value)); setLoading(false); return; }
      } catch (e) { /* first run */ }
      const seeded = seedData();
      setDb(seeded);
      setLoading(false);
      try { await storage.set(STORAGE_KEY, JSON.stringify(seeded)); } catch (e) {}
    })();
  }, []);

  /* ---- persist (debounced) ---- */
  useEffect(() => {
    if (!db) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      storage.set(STORAGE_KEY, JSON.stringify(db)).catch(() => {});
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [db]);

  const flash = useCallback((m) => { setToast(m); setTimeout(() => setToast(""), 2200); }, []);
  const range = useMemo(() => rangeFor(preset, custom), [preset, custom]);

  if (loading || !db) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl brand-mark flex items-center justify-center mx-auto mb-3">
            <span className="font-display font-bold text-sm" style={{ color: "#08302D" }}>FA</span>
          </div>
          <p className="text-sm text-slate-500">Loading your pipeline…</p>
        </div>
      </div>
    );
  }

  const me = db.users.find((u) => u.id === db.currentUserId) || db.users[0];
  const isAdmin = me.role === "admin";
  const nav = NAV.filter((n) => !n.adminOnly || isAdmin);

  return (
    <AppInner
      db={db} setDb={setDb} me={me} isAdmin={isAdmin} nav={nav}
      view={view} setView={setView} openLeadId={openLeadId} setOpenLeadId={setOpenLeadId}
      flash={flash} toast={toast} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
      preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom}
      range={range} search={search} setSearch={setSearch}
      leadModal={leadModal} setLeadModal={setLeadModal}
    />
  );
}

function AppInner(props) {
  const {
    db, setDb, me, isAdmin, nav, view, setView, openLeadId, setOpenLeadId,
    flash, toast, sidebarOpen, setSidebarOpen, preset, setPreset, custom, setCustom,
    range, search, setSearch, leadModal, setLeadModal,
  } = props;

  const D = useDerived(db);
  const alerts = useMemo(() => buildAlerts(db, D), [db, D]);

  /* ---------- mutations ---------- */
  const patchLead = useCallback((id, patch, activity) => {
    setDb((s) => {
      const leads = s.leads.map((l) => (l.id === id ? { ...l, ...patch, updatedAt: todayISO, updatedBy: me.name } : l));
      const activities = activity
        ? [...s.activities, { id: uid("act"), leadId: id, date: todayISO, by: me.name, ...activity }]
        : s.activities;
      return { ...s, leads, activities };
    });
  }, [setDb, me.name]);

  const addLead = useCallback((lead) => {
    setDb((s) => {
      const id = "L" + String(1000 + s.leads.length + Math.floor(Math.random() * 500));
      const l = { ...lead, id, createdAt: lead.createdAt || todayISO, updatedAt: todayISO, createdBy: me.name, updatedBy: me.name, deal: null, wonAt: null, lostReason: null };
      return {
        ...s, leads: [l, ...s.leads],
        activities: [...s.activities, { id: uid("act"), leadId: id, date: l.createdAt, type: "created", text: `Lead created from ${l.source}`, by: me.name }],
      };
    });
  }, [setDb, me.name]);

  const deleteLead = useCallback((id) => {
    setDb((s) => ({
      ...s,
      leads: s.leads.filter((l) => l.id !== id),
      activities: s.activities.filter((a) => a.leadId !== id),
      followups: s.followups.filter((f) => f.leadId !== id),
      appointments: s.appointments.filter((a) => a.leadId !== id),
      notes: s.notes.filter((n) => n.leadId !== id),
    }));
  }, [setDb]);

  const moveStage = useCallback((id, stage, extra = {}) => {
    const lead = db.leads.find((l) => l.id === id);
    if (!lead || lead.stage === stage) return;
    const patch = { stage, ...extra };
    if (stage === "won") { patch.wonAt = todayISO; patch.temperature = "hot"; }
    if (stage !== "lost") patch.lostReason = null;
    patchLead(id, patch, {
      type: stage === "won" ? "won" : stage === "lost" ? "lost" : "stage",
      text: stage === "lost" ? `Marked lost — ${extra.lostReason || "Other"}`
        : stage === "won" ? `Converted to client — ${RM(lead.deal ? lead.deal.finalPrice : lead.estValue)}`
        : `Moved to ${stageLabel(stage)}`,
    });
    flash(`${lead.name} → ${stageLabel(stage)}`);
  }, [db.leads, patchLead, flash]);

  const upsert = useCallback((key, item) => {
    setDb((s) => {
      const arr = s[key];
      const i = arr.findIndex((x) => x.id === item.id);
      return { ...s, [key]: i >= 0 ? arr.map((x) => (x.id === item.id ? item : x)) : [...arr, item] };
    });
  }, [setDb]);
  const removeFrom = useCallback((key, id) => {
    setDb((s) => ({ ...s, [key]: s[key].filter((x) => x.id !== id) }));
  }, [setDb]);

  const completeFollowup = useCallback((f) => {
    setDb((s) => ({
      ...s,
      followups: s.followups.map((x) => (x.id === f.id ? { ...x, completed: true, completedAt: todayISO } : x)),
      activities: [...s.activities, { id: uid("act"), leadId: f.leadId, date: todayISO, type: "message", text: `${f.type} follow-up completed — ${f.note}`, by: me.name }],
    }));
    flash("Follow-up marked done");
  }, [setDb, me.name, flash]);

  const dismissAlert = useCallback((id) => {
    setDb((s) => ({ ...s, dismissedAlerts: [...(s.dismissedAlerts || []), id] }));
  }, [setDb]);

  const ctx = {
    db, setDb, me, isAdmin, D, alerts, range, patchLead, addLead, deleteLead, moveStage,
    upsert, removeFrom, completeFollowup, dismissAlert, flash, setView, setOpenLeadId, setLeadModal,
  };

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return db.leads.filter((l) =>
      l.name.toLowerCase().includes(q) || l.phone.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [search, db.leads]);

  const urgentCount = alerts.filter((a) => a.priority === 1).length;
  const dueToday = D.openFollowups.filter((f) => f.date <= todayISO).length;

  const badgeFor = (id) => {
    if (id === "alerts" && urgentCount) return urgentCount;
    if (id === "followups" && dueToday) return dueToday;
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* theme lives in src/index.css */}
      {/* ---------- Sidebar ---------- */}
      {sidebarOpen && <div className="fixed inset-0 bg-slate-900 bg-opacity-40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-60 bg-slate-900 flex flex-col shrink-0 transform transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="px-4 py-4 flex items-center gap-2.5 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg brand-mark flex items-center justify-center shrink-0">
            <span className="font-display font-bold text-xs" style={{ color: "#08302D" }}>FA</span>
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-semibold leading-tight truncate">Fitness Aspire</div>
            <div className="t10 uppercase tracking-widest text-slate-500">Sales CRM</div>
          </div>
          <button className="ml-auto lg:hidden text-slate-400 p-1" onClick={() => setSidebarOpen(false)}><X size={16} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {nav.map((n) => {
            const active = view === n.id;
            const badge = badgeFor(n.id);
            return (
              <button key={n.id}
                onClick={() => { setView(n.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${active ? "nav-active text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>
                <n.icon size={16} className={active ? "text-amber-400" : ""} />
                <span className="flex-1 text-left">{n.label}</span>
                {badge ? <span className={`t10 font-mono font-semibold px-1.5 py-0.5 rounded ${n.id === "alerts" ? "bg-rose-500 text-white" : "bg-amber-500 text-slate-900"}`}>{badge}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <Label><span className="text-slate-500">Signed in as</span></Label>
          <select
            value={db.currentUserId}
            onChange={(e) => { setDb((s) => ({ ...s, currentUserId: e.target.value })); setView("today"); }}
            className="mt-1.5 w-full bg-slate-800 text-white text-sm rounded-lg px-2.5 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400">
            {db.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name} — {u.role === "admin" ? "Admin" : "Sales"}</option>)}
          </select>
        </div>
      </aside>

      {/* ---------- Main ---------- */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
          <div className="px-4 sm:px-6 py-3 flex items-center gap-3">
            <button className="lg:hidden p-1.5 -ml-1 rounded hover:bg-slate-100" onClick={() => setSidebarOpen(true)}><Menu size={18} /></button>
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, email or lead ID"
                className="w-full text-sm pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white" />
              {searchResults.length > 0 && (
                <div className="absolute mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-30">
                  {searchResults.map((l) => (
                    <button key={l.id} onClick={() => { setOpenLeadId(l.id); setSearch(""); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100 last:border-0">
                      <TempChip t={l.temperature} showLabel={false} />
                      <span className="text-sm font-medium">{l.name}</span>
                      <span className="text-xs text-slate-400 font-mono">{l.id}</span>
                      <span className="ml-auto"><StageBadge stage={l.stage} /></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {["dashboard", "marketing", "sales", "reports"].includes(view) && (
                <>
                  <Select value={preset} onChange={(e) => setPreset(e.target.value)} className="hidden sm:block w-40 py-1.5">
                    <option value="today">Today</option>
                    <option value="week">This week</option>
                    <option value="month">This month</option>
                    <option value="lastmonth">Last month</option>
                    <option value="quarter">This quarter</option>
                    <option value="ytd">Year to date</option>
                    <option value="all">All time</option>
                    <option value="custom">Custom range</option>
                  </Select>
                  {preset === "custom" && (
                    <div className="hidden md:flex items-center gap-1">
                      <Input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="py-1.5 w-36" />
                      <Input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="py-1.5 w-36" />
                    </div>
                  )}
                </>
              )}
              <Btn variant="accent" size="sm" onClick={() => setLeadModal({})}><Plus size={14} />New lead</Btn>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-full overflow-x-hidden">
          {view === "today" && <TodayView ctx={ctx} />}
          {view === "dashboard" && <DashboardView ctx={ctx} />}
          {view === "leads" && <LeadsView ctx={ctx} />}
          {view === "pipeline" && <PipelineView ctx={ctx} />}
          {view === "followups" && <FollowUpsView ctx={ctx} />}
          {view === "appointments" && <AppointmentsView ctx={ctx} />}
          {view === "marketing" && <MarketingView ctx={ctx} />}
          {view === "sales" && <SalesView ctx={ctx} />}
          {view === "reports" && <ReportsView ctx={ctx} />}
          {view === "alerts" && <AlertsView ctx={ctx} />}
          {view === "settings" && <SettingsView ctx={ctx} />}
        </main>
      </div>

      {openLeadId && <LeadProfile ctx={ctx} leadId={openLeadId} onClose={() => setOpenLeadId(null)} />}
      {leadModal && <LeadForm ctx={ctx} initial={leadModal} onClose={() => setLeadModal(null)} />}
      <Toast msg={toast} />
    </div>
  );
}

/* ============================================================
   TODAY
   ============================================================ */
function LeadRowMini({ lead, ctx, right, sub }) {
  return (
    <button onClick={() => ctx.setOpenLeadId(lead.id)}
      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left border-b border-slate-100 last:border-0">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tempMeta(lead.temperature).dot}`} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-900 truncate">{lead.name}</div>
        <div className="text-xs text-slate-500 truncate">{sub}</div>
      </div>
      {right}
    </button>
  );
}

function TodayView({ ctx }) {
  const { db, D, alerts, setOpenLeadId, completeFollowup, me, isAdmin } = ctx;
  const mine = (l) => isAdmin || l.ownerId === me.id;

  const openFu = D.openFollowups.filter((f) => { const l = D.byLead(f.leadId); return l && mine(l); });
  const overdue = openFu.filter((f) => f.date < todayISO).sort((a, b) => a.date.localeCompare(b.date));
  const today = openFu.filter((f) => f.date === todayISO);
  const tomorrow = openFu.filter((f) => f.date === addDays(todayISO, 1));

  const trialsToday = db.appointments.filter((a) => a.date === todayISO && D.byLead(a.leadId) && mine(D.byLead(a.leadId)));
  const trialsTomorrow = db.appointments.filter((a) => a.date === addDays(todayISO, 1) && ["Booked", "Confirmed"].includes(a.status));
  const newLeads = db.leads.filter((l) => mine(l) && l.stage === "new").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const hot = db.leads.filter((l) => mine(l) && l.temperature === "hot" && OPEN_STAGES.includes(l.stage));
  const pending = db.leads.filter((l) => mine(l) && ["proposal", "follow_up"].includes(l.stage));
  const pendingValue = pending.reduce((s, l) => s + D.dealValue(l), 0);
  const recent = db.activities.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const STAGE_HEX = {
    new: "#93A29C", contacted: "#6398C4", replied: "#43769F", qualified: "#6A5AA0",
    trial_offered: "#A8557E", trial_booked: "#2E8B84", trial_completed: "#40608F",
    proposal: "#C08F3E", follow_up: "#BE4630",
  };
  const openLeads = db.leads.filter((l) => mine(l) && OPEN_STAGES.includes(l.stage));
  const pulse = OPEN_STAGES.map((id) => {
    const ls = openLeads.filter((l) => l.stage === id);
    return { id, label: stageLabel(id), count: ls.length, value: ls.reduce((s, l) => s + D.dealValue(l), 0), hex: STAGE_HEX[id] };
  });
  const pulseTotal = pulse.reduce((s, p) => s + p.value, 0);

  return (
    <div className="space-y-5">
      {/* Signature: the daily triage panel + pipeline pulse */}
      <div className="hero-pine rounded-xl p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="t10 uppercase tracking-widest" style={{ color: "#6E9B93" }}>
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="text-white text-2xl font-semibold mt-1.5">{greet}, {me.name}</h1>
            <p className="text-sm mt-1.5" style={{ color: "#9DBDB6" }}>
              {overdue.length + today.length === 0
                ? "Nothing overdue. Work the new leads and keep the pipeline warm."
                : `${overdue.length + today.length} follow-up${overdue.length + today.length === 1 ? "" : "s"} need you today.`}
            </p>
          </div>
          <div className="flex gap-6 sm:gap-9">
            {[
              { n: overdue.length, l: "Overdue", c: "#E08B74" },
              { n: today.length, l: "Due today", c: "#E3B665" },
              { n: trialsToday.length, l: "Trials today", c: "#FFFFFF" },
              { n: newLeads.length, l: "New leads", c: "#FFFFFF" },
            ].map((k) => (
              <div key={k.l}>
                <div className="font-mono text-3xl font-semibold tabular-nums" style={{ color: k.c }}>{k.n}</div>
                <div className="t10 uppercase tracking-widest mt-1" style={{ color: "#6E9B93" }}>{k.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-rule my-5" />

        <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
          <span className="t10 uppercase tracking-widest" style={{ color: "#6E9B93" }}>Open pipeline</span>
          <span className="font-mono text-sm font-semibold" style={{ color: "#E3B665" }}>{RM(pulseTotal)}</span>
        </div>
        <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "#0B3D38" }}>
          {pulse.map((p) => (
            <div key={p.id} title={`${p.label}: ${p.count} leads · ${RM(p.value)}`}
              style={{ width: (pulseTotal ? (p.value / pulseTotal) * 100 : 0) + "%", backgroundColor: p.hex }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          {pulse.filter((p) => p.count > 0).map((p) => (
            <span key={p.id} className="t11 flex items-center gap-1.5" style={{ color: "#9DBDB6" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.hex }} />
              {p.label}<span className="font-mono" style={{ color: "#6E9B93" }}>{p.count}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Follow-ups requiring attention */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Follow-ups requiring attention</h2>
            <Btn variant="ghost" size="sm" onClick={() => ctx.setView("followups")}>View all <ChevronRight size={13} /></Btn>
          </div>
          {[...overdue, ...today, ...tomorrow].length === 0 ? (
            <Empty icon={Check} title="You're all caught up" hint="No follow-ups are due in the next 24 hours." />
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {[...overdue, ...today, ...tomorrow].map((f) => {
                const l = D.byLead(f.leadId); const st = fuState(f);
                return (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                    <button onClick={() => setOpenLeadId(l.id)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{l.name}</span>
                        <span className={`t11 font-medium px-1.5 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">{f.type} · {f.note}</div>
                    </button>
                    <Btn size="sm" variant="outline" onClick={() => completeFollowup(f)}><Check size={13} />Done</Btn>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Trials today */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Trials today</h2>
            <Btn variant="ghost" size="sm" onClick={() => ctx.setView("appointments")}>All <ChevronRight size={13} /></Btn>
          </div>
          {trialsToday.length === 0 ? <Empty icon={CalendarCheck} title="No trials today" hint="Book a trial from any qualified lead." /> : (
            <div className="divide-y divide-slate-100">
              {trialsToday.sort((a, b) => a.time.localeCompare(b.time)).map((a) => {
                const l = D.byLead(a.leadId);
                const tr = db.settings.trainers.find((t) => t.id === a.trainerId);
                return (
                  <button key={a.id} onClick={() => setOpenLeadId(l.id)} className="w-full text-left px-4 py-3 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{l.name}</span>
                      <span className="font-mono text-xs font-semibold text-slate-900">{a.time}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-slate-500 truncate">{tr?.name} · {a.location}</span>
                      <ApptBadge status={a.status} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {trialsTomorrow.length > 0 && (
            <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-100">
              <p className="text-xs text-amber-800">{trialsTomorrow.length} trial{trialsTomorrow.length === 1 ? "" : "s"} tomorrow — send confirmations today.</p>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold">New leads</h2>
            <span className="font-mono text-xs text-slate-400">{newLeads.length}</span>
          </div>
          {newLeads.length === 0 ? <Empty icon={Users} title="No untouched leads" /> :
            <div className="max-h-64 overflow-y-auto">
              {newLeads.slice(0, 8).map((l) => (
                <LeadRowMini key={l.id} lead={l} ctx={ctx} sub={`${l.source} · ${fmtDate(l.createdAt)}`}
                  right={<span className="font-mono text-xs text-slate-500">{RM(l.estValue)}</span>} />
              ))}
            </div>}
        </Card>

        <Card className="overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Hot leads</h2>
            <span className="font-mono text-xs text-slate-400">{hot.length}</span>
          </div>
          {hot.length === 0 ? <Empty icon={Flame} title="No hot leads right now" /> :
            <div className="max-h-64 overflow-y-auto">
              {hot.slice(0, 8).map((l) => (
                <LeadRowMini key={l.id} lead={l} ctx={ctx} sub={stageLabel(l.stage)}
                  right={<span className="font-mono text-xs text-slate-500">{RM(D.dealValue(l))}</span>} />
              ))}
            </div>}
        </Card>

        <Card className="overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Pending sales</h2>
            <span className="font-mono text-xs text-amber-600 font-semibold">{RM(pendingValue)}</span>
          </div>
          {pending.length === 0 ? <Empty icon={Wallet} title="No proposals outstanding" /> :
            <div className="max-h-64 overflow-y-auto">
              {pending.slice(0, 8).map((l) => (
                <LeadRowMini key={l.id} lead={l} ctx={ctx} sub={`${l.deal?.packageName || "Package TBC"} · ${stageLabel(l.stage)}`}
                  right={<span className="font-mono text-xs text-slate-500">{RM(D.dealValue(l))}</span>} />
              ))}
            </div>}
        </Card>

        <Card className="overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-200">
            <h2 className="text-sm font-semibold">Recent activity</h2>
          </div>
          <div className="max-h-64 overflow-y-auto px-3 py-2 space-y-2">
            {recent.map((a) => {
              const l = D.byLead(a.leadId);
              if (!l) return null;
              return (
                <button key={a.id} onClick={() => setOpenLeadId(l.id)} className="w-full text-left group">
                  <div className="flex gap-2">
                    <span className="font-mono t10 text-slate-400 pt-0.5 w-10 shrink-0">{fmtDate(a.date)}</span>
                    <p className="text-xs text-slate-600 group-hover:text-slate-900 leading-snug">
                      <span className="font-medium text-slate-800">{l.name}</span> — {a.text}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {alerts.filter((a) => a.priority === 1).length > 0 && (
        <Card className="overflow-hidden border-rose-200">
          <div className="px-4 py-3 border-b border-rose-100 bg-rose-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-rose-900 flex items-center gap-2"><AlertTriangle size={14} />Urgent alerts</h2>
            <Btn variant="ghost" size="sm" onClick={() => ctx.setView("alerts")}>All alerts <ChevronRight size={13} /></Btn>
          </div>
          <div className="divide-y divide-slate-100">
            {alerts.filter((a) => a.priority === 1).slice(0, 5).map((a) => {
              const l = D.byLead(a.leadId);
              return (
                <button key={a.id} onClick={() => setOpenLeadId(a.leadId)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-sm font-medium">{l?.name}</span>
                  <span className="text-sm text-slate-600 truncate">{a.title}</span>
                  <ChevronRight size={14} className="ml-auto text-slate-300 shrink-0" />
                </button>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function campaignSpendInRange(c, r) {
  const s = c.start > r.from ? c.start : r.from;
  const e = c.end < r.to ? c.end : r.to;
  if (s > e) return 0;
  const total = Math.max(1, daysDiff(c.end, c.start) + 1);
  const overlap = daysDiff(e, s) + 1;
  const elapsed = Math.min(total, Math.max(0, daysDiff(todayISO, c.start) + 1));
  const spentPerDay = c.spend / Math.max(1, elapsed);
  const billable = Math.min(overlap, Math.max(0, daysDiff(e > todayISO ? todayISO : e, s) + 1));
  return Math.round(spentPerDay * billable);
}

function bucketSeries(items, r, getDate) {
  const span = daysDiff(r.to, r.from);
  const mode = span <= 31 ? "day" : span <= 120 ? "week" : "month";
  const map = new Map();
  const keyOf = (iso) => {
    if (mode === "day") return iso;
    if (mode === "month") return iso.slice(0, 7);
    const d = new Date(iso + "T00:00:00");
    const dow = (d.getDay() + 6) % 7;
    return addDays(iso, -dow);
  };
  let cur = r.from;
  while (cur <= r.to) {
    map.set(keyOf(cur), 0);
    cur = addDays(cur, mode === "month" ? 28 : 1);
    if (map.size > 400) break;
  }
  items.forEach((it) => {
    const d = getDate(it);
    if (!d || d < r.from || d > r.to) return;
    const k = keyOf(d);
    map.set(k, (map.get(k) || 0) + 1);
  });
  return { mode, data: Array.from(map.entries()).map(([k, v]) => ({ key: k, label: mode === "month" ? k : fmtDate(k), value: v })) };
}

function DashboardView({ ctx }) {
  const { db, D, range } = ctx;
  const { leads, appointments, campaigns, followups, settings, users } = db;

  const m = useMemo(() => {
    const inLeads = leads.filter((l) => inRange(l.createdAt, range));
    const won = leads.filter((l) => l.stage === "won" && inRange(l.wonAt || l.updatedAt, range));
    const apts = appointments.filter((a) => inRange(a.date, range));
    const completed = apts.filter((a) => a.status === "Completed");
    const noshow = apts.filter((a) => a.status === "No-Show");
    const cancelled = apts.filter((a) => a.status === "Cancelled");
    const revenue = won.reduce((s, l) => s + D.dealValue(l), 0);
    const spend = campaigns.reduce((s, c) => s + campaignSpendInRange(c, range), 0);
    const dueToday = followups.filter((f) => !f.completed && f.date <= todayISO).length;
    const monthStart = `${TODAY.getFullYear()}-${pad(TODAY.getMonth() + 1)}-01`;
    const newThisMonth = leads.filter((l) => l.createdAt >= monthStart).length;
    return {
      inLeads, won, apts, completed, noshow, cancelled, revenue, spend, dueToday, newThisMonth,
      cpl: inLeads.length ? spend / inLeads.length : 0,
      cpa: won.length ? spend / won.length : 0,
      convRate: pct(won.length, inLeads.length),
      showRate: pct(completed.length, apts.filter((a) => a.status !== "Cancelled").length),
      noShowRate: pct(noshow.length, apts.filter((a) => a.status !== "Cancelled").length),
      roas: spend ? revenue / spend : 0,
      avgDeal: won.length ? revenue / won.length : 0,
    };
  }, [leads, appointments, campaigns, followups, range, D]);

  const leadsSeries = useMemo(() => bucketSeries(m.inLeads, range, (l) => l.createdAt), [m.inLeads, range]);
  const revenueSeries = useMemo(() => {
    const b = bucketSeries(m.won, range, (l) => l.wonAt || l.updatedAt);
    const map = new Map(b.data.map((d) => [d.key, 0]));
    m.won.forEach((l) => {
      const iso = l.wonAt || l.updatedAt;
      const keys = b.data.map((d) => d.key).filter((k) => k <= iso);
      const k = keys[keys.length - 1];
      if (k !== undefined) map.set(k, (map.get(k) || 0) + D.dealValue(l));
    });
    return b.data.map((d) => ({ ...d, value: map.get(d.key) || 0 }));
  }, [m.won, range, D]);

  const bySource = useMemo(() => {
    return settings.leadSources.map((src) => {
      const ls = m.inLeads.filter((l) => l.source === src);
      const w = ls.filter((l) => l.stage === "won");
      const trials = ls.filter((l) => (D.apptsByLead[l.id] || []).length > 0);
      const rev = w.reduce((s, l) => s + D.dealValue(l), 0);
      const spend = campaigns.filter((c) => c.platform === src).reduce((s, c) => s + campaignSpendInRange(c, range), 0);
      return {
        source: src, leads: ls.length, trials: trials.length, clients: w.length,
        conv: pct(w.length, ls.length), revenue: rev, spend,
        cpl: ls.length ? Math.round(spend / ls.length) : 0,
        cpa: w.length ? Math.round(spend / w.length) : 0,
        roas: spend ? num(rev / spend, 2) : 0,
      };
    }).filter((r) => r.leads > 0 || r.spend > 0);
  }, [m.inLeads, settings.leadSources, campaigns, range, D]);

  const funnel = useMemo(() => {
    const total = m.inLeads.length || 1;
    const count = (fn) => m.inLeads.filter(fn).length;
    const reached = (stage) => count((l) => stageIndex(l.stage) >= stageIndex(stage) && l.stage !== "lost") +
      count((l) => l.stage === "lost" && stageIndex(l.stage) >= stageIndex(stage));
    const step = (label, n) => ({ label, n, p: pct(n, total) });
    const hadTrial = count((l) => (D.apptsByLead[l.id] || []).length > 0);
    const didTrial = count((l) => (D.apptsByLead[l.id] || []).some((a) => a.status === "Completed"));
    return [
      step("Leads", m.inLeads.length),
      step("Contacted", count((l) => stageIndex(l.stage) >= 1 || l.stage === "lost")),
      step("Qualified", count((l) => stageIndex(l.stage) >= 3 && l.stage !== "lost") + count((l) => l.stage === "lost" && l.deal)),
      step("Trial booked", hadTrial),
      step("Trial completed", didTrial),
      step("Proposal sent", count((l) => !!l.deal)),
      step("Won", m.won.length),
    ];
  }, [m.inLeads, m.won, D]);

  const salesPerf = useMemo(() => users.filter((u) => u.active).map((u) => {
    const ls = m.inLeads.filter((l) => l.ownerId === u.id);
    const w = leads.filter((l) => l.ownerId === u.id && l.stage === "won" && inRange(l.wonAt || l.updatedAt, range));
    return { name: u.name, leads: ls.length, clients: w.length, revenue: w.reduce((s, l) => s + D.dealValue(l), 0), conv: pct(w.length, ls.length) };
  }).filter((r) => r.leads || r.clients), [users, m.inLeads, leads, range, D]);

  const fuStatus = useMemo(() => {
    const open = followups.filter((f) => !f.completed);
    return [
      { name: "Overdue", value: open.filter((f) => f.date < todayISO).length, color: "#BE4630" },
      { name: "Due today", value: open.filter((f) => f.date === todayISO).length, color: "#E09A2A" },
      { name: "Tomorrow", value: open.filter((f) => f.date === addDays(todayISO, 1)).length, color: "#C08F3E" },
      { name: "Upcoming", value: open.filter((f) => f.date > addDays(todayISO, 1)).length, color: "#43769F" },
      { name: "Completed", value: followups.filter((f) => f.completed).length, color: "#1C7A5E" },
    ].filter((x) => x.value > 0);
  }, [followups]);

  const lostReasons = useMemo(() => {
    const lost = leads.filter((l) => l.stage === "lost" && inRange(l.updatedAt, range));
    const map = {};
    lost.forEach((l) => { map[l.lostReason || "Other"] = (map[l.lostReason || "Other"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [leads, range]);

  const trialBars = [
    { name: "Booked", value: m.apts.length },
    { name: "Attended", value: m.completed.length },
    { name: "No-show", value: m.noshow.length },
    { name: "Cancelled", value: m.cancelled.length },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Sales dashboard</h1>
        <p className="text-sm text-slate-500">{range.label} · {fmtDateFull(range.from)} – {fmtDateFull(range.to)}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Total leads" value={m.inLeads.length} sub={`${db.leads.length} all time`} icon={Users} />
        <Stat label="New this month" value={m.newThisMonth} icon={ArrowUpRight} />
        <Stat label="Trials booked" value={m.apts.length} icon={CalendarCheck} />
        <Stat label="Trials completed" value={m.completed.length} sub={`${m.showRate}% show rate`} tone="good" icon={UserCheck} />
        <Stat label="No-shows" value={m.noshow.length} sub={`${m.noShowRate}% no-show rate`} tone="bad" icon={CalendarX} />
        <Stat label="Conversion rate" value={m.convRate + "%"} sub="Lead → client" tone="accent" icon={Target} />
        <Stat label="New clients" value={m.won.length} tone="good" icon={Trophy} />
        <Stat label="Sales revenue" value={RM(m.revenue)} sub={`Avg deal ${RM(m.avgDeal)}`} tone="good" icon={Wallet} />
        <Stat label="Marketing spend" value={RM(m.spend)} icon={Megaphone} />
        <Stat label="Cost per lead" value={RM(m.cpl)} icon={ArrowDownRight} />
        <Stat label="Cost per acquisition" value={RM(m.cpa)} icon={ArrowDownRight} />
        <Stat label="Follow-ups due" value={m.dueToday} sub="Today or overdue" tone={m.dueToday ? "bad" : "good"} icon={BellRing} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartBox title="Leads generated over time" sub={`Grouped by ${leadsSeries.mode}`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={leadsSeries.data}>
              <defs>
                <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E1" vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={20} />
              <YAxis {...axisProps} allowDecimals={false} width={28} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="value" name="Leads" stroke={ACCENT} strokeWidth={2} fill="url(#gLeads)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>

        <ChartBox title="Revenue over time" sub="Closed-won value">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E1" vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={20} />
              <YAxis {...axisProps} width={48} tickFormatter={(v) => (v >= 1000 ? v / 1000 + "k" : v)} />
              <Tooltip {...tooltipStyle} formatter={(v) => RM(v)} />
              <Bar dataKey="value" name="Revenue" fill="#1C7A5E" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>

        <ChartBox title="Leads by source" sub="Where enquiries come from">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bySource} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E1" horizontal={false} />
              <XAxis type="number" {...axisProps} allowDecimals={false} />
              <YAxis type="category" dataKey="source" {...axisProps} width={76} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="leads" name="Leads" fill={ACCENT} radius={[0, 3, 3, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>

        <ChartBox title="Marketing spend by source" sub="Prorated to the selected period">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bySource.filter((s) => s.spend > 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E1" vertical={false} />
              <XAxis dataKey="source" {...axisProps} />
              <YAxis {...axisProps} width={48} tickFormatter={(v) => (v >= 1000 ? v / 1000 + "k" : v)} />
              <Tooltip {...tooltipStyle} formatter={(v) => RM(v)} />
              <Bar dataKey="spend" name="Spend" fill="#43769F" radius={[3, 3, 0, 0]} barSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>

        <ChartBox title="Trials: booked vs attended vs no-show">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trialBars}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E1" vertical={false} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} allowDecimals={false} width={28} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="value" name="Sessions" radius={[3, 3, 0, 0]} barSize={40}>
                {trialBars.map((b, i) => <Cell key={i} fill={["#93A29C", "#1C7A5E", "#BE4630", "#D3CBBB"][i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>

        <ChartBox title="Conversion rate by source" sub="Lead → paying client">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bySource}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E1" vertical={false} />
              <XAxis dataKey="source" {...axisProps} />
              <YAxis {...axisProps} width={34} unit="%" />
              <Tooltip {...tooltipStyle} formatter={(v) => v + "%"} />
              <Bar dataKey="conv" name="Conversion" fill="#6A5AA0" radius={[3, 3, 0, 0]} barSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>

        {/* Funnel */}
        <Card className="p-4 lg:col-span-2">
          <SectionTitle sub="Every lead created in this period, tracked to its furthest stage">Lead-to-client conversion funnel</SectionTitle>
          <div className="space-y-1.5 mt-3">
            {funnel.map((f, i) => {
              const prev = i > 0 ? funnel[i - 1].n : f.n;
              const drop = prev ? Math.round(((prev - f.n) / prev) * 100) : 0;
              return (
                <div key={f.label} className="flex items-center gap-3">
                  <div className="w-28 sm:w-36 shrink-0 text-xs text-slate-600 text-right">{f.label}</div>
                  <div className="flex-1 h-7 bg-slate-100 rounded overflow-hidden relative">
                    <div className="h-full rounded transition-all flex items-center px-2"
                      style={{ width: Math.max(f.p, 3) + "%", backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}>
                      <span className="font-mono t11 font-semibold text-white">{f.n}</span>
                    </div>
                  </div>
                  <div className="w-14 shrink-0 font-mono text-xs text-slate-500 tabular-nums">{f.p}%</div>
                  <div className="w-16 shrink-0 t11 text-rose-500 hidden sm:block">{i > 0 && drop > 0 ? `−${drop}%` : ""}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <ChartBox title="Salesperson performance" sub="Clients closed in this period">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salesPerf}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E1" vertical={false} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} allowDecimals={false} width={28} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="leads" name="Leads" fill="#D3CBBB" radius={[3, 3, 0, 0]} barSize={16} />
              <Bar dataKey="clients" name="Clients" fill={ACCENT} radius={[3, 3, 0, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>

        <ChartBox title="Follow-up status" sub="Across all open leads">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={fuStatus} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={2}>
                {fuStatus.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartBox>

        <ChartBox title="Why we lose leads" sub="Reasons recorded on lost leads" height={240}>
          {lostReasons.length === 0 ? <Empty icon={Check} title="No leads lost in this period" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lostReasons} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E1" horizontal={false} />
                <XAxis type="number" {...axisProps} allowDecimals={false} />
                <YAxis type="category" dataKey="name" {...axisProps} width={120} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" name="Leads lost" fill="#BE4630" radius={[0, 3, 3, 0]} barSize={13} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartBox>

        <Card className="p-4">
          <SectionTitle sub="Return on ad spend across all tracked campaigns">Marketing efficiency</SectionTitle>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="p-3 bg-slate-50 rounded-lg">
              <Label>ROAS</Label>
              <div className="font-mono text-2xl font-semibold mt-1">{num(m.roas, 2)}×</div>
              <p className="t11 text-slate-500 mt-1">{RM(m.revenue)} from {RM(m.spend)}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <Label>Revenue per lead</Label>
              <div className="font-mono text-2xl font-semibold mt-1">{RM(m.inLeads.length ? m.revenue / m.inLeads.length : 0)}</div>
              <p className="t11 text-slate-500 mt-1">Across {m.inLeads.length} leads</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <Label>Trial → sale</Label>
              <div className="font-mono text-2xl font-semibold mt-1">{pct(m.won.length, m.completed.length)}%</div>
              <p className="t11 text-slate-500 mt-1">{m.won.length} of {m.completed.length} completed trials</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <Label>Lead → trial</Label>
              <div className="font-mono text-2xl font-semibold mt-1">{pct(m.apts.length, m.inLeads.length)}%</div>
              <p className="t11 text-slate-500 mt-1">{m.apts.length} trials from {m.inLeads.length} leads</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   LEADS
   ============================================================ */
function LeadsView({ ctx }) {
  const { db, D, setOpenLeadId, setLeadModal } = ctx;
  const [f, setF] = useState({ q: "", source: "", owner: "", stage: "", temp: "", location: "", pkg: "", trial: "", from: "", to: "" });
  const [sort, setSort] = useState({ key: "createdAt", dir: "desc" });
  const [showFilters, setShowFilters] = useState(false);

  const rows = useMemo(() => {
    let r = db.leads.filter((l) => {
      const q = f.q.trim().toLowerCase();
      if (q && !(l.name.toLowerCase().includes(q) || l.phone.includes(q) || l.email.toLowerCase().includes(q) || l.id.toLowerCase().includes(q))) return false;
      if (f.source && l.source !== f.source) return false;
      if (f.owner && l.ownerId !== f.owner) return false;
      if (f.stage && l.stage !== f.stage) return false;
      if (f.temp && l.temperature !== f.temp) return false;
      if (f.location && l.preferredLocation !== f.location) return false;
      if (f.pkg && l.packageId !== f.pkg) return false;
      if (f.from && l.createdAt < f.from) return false;
      if (f.to && l.createdAt > f.to) return false;
      if (f.trial) {
        const apts = D.apptsByLead[l.id] || [];
        if (f.trial === "none" && apts.length) return false;
        if (f.trial !== "none" && !apts.some((a) => a.status === f.trial)) return false;
      }
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    r.sort((a, b) => {
      let av, bv;
      if (sort.key === "value") { av = D.dealValue(a); bv = D.dealValue(b); }
      else if (sort.key === "stage") { av = stageIndex(a.stage); bv = stageIndex(b.stage); }
      else { av = a[sort.key] || ""; bv = b[sort.key] || ""; }
      return av > bv ? dir : av < bv ? -dir : 0;
    });
    return r;
  }, [db.leads, f, sort, D]);

  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
  const owner = (id) => db.users.find((u) => u.id === id)?.name || "—";
  const activeFilters = Object.entries(f).filter(([k, v]) => v && k !== "q").length;

  const exportRows = () => {
    downloadCSV(`fitness-aspire-leads-${todayISO}.csv`, [
      ["Lead ID", "Name", "Phone", "Email", "Gender", "Age", "Location", "Preferred location", "Created", "Source", "Campaign", "Ad", "Salesperson", "Stage", "Temperature", "Goal", "Package", "Est. value (RM)", "Lost reason", "Next follow-up"],
      ...rows.map((l) => [
        l.id, l.name, l.phone, l.email, l.gender, l.age, l.location, l.preferredLocation, l.createdAt, l.source,
        db.campaigns.find((c) => c.id === l.campaignId)?.name || "", l.adName, owner(l.ownerId), stageLabel(l.stage),
        l.temperature, l.goal, db.settings.packages.find((p) => p.id === l.packageId)?.name || "", D.dealValue(l),
        l.lostReason || "", D.nextFollowup[l.id]?.date || "",
      ]),
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-slate-500">{rows.length} of {db.leads.length} prospects</p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="outline" size="sm" onClick={() => setShowFilters((s) => !s)}>
            <Filter size={14} />Filters{activeFilters ? <span className="ml-1 font-mono t10 bg-amber-500 text-slate-900 px-1.5 rounded">{activeFilters}</span> : null}
          </Btn>
          <Btn variant="outline" size="sm" onClick={exportRows}><Download size={14} />Export CSV</Btn>
          <Btn variant="accent" size="sm" onClick={() => setLeadModal({})}><Plus size={14} />New lead</Btn>
        </div>
      </div>

      <Card className="p-3">
        <Input placeholder="Filter by name, phone, email or lead ID" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-2.5 mt-3 pt-3 border-t border-slate-100">
            <Field label="Source">
              <Select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
                <option value="">All sources</option>{db.settings.leadSources.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Salesperson">
              <Select value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>
                <option value="">Everyone</option>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </Field>
            <Field label="Stage">
              <Select value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>
                <option value="">All stages</option>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Temperature">
              <Select value={f.temp} onChange={(e) => setF({ ...f, temp: e.target.value })}>
                <option value="">Any</option>{TEMPS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Trial status">
              <Select value={f.trial} onChange={(e) => setF({ ...f, trial: e.target.value })}>
                <option value="">Any</option><option value="none">No trial booked</option>
                {APPT_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Preferred location">
              <Select value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })}>
                <option value="">All locations</option>{db.settings.locations.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Package">
              <Select value={f.pkg} onChange={(e) => setF({ ...f, pkg: e.target.value })}>
                <option value="">Any package</option>{db.settings.packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Created from"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
            <Field label="Created to"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
            <div className="flex items-end">
              <Btn variant="subtle" size="sm" onClick={() => setF({ q: f.q, source: "", owner: "", stage: "", temp: "", location: "", pkg: "", trial: "", from: "", to: "" })}>
                <RotateCcw size={13} />Clear filters
              </Btn>
            </div>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <Empty icon={Users} title="No leads match these filters" hint="Adjust the filters, or add a lead to get started."
            action={<Btn variant="accent" size="sm" onClick={() => setLeadModal({})}><Plus size={14} />Add a lead</Btn>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {[["name", "Prospect"], ["stage", "Stage"], ["temperature", "Temp"], ["source", "Source"], ["ownerId", "Owner"], ["value", "Value"], ["createdAt", "Created"]].map(([k, label]) => (
                    <Th key={k}><button onClick={() => toggleSort(k)} className="hover:text-slate-700 flex items-center gap-1">
                      {label}{sort.key === k && <ChevronDown size={11} className={sort.dir === "asc" ? "rotate-180" : ""} />}
                    </button></Th>
                  ))}
                  <Th>Next follow-up</Th>
                  <Th>Trial</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((l) => {
                  const nf = D.nextFollowup[l.id];
                  const st = nf ? fuState(nf) : null;
                  const apts = (D.apptsByLead[l.id] || []).slice().sort((a, b) => b.date.localeCompare(a.date));
                  return (
                    <tr key={l.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setOpenLeadId(l.id)}>
                      <Td>
                        <div className="font-medium text-slate-900">{l.name}</div>
                        <div className="text-xs text-slate-400 font-mono">{l.id} · {l.phone}</div>
                      </Td>
                      <Td><StageBadge stage={l.stage} /></Td>
                      <Td><TempChip t={l.temperature} /></Td>
                      <Td><span className="text-xs text-slate-600">{l.source}</span></Td>
                      <Td><span className="text-xs text-slate-600">{owner(l.ownerId)}</span></Td>
                      <Td><span className="font-mono text-xs tabular-nums">{RM(D.dealValue(l))}</span></Td>
                      <Td><span className="font-mono text-xs text-slate-500">{fmtDate(l.createdAt)}</span></Td>
                      <Td>{st ? <span className={`t11 font-medium px-1.5 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
                        : <span className="text-xs text-slate-300">None</span>}</Td>
                      <Td>{apts[0] ? <ApptBadge status={apts[0].status} /> : <span className="text-xs text-slate-300">—</span>}</Td>
                      <Td><ChevronRight size={14} className="text-slate-300" /></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- New / edit lead ---------- */
function LeadForm({ ctx, initial, onClose }) {
  const { db, addLead, patchLead, flash, me } = ctx;
  const editing = !!initial.id;
  const [v, setV] = useState({
    name: "", phone: "", email: "", gender: "Female", age: "", location: db.settings.locations[0],
    preferredLocation: db.settings.locations[0], createdAt: todayISO, source: db.settings.leadSources[0],
    campaignId: "", adName: "", ownerId: me.id, trainerId: "", stage: "new", temperature: "warm",
    goal: db.settings.goals[0], packageId: db.settings.packages[0]?.id || "", estValue: db.settings.packages[0]?.price || 0,
    ...initial,
  });
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));

  const onPackage = (pid) => {
    const p = db.settings.packages.find((x) => x.id === pid);
    setV((s) => ({ ...s, packageId: pid, estValue: p ? p.price : s.estValue }));
  };

  const save = () => {
    if (!v.name.trim() || !v.phone.trim()) { flash("Name and phone are required"); return; }
    const payload = { ...v, age: Number(v.age) || null, estValue: Number(v.estValue) || 0, campaignId: v.campaignId || null };
    if (editing) { patchLead(v.id, payload, { type: "note", text: "Lead details updated" }); flash("Lead updated"); }
    else { addLead(payload); flash("Lead added"); }
    onClose();
  };

  return (
    <Modal open onClose={onClose} wide title={editing ? `Edit ${v.name}` : "New lead"}
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="accent" onClick={save}><Save size={14} />{editing ? "Save changes" : "Add lead"}</Btn></>}>
      <div className="space-y-4">
        <div>
          <p className="t10 font-semibold uppercase tracking-widest text-slate-400 mb-2">Personal information</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Full name"><Input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Sarah Tan" /></Field>
            <Field label="Phone number"><Input value={v.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+6012-345 6789" /></Field>
            <Field label="Email"><Input value={v.email} onChange={(e) => set("email", e.target.value)} placeholder="name@email.com" /></Field>
            <Field label="Gender"><Select value={v.gender} onChange={(e) => set("gender", e.target.value)}><option>Female</option><option>Male</option><option>Prefer not to say</option></Select></Field>
            <Field label="Age"><Input type="number" value={v.age} onChange={(e) => set("age", e.target.value)} /></Field>
            <Field label="Lives in"><Select value={v.location} onChange={(e) => set("location", e.target.value)}>{db.settings.locations.map((l) => <option key={l}>{l}</option>)}</Select></Field>
            <Field label="Preferred training location"><Select value={v.preferredLocation} onChange={(e) => set("preferredLocation", e.target.value)}>{db.settings.locations.map((l) => <option key={l}>{l}</option>)}</Select></Field>
            <Field label="Fitness goal"><Select value={v.goal} onChange={(e) => set("goal", e.target.value)}>{db.settings.goals.map((g) => <option key={g}>{g}</option>)}</Select></Field>
          </div>
        </div>
        <div className="pt-3 border-t border-slate-100">
          <p className="t10 font-semibold uppercase tracking-widest text-slate-400 mb-2">Lead information</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Date created"><Input type="date" value={v.createdAt} onChange={(e) => set("createdAt", e.target.value)} /></Field>
            <Field label="Lead source"><Select value={v.source} onChange={(e) => set("source", e.target.value)}>{db.settings.leadSources.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Campaign">
              <Select value={v.campaignId || ""} onChange={(e) => set("campaignId", e.target.value)}>
                <option value="">Not from a campaign</option>{db.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Ad name"><Input value={v.adName} onChange={(e) => set("adName", e.target.value)} placeholder="e.g. Creative A" /></Field>
            <Field label="Assigned salesperson"><Select value={v.ownerId} onChange={(e) => set("ownerId", e.target.value)}>{db.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
            <Field label="Assigned trainer"><Select value={v.trainerId} onChange={(e) => set("trainerId", e.target.value)}><option value="">Unassigned</option>{db.settings.trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
            <Field label="Stage"><Select value={v.stage} onChange={(e) => set("stage", e.target.value)}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
            <Field label="Temperature"><Select value={v.temperature} onChange={(e) => set("temperature", e.target.value)}>{TEMPS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select></Field>
            <Field label="Interested package"><Select value={v.packageId} onChange={(e) => onPackage(e.target.value)}>{db.settings.packages.map((p) => <option key={p.id} value={p.id}>{p.name} — {RM(p.price)}</option>)}</Select></Field>
            <Field label="Estimated value (RM)"><Input type="number" value={v.estValue} onChange={(e) => set("estValue", e.target.value)} /></Field>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   PROSPECT PROFILE
   ============================================================ */
const ACT_ICON = {
  created: CircleDot, message: MessageCircle, reply: MessageCircle, stage: ChevronRight,
  appointment: CalendarCheck, deal: Wallet, won: Trophy, lost: X, alert: AlertTriangle, note: Pencil,
};

function LeadProfile({ ctx, leadId, onClose }) {
  const { db, D, patchLead, moveStage, upsert, removeFrom, completeFollowup, setDb, me, flash, setLeadModal, deleteLead, isAdmin } = ctx;
  const lead = db.leads.find((l) => l.id === leadId);
  const [tab, setTab] = useState("overview");
  const [fuModal, setFuModal] = useState(null);
  const [aptModal, setAptModal] = useState(null);
  const [dealModal, setDealModal] = useState(false);
  const [lostModal, setLostModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  useEffect(() => { setTab("overview"); }, [leadId]);
  if (!lead) return null;

  const owner = db.users.find((u) => u.id === lead.ownerId);
  const trainer = db.settings.trainers.find((t) => t.id === lead.trainerId);
  const camp = db.campaigns.find((c) => c.id === lead.campaignId);
  const acts = (D.actByLead[lead.id] || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const fus = (D.fuByLead[lead.id] || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const apts = (D.apptsByLead[lead.id] || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const leadNotes = db.notes.filter((n) => n.leadId === lead.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const nf = D.nextFollowup[lead.id];

  const addNote = () => {
    if (!noteText.trim()) return;
    setDb((s) => ({
      ...s,
      notes: [...s.notes, { id: uid("nt"), leadId: lead.id, text: noteText.trim(), by: me.name, createdAt: todayISO }],
      activities: [...s.activities, { id: uid("act"), leadId: lead.id, date: todayISO, type: "note", text: "Note added", by: me.name }],
    }));
    setNoteText(""); flash("Note saved");
  };

  const nextStage = STAGES[Math.min(stageIndex(lead.stage) + 1, 9)];
  const tabs = [["overview", "Overview"], ["timeline", "Timeline"], ["followups", `Follow-ups (${fus.length})`], ["appointments", `Trials (${apts.length})`], ["deal", "Package"], ["notes", `Notes (${leadNotes.length})`]];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900 bg-opacity-40" onClick={onClose}>
      <div className="bg-slate-50 w-full max-w-3xl h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold tracking-tight truncate">{lead.name}</h2>
                  <TempChip t={lead.temperature} />
                  <span className="font-mono text-xs text-slate-400">{lead.id}</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1"><Phone size={12} />{lead.phone}</span>
                  <span className="flex items-center gap-1"><Mail size={12} />{lead.email || "No email"}</span>
                  <span>{lead.gender}{lead.age ? `, ${lead.age}` : ""}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Btn variant="ghost" size="sm" onClick={() => setLeadModal(lead)}><Pencil size={14} /></Btn>
                {isAdmin && <Btn variant="ghost" size="sm" onClick={() => { if (confirm(`Delete ${lead.name} and all their history?`)) { deleteLead(lead.id); onClose(); flash("Lead deleted"); } }}><Trash2 size={14} /></Btn>}
                <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><X size={17} /></button>
              </div>
            </div>

            {/* key strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-100">
              <div><Label>Stage</Label><div className="mt-1"><StageBadge stage={lead.stage} /></div></div>
              <div><Label>Next follow-up</Label><div className="mt-1 text-xs font-medium">{nf ? <span className={`px-1.5 py-0.5 rounded border ${fuState(nf).cls}`}>{fmtDate(nf.date)}</span> : <span className="text-slate-400">Not scheduled</span>}</div></div>
              <div><Label>Salesperson</Label><div className="mt-1 text-sm">{owner?.name || "—"}</div></div>
              <div><Label>Trainer</Label><div className="mt-1 text-sm">{trainer?.name || "Unassigned"}</div></div>
              <div><Label>Deal value</Label><div className="mt-1 font-mono text-sm font-semibold text-amber-600">{RM(D.dealValue(lead))}</div></div>
            </div>

            {/* actions */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {!["won", "lost"].includes(lead.stage) && (
                <Btn size="sm" variant="default" onClick={() => moveStage(lead.id, nextStage.id)}>
                  Move to {nextStage.label}<ChevronRight size={13} />
                </Btn>
              )}
              <Btn size="sm" variant="outline" onClick={() => setFuModal({ leadId: lead.id })}><BellRing size={13} />Schedule follow-up</Btn>
              <Btn size="sm" variant="outline" onClick={() => setAptModal({ leadId: lead.id })}><CalendarCheck size={13} />Book trial</Btn>
              <Btn size="sm" variant="outline" onClick={() => setDealModal(true)}><Wallet size={13} />{lead.deal ? "Edit package" : "Offer package"}</Btn>
              {lead.stage !== "won" && <Btn size="sm" variant="success" onClick={() => moveStage(lead.id, "won")}><Trophy size={13} />Mark won</Btn>}
              {lead.stage !== "lost" && <Btn size="sm" variant="ghost" onClick={() => setLostModal(true)}>Mark lost</Btn>}
            </div>
          </div>

          <div className="px-5 flex gap-1 overflow-x-auto">
            {tabs.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap ${tab === id ? "border-amber-500 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {tab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <SectionTitle>Lead information</SectionTitle>
                <dl className="space-y-2 text-sm">
                  {[["Lead ID", lead.id], ["Created", fmtDateFull(lead.createdAt)], ["Source", lead.source],
                    ["Campaign", camp?.name || "—"], ["Ad", lead.adName || "—"], ["Fitness goal", lead.goal],
                    ["Lives in", lead.location], ["Trains at", lead.preferredLocation],
                    ["Interested package", db.settings.packages.find((p) => p.id === lead.packageId)?.name || "—"],
                    ["Created by", lead.createdBy], ["Last updated", `${fmtDateFull(lead.updatedAt)} by ${lead.updatedBy}`]].map(([k, val]) => (
                    <div key={k} className="flex justify-between gap-3 border-b border-slate-50 pb-1.5 last:border-0">
                      <dt className="text-slate-500">{k}</dt><dd className="text-slate-900 text-right">{val}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
              <div className="space-y-4">
                <Card className="p-4">
                  <SectionTitle>Pipeline progress</SectionTitle>
                  <div className="space-y-1.5">
                    {STAGES.slice(0, 10).map((s, i) => {
                      const done = stageIndex(lead.stage) >= i && lead.stage !== "lost";
                      const current = lead.stage === s.id;
                      return (
                        <button key={s.id} onClick={() => moveStage(lead.id, s.id)}
                          className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${current ? "bg-amber-50 border border-amber-200" : "hover:bg-slate-50 border border-transparent"}`}>
                          <span className={`w-2 h-2 rounded-full ${done ? s.color : "bg-slate-200"}`} />
                          <span className={done ? "text-slate-900 font-medium" : "text-slate-400"}>{s.label}</span>
                          {current && <span className="ml-auto t10 uppercase tracking-widest text-amber-600 font-semibold">Now</span>}
                        </button>
                      );
                    })}
                    {lead.stage === "lost" && (
                      <div className="mt-2 p-2.5 bg-slate-100 rounded-lg">
                        <Label>Lost reason</Label>
                        <p className="text-sm text-slate-700 mt-0.5">{lead.lostReason}</p>
                      </div>
                    )}
                  </div>
                </Card>
                <Card className="p-4">
                  <SectionTitle>Temperature</SectionTitle>
                  <div className="flex gap-2">
                    {TEMPS.map((t) => (
                      <button key={t.id} onClick={() => patchLead(lead.id, { temperature: t.id }, { type: "note", text: `Temperature set to ${t.label}` })}
                        className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 ${lead.temperature === t.id ? t.chip : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                        <t.icon size={13} />{t.label}
                      </button>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {tab === "timeline" && (
            <Card className="p-5">
              <SectionTitle sub="Everything that has happened with this prospect">Activity timeline</SectionTitle>
              {acts.length === 0 ? <Empty title="No activity yet" /> : (
                <div className="relative mt-4 pl-6">
                  <div className="absolute left-2 top-1 bottom-1 w-px bg-slate-200" />
                  {acts.map((a) => {
                    const Icon = ACT_ICON[a.type] || CircleDot;
                    return (
                      <div key={a.id} className="relative pb-5 last:pb-0">
                        <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center">
                          <Icon size={9} className="text-slate-500" />
                        </div>
                        <div className="flex items-baseline gap-3">
                          <span className="font-mono t11 text-slate-400 w-12 shrink-0">{fmtDate(a.date)}</span>
                          <div>
                            <p className="text-sm text-slate-800">{a.text}</p>
                            <p className="t11 text-slate-400 mt-0.5">{a.by}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {tab === "followups" && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Follow-up history</h3>
                <Btn size="sm" variant="accent" onClick={() => setFuModal({ leadId: lead.id })}><Plus size={13} />Schedule</Btn>
              </div>
              {fus.length === 0 ? <Empty icon={BellRing} title="No follow-ups scheduled" hint="Schedule one so this lead never goes quiet." /> : (
                <div className="divide-y divide-slate-100">
                  {fus.map((f) => {
                    const st = fuState(f);
                    return (
                      <div key={f.id} className="px-4 py-3 flex items-start gap-3">
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${st.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{f.type}</span>
                            <span className="font-mono text-xs text-slate-500">{fmtDate(f.date)} {f.time}</span>
                            <span className={`t11 px-1.5 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{f.note}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {!f.completed && <Btn size="sm" variant="outline" onClick={() => completeFollowup(f)}><Check size={13} /></Btn>}
                          <Btn size="sm" variant="ghost" onClick={() => removeFrom("followups", f.id)}><Trash2 size={13} /></Btn>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {tab === "appointments" && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Trial appointments</h3>
                <Btn size="sm" variant="accent" onClick={() => setAptModal({ leadId: lead.id })}><Plus size={13} />Book trial</Btn>
              </div>
              {apts.length === 0 ? <Empty icon={CalendarCheck} title="No trials booked" hint="A booked trial is the strongest predictor of a sale." /> : (
                <div className="divide-y divide-slate-100">
                  {apts.map((a) => (
                    <div key={a.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-medium">{fmtDate(a.date)} · {a.time}</span>
                          <ApptBadge status={a.status} />
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {db.settings.trainers.find((t) => t.id === a.trainerId)?.name || "No trainer"} · {a.location}
                        </p>
                      </div>
                      <Select value={a.status} className="w-36 py-1.5 text-xs"
                        onChange={(e) => {
                          upsert("appointments", { ...a, status: e.target.value, updatedAt: todayISO });
                          setDb((s) => ({ ...s, activities: [...s.activities, { id: uid("act"), leadId: lead.id, date: todayISO, type: "appointment", text: `Trial marked ${e.target.value}`, by: me.name }] }));
                          if (e.target.value === "Completed" && stageIndex(lead.stage) < 6) moveStage(lead.id, "trial_completed");
                        }}>
                        {APPT_STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </Select>
                      <Btn size="sm" variant="ghost" onClick={() => removeFrom("appointments", a.id)}><Trash2 size={13} /></Btn>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === "deal" && (
            <Card className="p-4">
              <SectionTitle right={<Btn size="sm" variant="accent" onClick={() => setDealModal(true)}>{lead.deal ? "Edit" : "Create"}</Btn>}>Package / deal</SectionTitle>
              {!lead.deal ? <Empty icon={Wallet} title="No package offered yet" hint="Record the package you quoted so it lands in your forecast." /> : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                  {[["Package", lead.deal.packageName], ["Sessions", lead.deal.sessions],
                    ["List price", RM(lead.deal.price)], ["Discount", RM(lead.deal.discount)],
                    ["Final price", RM(lead.deal.finalPrice)], ["Deposit", RM(lead.deal.deposit)],
                    ["Payment status", lead.deal.paymentStatus], ["Expected close", fmtDateFull(lead.deal.expectedClose)],
                    ["Balance due", RM(Math.max(0, lead.deal.finalPrice - lead.deal.deposit))]].map(([k, val]) => (
                    <div key={k} className="p-3 bg-slate-50 rounded-lg">
                      <Label>{k}</Label>
                      <div className="text-sm font-medium mt-1 font-mono">{val}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === "notes" && (
            <Card className="p-4">
              <SectionTitle>Notes</SectionTitle>
              <div className="flex gap-2 mb-4">
                <Textarea rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="What did you learn about this prospect?" />
                <Btn variant="accent" onClick={addNote}>Add</Btn>
              </div>
              {leadNotes.length === 0 ? <Empty icon={Pencil} title="No notes yet" hint="Context here saves the next conversation." /> : (
                <div className="space-y-2">
                  {leadNotes.map((n) => (
                    <div key={n.id} className="p-3 bg-slate-50 rounded-lg group">
                      <p className="text-sm text-slate-800">{n.text}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="t11 text-slate-400">{n.by} · {fmtDateFull(n.createdAt)}</p>
                        <button onClick={() => removeFrom("notes", n.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {fuModal && <FollowUpForm ctx={ctx} initial={fuModal} onClose={() => setFuModal(null)} />}
      {aptModal && <AppointmentForm ctx={ctx} initial={aptModal} onClose={() => setAptModal(null)} />}
      {dealModal && <DealForm ctx={ctx} lead={lead} onClose={() => setDealModal(false)} />}
      {lostModal && <LostForm ctx={ctx} lead={lead} onClose={() => setLostModal(false)} />}
    </div>
  );
}

/* ---------- Sub-forms ---------- */
function FollowUpForm({ ctx, initial, onClose }) {
  const { db, setDb, me, flash } = ctx;
  const [v, setV] = useState({ date: addDays(todayISO, 1), time: "10:00", type: "WhatsApp", note: "", ...initial });
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
  const save = () => {
    const item = { id: v.id || uid("fu"), leadId: v.leadId, date: v.date, time: v.time, type: v.type, note: v.note.trim() || "Follow up", completed: false, completedAt: null, createdAt: todayISO, ownerId: me.id };
    setDb((s) => ({
      ...s,
      followups: v.id ? s.followups.map((f) => (f.id === v.id ? item : f)) : [...s.followups, item],
      activities: [...s.activities, { id: uid("act"), leadId: v.leadId, date: todayISO, type: "note", text: `${v.type} follow-up scheduled for ${fmtDate(v.date)}`, by: me.name }],
    }));
    flash("Follow-up scheduled"); onClose();
  };
  return (
    <Modal open onClose={onClose} title="Schedule a follow-up"
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="accent" onClick={save}>Schedule</Btn></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={v.date} onChange={(e) => set("date", e.target.value)} /></Field>
          <Field label="Time"><Input type="time" value={v.time} onChange={(e) => set("time", e.target.value)} /></Field>
        </div>
        <Field label="Channel"><Select value={v.type} onChange={(e) => set("type", e.target.value)}>{FOLLOWUP_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="What to say"><Textarea rows={3} value={v.note} onChange={(e) => set("note", e.target.value)} placeholder="e.g. Confirm she's happy with the evening slot and close on the 24-session package" /></Field>
      </div>
    </Modal>
  );
}

function AppointmentForm({ ctx, initial, onClose }) {
  const { db, setDb, me, flash, moveStage } = ctx;
  const lead = db.leads.find((l) => l.id === initial.leadId);
  const [v, setV] = useState({
    date: addDays(todayISO, 2), time: "18:30", trainerId: lead?.trainerId || db.settings.trainers[0]?.id || "",
    location: lead?.preferredLocation || db.settings.locations[0], status: "Booked", notes: "", ...initial,
  });
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
  const save = () => {
    const item = { id: v.id || uid("apt"), leadId: v.leadId, date: v.date, time: v.time, trainerId: v.trainerId, location: v.location, status: v.status, notes: v.notes, createdAt: todayISO, updatedAt: todayISO };
    setDb((s) => ({
      ...s,
      appointments: v.id ? s.appointments.map((a) => (a.id === v.id ? item : a)) : [...s.appointments, item],
      activities: [...s.activities, { id: uid("act"), leadId: v.leadId, date: todayISO, type: "appointment", text: `Trial booked for ${fmtDate(v.date)} at ${v.time}`, by: me.name }],
    }));
    if (lead && stageIndex(lead.stage) < 5) moveStage(lead.id, "trial_booked");
    flash("Trial booked"); onClose();
  };
  return (
    <Modal open onClose={onClose} title={`Book a trial${lead ? ` — ${lead.name}` : ""}`}
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="accent" onClick={save}>Book trial</Btn></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={v.date} onChange={(e) => set("date", e.target.value)} /></Field>
          <Field label="Time"><Input type="time" value={v.time} onChange={(e) => set("time", e.target.value)} /></Field>
          <Field label="Trainer"><Select value={v.trainerId} onChange={(e) => set("trainerId", e.target.value)}>{db.settings.trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
          <Field label="Location"><Select value={v.location} onChange={(e) => set("location", e.target.value)}>{db.settings.locations.map((l) => <option key={l}>{l}</option>)}</Select></Field>
        </div>
        <Field label="Status"><Select value={v.status} onChange={(e) => set("status", e.target.value)}>{APPT_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Notes"><Textarea rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything the trainer should know" /></Field>
      </div>
    </Modal>
  );
}

function DealForm({ ctx, lead, onClose }) {
  const { db, patchLead, flash } = ctx;
  const d = lead.deal;
  const pkg0 = db.settings.packages.find((p) => p.id === (d?.packageId || lead.packageId)) || db.settings.packages[0];
  const [v, setV] = useState({
    packageId: pkg0?.id || "", price: d?.price ?? pkg0?.price ?? 0, discount: d?.discount ?? 0,
    deposit: d?.deposit ?? 0, paymentStatus: d?.paymentStatus || "Unpaid",
    expectedClose: d?.expectedClose || addDays(todayISO, 7),
  });
  const pkg = db.settings.packages.find((p) => p.id === v.packageId);
  const finalPrice = Math.max(0, Number(v.price) - Number(v.discount));
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
  const onPkg = (id) => { const p = db.settings.packages.find((x) => x.id === id); setV((s) => ({ ...s, packageId: id, price: p ? p.price : s.price })); };
  const save = () => {
    const deal = {
      packageId: v.packageId, packageName: pkg?.name || "Custom", sessions: pkg?.sessions || 0,
      price: Number(v.price), discount: Number(v.discount), finalPrice,
      deposit: Number(v.deposit), paymentStatus: v.paymentStatus, expectedClose: v.expectedClose,
    };
    const patch = { deal, estValue: finalPrice, packageId: v.packageId };
    if (stageIndex(lead.stage) < 7 && lead.stage !== "won") patch.stage = "proposal";
    patchLead(lead.id, patch, { type: "deal", text: `${deal.packageName} offered — ${RM(finalPrice)}` });
    flash("Package saved"); onClose();
  };
  return (
    <Modal open onClose={onClose} title="Package offered"
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="accent" onClick={save}>Save package</Btn></>}>
      <div className="space-y-3">
        <Field label="Package"><Select value={v.packageId} onChange={(e) => onPkg(e.target.value)}>{db.settings.packages.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.sessions} sessions — {RM(p.price)}</option>)}</Select></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Price (RM)"><Input type="number" value={v.price} onChange={(e) => set("price", e.target.value)} /></Field>
          <Field label="Discount (RM)"><Input type="number" value={v.discount} onChange={(e) => set("discount", e.target.value)} /></Field>
          <Field label="Final price"><div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg font-mono text-sm font-semibold text-amber-800">{RM(finalPrice)}</div></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Deposit (RM)"><Input type="number" value={v.deposit} onChange={(e) => set("deposit", e.target.value)} /></Field>
          <Field label="Payment status"><Select value={v.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value)}>{PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Expected close"><Input type="date" value={v.expectedClose} onChange={(e) => set("expectedClose", e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
}

function LostForm({ ctx, lead, onClose }) {
  const { db, moveStage } = ctx;
  const [reason, setReason] = useState(db.settings.lostReasons[0]);
  return (
    <Modal open onClose={onClose} title={`Mark ${lead.name} as lost`}
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="danger" onClick={() => { moveStage(lead.id, "lost", { lostReason: reason }); onClose(); }}>Mark lost</Btn></>}>
      <p className="text-sm text-slate-600 mb-3">A reason is required — this is what powers the lost-lead analytics.</p>
      <Field label="Reason"><Select value={reason} onChange={(e) => setReason(e.target.value)}>{db.settings.lostReasons.map((r) => <option key={r}>{r}</option>)}</Select></Field>
    </Modal>
  );
}

/* ============================================================
   PIPELINE (Kanban)
   ============================================================ */
function PipelineView({ ctx }) {
  const { db, D, moveStage, setOpenLeadId } = ctx;
  const [ownerFilter, setOwnerFilter] = useState("");
  const [tempFilter, setTempFilter] = useState("");
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);
  const [lostFor, setLostFor] = useState(null);

  const leads = db.leads.filter((l) =>
    (!ownerFilter || l.ownerId === ownerFilter) && (!tempFilter || l.temperature === tempFilter));

  const cols = STAGES.map((s) => {
    const items = leads.filter((l) => l.stage === s.id);
    return { ...s, items, value: items.reduce((sum, l) => sum + D.dealValue(l), 0) };
  });

  const drop = (stageId) => {
    setOverStage(null);
    if (!dragId) return;
    if (stageId === "lost") { setLostFor(dragId); setDragId(null); return; }
    moveStage(dragId, stageId);
    setDragId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Pipeline</h1>
          <p className="text-sm text-slate-500">Drag a card to move it. {leads.filter((l) => OPEN_STAGES.includes(l.stage)).length} open leads worth {RM(leads.filter((l) => OPEN_STAGES.includes(l.stage)).reduce((s, l) => s + D.dealValue(l), 0))}</p>
        </div>
        <div className="flex gap-2">
          <Select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="w-40 py-1.5">
            <option value="">All salespeople</option>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <Select value={tempFilter} onChange={(e) => setTempFilter(e.target.value)} className="w-32 py-1.5">
            <option value="">Any temp</option>{TEMPS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto pb-4 -mx-4 sm:-mx-6 px-4 sm:px-6">
        <div className="flex gap-3 min-w-max">
          {cols.map((c) => (
            <div key={c.id}
              onDragOver={(e) => { e.preventDefault(); setOverStage(c.id); }}
              onDragLeave={() => setOverStage((s) => (s === c.id ? null : s))}
              onDrop={() => drop(c.id)}
              className={`w-64 shrink-0 rounded-xl transition-colors ${overStage === c.id ? "bg-amber-50 ring-2 ring-amber-300" : "bg-slate-100"}`}>
              <div className="px-3 py-2.5 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${c.color}`} />
                  <span className="text-xs font-semibold text-slate-700 flex-1 truncate">{c.label}</span>
                  <span className="font-mono t11 text-slate-500">{c.items.length}</span>
                </div>
                <div className="font-mono t11 text-slate-500 mt-0.5 pl-3.5">{RM(c.value)}</div>
              </div>
              <div className="p-2 space-y-2 kanban-col max-h-screen overflow-y-auto">
                {c.items.length === 0 && <p className="t11 text-slate-400 text-center py-4">Drop a lead here</p>}
                {c.items.map((l) => {
                  const nf = D.nextFollowup[l.id];
                  const apt = (D.apptsByLead[l.id] || []).slice().sort((a, b) => b.date.localeCompare(a.date))[0];
                  const st = nf ? fuState(nf) : null;
                  return (
                    <div key={l.id} draggable
                      onDragStart={() => setDragId(l.id)} onDragEnd={() => setDragId(null)}
                      onClick={() => setOpenLeadId(l.id)}
                      className={`bg-white rounded-lg border border-slate-200 p-2.5 cursor-pointer hover:border-amber-300 hover:shadow-sm transition-all ${dragId === l.id ? "opacity-40" : ""}`}>
                      <div className="flex items-start gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${tempMeta(l.temperature).dot}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate leading-tight">{l.name}</p>
                          <p className="t11 text-slate-500 truncate">{l.source} · {db.users.find((u) => u.id === l.ownerId)?.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-mono text-xs font-semibold text-slate-800">{RM(D.dealValue(l))}</span>
                        {apt && <span className="font-mono t10 text-slate-500 flex items-center gap-1"><CalendarCheck size={10} />{fmtDate(apt.date)}</span>}
                      </div>
                      {st && <div className={`mt-1.5 t10 px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${st.cls}`}><Clock size={9} />{st.label}</div>}
                      {l.stage === "lost" && l.lostReason && <div className="mt-1.5 t10 text-slate-500">{l.lostReason}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {lostFor && <LostForm ctx={ctx} lead={db.leads.find((l) => l.id === lostFor)} onClose={() => setLostFor(null)} />}
    </div>
  );
}

/* ============================================================
   FOLLOW-UPS
   ============================================================ */
function FollowUpsView({ ctx }) {
  const { db, D, completeFollowup, setOpenLeadId, removeFrom } = ctx;
  const [filter, setFilter] = useState("open");
  const [owner, setOwner] = useState("");
  const [modal, setModal] = useState(null);

  const list = useMemo(() => {
    let f = db.followups.filter((x) => D.byLead(x.leadId));
    if (owner) f = f.filter((x) => D.byLead(x.leadId).ownerId === owner);
    if (filter === "open") f = f.filter((x) => !x.completed);
    if (filter === "overdue") f = f.filter((x) => !x.completed && x.date < todayISO);
    if (filter === "today") f = f.filter((x) => !x.completed && x.date === todayISO);
    if (filter === "tomorrow") f = f.filter((x) => !x.completed && x.date === addDays(todayISO, 1));
    if (filter === "completed") f = f.filter((x) => x.completed);
    return f.sort((a, b) => a.date.localeCompare(b.date));
  }, [db.followups, filter, owner, D]);

  const open = db.followups.filter((f) => !f.completed);
  const counts = {
    overdue: open.filter((f) => f.date < todayISO).length,
    today: open.filter((f) => f.date === todayISO).length,
    tomorrow: open.filter((f) => f.date === addDays(todayISO, 1)).length,
    completed: db.followups.filter((f) => f.completed).length,
  };

  const groups = useMemo(() => {
    const g = {};
    list.forEach((f) => { (g[f.date] = g[f.date] || []).push(f); });
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [list]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Follow-ups</h1>
          <p className="text-sm text-slate-500">Never lose a lead because nobody followed up</p>
        </div>
        <Select value={owner} onChange={(e) => setOwner(e.target.value)} className="w-44 py-1.5">
          <option value="">All salespeople</option>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Overdue" value={counts.overdue} tone="bad" icon={AlertTriangle} />
        <Stat label="Due today" value={counts.today} tone="accent" icon={Clock} />
        <Stat label="Tomorrow" value={counts.tomorrow} icon={CalendarCheck} />
        <Stat label="Completed" value={counts.completed} tone="good" icon={Check} />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[["open", "All open"], ["overdue", "Overdue"], ["today", "Due today"], ["tomorrow", "Tomorrow"], ["completed", "Completed"], ["all", "Everything"]].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${filter === id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            {label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <Card><Empty icon={Check} title="Nothing here" hint="No follow-ups match this filter." /></Card>
      ) : (
        <div className="space-y-3">
          {groups.map(([date, items]) => {
            const rel = daysDiff(date, todayISO);
            const heading = rel === 0 ? "Today" : rel === 1 ? "Tomorrow" : rel === -1 ? "Yesterday" : fmtDateFull(date);
            return (
              <div key={date}>
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="text-xs font-semibold text-slate-700">{heading}</h3>
                  {rel < 0 && !items[0].completed && <span className="t10 font-semibold uppercase tracking-widest text-rose-600">Overdue</span>}
                  <span className="font-mono t11 text-slate-400">{items.length}</span>
                </div>
                <Card className="overflow-hidden divide-y divide-slate-100">
                  {items.map((f) => {
                    const l = D.byLead(f.leadId); const st = fuState(f);
                    return (
                      <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                        <button onClick={() => setOpenLeadId(l.id)} className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{l.name}</span>
                            <TempChip t={l.temperature} showLabel={false} />
                            <StageBadge stage={l.stage} />
                            <span className="font-mono t11 text-slate-400">{f.time}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{f.type} · {f.note}</p>
                        </button>
                        <span className="font-mono text-xs text-slate-500 hidden sm:block">{RM(D.dealValue(l))}</span>
                        {!f.completed && <Btn size="sm" variant="outline" onClick={() => completeFollowup(f)}><Check size={13} />Done</Btn>}
                        <Btn size="sm" variant="ghost" onClick={() => setModal({ ...f })}><Pencil size={13} /></Btn>
                        <Btn size="sm" variant="ghost" onClick={() => removeFrom("followups", f.id)}><Trash2 size={13} /></Btn>
                      </div>
                    );
                  })}
                </Card>
              </div>
            );
          })}
        </div>
      )}
      {modal && <FollowUpForm ctx={ctx} initial={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ============================================================
   APPOINTMENTS
   ============================================================ */
function AppointmentsView({ ctx }) {
  const { db, D, upsert, removeFrom, setOpenLeadId, setDb, me, moveStage } = ctx;
  const [tab, setTab] = useState("upcoming");
  const [modal, setModal] = useState(null);

  const all = db.appointments.filter((a) => D.byLead(a.leadId));
  const list = useMemo(() => {
    let r = all;
    if (tab === "upcoming") r = r.filter((a) => a.date >= todayISO && ["Booked", "Confirmed", "Rescheduled"].includes(a.status));
    if (tab === "today") r = r.filter((a) => a.date === todayISO);
    if (tab === "past") r = r.filter((a) => a.date < todayISO);
    if (tab === "noshow") r = r.filter((a) => a.status === "No-Show");
    return r.slice().sort((a, b) => (tab === "past" || tab === "noshow" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  }, [all, tab]);

  const held = all.filter((a) => a.status !== "Cancelled" && a.date <= todayISO);
  const completed = all.filter((a) => a.status === "Completed");
  const noshow = all.filter((a) => a.status === "No-Show");
  const cancelled = all.filter((a) => a.status === "Cancelled");
  const wonFromTrial = completed.filter((a) => D.byLead(a.leadId)?.stage === "won").length;
  const noSaleYet = completed.filter((a) => { const l = D.byLead(a.leadId); return l && !["won", "lost"].includes(l.stage) && !l.deal; });

  const setStatus = (a, status) => {
    upsert("appointments", { ...a, status, updatedAt: todayISO });
    setDb((s) => ({ ...s, activities: [...s.activities, { id: uid("act"), leadId: a.leadId, date: todayISO, type: "appointment", text: `Trial marked ${status}`, by: me.name }] }));
    const l = D.byLead(a.leadId);
    if (status === "Completed" && l && stageIndex(l.stage) < 6) moveStage(l.id, "trial_completed");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Trial appointments</h1>
          <p className="text-sm text-slate-500">{all.length} trials on record</p>
        </div>
        <Btn variant="accent" size="sm" onClick={() => setModal({ leadId: db.leads.find((l) => OPEN_STAGES.includes(l.stage))?.id })}><Plus size={14} />Book a trial</Btn>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Show rate" value={pct(completed.length, held.length) + "%"} sub={`${completed.length} of ${held.length} held`} tone="good" icon={UserCheck} />
        <Stat label="No-show rate" value={pct(noshow.length, held.length) + "%"} sub={`${noshow.length} missed`} tone="bad" icon={CalendarX} />
        <Stat label="Cancellation rate" value={pct(cancelled.length, all.length) + "%"} sub={`${cancelled.length} cancelled`} icon={X} />
        <Stat label="Trial → sale" value={pct(wonFromTrial, completed.length) + "%"} sub={`${wonFromTrial} converted`} tone="accent" icon={Target} />
      </div>

      {noSaleYet.length > 0 && (
        <Card className="p-3 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            <AlertTriangle size={14} className="inline mr-1.5 -mt-0.5" />
            {noSaleYet.length} completed trial{noSaleYet.length === 1 ? " has" : "s have"} no package offered yet — that's the fastest revenue in the system.
          </p>
        </Card>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {[["upcoming", "Upcoming"], ["today", "Today"], ["past", "Past"], ["noshow", "No-shows"], ["all", "All"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${tab === id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>{label}</button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {list.length === 0 ? <Empty icon={CalendarCheck} title="No trials here" hint="Book a trial from any qualified lead's profile." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr><Th>Date</Th><Th>Time</Th><Th>Prospect</Th><Th>Trainer</Th><Th>Location</Th><Th>Status</Th><Th>Stage</Th><Th /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((a) => {
                  const l = D.byLead(a.leadId);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <Td><span className="font-mono text-xs">{fmtDate(a.date)}</span>{a.date === todayISO && <span className="ml-1.5 t10 font-semibold uppercase tracking-wider text-amber-600">Today</span>}</Td>
                      <Td><span className="font-mono text-xs">{a.time}</span></Td>
                      <Td><button onClick={() => setOpenLeadId(l.id)} className="font-medium hover:text-amber-600">{l.name}</button></Td>
                      <Td><span className="text-xs">{db.settings.trainers.find((t) => t.id === a.trainerId)?.name || "—"}</span></Td>
                      <Td><span className="text-xs">{a.location}</span></Td>
                      <Td>
                        <Select value={a.status} onChange={(e) => setStatus(a, e.target.value)} className="w-32 py-1 text-xs">
                          {APPT_STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </Select>
                      </Td>
                      <Td><StageBadge stage={l.stage} /></Td>
                      <Td><Btn size="sm" variant="ghost" onClick={() => removeFrom("appointments", a.id)}><Trash2 size={13} /></Btn></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {modal && modal.leadId && <AppointmentForm ctx={ctx} initial={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ============================================================
   MARKETING
   ============================================================ */
function MarketingView({ ctx }) {
  const { db, D, range, upsert, removeFrom, isAdmin, flash } = ctx;
  const [modal, setModal] = useState(null);
  const [sortKey, setSortKey] = useState("leads");

  const campaignStats = useMemo(() => db.campaigns.map((c) => {
    const ls = db.leads.filter((l) => l.campaignId === c.id);
    const trials = ls.filter((l) => (D.apptsByLead[l.id] || []).length > 0);
    const clients = ls.filter((l) => l.stage === "won");
    const revenue = clients.reduce((s, l) => s + D.dealValue(l), 0);
    return {
      ...c, leads: ls.length, trials: trials.length, clients: clients.length, revenue,
      cpl: ls.length ? c.spend / ls.length : 0,
      cpt: trials.length ? c.spend / trials.length : 0,
      cpa: clients.length ? c.spend / clients.length : 0,
      conv: pct(clients.length, ls.length),
      roas: c.spend ? revenue / c.spend : 0,
      rpl: ls.length ? revenue / ls.length : 0,
      pacing: c.budget ? pct(c.spend, c.budget) : 0,
    };
  }), [db.campaigns, db.leads, D]);

  const sourceStats = useMemo(() => db.settings.leadSources.map((src) => {
    const ls = db.leads.filter((l) => l.source === src);
    const trials = ls.filter((l) => (D.apptsByLead[l.id] || []).length > 0);
    const clients = ls.filter((l) => l.stage === "won");
    const revenue = clients.reduce((s, l) => s + D.dealValue(l), 0);
    const spend = db.campaigns.filter((c) => c.platform === src).reduce((s, c) => s + c.spend, 0);
    return {
      source: src, leads: ls.length, trials: trials.length, clients: clients.length,
      conv: pct(clients.length, ls.length), revenue, spend,
      cpl: ls.length ? Math.round(spend / ls.length) : 0,
      cpa: clients.length ? Math.round(spend / clients.length) : 0,
      roas: spend ? num(revenue / spend, 2) : 0,
    };
  }).filter((r) => r.leads || r.spend), [db.settings.leadSources, db.leads, db.campaigns, D]);

  const sorted = useMemo(() => {
    const dirAsc = ["cpl", "cpa"].includes(sortKey);
    return sourceStats.slice().sort((a, b) => (dirAsc ? (a[sortKey] || Infinity) - (b[sortKey] || Infinity) : b[sortKey] - a[sortKey]));
  }, [sourceStats, sortKey]);

  const totals = sourceStats.reduce((t, r) => ({
    leads: t.leads + r.leads, trials: t.trials + r.trials, clients: t.clients + r.clients,
    revenue: t.revenue + r.revenue, spend: t.spend + r.spend,
  }), { leads: 0, trials: 0, clients: 0, revenue: 0, spend: 0 });

  const exportSources = () => downloadCSV(`fitness-aspire-source-analytics-${todayISO}.csv`, [
    ["Source", "Leads", "Trials", "Clients", "Conversion %", "Revenue RM", "Spend RM", "CPL RM", "CPA RM", "ROAS"],
    ...sorted.map((r) => [r.source, r.leads, r.trials, r.clients, r.conv, r.revenue, r.spend, r.cpl, r.cpa, r.roas]),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Marketing</h1>
          <p className="text-sm text-slate-500">Campaign spend and what it actually bought you</p>
        </div>
        {isAdmin && <Btn variant="accent" size="sm" onClick={() => setModal({})}><Plus size={14} />New campaign</Btn>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Total spend" value={RM(totals.spend)} icon={Megaphone} />
        <Stat label="Leads" value={totals.leads} icon={Users} />
        <Stat label="Trials" value={totals.trials} icon={CalendarCheck} />
        <Stat label="Clients" value={totals.clients} tone="good" icon={Trophy} />
        <Stat label="Revenue" value={RM(totals.revenue)} tone="good" icon={Wallet} />
        <Stat label="Blended ROAS" value={(totals.spend ? num(totals.revenue / totals.spend, 2) : 0) + "×"} tone="accent" icon={TrendingUp} />
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold">Campaigns</h2>
          <p className="text-xs text-slate-500 mt-0.5">Enter budget and spend — every metric below is calculated for you</p>
        </div>
        {db.campaigns.length === 0 ? <Empty icon={Megaphone} title="No campaigns tracked" hint="Add a campaign to start measuring cost per lead." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr><Th>Campaign</Th><Th>Platform</Th><Th>Dates</Th><Th>Budget</Th><Th>Spend</Th><Th>Pacing</Th><Th>Leads</Th><Th>Trials</Th><Th>Clients</Th><Th>Revenue</Th><Th>CPL</Th><Th>CPT</Th><Th>CPA</Th><Th>ROAS</Th>{isAdmin && <Th />}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaignStats.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <Td><div className="font-medium">{c.name}</div><div className="text-xs text-slate-400">{c.type}</div></Td>
                    <Td><span className="text-xs">{c.platform}</span></Td>
                    <Td><span className="font-mono text-xs text-slate-500">{fmtDate(c.start)} – {fmtDate(c.end)}</span></Td>
                    <Td><span className="font-mono text-xs">{RM(c.budget)}</span></Td>
                    <Td><span className="font-mono text-xs font-semibold">{RM(c.spend)}</span></Td>
                    <Td>
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${c.pacing > 100 ? "bg-rose-500" : "bg-amber-500"}`} style={{ width: Math.min(100, c.pacing) + "%" }} />
                      </div>
                      <span className="font-mono t10 text-slate-400">{c.pacing}%</span>
                    </Td>
                    <Td><span className="font-mono text-xs">{c.leads}</span></Td>
                    <Td><span className="font-mono text-xs">{c.trials}</span></Td>
                    <Td><span className="font-mono text-xs font-semibold">{c.clients}</span></Td>
                    <Td><span className="font-mono text-xs text-emerald-700">{RM(c.revenue)}</span></Td>
                    <Td><span className="font-mono text-xs">{RM(c.cpl)}</span></Td>
                    <Td><span className="font-mono text-xs">{RM(c.cpt)}</span></Td>
                    <Td><span className="font-mono text-xs">{RM(c.cpa)}</span></Td>
                    <Td><span className={`font-mono text-xs font-semibold ${c.roas >= 3 ? "text-emerald-700" : c.roas >= 1 ? "text-amber-600" : "text-rose-600"}`}>{num(c.roas, 2)}×</span></Td>
                    {isAdmin && <Td className="whitespace-nowrap">
                      <Btn size="sm" variant="ghost" onClick={() => setModal(c)}><Pencil size={13} /></Btn>
                      <Btn size="sm" variant="ghost" onClick={() => { removeFrom("campaigns", c.id); flash("Campaign removed"); }}><Trash2 size={13} /></Btn>
                    </Td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Lead source analytics</h2>
            <p className="text-xs text-slate-500 mt-0.5">Where to put the next ringgit</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="w-44 py-1.5">
              <option value="leads">Most leads</option>
              <option value="conv">Highest conversion</option>
              <option value="revenue">Highest revenue</option>
              <option value="cpl">Lowest CPL</option>
              <option value="cpa">Lowest CPA</option>
              <option value="roas">Highest ROAS</option>
            </Select>
            <Btn variant="outline" size="sm" onClick={exportSources}><Download size={13} />CSV</Btn>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr><Th>Source</Th><Th>Leads</Th><Th>Trials</Th><Th>Clients</Th><Th>Conversion</Th><Th>Revenue</Th><Th>Spend</Th><Th>CPL</Th><Th>CPA</Th><Th>ROAS</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((r) => (
                <tr key={r.source} className="hover:bg-slate-50">
                  <Td className="font-medium">{r.source}</Td>
                  <Td><span className="font-mono text-xs">{r.leads}</span></Td>
                  <Td><span className="font-mono text-xs">{r.trials}</span></Td>
                  <Td><span className="font-mono text-xs font-semibold">{r.clients}</span></Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: Math.min(100, r.conv * 2) + "%" }} />
                      </div>
                      <span className="font-mono text-xs">{r.conv}%</span>
                    </div>
                  </Td>
                  <Td><span className="font-mono text-xs text-emerald-700">{RM(r.revenue)}</span></Td>
                  <Td><span className="font-mono text-xs">{RM(r.spend)}</span></Td>
                  <Td><span className="font-mono text-xs">{r.spend ? RM(r.cpl) : "—"}</span></Td>
                  <Td><span className="font-mono text-xs">{r.spend && r.clients ? RM(r.cpa) : "—"}</span></Td>
                  <Td><span className={`font-mono text-xs font-semibold ${r.roas >= 3 ? "text-emerald-700" : r.roas >= 1 ? "text-amber-600" : r.spend ? "text-rose-600" : "text-slate-400"}`}>{r.spend ? num(r.roas, 2) + "×" : "Organic"}</span></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle sub="Connect these when you're ready — the data structure is already in place">Integrations</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          {["WhatsApp Business", "Meta Ads", "Google Ads", "TikTok Ads", "Instagram", "Email", "Payment gateway", "Fitness Aspire app"].map((n) => (
            <div key={n} className="p-3 border border-dashed border-slate-300 rounded-lg">
              <div className="text-sm font-medium text-slate-700">{n}</div>
              <div className="t11 text-slate-400 mt-1">Not connected</div>
            </div>
          ))}
        </div>
      </Card>

      {modal && <CampaignForm ctx={ctx} initial={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function CampaignForm({ ctx, initial, onClose }) {
  const { db, upsert, flash } = ctx;
  const [v, setV] = useState({
    name: "", platform: db.settings.platforms[0], type: "Lead Generation",
    start: todayISO, end: addDays(todayISO, 30), budget: 1000, spend: 0, ...initial,
  });
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
  const save = () => {
    if (!v.name.trim()) { flash("Give the campaign a name"); return; }
    upsert("campaigns", { ...v, id: v.id || uid("c"), budget: Number(v.budget), spend: Number(v.spend) });
    flash(v.id ? "Campaign updated" : "Campaign added"); onClose();
  };
  return (
    <Modal open onClose={onClose} title={v.id ? "Edit campaign" : "New campaign"}
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="accent" onClick={save}>Save campaign</Btn></>}>
      <div className="space-y-3">
        <Field label="Campaign name"><Input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. IG Reels — Fat Loss Challenge" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Platform"><Select value={v.platform} onChange={(e) => set("platform", e.target.value)}>{db.settings.platforms.map((p) => <option key={p}>{p}</option>)}</Select></Field>
          <Field label="Campaign type"><Select value={v.type} onChange={(e) => set("type", e.target.value)}>
            {["Lead Generation", "Awareness", "Search", "Retargeting", "Promotion", "Other"].map((t) => <option key={t}>{t}</option>)}
          </Select></Field>
          <Field label="Start date"><Input type="date" value={v.start} onChange={(e) => set("start", e.target.value)} /></Field>
          <Field label="End date"><Input type="date" value={v.end} onChange={(e) => set("end", e.target.value)} /></Field>
          <Field label="Budget (RM)"><Input type="number" value={v.budget} onChange={(e) => set("budget", e.target.value)} /></Field>
          <Field label="Actual spend (RM)"><Input type="number" value={v.spend} onChange={(e) => set("spend", e.target.value)} /></Field>
        </div>
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5">
          Leads, trials, clients and revenue are counted automatically from any lead tagged to this campaign — you never enter them by hand.
        </p>
      </div>
    </Modal>
  );
}

/* ============================================================
   SALES — leaderboard, forecast, lost leads
   ============================================================ */
function SalesView({ ctx }) {
  const { db, D, range, setOpenLeadId } = ctx;
  const [tab, setTab] = useState("leaderboard");

  const board = useMemo(() => db.users.filter((u) => u.active).map((u) => {
    const mine = db.leads.filter((l) => l.ownerId === u.id);
    const inPeriod = mine.filter((l) => inRange(l.createdAt, range));
    const contacted = mine.filter((l) => stageIndex(l.stage) >= 1);
    const apts = db.appointments.filter((a) => { const l = D.byLead(a.leadId); return l && l.ownerId === u.id; });
    const won = mine.filter((l) => l.stage === "won" && inRange(l.wonAt || l.updatedAt, range));
    const revenue = won.reduce((s, l) => s + D.dealValue(l), 0);
    const fus = db.followups.filter((f) => { const l = D.byLead(f.leadId); return l && l.ownerId === u.id; });
    return {
      ...u, leads: mine.length, leadsInPeriod: inPeriod.length, contacted: contacted.length,
      trialsBooked: apts.length, trialsCompleted: apts.filter((a) => a.status === "Completed").length,
      noShows: apts.filter((a) => a.status === "No-Show").length,
      clients: won.length, revenue, conv: pct(won.length, inPeriod.length || mine.length),
      avgDeal: won.length ? revenue / won.length : 0,
      fuDone: fus.filter((f) => f.completed).length,
      fuOverdue: fus.filter((f) => !f.completed && f.date < todayISO).length,
      pipeline: mine.filter((l) => OPEN_STAGES.includes(l.stage)).reduce((s, l) => s + D.dealValue(l), 0),
    };
  }).sort((a, b) => b.revenue - a.revenue || b.clients - a.clients), [db, D, range]);

  const forecast = useMemo(() => {
    const open = db.leads.filter((l) => OPEN_STAGES.includes(l.stage));
    const byTemp = TEMPS.map((t) => {
      const ls = open.filter((l) => l.temperature === t.id);
      return { ...t, count: ls.length, value: ls.reduce((s, l) => s + D.dealValue(l), 0) };
    });
    const trialsPending = db.appointments.filter((a) => ["Booked", "Confirmed", "Rescheduled"].includes(a.status) && a.date >= todayISO);
    const trialsPendingValue = trialsPending.reduce((s, a) => { const l = D.byLead(a.leadId); return s + (l ? D.dealValue(l) : 0); }, 0);
    const won = db.leads.filter((l) => l.stage === "won");
    const wonValue = won.reduce((s, l) => s + D.dealValue(l), 0);
    const pipelineValue = open.reduce((s, l) => s + D.dealValue(l), 0);
    const weighted = open.reduce((s, l) => s + D.dealValue(l) * (STAGE_PROB[l.stage] || 0) * (TEMP_PROB[l.temperature] || 1), 0);
    const byStage = STAGES.filter((s) => OPEN_STAGES.includes(s.id)).map((s) => {
      const ls = open.filter((l) => l.stage === s.id);
      const val = ls.reduce((sum, l) => sum + D.dealValue(l), 0);
      return { stage: s.label, count: ls.length, value: val, weighted: Math.round(val * STAGE_PROB[s.id]), prob: Math.round(STAGE_PROB[s.id] * 100) };
    });
    return { byTemp, trialsPending: trialsPending.length, trialsPendingValue, wonValue, wonCount: won.length, pipelineValue, weighted, byStage, openCount: open.length };
  }, [db.leads, db.appointments, D]);

  const lost = useMemo(() => {
    const ls = db.leads.filter((l) => l.stage === "lost");
    const map = {};
    ls.forEach((l) => {
      const r = l.lostReason || "Other";
      map[r] = map[r] || { reason: r, count: 0, value: 0, sources: {} };
      map[r].count++; map[r].value += D.dealValue(l);
      map[r].sources[l.source] = (map[r].sources[l.source] || 0) + 1;
    });
    const rows = Object.values(map).sort((a, b) => b.count - a.count);
    return { rows, total: ls.length, value: ls.reduce((s, l) => s + D.dealValue(l), 0), leads: ls };
  }, [db.leads, D]);

  const medals = ["🏆", "🥈", "🥉"];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Sales</h1>
        <p className="text-sm text-slate-500">Performance, forecast and where deals are dying</p>
      </div>

      <div className="flex gap-1.5">
        {[["leaderboard", "Leaderboard"], ["forecast", "Forecast"], ["lost", "Lost leads"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${tab === id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>{label}</button>
        ))}
      </div>

      {tab === "leaderboard" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {board.slice(0, 3).map((s, i) => (
              <Card key={s.id} className={`p-4 ${i === 0 ? "border-amber-300 bg-amber-50" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{medals[i]}</span>
                  <div>
                    <div className="text-sm font-semibold">{s.name}</div>
                    <div className="t10 uppercase tracking-widest text-slate-400">{s.role === "admin" ? "Owner" : "Sales"}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div><div className="font-mono text-lg font-semibold">{s.clients}</div><Label>Clients</Label></div>
                  <div><div className="font-mono text-lg font-semibold">{RM(s.revenue)}</div><Label>Revenue</Label></div>
                  <div><div className="font-mono text-lg font-semibold">{s.conv}%</div><Label>Conv.</Label></div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr><Th>Salesperson</Th><Th>Leads</Th><Th>Contacted</Th><Th>Trials booked</Th><Th>Completed</Th><Th>No-shows</Th><Th>Clients</Th><Th>Conversion</Th><Th>Revenue</Th><Th>Avg deal</Th><Th>Follow-ups done</Th><Th>Overdue</Th><Th>Open pipeline</Th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {board.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <Td className="font-medium">{s.name}</Td>
                      <Td><span className="font-mono text-xs">{s.leads}</span></Td>
                      <Td><span className="font-mono text-xs">{s.contacted}</span></Td>
                      <Td><span className="font-mono text-xs">{s.trialsBooked}</span></Td>
                      <Td><span className="font-mono text-xs">{s.trialsCompleted}</span></Td>
                      <Td><span className="font-mono text-xs text-rose-600">{s.noShows}</span></Td>
                      <Td><span className="font-mono text-xs font-semibold">{s.clients}</span></Td>
                      <Td><span className="font-mono text-xs">{s.conv}%</span></Td>
                      <Td><span className="font-mono text-xs text-emerald-700 font-semibold">{RM(s.revenue)}</span></Td>
                      <Td><span className="font-mono text-xs">{RM(s.avgDeal)}</span></Td>
                      <Td><span className="font-mono text-xs">{s.fuDone}</span></Td>
                      <Td><span className={`font-mono text-xs ${s.fuOverdue ? "text-rose-600 font-semibold" : "text-slate-400"}`}>{s.fuOverdue}</span></Td>
                      <Td><span className="font-mono text-xs text-amber-600">{RM(s.pipeline)}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === "forecast" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Pipeline value" value={RM(forecast.pipelineValue)} sub={`${forecast.openCount} open leads`} icon={TrendingUp} />
            <Stat label="Weighted forecast" value={RM(forecast.weighted)} sub="Stage × temperature" tone="accent" icon={Target} />
            <Stat label="Trials pending" value={RM(forecast.trialsPendingValue)} sub={`${forecast.trialsPending} upcoming`} icon={CalendarCheck} />
            <Stat label="Won revenue" value={RM(forecast.wonValue)} sub={`${forecast.wonCount} clients, all time`} tone="good" icon={Trophy} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <SectionTitle sub="Open pipeline split by how warm the prospect is">Pipeline by lead temperature</SectionTitle>
              <div className="space-y-3 mt-3">
                {forecast.byTemp.map((t) => (
                  <div key={t.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${t.dot}`} />{t.label} leads<span className="text-slate-400 font-mono text-xs">({t.count})</span></span>
                      <span className="font-mono font-semibold">{RM(t.value)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${t.dot}`} style={{ width: (forecast.pipelineValue ? (t.value / forecast.pipelineValue) * 100 : 0) + "%" }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-sm">
                <span className="text-slate-500">Total open pipeline</span>
                <span className="font-mono font-semibold">{RM(forecast.pipelineValue)}</span>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <h2 className="text-sm font-semibold">Expected revenue by stage</h2>
                <p className="text-xs text-slate-500 mt-0.5">Value weighted by how often each stage closes</p>
              </div>
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr><Th>Stage</Th><Th>Leads</Th><Th>Value</Th><Th>Close %</Th><Th>Expected</Th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {forecast.byStage.map((s) => (
                    <tr key={s.stage}>
                      <Td className="text-xs">{s.stage}</Td>
                      <Td><span className="font-mono text-xs">{s.count}</span></Td>
                      <Td><span className="font-mono text-xs">{RM(s.value)}</span></Td>
                      <Td><span className="font-mono text-xs text-slate-500">{s.prob}%</span></Td>
                      <Td><span className="font-mono text-xs font-semibold text-amber-600">{RM(s.weighted)}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}

      {tab === "lost" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="Leads lost" value={lost.total} tone="bad" icon={X} />
            <Stat label="Revenue lost" value={RM(lost.value)} tone="bad" icon={Wallet} />
            <Stat label="Top reason" value={lost.rows[0]?.reason || "—"} sub={lost.rows[0] ? `${lost.rows[0].count} leads` : ""} icon={AlertTriangle} />
          </div>
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold">Why leads are lost</h2>
              <p className="text-xs text-slate-500 mt-0.5">Fix the top two and the whole funnel moves</p>
            </div>
            {lost.rows.length === 0 ? <Empty icon={Check} title="No lost leads recorded" /> : (
              <div className="divide-y divide-slate-100">
                {lost.rows.map((r) => (
                  <div key={r.reason} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{r.reason}</span>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xs text-slate-500">{RM(r.value)} lost</span>
                        <span className="font-mono text-xs font-semibold w-8 text-right">{r.count}</span>
                        <span className="font-mono text-xs text-slate-400 w-12 text-right">{pct(r.count, lost.total)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-rose-400" style={{ width: pct(r.count, lost.total) + "%" }} />
                    </div>
                    <p className="t11 text-slate-400 mt-1.5">
                      Mostly from {Object.entries(r.sources).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, n]) => `${s} (${n})`).join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200"><h2 className="text-sm font-semibold">Lost leads</h2></div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full min-w-max">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0"><tr><Th>Prospect</Th><Th>Source</Th><Th>Owner</Th><Th>Reason</Th><Th>Value</Th><Th>Lost on</Th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {lost.leads.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setOpenLeadId(l.id)}>
                      <Td className="font-medium">{l.name}</Td>
                      <Td><span className="text-xs">{l.source}</span></Td>
                      <Td><span className="text-xs">{db.users.find((u) => u.id === l.ownerId)?.name}</span></Td>
                      <Td><span className="text-xs">{l.lostReason}</span></Td>
                      <Td><span className="font-mono text-xs">{RM(D.dealValue(l))}</span></Td>
                      <Td><span className="font-mono text-xs text-slate-500">{fmtDate(l.updatedAt)}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* ============================================================
   REPORTS
   ============================================================ */
function ReportsView({ ctx }) {
  const { db, D, range } = ctx;

  const build = (key) => {
    const leads = db.leads.filter((l) => inRange(l.createdAt, range));
    const won = db.leads.filter((l) => l.stage === "won" && inRange(l.wonAt || l.updatedAt, range));
    const apts = db.appointments.filter((a) => inRange(a.date, range));
    const owner = (id) => db.users.find((u) => u.id === id)?.name || "";

    switch (key) {
      case "daily": case "weekly": case "monthly": {
        const r = key === "daily" ? rangeFor("today") : key === "weekly" ? rangeFor("week") : rangeFor("month");
        const L = db.leads.filter((l) => inRange(l.createdAt, r));
        const W = db.leads.filter((l) => l.stage === "won" && inRange(l.wonAt || l.updatedAt, r));
        const A = db.appointments.filter((a) => inRange(a.date, r));
        return {
          title: `${key[0].toUpperCase() + key.slice(1)} sales report`, period: `${fmtDateFull(r.from)} – ${fmtDateFull(r.to)}`,
          rows: [
            ["New leads", L.length], ["Leads contacted", L.filter((l) => stageIndex(l.stage) >= 1).length],
            ["Trials booked", A.length], ["Trials completed", A.filter((a) => a.status === "Completed").length],
            ["No-shows", A.filter((a) => a.status === "No-Show").length],
            ["Proposals sent", L.filter((l) => !!l.deal).length],
            ["Clients won", W.length], ["Revenue (RM)", W.reduce((s, l) => s + D.dealValue(l), 0)],
            ["Leads lost", db.leads.filter((l) => l.stage === "lost" && inRange(l.updatedAt, r)).length],
            ["Conversion rate (%)", pct(W.length, L.length)],
          ],
          headers: ["Metric", "Value"],
        };
      }
      case "marketing":
        return {
          title: "Marketing report", period: `${fmtDateFull(range.from)} – ${fmtDateFull(range.to)}`,
          headers: ["Campaign", "Platform", "Spend RM", "Leads", "Trials", "Clients", "Revenue RM", "CPL RM", "CPA RM", "ROAS"],
          rows: db.campaigns.map((c) => {
            const ls = db.leads.filter((l) => l.campaignId === c.id);
            const cl = ls.filter((l) => l.stage === "won");
            const rev = cl.reduce((s, l) => s + D.dealValue(l), 0);
            return [c.name, c.platform, c.spend, ls.length,
              ls.filter((l) => (D.apptsByLead[l.id] || []).length).length, cl.length, rev,
              ls.length ? Math.round(c.spend / ls.length) : 0,
              cl.length ? Math.round(c.spend / cl.length) : 0,
              c.spend ? num(rev / c.spend, 2) : 0];
          }),
        };
      case "conversion": {
        const stages = [["Leads", leads.length],
          ["Contacted", leads.filter((l) => stageIndex(l.stage) >= 1).length],
          ["Qualified", leads.filter((l) => stageIndex(l.stage) >= 3 && l.stage !== "lost").length],
          ["Trial booked", leads.filter((l) => (D.apptsByLead[l.id] || []).length).length],
          ["Trial completed", leads.filter((l) => (D.apptsByLead[l.id] || []).some((a) => a.status === "Completed")).length],
          ["Proposal sent", leads.filter((l) => !!l.deal).length],
          ["Won", won.length]];
        return {
          title: "Lead conversion report", period: `${fmtDateFull(range.from)} – ${fmtDateFull(range.to)}`,
          headers: ["Stage", "Leads", "% of all leads"],
          rows: stages.map(([s, n]) => [s, n, pct(n, leads.length) + "%"]),
        };
      }
      case "salesperson":
        return {
          title: "Salesperson report", period: `${fmtDateFull(range.from)} – ${fmtDateFull(range.to)}`,
          headers: ["Salesperson", "Leads", "Trials booked", "Trials completed", "No-shows", "Clients", "Revenue RM", "Conversion %", "Overdue follow-ups"],
          rows: db.users.filter((u) => u.active).map((u) => {
            const ls = leads.filter((l) => l.ownerId === u.id);
            const w = won.filter((l) => l.ownerId === u.id);
            const a = apts.filter((x) => D.byLead(x.leadId)?.ownerId === u.id);
            const fo = db.followups.filter((f) => !f.completed && f.date < todayISO && D.byLead(f.leadId)?.ownerId === u.id);
            return [u.name, ls.length, a.length, a.filter((x) => x.status === "Completed").length,
              a.filter((x) => x.status === "No-Show").length, w.length,
              w.reduce((s, l) => s + D.dealValue(l), 0), pct(w.length, ls.length), fo.length];
          }),
        };
      case "trial":
        return {
          title: "Trial report", period: `${fmtDateFull(range.from)} – ${fmtDateFull(range.to)}`,
          headers: ["Date", "Time", "Prospect", "Trainer", "Location", "Status", "Current stage", "Value RM"],
          rows: apts.map((a) => {
            const l = D.byLead(a.leadId);
            return [a.date, a.time, l?.name || "", db.settings.trainers.find((t) => t.id === a.trainerId)?.name || "",
              a.location, a.status, stageLabel(l?.stage), l ? D.dealValue(l) : 0];
          }),
        };
      case "lost":
        return {
          title: "Lost lead report", period: `${fmtDateFull(range.from)} – ${fmtDateFull(range.to)}`,
          headers: ["Prospect", "Source", "Salesperson", "Reason", "Lost value RM", "Date lost"],
          rows: db.leads.filter((l) => l.stage === "lost" && inRange(l.updatedAt, range))
            .map((l) => [l.name, l.source, owner(l.ownerId), l.lostReason, D.dealValue(l), l.updatedAt]),
        };
      default:
        return { title: "", period: "", headers: [], rows: [] };
    }
  };

  const REPORTS = [
    { id: "daily", name: "Daily sales report", desc: "Everything that happened today" },
    { id: "weekly", name: "Weekly sales report", desc: "This week's activity and results" },
    { id: "monthly", name: "Monthly sales report", desc: "The month in one page" },
    { id: "marketing", name: "Marketing report", desc: "Spend, leads and return by campaign" },
    { id: "conversion", name: "Lead conversion report", desc: "Where prospects drop out" },
    { id: "salesperson", name: "Salesperson report", desc: "Activity and results per person" },
    { id: "trial", name: "Trial report", desc: "Every trial and how it ended" },
    { id: "lost", name: "Lost lead report", desc: "Deals lost and why" },
  ];

  const [active, setActive] = useState("monthly");
  const report = build(active);

  const exportReport = () => downloadCSV(
    `fitness-aspire-${active}-report-${todayISO}.csv`,
    [[report.title], [report.period], [], report.headers, ...report.rows]
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-slate-500">Everything is calculated from live data — nothing to fill in by hand</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          {REPORTS.map((r) => (
            <button key={r.id} onClick={() => setActive(r.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${active === r.id ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
              <div className="text-sm font-medium">{r.name}</div>
              <div className={`t11 mt-0.5 ${active === r.id ? "text-slate-400" : "text-slate-500"}`}>{r.desc}</div>
            </button>
          ))}
        </div>

        <Card className="lg:col-span-3 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{report.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{report.period}</p>
            </div>
            <Btn variant="outline" size="sm" onClick={exportReport}><Download size={13} />Export CSV</Btn>
          </div>
          {report.rows.length === 0 ? <Empty icon={FileText} title="No data in this period" hint="Try a wider date range from the filter at the top." /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>{report.headers.map((h) => <Th key={h}>{h}</Th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {row.map((cell, j) => (
                        <Td key={j} className={j === 0 ? "font-medium" : "font-mono text-xs"}>{cell}</Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   ALERTS
   ============================================================ */
function AlertsView({ ctx }) {
  const { alerts, D, setOpenLeadId, dismissAlert, db, setDb } = ctx;
  const groups = [1, 2, 3].map((p) => ({ p, items: alerts.filter((a) => a.priority === p) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Alerts</h1>
          <p className="text-sm text-slate-500">{alerts.length} things the system thinks you should look at</p>
        </div>
        {(db.dismissedAlerts || []).length > 0 && (
          <Btn variant="outline" size="sm" onClick={() => setDb((s) => ({ ...s, dismissedAlerts: [] }))}>
            <RotateCcw size={13} />Restore {db.dismissedAlerts.length} dismissed
          </Btn>
        )}
      </div>

      {alerts.length === 0 ? (
        <Card><Empty icon={Check} title="Nothing needs your attention" hint="Every lead has a next step and no follow-up is overdue." /></Card>
      ) : groups.map(({ p, items }) => items.length > 0 && (
        <div key={p}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`w-2 h-2 rounded-full ${PRIORITY_META[p].dot}`} />
            <h2 className="text-xs font-semibold text-slate-700">{PRIORITY_META[p].label}</h2>
            <span className="font-mono t11 text-slate-400">{items.length}</span>
          </div>
          <Card className="overflow-hidden divide-y divide-slate-100">
            {items.map((a) => {
              const l = D.byLead(a.leadId);
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <button onClick={() => setOpenLeadId(a.leadId)} className="flex-1 min-w-0 text-left flex items-center gap-3">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_META[a.priority].dot}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{l?.name}</span>
                        {l && <TempChip t={l.temperature} showLabel={false} />}
                        {l && <StageBadge stage={l.stage} />}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{a.title}{a.detail ? ` — ${a.detail}` : ""}</p>
                    </div>
                  </button>
                  <span className="font-mono text-xs text-slate-500 hidden sm:block">{l ? RM(D.dealValue(l)) : ""}</span>
                  <Btn size="sm" variant="ghost" onClick={() => dismissAlert(a.id)}><X size={13} /></Btn>
                </div>
              );
            })}
          </Card>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   SETTINGS
   ============================================================ */
function ListEditor({ title, hint, items, onChange }) {
  const [val, setVal] = useState("");
  return (
    <Card className="p-4">
      <SectionTitle sub={hint}>{title}</SectionTitle>
      <div className="flex gap-2 mb-3">
        <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Add a new option"
          onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) { onChange([...items, val.trim()]); setVal(""); } }} />
        <Btn variant="accent" onClick={() => { if (val.trim()) { onChange([...items, val.trim()]); setVal(""); } }}><Plus size={14} /></Btn>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span key={it + i} className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">
            {it}
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600"><X size={11} /></button>
          </span>
        ))}
        {items.length === 0 && <p className="text-xs text-slate-400">Nothing here yet.</p>}
      </div>
    </Card>
  );
}

function SettingsView({ ctx }) {
  const { db, setDb, flash } = ctx;
  const s = db.settings;
  const setS = (patch) => setDb((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const [pkg, setPkg] = useState(null);
  const [user, setUser] = useState(null);
  const [trainer, setTrainer] = useState("");

  const resetAll = async () => {
    if (!confirm("Reset everything back to the sample data? All leads, follow-ups and campaigns you've added will be deleted.")) return;
    const fresh = seedData();
    setDb(fresh);
    try { await storage.set(STORAGE_KEY, JSON.stringify(fresh)); } catch (e) {}
    flash("Data reset");
  };

  const backup = () => downloadCSV(`fitness-aspire-backup-${todayISO}.csv`, [
    ["Table", "JSON"],
    ...["leads", "activities", "followups", "appointments", "campaigns", "notes", "users"].map((k) => [k, JSON.stringify(db[k])]),
    ["settings", JSON.stringify(db.settings)],
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500">Everything the system offers as a choice is defined here — nothing is fixed in code</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ListEditor title="Lead sources" hint="Where enquiries come from" items={s.leadSources} onChange={(v) => setS({ leadSources: v })} />
        <ListEditor title="Lost reasons" hint="Required when a lead is marked lost" items={s.lostReasons} onChange={(v) => setS({ lostReasons: v })} />
        <ListEditor title="Marketing platforms" hint="Available when creating a campaign" items={s.platforms} onChange={(v) => setS({ platforms: v })} />
        <ListEditor title="Training locations" hint="Studios and areas you serve" items={s.locations} onChange={(v) => setS({ locations: v })} />
        <ListEditor title="Fitness goals" hint="Used to qualify a lead" items={s.goals} onChange={(v) => setS({ goals: v })} />

        <Card className="p-4">
          <SectionTitle sub="The pipeline stages are the backbone of the system and are fixed in V1">Pipeline stages</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((st) => (
              <span key={st.id} className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">
                <span className={`w-1.5 h-1.5 rounded-full ${st.color}`} />{st.label}
              </span>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle right={<Btn size="sm" variant="accent" onClick={() => setPkg({})}><Plus size={13} />Add</Btn>}
            sub="Prices flow straight into deals and forecasts">Packages</SectionTitle>
          <div className="divide-y divide-slate-100">
            {s.packages.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.sessions} sessions · {RM(p.price / (p.sessions || 1))} per session</div>
                </div>
                <span className="font-mono text-sm font-semibold">{RM(p.price)}</span>
                <Btn size="sm" variant="ghost" onClick={() => setPkg(p)}><Pencil size={13} /></Btn>
                <Btn size="sm" variant="ghost" onClick={() => setS({ packages: s.packages.filter((x) => x.id !== p.id) })}><Trash2 size={13} /></Btn>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle right={<Btn size="sm" variant="accent" onClick={() => setUser({})}><Plus size={13} />Add</Btn>}
            sub="Admins see everything; sales can manage leads but not settings">People and access</SectionTitle>
          <div className="divide-y divide-slate-100">
            {db.users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{u.name}</div>
                  <div className="text-xs text-slate-500 truncate">{u.email}</div>
                </div>
                <span className={`t11 font-medium px-2 py-0.5 rounded border ${u.role === "admin" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  {u.role === "admin" ? "Admin / Owner" : "Sales"}
                </span>
                {!u.active && <span className="t11 text-slate-400">Inactive</span>}
                <Btn size="sm" variant="ghost" onClick={() => setUser(u)}><Pencil size={13} /></Btn>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle sub="Assigned to leads and trial sessions">Trainers</SectionTitle>
          <div className="flex gap-2 mb-3">
            <Input value={trainer} onChange={(e) => setTrainer(e.target.value)} placeholder="Coach name" />
            <Btn variant="accent" onClick={() => { if (trainer.trim()) { setS({ trainers: [...s.trainers, { id: uid("t"), name: trainer.trim() }] }); setTrainer(""); } }}><Plus size={14} /></Btn>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {s.trainers.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">
                {t.name}
                <button onClick={() => setS({ trainers: s.trainers.filter((x) => x.id !== t.id) })} className="text-slate-400 hover:text-rose-600"><X size={11} /></button>
              </span>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle sub="Which alerts the system raises for you">Notifications</SectionTitle>
          <div className="space-y-2">
            {[["overdueFollowUp", "Follow-up is overdue"], ["trialReminder", "Trial today or tomorrow"],
              ["noShowFollowUp", "Trial no-show needs re-booking"], ["hotLeadNoFollowUp", "Hot lead with nothing scheduled"],
              ["inactiveLead", "Lead has gone quiet"], ["staleStage", "Lead stuck in the same stage"]].map(([k, label]) => (
              <label key={k} className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input type="checkbox" checked={s.notifications[k]} className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                  onChange={(e) => setS({ notifications: { ...s.notifications, [k]: e.target.checked } })} />
                <span className="text-slate-700">{label}</span>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
            <Field label="Quiet for (days)">
              <Input type="number" value={s.notifications.inactiveDays}
                onChange={(e) => setS({ notifications: { ...s.notifications, inactiveDays: Number(e.target.value) } })} />
            </Field>
            <Field label="Stuck in stage (days)">
              <Input type="number" value={s.notifications.staleStageDays}
                onChange={(e) => setS({ notifications: { ...s.notifications, staleStageDays: Number(e.target.value) } })} />
            </Field>
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle sub="Your data lives in this browser profile and is saved automatically">Data</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Btn variant="outline" size="sm" onClick={backup}><Download size={13} />Download a backup</Btn>
            <Btn variant="outline" size="sm" onClick={resetAll}><RotateCcw size={13} />Reset to sample data</Btn>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[["Leads", db.leads.length], ["Activities", db.activities.length], ["Follow-ups", db.followups.length],
              ["Trials", db.appointments.length], ["Campaigns", db.campaigns.length], ["Notes", db.notes.length]].map(([k, v]) => (
              <div key={k}><div className="font-mono text-lg font-semibold">{v}</div><Label>{k}</Label></div>
            ))}
          </div>
        </Card>
      </div>

      {pkg && <PackageForm ctx={ctx} initial={pkg} onClose={() => setPkg(null)} />}
      {user && <UserForm ctx={ctx} initial={user} onClose={() => setUser(null)} />}
    </div>
  );
}

function PackageForm({ ctx, initial, onClose }) {
  const { db, setDb, flash } = ctx;
  const [v, setV] = useState({ name: "", sessions: 12, price: 1800, ...initial });
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
  const save = () => {
    if (!v.name.trim()) { flash("Give the package a name"); return; }
    const item = { id: v.id || uid("p"), name: v.name.trim(), sessions: Number(v.sessions), price: Number(v.price) };
    setDb((s) => ({ ...s, settings: { ...s.settings, packages: v.id ? s.settings.packages.map((p) => (p.id === v.id ? item : p)) : [...s.settings.packages, item] } }));
    flash("Package saved"); onClose();
  };
  return (
    <Modal open onClose={onClose} title={v.id ? "Edit package" : "New package"}
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="accent" onClick={save}>Save</Btn></>}>
      <div className="space-y-3">
        <Field label="Package name"><Input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. 24 Sessions" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sessions"><Input type="number" value={v.sessions} onChange={(e) => set("sessions", e.target.value)} /></Field>
          <Field label="Price (RM)"><Input type="number" value={v.price} onChange={(e) => set("price", e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
}

function UserForm({ ctx, initial, onClose }) {
  const { setDb, flash } = ctx;
  const [v, setV] = useState({ name: "", email: "", role: "sales", active: true, ...initial });
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
  const save = () => {
    if (!v.name.trim()) { flash("Name is required"); return; }
    const item = { ...v, id: v.id || uid("u"), name: v.name.trim() };
    setDb((s) => ({ ...s, users: v.id ? s.users.map((u) => (u.id === v.id ? item : u)) : [...s.users, item] }));
    flash("Saved"); onClose();
  };
  return (
    <Modal open onClose={onClose} title={v.id ? `Edit ${v.name}` : "Add a team member"}
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="accent" onClick={save}>Save</Btn></>}>
      <div className="space-y-3">
        <Field label="Name"><Input value={v.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Email"><Input value={v.email} onChange={(e) => set("email", e.target.value)} placeholder="name@fitnessaspire.my" /></Field>
        <Field label="Role">
          <Select value={v.role} onChange={(e) => set("role", e.target.value)}>
            <option value="admin">Admin / Owner — full access</option>
            <option value="sales">Sales — leads, follow-ups and trials only</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <input type="checkbox" checked={v.active} onChange={(e) => set("active", e.target.checked)} className="rounded border-slate-300 text-amber-500 focus:ring-amber-400" />
          <span className="text-slate-700">Active — can be assigned new leads</span>
        </label>
      </div>
    </Modal>
  );
}
