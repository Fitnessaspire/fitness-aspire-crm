import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { storage } from "./lib/storage";
import { supabase, CLOUD, WORKSPACE_KEY } from "./lib/supabaseClient";
import {
  LayoutDashboard, Users, Kanban, BellRing, CalendarCheck, Megaphone,
  TrendingUp, FileText, AlertTriangle, Settings as SettingsIcon, Sun,
  Search, Plus, X, ChevronRight, ChevronDown, Phone, Mail, MessageCircle,
  Instagram, Trophy, Flame, Snowflake, Thermometer, Clock, Check,
  ArrowUpRight, ArrowDownRight, Trash2, Pencil, Download, Filter, Menu,
  CircleDot, Target, Wallet, UserCheck, CalendarX, Activity, Save, RotateCcw,
  ListChecks, Square, CalendarDays, ChevronLeft, Flag
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";

/* ============================================================
   FITNESS ASPIRE — SALES CRM & LEAD MANAGEMENT (V1)
   Data persists through src/lib/storage.js (localStorage now, Supabase later).
   ============================================================ */

const STORAGE_KEY = CLOUD ? WORKSPACE_KEY : "fa-crm-data-v1";
const SESSION_KEY = "fa-crm-session-v1";

/* ---------- Palette (ink + gold, mono numerals) ---------- */
const ACCENT = "#C89252";
const INK = "#181F29";
const CHART_COLORS = ["#C89252", "#1C7A5E", "#43769F", "#BE4630", "#6A5AA0", "#2E8B84", "#A8557E", "#8A968F"];

/* ---------- Pipeline stages ---------- */
const STAGES = [
  { id: "new", label: "New Lead", color: "bg-slate-400" },
  { id: "contacted", label: "Contacted", color: "bg-sky-400" },
  { id: "replied", label: "Replied", color: "bg-sky-500" },
  { id: "qualified", label: "Qualified", color: "bg-violet-500" },
  { id: "follow_1", label: "Follow-up 1", color: "bg-amber-400" },
  { id: "follow_2", label: "Follow-up 2", color: "bg-orange-500" },
  { id: "follow_3", label: "Follow-up 3", color: "bg-rose-400" },
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
/* Compare by name rather than a fixed number, so adding stages never
   silently changes the rules below. */
const atLeast = (leadStage, targetId) => stageIndex(leadStage) >= stageIndex(targetId);
const before = (leadStage, targetId) => stageIndex(leadStage) < stageIndex(targetId);
const OPEN_STAGES = STAGES.filter((s) => s.id !== "won" && s.id !== "lost").map((s) => s.id);

/* Probability weighting for forecast (by stage) */
const STAGE_PROB = {
  new: 0.05, contacted: 0.1, replied: 0.15, qualified: 0.25,
  follow_1: 0.22, follow_2: 0.16, follow_3: 0.1,
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

const PRIORITIES = [
  { id: "high", label: "Urgent", chip: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500", rank: 0 },
  { id: "normal", label: "Normal", chip: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500", rank: 1 },
  { id: "low", label: "Low", chip: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500", rank: 2 },
];
const prioMeta = (id) => PRIORITIES.find((p) => p.id === id) || PRIORITIES[1];

const APPT_STATUSES = ["Booked", "Confirmed", "Completed", "No-Show", "Cancelled", "Rescheduled"];
const FOLLOWUP_TYPES = ["WhatsApp", "Phone Call", "Email", "Instagram DM", "Other"];
const PAYMENT_STATUSES = ["Unpaid", "Deposit Paid", "Paid in Full", "Instalment"];


/* ------------------------------------------------------------
   MESSAGE TEMPLATES
   Editable in Settings. {name}, {me}, {trainer}, {location},
   {goal}, {date}, {time}, {package}, {sessions}, {price},
   {deposit} are filled in automatically per lead.
   ------------------------------------------------------------ */
const DEFAULT_TEMPLATES = [
  { id: "tpl1", stage: "new", channel: "WhatsApp", label: "First reply",
    body: "Hi {name}, {me} here from Fitness Aspire \u{1F44B}\n\nThanks for reaching out! Quick bit about us \u2014 we match you with a certified coach we've verified ourselves, and your training is tracked in our app so you can actually see your progress.\n\nBefore that, can I know what you're looking to work on? Any specific goals you'd like to achieve, so we have a better understanding of how to help you?" },

  { id: "tpl2", stage: "new", channel: "Instagram DM", label: "First reply (DM)",
    body: "Hi {name}, thanks for the message \u{1F64C}\n\n{me} here from Fitness Aspire \u2014 we match you with certified coaches we've verified ourselves, and track your progress in our app.\n\nWhat are you looking to work on at the moment?" },

  { id: "tpl19", stage: "replied", channel: "WhatsApp", label: "Why us / are you legit?",
    body: "Good question, {name} \u2014 happy to explain \u{1F642}\n\nSomething most people don't realise: personal training isn't a licensed profession in Malaysia. There's no government requirement to be qualified, so anyone can call themselves a trainer and start charging clients. That's fine when they're good \u2014 and a real problem for your body when they're not.\n\nSo here's how we handle it:\n\n\u2705 Verified coaches \u2014 every trainer is certified and we check their credentials ourselves before they take a single client. You're not taking a chance on a stranger.\n\n\u{1F4F1} Progress tracked in our app \u2014 your programme, sessions and results are all recorded, so training stays structured and you can see exactly what's changing.\n\n\u{1F504} Not happy with your coach? We'll move you to another one. Your sessions are with us, not tied to one person.\n\nThat last one is what most people worry about when paying upfront, which is exactly why we set it up that way." },

  { id: "tpl20", stage: "proposal", channel: "WhatsApp", label: "Reassurance before paying",
    body: "Completely understand, {name} \u2014 it's a fair thing to think about before paying \u{1F642}\n\nTwo things that should put your mind at ease:\n\nYour sessions are held with us, not with one trainer. If you're ever not happy with your coach, we'll move you to another one and your remaining sessions carry over.\n\nAnd every coach we assign is certified and verified by us first \u2014 we don't put anyone in front of a client we haven't checked.\n\nAnything else you'd like me to clear up before we start?" },

  { id: "tpl3", stage: "contacted", channel: "WhatsApp", label: "No reply yet",
    body: "Hi {name}, just checking in on my message \u{1F642}\n\nNo rush at all \u2014 if the timing isn't right just let me know. And if you're still keen, happy to answer anything you're unsure about." },

  { id: "tpl4", stage: "replied", channel: "WhatsApp", label: "Their area + goals",
    body: "Oh that's nice, {name} \u2014 we actually train a few clients around {location} already \u{1F44D}\n\nCan I know a bit more about your fitness goals? Anything specific you'd like to achieve, so we have a better understanding of how to help you?" },

  { id: "tpl5", stage: "replied", channel: "WhatsApp", label: "Understanding their routine",
    body: "Got it, {name} \u2014 thanks for sharing that.\n\nTwo more quick things so I can match you with the right coach:\n\n1. Are you training at the moment, or starting fresh?\n2. What days and times usually work for you?" },

  { id: "tpl6", stage: "qualified", channel: "WhatsApp", label: "Why the trial is worth it",
    body: "Totally understand, {name} \u{1F642}\n\nThe best next step would be a trial session with us. It's not just a workout \u2014 it's really an assessment, so we properly understand where you're starting from.\n\nTwo things we go through:\n\n\u{1F4CA} Body composition \u2014 muscle, body fat, and whether there are imbalances between one side and the other. That tells us what your body actually needs.\n\n\u{1F3CB} Movement screening \u2014 squat, push, pull and hinge. If any of those aren't moving well, training on top of it limits your results and raises your injury risk.\n\nOnce we have that, one of our certified coaches can design a programme that's safe for you and actually moves you towards your goals \u2014 all tracked in our app so you can see it working.\n\nWhat time and days work best for you this week?" },

  { id: "tpl7", stage: "qualified", channel: "Instagram DM", label: "Why the trial is worth it (DM)",
    body: "Totally understand, {name} \u{1F642}\n\nBest next step would be a trial with us \u2014 we check your body composition and screen your movement (squat, push, pull, hinge) so your programme is built around your goals and safe for you, not guesswork.\n\nWhat time and days work best for you this week?" },

  { id: "tpl8", stage: "trial_offered", channel: "WhatsApp", label: "Lock in the slot",
    body: "What day and time works best for you this week?\n\nOnce you pick, I'll confirm it with your coach and send you the location pin." },

  { id: "tpl21", stage: "follow_1", channel: "WhatsApp", label: "Follow-up 1 \u2014 gentle bump",
    body: "Hi {name} \u{1F642}\n\nJust checking \u2014 did any day work for you? If this week is busy, we can do next week. Up to you." },

  { id: "tpl22", stage: "follow_2", channel: "WhatsApp", label: "Follow-up 2 \u2014 ask what's tricky",
    body: "Hi {name}, no pressure \u{1F642}\n\nIs the timing hard for you? Or do you want to know more about the session first?\n\nWe also have early morning and late night slots, so we can follow your schedule." },

  { id: "tpl23", stage: "follow_3", channel: "WhatsApp", label: "Follow-up 3 \u2014 what they get",
    body: "Hi {name}, one more thing then I'll stop \u{1F642}\n\nEven if you don't train with us, the check-up is still useful for you. You will know your body fat, your muscle, and which movements are weak. Most people never check this.\n\nIf you want to come, just tell me what day and time is good for you." },

  { id: "tpl24", stage: "follow_3", channel: "WhatsApp", label: "Closing the loop before Lost",
    body: "Hi {name}, I won't message you again \u{1F642}\n\nIf the time is not right, no problem. When you are ready, just message me and I will book a slot for you.\n\nAll the best \u{1F4AA}" },

  { id: "tpl9", stage: "trial_offered", channel: "WhatsApp", label: "Still deciding",
    body: "No problem at all, {name} \u{1F642}\n\nIs there anything holding you back that I can help with \u2014 the timing, the location, or how the sessions work? Happy to explain anything before you decide." },

  { id: "tpl10", stage: "trial_booked", channel: "WhatsApp", label: "Booking confirmed",
    body: "All confirmed, {name} \u2705\n\n\u{1F4C5} {date}\n\u{1F551} {time}\n\u{1F4CD} {location}\n\u{1F3CB} Coach: {trainer}\n\nCome in comfortable workout clothes and bring a water bottle. Try to arrive 10 minutes early so we can get you settled and start the assessment properly.\n\nSee you then!" },

  { id: "tpl11", stage: "trial_booked", channel: "WhatsApp", label: "Reminder \u2014 day before",
    body: "Hi {name}, just a reminder about your session tomorrow at {time} with {trainer} \u{1F4AA}\n\nStill good to go? Let me know if anything's changed and we'll move it." },

  { id: "tpl12", stage: "trial_completed", channel: "WhatsApp", label: "After the assessment",
    body: "Great session today, {name} \u{1F525}\n\nHow are you feeling \u2014 any aches?\n\n{trainer} has gone through your movement screening and body composition, so we now have a clear picture of what your body needs. I can put together a plan built around that and your goals.\n\nWant me to send you the options?" },

  { id: "tpl13", stage: "trial_completed", channel: "WhatsApp", label: "No-show \u2014 re-book",
    body: "Hi {name}, we missed you at the session today \u2014 hope everything's okay \u{1F642}\n\nThings come up, no problem at all. What day and time works better for you this week?" },

  { id: "tpl14", stage: "proposal", channel: "WhatsApp", label: "Send the package",
    body: "Here's what I'd recommend for you, {name}:\n\n\u{1F4CB} {package}\n\u{1F4AA} {sessions} sessions with {trainer}\n\u{1F4B0} {price}\n\nThe programme is built around what we found in your assessment, tracked in our app, and we re-check your progress as you go.\n\nAnd if you're ever not happy with your coach, we'll move you to another one \u2014 your sessions stay with us.\n\nWe can start with a deposit of {deposit} and settle the rest before your first session. Any questions on it?" },

  { id: "tpl15", stage: "follow_up", channel: "WhatsApp", label: "Checking in on the plan",
    body: "Hi {name}, just checking in on the plan I sent over \u{1F642}\n\nAny questions about the sessions or the payment side? If a different number of sessions suits you better, we can adjust it \u2014 just let me know what you're thinking." },

  { id: "tpl16", stage: "follow_up", channel: "WhatsApp", label: "Last check-in",
    body: "Hi {name}, I don't want to keep chasing you \u{1F605}\n\nIf the timing isn't right, that's completely fine \u2014 just let me know and I'll stop messaging. And if you'd still like to start, I'm here whenever you're ready." },

  { id: "tpl17", stage: "won", channel: "WhatsApp", label: "Welcome aboard",
    body: "Welcome to Fitness Aspire, {name} \u{1F389}\n\nYou're all set with {trainer} for {sessions} sessions. Here's what happens next:\n\n1. {trainer} will message you to set your schedule\n2. First session at {location}\n3. We re-check your progress as we go, so you can see it working\n\nReally looking forward to training with you \u{1F4AA}" },

  { id: "tpl18", stage: "lost", channel: "WhatsApp", label: "Keeping the door open",
    body: "No problem at all, {name} \u2014 thanks for being straight with me \u{1F642}\n\nI'll leave it there for now. If things change down the line, you know where to find us. All the best with your training either way!" },
];

const TEMPLATE_VARS = ["name", "me", "trainer", "location", "goal", "date", "time", "package", "sessions", "price", "deposit"];

function fillTemplate(body, { lead, me, db, D }) {
  const trainer = db.settings.trainers.find((t) => t.id === lead.trainerId);
  const apts = (D.apptsByLead[lead.id] || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const apt = apts[0];
  const map = {
    name: (lead.name || "").split(" ")[0] || lead.name,
    me: me.name,
    trainer: trainer ? trainer.name : "your coach",
    location: lead.preferredLocation || lead.location || "our studio",
    goal: (lead.goal || "your goal").toLowerCase(),
    date: apt ? fmtDateFull(apt.date) : "[date]",
    time: apt ? apt.time : "[time]",
    package: (lead.deal && lead.deal.packageName) || "[package]",
    sessions: (lead.deal && lead.deal.sessions) || "[sessions]",
    price: lead.deal ? RM(lead.deal.finalPrice) : "[price]",
    deposit: lead.deal ? RM(lead.deal.deposit) : "[deposit]",
  };
  return String(body).replace(/\{(\w+)\}/g, (m, k) => (map[k] !== undefined ? map[k] : m));
}

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
  templates: DEFAULT_TEMPLATES,
  notifications: {
    overdueFollowUp: true, trialReminder: true, noShowFollowUp: true,
    inactiveLead: true, hotLeadNoFollowUp: true, staleStage: true,
    inactiveDays: 7, staleStageDays: 14,
  },
};

/* ------------------------------------------------------------
   LOGIN PASSCODES
   Passcodes are managed in Settings → People and access, per person.
   Nothing here needs editing — the map below is only a fallback for
   accounts created before passcodes moved into Settings.
   Note: this keeps people out of the app, but it is not bank-grade
   security. Real accounts come with the Supabase step.
   ------------------------------------------------------------ */
const FALLBACK_PASSCODE = "aspire2026";
const USER_PASSCODES = {
  u1: "aspire2026", u2: "nadia2026", u3: "weijie2026", u4: "faiz2026",
};
const passcodeFor = (u) =>
  (u && u.passcode) || (u && USER_PASSCODES[u.id]) || FALLBACK_PASSCODE;

const DEFAULT_USERS = [
  { id: "u1", name: "Andrea", role: "admin", email: "andrea@fitnessaspire.my", active: true, passcode: "aspire2026" },
  { id: "u2", name: "Nadia", role: "sales", email: "nadia@fitnessaspire.my", active: true, passcode: "nadia2026" },
  { id: "u3", name: "Wei Jie", role: "sales", email: "weijie@fitnessaspire.my", active: true, passcode: "weijie2026" },
  { id: "u4", name: "Faiz", role: "sales", email: "faiz@fitnessaspire.my", active: true, passcode: "faiz2026" },
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

/* A completely empty system — your settings kept, all leads gone. */
function emptyData(keepSettings, keepUsers) {
  const users = keepUsers || (CLOUD ? [] : DEFAULT_USERS);
  return {
    version: 1,
    users,
    settings: keepSettings || DEFAULT_SETTINGS,
    campaigns: [], leads: [], activities: [], followups: [],
    appointments: [], notes: [], tasks: [],
    currentUserId: users[0] ? users[0].id : null,
    dismissedAlerts: [],
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
    accent: { text: "text-amber-600", edge: "#C89252" },
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
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto bg-slate-900 bg-opacity-40"
      onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
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
  contentStyle: { fontSize: 12, borderRadius: 8, border: "1px solid #E4DED2", boxShadow: "0 8px 24px -8px rgba(24,31,41,0.18)" },
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

    const dealValue = (l) => {
      const d = l.deal && Number(l.deal.finalPrice) > 0 ? Number(l.deal.finalPrice) : 0;
      return d || Number(l.estValue) || 0;
    };
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
    if (!l.phone && !l.email && !l.handle && daysDiff(todayISO, l.createdAt) >= 1)
      add({ type: "nocontact", priority: 2, leadId: l.id, title: "No contact details saved yet", detail: "Add a phone, email or handle so this lead can be reached" });
    if (l.stage === "new" && daysDiff(todayISO, l.createdAt) >= 1)
      add({ type: "uncontacted", priority: 2, leadId: l.id, title: "New lead not contacted yet", detail: `Created ${fmtDate(l.createdAt)}` });
    if (l.stage === "proposal" && stageAge >= 3)
      add({ type: "proposal_silent", priority: 2, leadId: l.id, title: "Proposal sent, no response", detail: `${stageAge} days since sent` });
    if (cfg.inactiveLead && idle >= cfg.inactiveDays)
      add({ type: "inactive", priority: 2, leadId: l.id, title: `No activity for ${idle} days`, detail: `Last touch ${fmtDate(touched)}` });
    if (l.stage === "follow_3" && stageAge >= 5)
      add({ type: "followup_exhausted", priority: 2, leadId: l.id,
        title: "Third follow-up with no reply", detail: "Time to mark this one lost and free up your attention" });
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
  db.leads.forEach((l) => {
    if (l.stage !== "won") return;
    const val = (l.deal && Number(l.deal.finalPrice)) || Number(l.estValue) || 0;
    if (val <= 0)
      add({ type: "won_noprice", priority: 2, leadId: l.id, title: "Won deal has no price recorded",
        detail: "Revenue reports will be wrong until this is filled in" });
  });

  (db.tasks || []).forEach((t) => {
    if (t.done || t.date >= todayISO) return;
    const late = Math.abs(daysDiff(t.date, todayISO));
    add({ type: "task", priority: t.priority === "high" ? 1 : 2, refId: t.id, leadId: t.leadId || null,
      title: `Task ${late} day(s) overdue: ${t.title}`, detail: prioMeta(t.priority).label });
  });

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
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "templates", label: "Templates", icon: MessageCircle },
  { id: "marketing", label: "Marketing", icon: Megaphone },
  { id: "sales", label: "Sales", icon: TrendingUp },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "alerts", label: "Alerts", icon: AlertTriangle },
  { id: "settings", label: "Settings", icon: SettingsIcon, adminOnly: true },
];

function CloudLogin() {
  const [mode, setMode] = useState("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async () => {
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    if (mode === "up" && password.length < 8) { setError("Use at least 8 characters for the password."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) setNotice("Account created. Check your email to confirm it, then sign in.");
      }
    } catch (e) {
      const m = String(e.message || e);
      setError(
        /invalid login/i.test(m) ? "That email and password don't match an account."
        : /already registered/i.test(m) ? "That email already has an account — sign in instead."
        : m
      );
    } finally { setBusy(false); }
  };

  const reset = async () => {
    if (!email.trim()) { setError("Type your email first, then tap this again."); return; }
    setBusy(true); setError(""); setNotice("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setBusy(false);
    if (error) setError(String(error.message)); else setNotice("Password reset link sent — check your email.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ backgroundColor: "#F7F6F3" }}>
      <div className="w-full max-w-sm">
        <div className="hero-pine rounded-xl p-6">
          <div className="flex items-center gap-2.5">
            <BrandMark size={36} />
            <div>
              <div className="text-white text-sm font-semibold leading-tight">Fitness Aspire</div>
              <div className="t10 uppercase tracking-widest" style={{ color: "#8E97A6" }}>Sales CRM</div>
            </div>
          </div>
          <h1 className="text-white text-xl font-semibold mt-5">{mode === "in" ? "Sign in" : "Create your account"}</h1>
          <p className="text-sm mt-1" style={{ color: "#AEB6C2" }}>
            {mode === "in" ? "Your leads are waiting on every device." : "The first account created becomes the Admin."}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 mt-3 space-y-3">
          <Field label="Email">
            <Input type="email" value={email} autoFocus autoComplete="username"
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="you@fitnessaspire.my" />
          </Field>
          <Field label="Password">
            <Input type="password" value={password}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={mode === "in" ? "Your password" : "At least 8 characters"} />
          </Field>

          {error && <p className="text-xs px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</p>}
          {notice && <p className="text-xs px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">{notice}</p>}

          <Btn variant="accent" size="lg" className="w-full" onClick={submit} disabled={busy}>
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
          </Btn>

          <div className="flex items-center justify-between pt-1">
            <button className="t11 text-slate-500 hover:text-slate-800"
              onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(""); setNotice(""); }}>
              {mode === "in" ? "Create an account" : "I already have an account"}
            </button>
            {mode === "in" && (
              <button className="t11 text-slate-500 hover:text-slate-800" onClick={reset}>Forgot password?</button>
            )}
          </div>
        </div>

        <p className="t11 text-slate-400 text-center mt-3">Your data is stored securely and shared with your team.</p>
      </div>
    </div>
  );
}

function LoginScreen({ users, onLogin }) {
  const list = users.filter((u) => u.active);
  const [userId, setUserId] = useState(list[0]?.id || "");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");

  const submit = () => {
    const user = list.find((u) => u.id === userId);
    if (!user) { setError("Pick who you are first."); return; }
    if (code !== passcodeFor(user)) { setError("That passcode isn't right. Try again."); return; }
    setError("");
    onLogin(userId, remember);
  };

  const who = list.find((u) => u.id === userId);

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ backgroundColor: "#F7F6F3" }}>
      <div className="w-full max-w-sm">
        <div className="hero-pine rounded-xl p-6">
          <div className="flex items-center gap-2.5">
            <BrandMark size={36} />
            <div>
              <div className="text-white text-sm font-semibold leading-tight">Fitness Aspire</div>
              <div className="t10 uppercase tracking-widest" style={{ color: "#8E97A6" }}>Sales CRM</div>
            </div>
          </div>
          <h1 className="text-white text-xl font-semibold mt-5">Sign in</h1>
          <p className="text-sm mt-1" style={{ color: "#AEB6C2" }}>Choose your name and enter your passcode.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 mt-3 space-y-3">
          <Field label="Who are you?">
            <Select value={userId} onChange={(e) => { setUserId(e.target.value); setError(""); }}>
              {list.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.role === "admin" ? "Admin" : "Sales"}</option>)}
            </Select>
          </Field>
          <Field label="Passcode">
            <Input type="password" value={code} autoFocus
              onChange={(e) => { setCode(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Enter your passcode" />
          </Field>
          {error && (
            <p className="text-xs px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</p>
          )}
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
              className="rounded border-slate-300 text-amber-500 focus:ring-amber-400" />
            <span className="text-slate-700">Keep me signed in on this device</span>
          </label>
          <Btn variant="accent" size="lg" className="w-full" onClick={submit}>
            Sign in{who ? ` as ${who.name}` : ""}
          </Btn>
        </div>

        <p className="t11 text-slate-400 text-center mt-3">
          Forgot your passcode? An Admin can see and change it in Settings → People and access.
        </p>
      </div>
    </div>
  );
}

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
  const [authedUserId, setAuthedUserId] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveState, setSaveState] = useState("idle");   // idle | saving | saved | error
  const [savedAt, setSavedAt] = useState(null);
  const hydrated = useRef(false);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!CLOUD);
  const saveTimer = useRef(null);
  const lastSaved = useRef(null);

  /* ---- who is signed in (cloud mode) ---- */
  useEffect(() => {
    if (!CLOUD) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session || null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s || null);
      if (!s) { setAuthedUserId(null); setDb(null); setLoading(true); }
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  /* ---- load ---- */
  useEffect(() => {
    if (CLOUD && (!authReady || !session)) return;
    (async () => {
      let saved = null;
      let readFailed = false;
      let readMessage = "";
      try {
        const res = await storage.get(STORAGE_KEY);
        if (res && res.value) {
          saved = JSON.parse(res.value);
          if (!Array.isArray(saved.tasks)) saved.tasks = [];
        }
      } catch (e) {
        // Could not reach the data. NEVER treat this as "new user" —
        // doing so would overwrite real data with an empty workspace.
        readFailed = true;
        readMessage = String((e && e.message) || e);
      }

      // stay signed in between visits
      try {
        const sess = await storage.get(SESSION_KEY);
        const id = sess && sess.value;
        if (id && saved) {
          const u = saved.users.find((x) => x.id === id && x.active);
          if (u) setAuthedUserId(u.id);
        }
      } catch (e) { /* nobody signed in yet */ }

      if (saved) {
        lastSaved.current = JSON.stringify(saved);
        hydrated.current = true;
        setDb(saved);
        setLoading(false);
        return;
      }

      if (readFailed) {
        setLoadError(readMessage || "Could not reach your data.");
        setLoading(false);
        return;
      }
      const fresh = emptyData();
      lastSaved.current = JSON.stringify(fresh);
      hydrated.current = true;
      setDb(fresh);
      setLoading(false);
      try { await storage.set(STORAGE_KEY, JSON.stringify(fresh)); } catch (e) {}
    })();
  }, [authReady, session]);

  /* ---- persist (debounced) ---- */
  useEffect(() => {
    if (!db) return;
    // Only ever save once we have successfully loaded. Without this, a failed
    // read could save an empty workspace over real data.
    if (!hydrated.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const payload = JSON.stringify(db);
      setSaveState("saving");
      storage.set(STORAGE_KEY, payload)
        .then(() => {
          lastSaved.current = payload;
          setSaveError("");
          setSaveState("saved");
          setSavedAt(new Date());
        })
        .catch((e) => {
          // Never fail silently: an unsaved change the user thinks is saved
          // is how data gets lost.
          setSaveError(String((e && e.message) || e));
          setSaveState("error");
        });
    }, 1200);
    return () => clearTimeout(saveTimer.current);
  }, [db]);

  /* ---- live sync: pick up changes made on other devices ---- */
  useEffect(() => {
    if (!CLOUD || !session) return;
    const channel = supabase
      .channel("workspace-sync")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "app_state", filter: `key=eq.${STORAGE_KEY}` },
        (payload) => {
          const incoming = payload.new && payload.new.value;
          if (!incoming || incoming === lastSaved.current) return;
          try {
            const parsed = JSON.parse(incoming);
            lastSaved.current = incoming;
            setDb(parsed);
          } catch (e) { /* ignore a malformed update */ }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const flash = useCallback((m) => { setToast(m); setTimeout(() => setToast(""), 2200); }, []);
  const range = useMemo(() => rangeFor(preset, custom), [preset, custom]);

  // In cloud mode, match the signed-in email to a team member (creating one on first sign-in).
  useEffect(() => {
    if (!CLOUD || !session || !db) return;
    const email = (session.user.email || "").toLowerCase();
    const found = db.users.find((u) => (u.email || "").toLowerCase() === email);
    if (found) {
      if (authedUserId !== found.id) setAuthedUserId(found.id);
      return;
    }
    const isFirst = db.users.length === 0;
    const newUser = {
      id: uid("u"),
      name: email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      email,
      role: isFirst ? "admin" : "sales",
      active: true,
      passcode: "",
    };
    setAuthedUserId(newUser.id);
    setDb((s) => ({ ...s, users: [...s.users, newUser], currentUserId: s.currentUserId || newUser.id }));
  }, [session, db, authedUserId]);

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5" style={{ backgroundColor: "#F7F6F3" }}>
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6">
          <div className="w-10 h-10 rounded-xl brand-mark flex items-center justify-center mb-4">
            <span className="font-display font-bold text-sm" style={{ color: "#181F29" }}>FA</span>
          </div>
          <h1 className="text-lg font-semibold">Couldn't reach your data</h1>
          <p className="text-sm text-slate-600 mt-2">
            Your leads are safe on the server — the app just couldn't load them right now.
            Nothing has been changed or overwritten.
          </p>
          <p className="text-sm text-slate-600 mt-2">Most often this is one of:</p>
          <ul className="text-sm text-slate-600 mt-1 space-y-1 list-disc pl-5">
            <li>The Supabase project is paused after a quiet week — open your Supabase dashboard and click Restore</li>
            <li>No internet connection</li>
            <li>Your sign-in expired — sign out and back in</li>
          </ul>
          <p className="t11 text-slate-400 mt-3 font-mono break-words">{loadError}</p>
          <div className="flex gap-2 mt-4">
            <Btn variant="accent" onClick={() => window.location.reload()}>Try again</Btn>
            {CLOUD && (
              <Btn variant="outline" onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}>
                Sign out
              </Btn>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (CLOUD && !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F7F6F3" }}>
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl brand-mark flex items-center justify-center mx-auto mb-3">
            <span className="font-display font-bold text-sm" style={{ color: "#181F29" }}>FA</span>
          </div>
          <p className="text-sm text-slate-500">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (CLOUD && !session) return <CloudLogin />;

  if (loading || !db) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl brand-mark flex items-center justify-center mx-auto mb-3">
            <span className="font-display font-bold text-sm" style={{ color: "#181F29" }}>FA</span>
          </div>
          <p className="text-sm text-slate-500">Loading your pipeline…</p>
        </div>
      </div>
    );
  }

  if (!authedUserId && !CLOUD) {
    return (
      <LoginScreen
        users={db.users}
        onLogin={(id, remember) => {
          setAuthedUserId(id);
          setDb((s) => ({ ...s, currentUserId: id }));
          setView("today");
          storage.set(SESSION_KEY, remember ? id : "").catch(() => {});
        }}
      />
    );
  }

  const me = db.users.find((u) => u.id === authedUserId) || db.users[0];
  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F7F6F3" }}>
        <p className="text-sm text-slate-500">Setting up your account…</p>
      </div>
    );
  }
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
      saveError={saveError} setSaveError={setSaveError}
      saveState={saveState} savedAt={savedAt}
      onSignOut={async () => {
        setView("today");
        if (CLOUD) { await supabase.auth.signOut(); return; }
        setAuthedUserId(null);
        storage.set(SESSION_KEY, "").catch(() => {});
      }}
    />
  );
}

function AppInner(props) {
  const {
    db, setDb, me, isAdmin, nav, view, setView, openLeadId, setOpenLeadId,
    flash, toast, sidebarOpen, setSidebarOpen, preset, setPreset, custom, setCustom,
    range, search, setSearch, leadModal, setLeadModal, onSignOut, saveError, setSaveError,
    saveState, savedAt,
  } = props;

  const D = useDerived(db);
  const alerts = useMemo(() => buildAlerts(db, D), [db, D]);

  /* ---------- mutations ---------- */
  const patchLead = useCallback((id, patch, activity) => {
    setDb((s) => {
      const i = s.leads.findIndex((l) => l.id === id);
      if (i < 0) return s;
      const leads = s.leads.slice();
      leads[i] = { ...leads[i], ...patch, updatedAt: todayISO, updatedBy: me.name };
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

  const toggleTask = useCallback((task) => {
    setDb((s) => ({
      ...s,
      tasks: (s.tasks || []).map((t) => (t.id === task.id
        ? { ...t, done: !t.done, doneAt: !t.done ? todayISO : null, updatedAt: todayISO }
        : t)),
    }));
  }, [setDb]);

  const dismissAlert = useCallback((id) => {
    setDb((s) => ({ ...s, dismissedAlerts: [...(s.dismissedAlerts || []), id] }));
  }, [setDb]);

  const ctx = {
    db, setDb, me, isAdmin, D, alerts, range, patchLead, addLead, deleteLead, moveStage,
    upsert, removeFrom, completeFollowup, dismissAlert, flash, setView, setOpenLeadId, setLeadModal,
    toggleTask,
  };

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return db.leads.filter((l) =>
      l.name.toLowerCase().includes(q) || (l.phone || "").toLowerCase().includes(q) ||
      (l.email || "").toLowerCase().includes(q) || (l.handle || "").toLowerCase().includes(q) ||
      l.id.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [search, db.leads]);

  const urgentCount = alerts.filter((a) => a.priority === 1).length;
  const dueToday = D.openFollowups.filter((f) => f.date <= todayISO).length;

  const tasksDue = (db.tasks || []).filter((t) => !t.done && t.date <= todayISO).length;
  const badgeFor = (id) => {
    if (id === "alerts" && urgentCount) return urgentCount;
    if (id === "followups" && dueToday) return dueToday;
    if (id === "tasks" && tasksDue) return tasksDue;
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* theme lives in src/index.css */}
      {/* ---------- Sidebar ---------- */}
      {sidebarOpen && <div className="fixed inset-0 bg-slate-900 bg-opacity-40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-60 bg-slate-900 flex flex-col shrink-0 transform transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="px-4 py-4 flex items-center gap-2.5 border-b border-slate-800">
          <BrandMark logo={db.settings.logo} size={32} />
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

        <div className="px-3 py-2 border-t border-slate-800">
          <SaveIndicator state={saveState} at={savedAt} cloud={CLOUD} />
        </div>

        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full brand-mark flex items-center justify-center shrink-0">
              <span className="font-display font-bold t10" style={{ color: "#181F29" }}>{me.name.slice(0, 2).toUpperCase()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white text-sm font-medium truncate leading-tight">{me.name}</div>
              <div className="t10 uppercase tracking-widest text-slate-500">{me.role === "admin" ? "Admin / Owner" : "Sales"}</div>
            </div>
          </div>
          <button onClick={onSignOut}
            className="mt-2.5 w-full text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg py-2 transition-colors">
            Sign out
          </button>
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
          {view === "tasks" && <TasksView ctx={ctx} />}
          {view === "templates" && <TemplatesView ctx={ctx} />}
          {view === "marketing" && <MarketingView ctx={ctx} />}
          {view === "sales" && <SalesView ctx={ctx} />}
          {view === "reports" && <ReportsView ctx={ctx} />}
          {view === "alerts" && <AlertsView ctx={ctx} />}
          {view === "settings" && <SettingsView ctx={ctx} />}
        </main>
      </div>

      {openLeadId && <LeadProfile ctx={ctx} leadId={openLeadId} onClose={() => setOpenLeadId(null)} />}
      {leadModal && <LeadForm ctx={ctx} initial={leadModal} onClose={() => setLeadModal(null)} />}
      {saveError && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-rose-600 text-white px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-start gap-3">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Your changes are NOT being saved</p>
              <p className="t11 mt-0.5 opacity-90">
                Anything you enter now will be lost when you close the app. Take a backup from
                Settings → Data, then check that the Supabase setup SQL has been run.
              </p>
              <p className="t11 mt-1 font-mono opacity-75 break-words">{saveError}</p>
            </div>
            <button onClick={() => setSaveError("")} className="shrink-0 opacity-80 hover:opacity-100"><X size={16} /></button>
          </div>
        </div>
      )}
      <Toast msg={toast} />
    </div>
  );
}

function SaveIndicator({ state, at, cloud }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const ago = () => {
    if (!at) return "";
    const secs = Math.round((Date.now() - at.getTime()) / 1000);
    if (secs < 45) return "just now";
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} min ago`;
    return at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  if (state === "error") {
    return (
      <div className="flex items-center gap-2 px-1.5 py-1">
        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
        <span className="t11 text-rose-300 font-medium">Not saving — see the red bar</span>
      </div>
    );
  }
  if (state === "saving") {
    return (
      <div className="flex items-center gap-2 px-1.5 py-1">
        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
        <span className="t11 text-slate-400">Saving…</span>
      </div>
    );
  }
  if (state === "saved") {
    return (
      <div className="flex items-center gap-2 px-1.5 py-1">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="t11 text-slate-400">
          Saved {ago()}{cloud ? " to the server" : ""}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-1.5 py-1">
      <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
      <span className="t11 text-slate-500">{cloud ? "Connected" : "This browser only"}</span>
    </div>
  );
}

function BrandMark({ logo, size = 32, rounded = "rounded-lg" }) {
  if (logo) {
    return (
      <img src={logo} alt="Logo" style={{ width: size, height: size }}
        className={`${rounded} object-cover shrink-0 bg-white`} />
    );
  }
  return (
    <div className={`${rounded} brand-mark flex items-center justify-center shrink-0`}
      style={{ width: size, height: size }}>
      <span className="font-display font-bold" style={{ color: "#181F29", fontSize: Math.round(size * 0.34) }}>FA</span>
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
  const myTasks = (db.tasks || [])
    .filter((t) => !t.done && t.date <= todayISO && (isAdmin || t.assigneeId === me.id))
    .sort((a, b) => a.date.localeCompare(b.date) || prioMeta(a.priority).rank - prioMeta(b.priority).rank);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const STAGE_HEX = {
    new: "#93A29C", contacted: "#6398C4", replied: "#43769F", qualified: "#6A5AA0",
    follow_1: "#E0B478", follow_2: "#E09A2A", follow_3: "#D97D68",
    trial_offered: "#A8557E", trial_booked: "#2E8B84", trial_completed: "#40608F",
    proposal: "#C89252", follow_up: "#BE4630",
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
            <p className="t10 uppercase tracking-widest" style={{ color: "#8E97A6" }}>
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="text-white text-2xl font-semibold mt-1.5">{greet}, {me.name}</h1>
            <p className="text-sm mt-1.5" style={{ color: "#AEB6C2" }}>
              {overdue.length + today.length === 0
                ? "Nothing overdue. Work the new leads and keep the pipeline warm."
                : `${overdue.length + today.length} follow-up${overdue.length + today.length === 1 ? "" : "s"} need you today.`}
            </p>
          </div>
          <div className="flex gap-6 sm:gap-9">
            {[
              { n: overdue.length, l: "Overdue", c: "#E08B74" },
              { n: today.length, l: "Due today", c: "#E0B478" },
              { n: trialsToday.length, l: "Trials today", c: "#FFFFFF" },
              { n: newLeads.length, l: "New leads", c: "#FFFFFF" },
              { n: myTasks.length, l: "Tasks due", c: "#FFFFFF" },
            ].map((k) => (
              <div key={k.l}>
                <div className="font-mono text-3xl font-semibold tabular-nums" style={{ color: k.c }}>{k.n}</div>
                <div className="t10 uppercase tracking-widest mt-1" style={{ color: "#8E97A6" }}>{k.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-rule my-5" />

        <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
          <span className="t10 uppercase tracking-widest" style={{ color: "#8E97A6" }}>Open pipeline</span>
          <span className="font-mono text-sm font-semibold" style={{ color: "#E3B665" }}>{RM(pulseTotal)}</span>
        </div>
        <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "#242E3D" }}>
          {pulse.map((p) => (
            <div key={p.id} title={`${p.label}: ${p.count} leads · ${RM(p.value)}`}
              style={{ width: (pulseTotal ? (p.value / pulseTotal) * 100 : 0) + "%", backgroundColor: p.hex }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          {pulse.filter((p) => p.count > 0).map((p) => (
            <span key={p.id} className="t11 flex items-center gap-1.5" style={{ color: "#AEB6C2" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.hex }} />
              {p.label}<span className="font-mono" style={{ color: "#8E97A6" }}>{p.count}</span>
            </span>
          ))}
        </div>
      </div>

      {db.leads.length === 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Your system is empty — that's the right starting point</h2>
          <p className="text-sm text-slate-600 mt-1.5">
            Set up your packages, locations, trainers and team in Settings, then add your first real lead.
            Nothing here is demo data, so what you see is only ever what you put in.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Btn variant="accent" size="sm" onClick={() => ctx.setLeadModal({})}><Plus size={14} />Add your first lead</Btn>
            {isAdmin && <Btn variant="outline" size="sm" onClick={() => ctx.setView("settings")}>Open Settings</Btn>}
          </div>
        </Card>
      )}

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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card className="overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Tasks due</h2>
            <span className="font-mono text-xs text-slate-400">{myTasks.length}</span>
          </div>
          {myTasks.length === 0 ? <Empty icon={ListChecks} title="No tasks due" /> : (
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
              {myTasks.slice(0, 8).map((t) => {
                const pr = prioMeta(t.priority);
                const late = t.date < todayISO;
                return (
                  <div key={t.id} className="flex items-center gap-2.5 px-3 py-2.5">
                    <button onClick={() => ctx.toggleTask(t)} className="shrink-0" aria-label="Mark done">
                      <span className="w-4 h-4 rounded border-2 border-slate-300 hover:border-amber-500 block" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-900 truncate">{t.title}</div>
                      <div className="t11 text-slate-500">{late ? "Overdue" : "Today"} · {pr.label}</div>
                    </div>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pr.dot}`} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

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
      step("Contacted", count((l) => atLeast(l.stage, "contacted") || l.stage === "lost")),
      step("Qualified", count((l) => atLeast(l.stage, "qualified") && l.stage !== "lost") + count((l) => l.stage === "lost" && l.deal)),
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
      { name: "Tomorrow", value: open.filter((f) => f.date === addDays(todayISO, 1)).length, color: "#C89252" },
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
      if (q && !(l.name.toLowerCase().includes(q) || (l.phone || "").includes(q) || (l.email || "").toLowerCase().includes(q)
        || (l.handle || "").toLowerCase().includes(q) || l.id.toLowerCase().includes(q))) return false;
      if (f.source && l.source !== f.source) return false;
      if (f.owner && l.ownerId !== f.owner) return false;
      if (f.stage === "__wonzero" && !(l.stage === "won" && D.dealValue(l) <= 0)) return false;
      if (f.stage && f.stage !== "__wonzero" && l.stage !== f.stage) return false;
      if (f.temp && l.temperature !== f.temp) return false;
      if (f.location && l.preferredLocation !== f.location) return false;
      if (f.pkg === "__custom" && l.packageId) return false;
      if (f.pkg && f.pkg !== "__custom" && l.packageId !== f.pkg) return false;
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

  const PER_PAGE = 50;
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [f, sort]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = rows.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE);

  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
  const owner = (id) => db.users.find((u) => u.id === id)?.name || "—";
  const activeFilters = Object.entries(f).filter(([k, v]) => v && k !== "q").length;

  const exportRows = () => {
    downloadCSV(`fitness-aspire-leads-${todayISO}.csv`, [
      ["Lead ID", "Name", "Phone", "Email", "Social handle", "Gender", "Age", "Location", "Preferred location", "Created", "Source", "Campaign", "Ad", "Salesperson", "Stage", "Temperature", "Goal", "Package", "Sessions", "Est. value (RM)", "Lost reason", "Next follow-up"],
      ...rows.map((l) => [
        l.id, l.name, l.phone, l.email, l.handle || "", l.gender, l.age, l.location, l.preferredLocation, l.createdAt, l.source,
        db.campaigns.find((c) => c.id === l.campaignId)?.name || "", l.adName, owner(l.ownerId), stageLabel(l.stage),
        l.temperature, l.goal, l.deal?.packageName || db.settings.packages.find((p) => p.id === l.packageId)?.name || "", l.deal?.sessions || "", D.dealValue(l),
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
                <option value="">All stages</option>
                <option value="__wonzero">Won — price missing</option>
                {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
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
                <option value="">Any package</option><option value="__custom">Custom / undecided</option>{db.settings.packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                {paged.map((l) => {
                  const nf = D.nextFollowup[l.id];
                  const st = nf ? fuState(nf) : null;
                  const apts = (D.apptsByLead[l.id] || []).slice().sort((a, b) => b.date.localeCompare(a.date));
                  return (
                    <tr key={l.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setOpenLeadId(l.id)}>
                      <Td>
                        <div className="font-medium text-slate-900">{l.name}</div>
                        <div className="text-xs text-slate-400 font-mono">{l.id} · {l.phone || l.handle || l.email || "no contact yet"}</div>
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
        {rows.length > PER_PAGE && (
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-t border-slate-200 bg-slate-50">
            <span className="t11 text-slate-500 font-mono">
              {safePage * PER_PAGE + 1}–{Math.min(rows.length, safePage * PER_PAGE + PER_PAGE)} of {rows.length}
            </span>
            <div className="flex gap-2">
              <Btn size="sm" variant="outline" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</Btn>
              <Btn size="sm" variant="outline" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>Next</Btn>
            </div>
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
    name: "", phone: "", email: "", handle: "", gender: "Female", age: "", location: db.settings.locations[0],
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
    if (!v.name.trim()) { flash("A name is required — everything else can wait"); return; }
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
            <Field label="Phone number (optional)"><Input value={v.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Add it once they share it" /></Field>
            <Field label="Email (optional)"><Input value={v.email} onChange={(e) => set("email", e.target.value)} placeholder="Add it later" /></Field>
            <Field label="Social handle (optional)"><Input value={v.handle} onChange={(e) => set("handle", e.target.value)} placeholder="@their_instagram" /></Field>
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
            <Field label="Interested package">
              <Select value={v.packageId} onChange={(e) => onPackage(e.target.value)}>
                <option value="">Not decided yet / custom</option>
                {db.settings.packages.map((p) => <option key={p.id} value={p.id}>{p.name} — {RM(p.price)}</option>)}
              </Select>
            </Field>
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
  const [wonModal, setWonModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  useEffect(() => { setTab("overview"); }, [leadId]);
  if (!lead) return null;

  const owner = db.users.find((u) => u.id === lead.ownerId);
  const trainer = db.settings.trainers.find((t) => t.id === lead.trainerId);
  const camp = db.campaigns.find((c) => c.id === lead.campaignId);
  const acts = useMemo(() => (D.actByLead[lead.id] || []).slice().sort((a, b) => b.date.localeCompare(a.date)), [D, lead.id]);
  const fus = useMemo(() => (D.fuByLead[lead.id] || []).slice().sort((a, b) => b.date.localeCompare(a.date)), [D, lead.id]);
  const apts = useMemo(() => (D.apptsByLead[lead.id] || []).slice().sort((a, b) => b.date.localeCompare(a.date)), [D, lead.id]);
  const leadNotes = useMemo(() => db.notes.filter((n) => n.leadId === lead.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [db.notes, lead.id]);
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

  const wonIdx = stageIndex("won");
  const nextStage = STAGES[Math.min(stageIndex(lead.stage) + 1, wonIdx)];
  const tabs = [["overview", "Overview"], ["messages", "Messages"], ["timeline", "Timeline"], ["followups", `Follow-ups (${fus.length})`], ["appointments", `Trials (${apts.length})`], ["deal", "Package"], ["notes", `Notes (${leadNotes.length})`]];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900 bg-opacity-40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) e.currentTarget.dataset.fromBackdrop = "1"; }}
      onClick={(e) => {
        const started = e.currentTarget.dataset.fromBackdrop === "1";
        e.currentTarget.dataset.fromBackdrop = "";
        if (started && e.target === e.currentTarget) onClose();
      }}>
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
                  <span className="flex items-center gap-1"><Phone size={12} />{lead.phone || "No phone yet"}</span>
                  <span className="flex items-center gap-1"><Mail size={12} />{lead.email || "No email"}</span>
                  {lead.handle && <span className="flex items-center gap-1"><Instagram size={12} />{lead.handle}</span>}
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
              <Btn size="sm" variant="success" onClick={() => setWonModal(true)}>
                <Trophy size={13} />{lead.stage === "won" ? "Edit sale amount" : "Mark won"}
              </Btn>
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
                    ["Package", lead.deal?.packageName || db.settings.packages.find((p) => p.id === lead.packageId)?.name || "Not decided yet"],
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
                    {STAGES.slice(0, stageIndex("won") + 1).map((s, i) => {
                      const done = stageIndex(lead.stage) >= i && lead.stage !== "lost";
                      const current = lead.stage === s.id;
                      return (
                        <button key={s.id} onClick={() => (s.id === "won" ? setWonModal(true) : moveStage(lead.id, s.id))}
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

          {tab === "messages" && <MessagesTab ctx={ctx} lead={lead} />}

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
                          if (e.target.value === "Completed" && before(lead.stage, "trial_completed")) moveStage(lead.id, "trial_completed");
                        }}>
                        {APPT_STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </Select>
                      <Btn size="sm" variant="ghost" onClick={() => setAptModal({ ...a })}><Pencil size={13} /></Btn>
                      <Btn size="sm" variant="ghost" onClick={() => { if (confirm("Delete this trial appointment?")) removeFrom("appointments", a.id); }}><Trash2 size={13} /></Btn>
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
                    ["Balance due", RM(Math.max(0, lead.deal.finalPrice - lead.deal.deposit))],
                    ["Per session", lead.deal.sessions ? RM(lead.deal.finalPrice / lead.deal.sessions) : "—"]].map(([k, val]) => (
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
      {wonModal && <WonForm ctx={ctx} lead={lead} onClose={() => setWonModal(false)} />}
      {lostModal && <LostForm ctx={ctx} lead={lead} onClose={() => setLostModal(false)} />}
    </div>
  );
}

function MessagesTab({ ctx, lead }) {
  const { db, me, D, flash } = ctx;
  const all = db.settings.templates || DEFAULT_TEMPLATES;
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState("");

  const forStage = all.filter((t) => t.stage === lead.stage);
  const list = showAll || forStage.length === 0 ? all : forStage;

  const copy = async (t) => {
    const text = fillTemplate(t.body, { lead, me, db, D });
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (err) {}
      document.body.removeChild(ta);
    }
    setCopied(t.id); setTimeout(() => setCopied(""), 1800);
    flash("Copied — paste it into WhatsApp or Instagram");
  };

  const logSent = (t) => {
    ctx.setDb((st) => ({
      ...st,
      activities: [...st.activities, { id: uid("act"), leadId: lead.id, date: todayISO,
        type: "message", text: `${t.channel} sent — ${t.label}`, by: me.name }],
    }));
    flash("Logged on the timeline");
  };

  const waLink = (t) => {
    let digits = String(lead.phone || "").replace(/\D/g, "");
    if (!digits) return null;
    if (digits.startsWith("0")) digits = "6" + digits;        // 012... -> 6012...
    if (digits.length < 8) return null;
    return `https://wa.me/${digits}?text=${encodeURIComponent(fillTemplate(t.body, { lead, me, db, D }))}`;
  };

  const igLink = () => {
    const h = String(lead.handle || "").trim().replace(/^@/, "");
    if (!h) return null;
    return `https://instagram.com/${h}`;
  };

  return (
    <Card className="p-4">
      <SectionTitle
        sub={showAll ? "Every template" : `Suggested for ${stageLabel(lead.stage)} — names and details already filled in`}
        right={<Btn size="sm" variant="outline" onClick={() => setShowAll(!showAll)}>{showAll ? "Show suggested" : "Show all"}</Btn>}>
        Message templates
      </SectionTitle>

      {forStage.length === 0 && !showAll && (
        <p className="t11 text-slate-500 mb-3">Nothing written for this stage yet — showing everything instead.</p>
      )}

      <div className="space-y-3 mt-2">
        {list.map((t) => {
          const text = fillTemplate(t.body, { lead, me, db, D });
          const link = waLink(t);
          const ig = igLink();
          return (
            <div key={t.id} className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                <span className="text-xs font-medium text-slate-800">{t.label}</span>
                <span className="t10 uppercase tracking-widest text-slate-400">{t.channel}</span>
                {showAll && <span className="t10 text-slate-400 ml-auto">{stageLabel(t.stage)}</span>}
              </div>
              <p className="px-3 py-2.5 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{text}</p>
              <div className="flex gap-2 px-3 pb-3">
                <Btn size="sm" variant={copied === t.id ? "success" : "outline"} onClick={() => copy(t)}>
                  {copied === t.id ? <><Check size={13} />Copied</> : "Copy"}
                </Btn>
                <Btn size="sm" variant="ghost" onClick={() => logSent(t)}>Log as sent</Btn>
                {link && (
                  <a href={link} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50">
                    <MessageCircle size={13} />Open in WhatsApp
                  </a>
                )}
                {!link && ig && (
                  <a href={ig} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50">
                    <Instagram size={13} />Open Instagram
                  </a>
                )}
                {!link && !ig && (
                  <span className="t11 text-slate-400 self-center">Add a phone number to message on WhatsApp</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
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
  const editing = !!initial.id;
  const wasAt = editing ? `${fmtDate(initial.date)} ${initial.time}` : "";
  const [v, setV] = useState({
    date: addDays(todayISO, 2), time: "18:30", trainerId: lead?.trainerId || db.settings.trainers[0]?.id || "",
    location: lead?.preferredLocation || db.settings.locations[0], status: "Booked", notes: "", ...initial,
  });
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
  const save = () => {
    const moved = editing && (v.date !== initial.date || v.time !== initial.time);
    const item = {
      id: v.id || uid("apt"), leadId: v.leadId, date: v.date, time: v.time,
      trainerId: v.trainerId, location: v.location, status: v.status, notes: v.notes,
      createdAt: initial.createdAt || todayISO, updatedAt: todayISO,
    };
    const text = !editing
      ? `Trial booked for ${fmtDate(v.date)} at ${v.time}`
      : moved
        ? `Trial moved from ${wasAt} to ${fmtDate(v.date)} at ${v.time}`
        : `Trial details updated — ${fmtDate(v.date)} at ${v.time}`;
    setDb((s) => ({
      ...s,
      appointments: v.id ? s.appointments.map((a) => (a.id === v.id ? item : a)) : [...s.appointments, item],
      activities: [...s.activities, { id: uid("act"), leadId: v.leadId, date: todayISO, type: "appointment", text, by: me.name }],
    }));
    if (!editing && lead && before(lead.stage, "trial_booked")) moveStage(lead.id, "trial_booked");
    flash(editing ? (moved ? "Trial rescheduled" : "Trial updated") : "Trial booked"); onClose();
  };
  return (
    <Modal open onClose={onClose} title={`${editing ? "Edit trial" : "Book a trial"}${lead ? ` — ${lead.name}` : ""}`}
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="accent" onClick={save}>{editing ? "Save changes" : "Book trial"}</Btn></>}>
      <div className="space-y-3">
        {editing && <p className="t11 text-slate-500">Currently booked for {wasAt}. Change anything below and it's logged on the timeline.</p>}
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
  const { db, patchLead, setDb, flash } = ctx;
  const d = lead.deal;
  const preset0 = db.settings.packages.find((p) => p.id === (d?.packageId || lead.packageId));
  const [v, setV] = useState({
    packageId: d ? (d.packageId || "custom") : (preset0?.id || "custom"),
    packageName: d?.packageName || preset0?.name || "",
    sessions: d?.sessions ?? preset0?.sessions ?? 12,
    price: d?.price ?? preset0?.price ?? 0,
    discount: d?.discount ?? 0,
    deposit: d?.deposit ?? 0,
    paymentStatus: d?.paymentStatus || "Unpaid",
    expectedClose: d?.expectedClose || addDays(todayISO, 7),
  });
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const isCustom = v.packageId === "custom";
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));

  const finalPrice = Math.max(0, Number(v.price || 0) - Number(v.discount || 0));
  const sessions = Number(v.sessions) || 0;
  const perSession = sessions > 0 ? finalPrice / sessions : 0;
  const balance = Math.max(0, finalPrice - Number(v.deposit || 0));

  const onPkg = (id) => {
    if (id === "custom") { setV((s) => ({ ...s, packageId: "custom" })); return; }
    const p = db.settings.packages.find((x) => x.id === id);
    setV((s) => ({
      ...s, packageId: id,
      packageName: p ? p.name : s.packageName,
      sessions: p ? p.sessions : s.sessions,
      price: p ? p.price : s.price,
    }));
    setSaveAsPreset(false);
  };

  const save = () => {
    if (!v.packageName.trim()) { flash("Give the package a name"); return; }
    const deal = {
      packageId: isCustom ? null : v.packageId,
      packageName: v.packageName.trim(),
      sessions, price: Number(v.price) || 0, discount: Number(v.discount) || 0, finalPrice,
      deposit: Number(v.deposit) || 0, paymentStatus: v.paymentStatus, expectedClose: v.expectedClose,
    };
    if (isCustom && saveAsPreset) {
      setDb((s) => ({
        ...s,
        settings: { ...s.settings, packages: [...s.settings.packages, { id: uid("p"), name: deal.packageName, sessions, price: deal.price }] },
      }));
    }
    const patch = { deal, estValue: finalPrice, packageId: deal.packageId };
    if (before(lead.stage, "proposal") && lead.stage !== "won") patch.stage = "proposal";
    patchLead(lead.id, patch, { type: "deal", text: `${deal.packageName} offered — ${RM(finalPrice)}` });
    flash(isCustom && saveAsPreset ? "Package saved and added to Settings" : "Package saved");
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Package offered"
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="accent" onClick={save}>Save package</Btn></>}>
      <div className="space-y-3">
        <Field label="Start from">
          <Select value={v.packageId} onChange={(e) => onPkg(e.target.value)}>
            {db.settings.packages.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.sessions} sessions — {RM(p.price)}</option>)}
            <option value="custom">Custom — build it myself</option>
          </Select>
        </Field>

        <div className="p-3 bg-slate-50 rounded-lg space-y-3">
          <p className="t11 text-slate-500">
            Every field below is editable, whichever option you picked. Change anything here and it only affects this deal — your Settings packages stay as they are.
          </p>
          <Field label="Package name">
            <Input value={v.packageName} onChange={(e) => set("packageName", e.target.value)} placeholder="e.g. 20 Sessions — Ramadan promo" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Number of sessions"><Input type="number" min="0" value={v.sessions} onChange={(e) => set("sessions", e.target.value)} /></Field>
            <Field label="Price (RM)"><Input type="number" min="0" value={v.price} onChange={(e) => set("price", e.target.value)} /></Field>
          </div>
          {isCustom && (
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" checked={saveAsPreset} onChange={(e) => setSaveAsPreset(e.target.checked)}
                className="rounded border-slate-300 text-amber-500 focus:ring-amber-400" />
              <span className="text-slate-700">Also save this as a reusable package in Settings</span>
            </label>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Discount (RM)"><Input type="number" min="0" value={v.discount} onChange={(e) => set("discount", e.target.value)} /></Field>
          <Field label="Final price">
            <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg font-mono text-sm font-semibold text-amber-800">{RM(finalPrice)}</div>
          </Field>
          <Field label="Per session">
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-600">{sessions ? RM(perSession) : "—"}</div>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Deposit (RM)"><Input type="number" min="0" value={v.deposit} onChange={(e) => set("deposit", e.target.value)} /></Field>
          <Field label="Payment status"><Select value={v.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value)}>{PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Expected close"><Input type="date" value={v.expectedClose} onChange={(e) => set("expectedClose", e.target.value)} /></Field>
        </div>
        {balance > 0 && <p className="t11 text-slate-500">Balance still owing after deposit: <span className="font-mono font-semibold text-slate-700">{RM(balance)}</span></p>}
      </div>
    </Modal>
  );
}

function WonForm({ ctx, lead, onClose }) {
  const { db, patchLead, flash } = ctx;
  const d = lead.deal;
  const preset0 = db.settings.packages.find((x) => x.id === (d?.packageId || lead.packageId));
  const [v, setV] = useState({
    packageId: d ? (d.packageId || "custom") : (preset0?.id || "custom"),
    packageName: d?.packageName || preset0?.name || "",
    sessions: d?.sessions ?? preset0?.sessions ?? 0,
    price: Number(d?.price) > 0 ? d.price : (preset0?.price ?? 0),
    discount: d?.discount ?? 0,
    deposit: d?.deposit ?? 0,
    paymentStatus: d?.paymentStatus && d.paymentStatus !== "Unpaid" ? d.paymentStatus : "Paid in Full",
    wonAt: lead.wonAt || todayISO,
  });
  const set = (k, val) => setV((st) => ({ ...st, [k]: val }));
  const isCustom = v.packageId === "custom";
  const finalPrice = Math.max(0, Number(v.price || 0) - Number(v.discount || 0));
  const sessions = Number(v.sessions) || 0;

  const onPkg = (id) => {
    if (id === "custom") { setV((st) => ({ ...st, packageId: "custom" })); return; }
    const pk = db.settings.packages.find((x) => x.id === id);
    setV((st) => ({ ...st, packageId: id, packageName: pk ? pk.name : st.packageName,
      sessions: pk ? pk.sessions : st.sessions, price: pk ? pk.price : st.price }));
  };

  const confirm2 = () => {
    if (finalPrice <= 0 && !window.confirm("No amount entered. Save this as a won deal worth RM0?")) return;
    const deal = {
      packageId: isCustom ? null : v.packageId,
      packageName: v.packageName.trim() || (sessions ? `${sessions} Sessions` : "Package sold"),
      sessions, price: Number(v.price) || 0, discount: Number(v.discount) || 0, finalPrice,
      deposit: Number(v.deposit) || 0, paymentStatus: v.paymentStatus, expectedClose: v.wonAt,
    };
    patchLead(lead.id, {
      deal, estValue: finalPrice, packageId: deal.packageId,
      stage: "won", wonAt: v.wonAt, temperature: "hot", lostReason: null,
    }, { type: "won", text: `Converted to client — ${RM(finalPrice)}` });
    flash(`${lead.name} won — ${RM(finalPrice)}`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Mark ${lead.name} as won`}
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="success" onClick={confirm2}><Trophy size={14} />Confirm won</Btn></>}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          What did they actually buy? This is what your revenue, average deal value and ROAS are all built from.
        </p>
        <Field label="Package">
          <Select value={v.packageId} onChange={(e) => onPkg(e.target.value)}>
            {db.settings.packages.map((pk) => <option key={pk.id} value={pk.id}>{pk.name} — {pk.sessions} sessions — {RM(pk.price)}</option>)}
            <option value="custom">Custom — type it in</option>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Package name"><Input value={v.packageName} onChange={(e) => set("packageName", e.target.value)} placeholder="e.g. 24 Sessions" /></Field>
          <Field label="Sessions"><Input type="number" min="0" value={v.sessions} onChange={(e) => set("sessions", e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Price (RM)"><Input type="number" min="0" value={v.price} autoFocus onChange={(e) => set("price", e.target.value)} /></Field>
          <Field label="Discount (RM)"><Input type="number" min="0" value={v.discount} onChange={(e) => set("discount", e.target.value)} /></Field>
          <Field label="They paid">
            <div className={`px-3 py-2 rounded-lg font-mono text-sm font-semibold border ${finalPrice > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700"}`}>{RM(finalPrice)}</div>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Deposit taken (RM)"><Input type="number" min="0" value={v.deposit} onChange={(e) => set("deposit", e.target.value)} /></Field>
          <Field label="Payment status"><Select value={v.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value)}>{PAYMENT_STATUSES.map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Date won"><Input type="date" value={v.wonAt} onChange={(e) => set("wonAt", e.target.value)} /></Field>
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
  const [wonFor, setWonFor] = useState(null);
  const [expanded, setExpanded] = useState({});
  const CARD_CAP = 40;

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
    if (stageId === "won") { setWonFor(dragId); setDragId(null); return; }
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
                {(expanded[c.id] ? c.items : c.items.slice(0, CARD_CAP)).map((l) => {
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
                {!expanded[c.id] && c.items.length > CARD_CAP && (
                  <button onClick={() => setExpanded((e) => ({ ...e, [c.id]: true }))}
                    className="w-full text-center t11 text-slate-500 hover:text-slate-800 py-2">
                    Show {c.items.length - CARD_CAP} more
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {wonFor && <WonForm ctx={ctx} lead={db.leads.find((l) => l.id === wonFor)} onClose={() => setWonFor(null)} />}
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
    if (status === "Completed" && l && before(l.stage, "trial_completed")) moveStage(l.id, "trial_completed");
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
                      <Td className="whitespace-nowrap">
                        <Btn size="sm" variant="ghost" onClick={() => setModal({ ...a })}><Pencil size={13} /></Btn>
                        <Btn size="sm" variant="ghost" onClick={() => { if (confirm("Delete this trial appointment?")) removeFrom("appointments", a.id); }}><Trash2 size={13} /></Btn>
                      </Td>
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

function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Opens a clean printable page. The browser's print dialog has
   "Save as PDF", which works on Mac, Windows and iPhone alike. */
function openPrintReport(html, title) {
  const w = window.open("", "_blank");
  if (!w) { alert("Your browser blocked the print window. Allow pop-ups for this site and try again."); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #181F29; margin: 32px; }
    h1 { font-size: 20px; margin: 0 0 2px; }
    h2 { font-size: 13px; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: .08em; color: #6E747E; }
    .sub { color: #6E747E; font-size: 12px; margin-bottom: 20px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .kpi { border: 1px solid #E3E0D9; border-radius: 8px; padding: 10px; }
    .kpi .l { font-size: 9px; text-transform: uppercase; letter-spacing: .1em; color: #989DA6; }
    .kpi .v { font-size: 18px; font-weight: 600; margin-top: 4px; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .1em;
         color: #989DA6; border-bottom: 1px solid #E4DED2; padding: 6px 8px; }
    td { padding: 6px 8px; border-bottom: 1px solid #ECEAE5; font-variant-numeric: tabular-nums; }
    .brand { display:flex; align-items:center; gap:8px; margin-bottom:14px; }
    .mark { width:26px; height:26px; border-radius:7px; background:#C89252; color:#181F29;
            display:flex; align-items:center; justify-content:center; font-weight:700; font-size:11px; }
    .foot { margin-top: 28px; font-size: 10px; color: #989DA6; border-top: 1px solid #E4DED2; padding-top: 8px; }
    @media print { body { margin: 12mm; } .kpi, table { break-inside: avoid; } }
  </style></head><body>${html}</body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
}

/* ---------- duplicate detection ----------
   Two leads are the same person if their phone numbers match once
   punctuation and country codes are stripped, or failing that if the
   name and source match exactly. ---------------------------------- */
function phoneKey(p) {
  let d = String(p || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0")) d = "6" + d;
  return d.length >= 8 ? d.slice(-9) : "";
}

function findDuplicateGroups(leads) {
  const buckets = new Map();
  leads.forEach((l) => {
    const key = phoneKey(l.phone) || `n:${String(l.name || "").trim().toLowerCase()}|${l.source || ""}`;
    if (!key || key === "n:|") return;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(l);
  });
  return Array.from(buckets.values()).filter((g) => g.length > 1);
}

/* The survivor is the one carrying the most information. */
function scoreLead(l, counts) {
  const c = counts[l.id] || 0;
  return c * 10
    + (l.deal ? 25 : 0)
    + (stageIndex(l.stage) >= 0 ? stageIndex(l.stage) : 0)
    + (l.phone ? 3 : 0) + (l.email ? 2 : 0) + (l.handle ? 2 : 0)
    + (l.lostReason ? 2 : 0);
}

/* ============================================================
   TASKS  —  list + calendar, merged with follow-ups and trials
   ============================================================ */
function TaskForm({ ctx, initial, onClose }) {
  const { db, setDb, me, flash } = ctx;
  const [v, setV] = useState({
    title: "", notes: "", priority: "normal", date: todayISO, time: "",
    assigneeId: me.id, leadId: "", ...initial,
  });
  const set = (k, val) => setV((st) => ({ ...st, [k]: val }));
  const save = () => {
    if (!v.title.trim()) { flash("Give the task a title"); return; }
    const item = {
      id: v.id || uid("task"), title: v.title.trim(), notes: v.notes, priority: v.priority,
      date: v.date, time: v.time, assigneeId: v.assigneeId, leadId: v.leadId || null,
      done: v.done || false, doneAt: v.doneAt || null,
      createdBy: v.createdBy || me.name, createdAt: v.createdAt || todayISO, updatedAt: todayISO,
    };
    setDb((st) => {
      const list = st.tasks || [];
      return { ...st, tasks: v.id ? list.map((t) => (t.id === v.id ? item : t)) : [...list, item] };
    });
    flash(v.id ? "Task updated" : "Task added"); onClose();
  };
  return (
    <Modal open onClose={onClose} title={v.id ? "Edit task" : "New task"}
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="accent" onClick={save}>{v.id ? "Save" : "Add task"}</Btn></>}>
      <div className="space-y-3">
        <Field label="What needs doing"><Input value={v.title} autoFocus onChange={(e) => set("title", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()} placeholder="e.g. Order new resistance bands" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="How important">
            <Select value={v.priority} onChange={(e) => set("priority", e.target.value)}>
              {PRIORITIES.map((pr) => <option key={pr.id} value={pr.id}>{pr.label}</option>)}
            </Select>
          </Field>
          <Field label="Due date"><Input type="date" value={v.date} onChange={(e) => set("date", e.target.value)} /></Field>
          <Field label="Time (optional)"><Input type="time" value={v.time} onChange={(e) => set("time", e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Who's doing it">
            <Select value={v.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
              {db.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Linked prospect (optional)">
            <Select value={v.leadId || ""} onChange={(e) => set("leadId", e.target.value)}>
              <option value="">Not about a prospect</option>
              {db.leads.slice(0, 300).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Notes (optional)"><Textarea rows={3} value={v.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function TaskRow({ t, ctx, onEdit }) {
  const { db, toggleTask, setDb, setOpenLeadId } = ctx;
  const pr = prioMeta(t.priority);
  const who = db.users.find((u) => u.id === t.assigneeId);
  const lead = t.leadId ? db.leads.find((l) => l.id === t.leadId) : null;
  const late = !t.done && t.date < todayISO;
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
      <button onClick={() => toggleTask(t)} className="mt-0.5 shrink-0" aria-label="Mark done">
        {t.done
          ? <span className="w-4 h-4 rounded bg-emerald-600 flex items-center justify-center"><Check size={11} className="text-white" /></span>
          : <span className="w-4 h-4 rounded border-2 border-slate-300 hover:border-amber-500 block" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${t.done ? "text-slate-400 line-through" : "text-slate-900"}`}>{t.title}</span>
          {!t.done && <span className={`t11 font-medium px-1.5 py-0.5 rounded border ${pr.chip}`}>{pr.label}</span>}
          {late && <span className="t11 font-semibold uppercase tracking-widest text-rose-600">Overdue</span>}
        </div>
        <div className="t11 text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
          <span className="font-mono">{fmtDate(t.date)}{t.time ? ` ${t.time}` : ""}</span>
          <span>· {who ? who.name : "Unassigned"}</span>
          {lead && <button onClick={() => setOpenLeadId(lead.id)} className="text-amber-600 hover:underline">· {lead.name}</button>}
        </div>
        {t.notes && <p className="t11 text-slate-500 mt-1">{t.notes}</p>}
      </div>
      <Btn size="sm" variant="ghost" onClick={() => onEdit(t)}><Pencil size={13} /></Btn>
      <Btn size="sm" variant="ghost" onClick={() => {
        if (!confirm(`Delete "${t.title}"?`)) return;
        setDb((s) => ({ ...s, tasks: (s.tasks || []).filter((x) => x.id !== t.id) }));
      }}><Trash2 size={13} /></Btn>
    </div>
  );
}

function TasksView({ ctx }) {
  const { db, D, me, isAdmin, setOpenLeadId } = ctx;
  const tasks = db.tasks || [];
  const [modal, setModal] = useState(null);
  const [mode, setMode] = useState("list");
  const [filter, setFilter] = useState("open");
  const [who, setWho] = useState("");
  const [month, setMonth] = useState(() => todayISO.slice(0, 7));
  const [picked, setPicked] = useState(todayISO);

  const visible = tasks.filter((t) => {
    if (who && t.assigneeId !== who) return false;
    if (filter === "open") return !t.done;
    if (filter === "today") return !t.done && t.date === todayISO;
    if (filter === "overdue") return !t.done && t.date < todayISO;
    if (filter === "week") return !t.done && t.date <= addDays(todayISO, 7);
    if (filter === "done") return t.done;
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date) || prioMeta(a.priority).rank - prioMeta(b.priority).rank);

  const counts = {
    overdue: tasks.filter((t) => !t.done && t.date < todayISO).length,
    today: tasks.filter((t) => !t.done && t.date === todayISO).length,
    urgent: tasks.filter((t) => !t.done && t.priority === "high").length,
    done: tasks.filter((t) => t.done).length,
  };

  const groups = useMemo(() => {
    const g = {};
    visible.forEach((t) => { (g[t.date] = g[t.date] || []).push(t); });
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);

  /* ---- everything happening on a given day ---- */
  const dayItems = (iso) => {
    const out = [];
    tasks.filter((t) => t.date === iso && (!who || t.assigneeId === who))
      .forEach((t) => out.push({ kind: "task", id: t.id, label: t.title, dot: prioMeta(t.priority).dot, done: t.done, time: t.time, ref: t }));
    (db.followups || []).filter((f) => f.date === iso && !f.completed).forEach((f) => {
      const l = D.byLead(f.leadId);
      if (l && (!who || l.ownerId === who)) out.push({ kind: "followup", id: f.id, label: `Follow up ${l.name}`, dot: "bg-orange-500", time: f.time, leadId: l.id });
    });
    (db.appointments || []).filter((a) => a.date === iso).forEach((a) => {
      const l = D.byLead(a.leadId);
      if (l && (!who || l.ownerId === who)) out.push({ kind: "trial", id: a.id, label: `Trial — ${l.name}`, dot: "bg-cyan-500", time: a.time, leadId: l.id });
    });
    return out.sort((x, y) => String(x.time || "").localeCompare(String(y.time || "")));
  };

  const grid = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const startPad = (first.getDay() + 6) % 7;
    const days = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(`${y}-${pad(m)}-${pad(d)}`);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  const shiftMonth = (n) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };
  const monthLabel = new Date(month + "-01T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-slate-500">Work that isn't tied to a prospect — plus everything else on your calendar</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            <button onClick={() => setMode("list")}
              className={`text-xs font-medium px-3 py-1.5 ${mode === "list" ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}>List</button>
            <button onClick={() => setMode("calendar")}
              className={`text-xs font-medium px-3 py-1.5 ${mode === "calendar" ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}>Calendar</button>
          </div>
          <Btn variant="accent" size="sm" onClick={() => setModal({})}><Plus size={14} />New task</Btn>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Overdue" value={counts.overdue} tone={counts.overdue ? "bad" : "default"} icon={AlertTriangle} />
        <Stat label="Due today" value={counts.today} tone="accent" icon={Clock} />
        <Stat label="Urgent open" value={counts.urgent} tone={counts.urgent ? "bad" : "default"} icon={Flag} />
        <Stat label="Completed" value={counts.done} tone="good" icon={Check} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {mode === "list" && [["open", "All open"], ["overdue", "Overdue"], ["today", "Due today"], ["week", "Next 7 days"], ["done", "Done"], ["all", "Everything"]].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${filter === id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>{label}</button>
        ))}
        {isAdmin && (
          <Select value={who} onChange={(e) => setWho(e.target.value)} className="w-44 py-1.5 ml-auto">
            <option value="">Everyone</option>
            {db.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        )}
      </div>

      {mode === "list" ? (
        groups.length === 0 ? (
          <Card><Empty icon={ListChecks} title="Nothing on the list"
            hint="Add a task for anything that isn't about a specific prospect — ordering equipment, paying an invoice, planning a campaign."
            action={<Btn variant="accent" size="sm" onClick={() => setModal({})}><Plus size={14} />New task</Btn>} /></Card>
        ) : (
          <div className="space-y-3">
            {groups.map(([date, items]) => {
              const rel = daysDiff(date, todayISO);
              const heading = rel === 0 ? "Today" : rel === 1 ? "Tomorrow" : rel === -1 ? "Yesterday" : fmtDateFull(date);
              return (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-xs font-semibold text-slate-700">{heading}</h3>
                    {rel < 0 && <span className="t10 font-semibold uppercase tracking-widest text-rose-600">Overdue</span>}
                    <span className="font-mono t11 text-slate-400">{items.length}</span>
                  </div>
                  <Card className="overflow-hidden divide-y divide-slate-100">
                    {items.map((t) => <TaskRow key={t.id} t={t} ctx={ctx} onEdit={(x) => setModal(x)} />)}
                  </Card>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 p-4">
            <div className="flex items-center justify-between mb-3">
              <Btn size="sm" variant="ghost" onClick={() => shiftMonth(-1)}><ChevronLeft size={14} /></Btn>
              <h2 className="text-sm font-semibold">{monthLabel}</h2>
              <Btn size="sm" variant="ghost" onClick={() => shiftMonth(1)}><ChevronRight size={14} /></Btn>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="t10 uppercase tracking-widest text-slate-400 text-center pb-1">{d}</div>
              ))}
              {grid.map((iso, i) => {
                if (!iso) return <div key={i} />;
                const items = dayItems(iso);
                const isToday = iso === todayISO;
                const isPicked = iso === picked;
                return (
                  <button key={iso} onClick={() => setPicked(iso)}
                    className={`min-h-16 p-1 rounded-lg border text-left align-top transition-colors ${
                      isPicked ? "border-amber-400 bg-amber-50" : isToday ? "border-slate-900 bg-white" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                    <div className={`t10 font-mono ${isToday ? "font-bold text-slate-900" : "text-slate-500"}`}>{Number(iso.slice(8))}</div>
                    <div className="space-y-0.5 mt-0.5">
                      {items.slice(0, 3).map((it) => (
                        <div key={it.kind + it.id} className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${it.done ? "bg-slate-300" : it.dot}`} />
                          <span className={`t10 truncate ${it.done ? "text-slate-400 line-through" : "text-slate-600"}`}>{it.label}</span>
                        </div>
                      ))}
                      {items.length > 3 && <div className="t10 text-slate-400">+{items.length - 3} more</div>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100">
              <span className="t11 text-slate-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Urgent task</span>
              <span className="t11 text-slate-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Normal task</span>
              <span className="t11 text-slate-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" />Follow-up</span>
              <span className="t11 text-slate-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />Trial</span>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{fmtDateFull(picked)}</h2>
              <Btn size="sm" variant="outline" onClick={() => setModal({ date: picked })}><Plus size={13} />Add</Btn>
            </div>
            {dayItems(picked).length === 0 ? (
              <Empty icon={CalendarDays} title="Nothing scheduled" hint="A clear day. Add a task if you need one." />
            ) : (
              <div className="divide-y divide-slate-100">
                {dayItems(picked).map((it) => (
                  it.kind === "task"
                    ? <TaskRow key={it.id} t={it.ref} ctx={ctx} onEdit={(x) => setModal(x)} />
                    : (
                      <button key={it.kind + it.id} onClick={() => setOpenLeadId(it.leadId)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${it.dot}`} />
                        <span className="text-sm flex-1 truncate">{it.label}</span>
                        <span className="font-mono t11 text-slate-500">{it.time}</span>
                      </button>
                    )
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {modal && <TaskForm ctx={ctx} initial={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ============================================================
   TEMPLATES
   ============================================================ */
function TemplatesView({ ctx }) {
  const { db, setDb, isAdmin, flash } = ctx;
  const list = db.settings.templates || DEFAULT_TEMPLATES;
  const [tpl, setTpl] = useState(null);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [copied, setCopied] = useState("");

  const filtered = list.filter((t) => {
    if (stage && t.stage !== stage) return false;
    const s2 = q.trim().toLowerCase();
    if (!s2) return true;
    return t.label.toLowerCase().includes(s2) || String(t.body).toLowerCase().includes(s2);
  });

  const groups = STAGES.map((st) => ({ st, items: filtered.filter((t) => t.stage === st.id) }))
    .filter((g) => g.items.length);

  const copy = async (t) => {
    try { await navigator.clipboard.writeText(t.body); }
    catch (e) {
      const ta = document.createElement("textarea");
      ta.value = t.body; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (err) {}
      document.body.removeChild(ta);
    }
    setCopied(t.id); setTimeout(() => setCopied(""), 1800);
    flash("Copied to clipboard");
  };

  const restore = () => {
    if (!confirm(
      "Replace every template with the standard Fitness Aspire set?\n\n" +
      "Any wording you have written yourself will be overwritten."
    )) return;
    setDb((st) => ({ ...st, settings: { ...st.settings, templates: DEFAULT_TEMPLATES } }));
    flash("Standard templates loaded");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Message templates</h1>
          <p className="text-sm text-slate-500">{list.length} messages, one for every stage of the sale</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" onClick={restore}><RotateCcw size={13} />Load standard set</Btn>
            <Btn variant="accent" size="sm" onClick={() => setTpl({})}><Plus size={14} />New template</Btn>
          </div>
        )}
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-48"><Input placeholder="Search the wording" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select value={stage} onChange={(e) => setStage(e.target.value)} className="w-48">
            <option value="">Every stage</option>
            {STAGES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </Select>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
          <span className="t11 text-slate-500 mr-1">Swapped in automatically:</span>
          {TEMPLATE_VARS.map((v) => (
            <span key={v} className="t10 font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{"{" + v + "}"}</span>
          ))}
        </div>
      </Card>

      {groups.length === 0 ? (
        <Card><Empty icon={MessageCircle} title="Nothing matches" hint="Try a different search or stage." /></Card>
      ) : groups.map(({ st, items }) => (
        <div key={st.id}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`w-2 h-2 rounded-full ${st.color}`} />
            <h2 className="text-xs font-semibold text-slate-700">{st.label}</h2>
            <span className="font-mono t11 text-slate-400">{items.length}</span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {items.map((t) => (
              <Card key={t.id} className="overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-medium text-slate-800">{t.label}</span>
                  <span className="t10 uppercase tracking-widest text-slate-400">{t.channel}</span>
                  {isAdmin && (
                    <span className="ml-auto flex gap-1">
                      <Btn size="sm" variant="ghost" onClick={() => setTpl(t)}><Pencil size={13} /></Btn>
                      <Btn size="sm" variant="ghost" onClick={() => {
                        if (!confirm(`Delete the "${t.label}" template?`)) return;
                        setDb((st2) => ({ ...st2, settings: { ...st2.settings,
                          templates: (st2.settings.templates || DEFAULT_TEMPLATES).filter((x) => x.id !== t.id) } }));
                      }}><Trash2 size={13} /></Btn>
                    </span>
                  )}
                </div>
                <p className="px-3 py-2.5 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{t.body}</p>
                <div className="px-3 pb-3">
                  <Btn size="sm" variant={copied === t.id ? "success" : "outline"} onClick={() => copy(t)}>
                    {copied === t.id ? <><Check size={13} />Copied</> : "Copy"}
                  </Btn>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <Card className="p-4">
        <p className="text-sm text-slate-600">
          Copying from here gives you the raw wording with the tags still in it. To get a message with a
          prospect's real name, coach and trial time already filled in, open that prospect and use the
          <span className="font-medium text-slate-800"> Messages </span> tab instead.
        </p>
      </Card>

      {tpl && <TemplateForm ctx={ctx} initial={tpl} onClose={() => setTpl(null)} />}
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
    const contacted = mine.filter((l) => atLeast(l.stage, "contacted"));
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
            ["New leads", L.length], ["Leads contacted", L.filter((l) => atLeast(l.stage, "contacted")).length],
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
          ["Contacted", leads.filter((l) => atLeast(l.stage, "contacted")).length],
          ["Qualified", leads.filter((l) => atLeast(l.stage, "qualified") && l.stage !== "lost").length],
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

  const esc = (v) => String(v === null || v === undefined ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const printReport = () => {
    const rowsHtml = report.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
    const headHtml = report.headers.map((h) => `<th>${esc(h)}</th>`).join("");
    const kpis = [
      ["Leads", db.leads.filter((l) => inRange(l.createdAt, range)).length],
      ["Clients won", db.leads.filter((l) => l.stage === "won" && inRange(l.wonAt || l.updatedAt, range)).length],
      ["Revenue", RM(db.leads.filter((l) => l.stage === "won" && inRange(l.wonAt || l.updatedAt, range)).reduce((a, l) => a + D.dealValue(l), 0))],
      ["Trials", db.appointments.filter((a) => inRange(a.date, range)).length],
    ].map(([l, v]) => `<div class="kpi"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>`).join("");

    openPrintReport(`
      <div class="brand">${db.settings.logo
        ? `<img src="${db.settings.logo}" style="width:26px;height:26px;border-radius:7px;object-fit:cover" />`
        : `<div class="mark">FA</div>`}<div><strong>Fitness Aspire</strong></div></div>
      <h1>${esc(report.title)}</h1>
      <div class="sub">${esc(report.period)}</div>
      <div class="kpis">${kpis}</div>
      <h2>${esc(report.title)}</h2>
      <table><thead><tr>${headHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="foot">Generated ${esc(fmtDateFull(todayISO))} from Fitness Aspire Sales CRM</div>
    `, `${report.title} — ${fmtDateFull(todayISO)}`);
  };

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
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{report.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{report.period}</p>
            </div>
            <Btn variant="default" size="sm" onClick={printReport}><FileText size={13} />Save as PDF</Btn>
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
  const { db, setDb, flash, me } = ctx;
  const s = db.settings;
  const setS = (patch) => setDb((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const [pkg, setPkg] = useState(null);
  const [user, setUser] = useState(null);
  const [tpl, setTpl] = useState(null);
  const [trainer, setTrainer] = useState("");

  const resetAll = async () => {
    if (!confirm("Load the sample data again? Everything you have entered will be replaced by the demo leads.")) return;
    const fresh = seedData();
    setDb(fresh);
    try { await storage.set(STORAGE_KEY, JSON.stringify(fresh)); } catch (e) {}
    flash("Sample data loaded");
  };

  const startEmpty = async () => {
    if (!confirm(
      "Delete ALL leads, follow-ups, trials, campaigns and notes, and start with a completely empty system?\n\n" +
      "Your packages, locations, trainers and team will be kept.\n\nThis cannot be undone."
    )) return;
    if (!confirm("Last check — this permanently deletes " + db.leads.length + " leads. Continue?")) return;
    const fresh = emptyData(db.settings, db.users);
    setDb(fresh);
    try { await storage.set(STORAGE_KEY, JSON.stringify(fresh)); } catch (e) {}
    flash("Cleared — the system is now empty");
  };

  const [importing, setImporting] = useState(null);

  const runImport = async (file) => {
    if (!file) return;
    setImporting({ status: "reading" });
    try {
      const text = await file.text();
      const b = JSON.parse(text);
      if (!b || !Array.isArray(b.leads)) throw new Error("This file doesn't look like a Fitness Aspire import file.");

      setDb((prev) => {
        // make sure every coach mentioned in the file exists
        const trainers = [...prev.settings.trainers];
        const trainerId = (nm) => {
          const clean = String(nm || "").trim();
          if (!clean || clean === "-") return "";
          const hit = trainers.find((t) => t.name.toLowerCase() === clean.toLowerCase());
          if (hit) return hit.id;
          const made = { id: uid("t"), name: clean };
          trainers.push(made);
          return made.id;
        };

        // never overwrite a lead that is already in the system
        const taken = new Set(prev.leads.map((l) => l.id));
        const remap = {};
        const leads = b.leads.map((l) => {
          let id = l.id;
          while (taken.has(id)) id = id + "b";
          taken.add(id);
          remap[l.id] = id;
          const { trainerName, ...rest } = l;
          return { ...rest, id, trainerId: trainerId(trainerName), ownerId: (me && me.id) || null };
        });

        const fix = (arr, extra) => (arr || [])
          .filter((x) => remap[x.leadId])
          .map((x) => ({ ...x, id: uid("i"), leadId: remap[x.leadId], ...(extra ? extra(x) : {}) }));

        return {
          ...prev,
          settings: { ...prev.settings, trainers },
          leads: [...leads, ...prev.leads],
          activities: [...prev.activities, ...fix(b.activities)],
          followups: [...prev.followups, ...fix(b.followups, () => ({ ownerId: (me && me.id) || null }))],
          notes: [...prev.notes, ...fix(b.notes)],
        };
      });

      setImporting({
        status: "done",
        counts: {
          leads: b.leads.length,
          activities: (b.activities || []).length,
          followups: (b.followups || []).length,
          notes: (b.notes || []).length,
        },
      });
      flash(`Imported ${b.leads.length} prospects`);
    } catch (e) {
      setImporting({ status: "error", message: String(e.message || e) });
    }
  };

  const dupGroups = useMemo(() => findDuplicateGroups(db.leads), [db.leads]);
  const dupExtra = dupGroups.reduce((n, g) => n + g.length - 1, 0);
  const [dupPreview, setDupPreview] = useState(false);

  const mergeDuplicates = () => {
    if (dupExtra === 0) return;
    if (!confirm(
      `Merge ${dupExtra} duplicate lead${dupExtra === 1 ? "" : "s"} into ${dupGroups.length} ` +
      `record${dupGroups.length === 1 ? "" : "s"}?\n\n` +
      `The most complete version of each person is kept, and their history, follow-ups, ` +
      `trials and notes are all moved onto it. Nothing is thrown away.\n\n` +
      `Take a backup first if you haven't.`
    )) return;

    setDb((prev) => {
      const counts = {};
      prev.activities.forEach((a) => { counts[a.leadId] = (counts[a.leadId] || 0) + 1; });
      prev.notes.forEach((n) => { counts[n.leadId] = (counts[n.leadId] || 0) + 1; });

      const groups = findDuplicateGroups(prev.leads);
      const remap = {};
      const drop = new Set();

      groups.forEach((g) => {
        const sorted = g.slice().sort((a, b) => scoreLead(b, counts) - scoreLead(a, counts));
        const keep = sorted[0];
        sorted.slice(1).forEach((d) => { remap[d.id] = keep.id; drop.add(d.id); });
      });

      const point = (id) => remap[id] || id;
      const dedupe = (arr, sig) => {
        const seen = new Set();
        return arr.filter((x) => {
          const k = sig(x);
          if (seen.has(k)) return false;
          seen.add(k); return true;
        });
      };

      return {
        ...prev,
        leads: prev.leads.filter((l) => !drop.has(l.id)),
        activities: dedupe(
          prev.activities.map((a) => ({ ...a, leadId: point(a.leadId) })),
          (a) => `${a.leadId}|${a.date}|${a.text}`),
        followups: dedupe(
          prev.followups.map((f) => ({ ...f, leadId: point(f.leadId) })),
          (f) => `${f.leadId}|${f.date}|${f.note}|${f.completed}`),
        appointments: dedupe(
          prev.appointments.map((a) => ({ ...a, leadId: point(a.leadId) })),
          (a) => `${a.leadId}|${a.date}|${a.time}`),
        notes: dedupe(
          prev.notes.map((n) => ({ ...n, leadId: point(n.leadId) })),
          (n) => `${n.leadId}|${n.text}`),
        tasks: (prev.tasks || []).map((t) => (t.leadId ? { ...t, leadId: point(t.leadId) } : t)),
      };
    });
    flash(`Merged ${dupExtra} duplicates`);
    setDupPreview(false);
  };

  const uploadLogo = (file) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { alert("That image is very large. Please use one under 4MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Shrink it before storing — the logo travels with every save,
        // so a huge image would slow the whole app down.
        const MAX = 160;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const out = canvas.toDataURL("image/png");
          setS({ logo: out });
          flash("Logo saved");
        } catch (err) {
          alert("Could not process that image. Try a PNG or JPG.");
        }
      };
      img.onerror = () => alert("That file doesn't look like an image.");
      img.src = String(reader.result);
    };
    reader.onerror = () => alert("Could not read that file.");
    reader.readAsDataURL(file);
  };

  const fullBackup = () => {
    downloadJSON(`fitness-aspire-backup-${todayISO}.json`, { exportedAt: new Date().toISOString(), app: "fitness-aspire-crm", data: db });
    flash("Backup downloaded — keep it somewhere safe");
  };

  const restoreBackup = async (file) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const data = parsed && parsed.data ? parsed.data : parsed;
      if (!data || !Array.isArray(data.leads)) throw new Error("That doesn't look like a Fitness Aspire backup.");
      if (!confirm(
        `Restore this backup?\n\n` +
        `It contains ${data.leads.length} leads and was saved on ${String(parsed.exportedAt || "").slice(0, 10) || "an unknown date"}.\n\n` +
        `Everything currently in the system will be REPLACED. This cannot be undone.`
      )) return;
      if (!confirm(`Last check — you currently have ${db.leads.length} leads. Replace them all?`)) return;
      if (!Array.isArray(data.tasks)) data.tasks = [];
      setDb(data);
      await storage.set(STORAGE_KEY, JSON.stringify(data));
      flash(`Restored ${data.leads.length} leads`);
    } catch (e) {
      alert("Could not restore: " + String(e.message || e));
    }
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
                  {!CLOUD && <div className="t11 text-slate-400 font-mono mt-0.5">Passcode: {passcodeFor(u)}</div>}
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

        <Card className="p-4 lg:col-span-2">
          <SectionTitle
            right={<Btn size="sm" variant="accent" onClick={() => setTpl({})}><Plus size={13} />Add template</Btn>}
            sub="What you send at each stage. Edit the wording to sound like you.">Message templates</SectionTitle>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {TEMPLATE_VARS.map((v) => (
              <span key={v} className="t10 font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{"{" + v + "}"}</span>
            ))}
          </div>
          <p className="t11 text-slate-500 mb-3">Those tags get swapped for the real details when you open a prospect.</p>
          <div className="divide-y divide-slate-100">
            {(s.templates || DEFAULT_TEMPLATES).map((t) => (
              <div key={t.id} className="flex items-start gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{t.label}</span>
                    <span className="t10 uppercase tracking-widest text-slate-400">{t.channel}</span>
                    <StageBadge stage={t.stage} />
                  </div>
                  <p className="t11 text-slate-500 mt-0.5 truncate">{String(t.body).replace(/\n/g, " ").slice(0, 90)}…</p>
                </div>
                <Btn size="sm" variant="ghost" onClick={() => setTpl(t)}><Pencil size={13} /></Btn>
                <Btn size="sm" variant="ghost" onClick={() => setS({ templates: (s.templates || DEFAULT_TEMPLATES).filter((x) => x.id !== t.id) })}><Trash2 size={13} /></Btn>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle sub="Shown in the sidebar, on the sign-in screen and on printed reports">Your logo</SectionTitle>
          <div className="flex items-center gap-4">
            <BrandMark logo={s.logo} size={56} rounded="rounded-xl" />
            <div className="flex-1 min-w-0">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => { uploadLogo(e.target.files && e.target.files[0]); e.target.value = ""; }}
                className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer" />
              <p className="t11 text-slate-500 mt-1.5">
                A square image works best. It's shrunk to 160px automatically, so a big file is fine.
              </p>
              {s.logo && (
                <Btn size="sm" variant="ghost" className="mt-1.5"
                  onClick={() => { if (confirm("Remove your logo and go back to the FA mark?")) setS({ logo: null }); }}>
                  <Trash2 size={13} />Remove logo
                </Btn>
              )}
            </div>
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
            <Btn variant="default" size="sm" onClick={fullBackup}><Download size={13} />Download full backup</Btn>
            <Btn variant="outline" size="sm" onClick={backup}><Download size={13} />Spreadsheet copy</Btn>
            <Btn variant="danger" size="sm" onClick={startEmpty}><Trash2 size={13} />Clear everything and start empty</Btn>
            <Btn variant="ghost" size="sm" onClick={resetAll}><RotateCcw size={13} />Load sample data</Btn>
          </div>
          <p className="t11 text-slate-500 mt-2.5">
            Clearing keeps your packages, locations, trainers and team — it only removes leads and their history.
            Take a backup first if you are unsure.
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <Label>Duplicate leads</Label>
            {dupExtra === 0 ? (
              <p className="t11 text-slate-500 mt-1 mb-5">
                No duplicates found — every lead looks like a different person.
              </p>
            ) : (
              <div className="mt-1 mb-5">
                <p className="text-sm text-slate-700">
                  Found <span className="font-semibold">{dupExtra}</span> duplicate
                  {dupExtra === 1 ? "" : "s"} across {dupGroups.length} {dupGroups.length === 1 ? "person" : "people"}.
                </p>
                <p className="t11 text-slate-500 mt-1">
                  Merging keeps the most complete version of each person and moves all their history,
                  follow-ups, trials and notes onto it. Back up first.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Btn size="sm" variant="outline" onClick={() => setDupPreview(!dupPreview)}>
                    {dupPreview ? "Hide list" : "Show me which ones"}
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={mergeDuplicates}>
                    Merge {dupExtra} duplicate{dupExtra === 1 ? "" : "s"}
                  </Btn>
                </div>
                {dupPreview && (
                  <div className="mt-2 max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {dupGroups.slice(0, 60).map((g, i) => (
                      <div key={i} className="px-3 py-2">
                        <div className="text-sm font-medium">{g[0].name}</div>
                        <div className="t11 text-slate-500">
                          {g.length} copies · {g[0].phone || g[0].handle || "no contact"} ·{" "}
                          {g.map((x) => stageLabel(x.stage)).join(", ")}
                        </div>
                      </div>
                    ))}
                    {dupGroups.length > 60 && (
                      <div className="px-3 py-2 t11 text-slate-500">…and {dupGroups.length - 60} more</div>
                    )}
                  </div>
                )}
              </div>
            )}

            <Label>Restore from a backup</Label>
            <p className="t11 text-slate-500 mt-1 mb-2">
              Put back everything from a full backup file. This replaces what's in the system now, so take a fresh backup first.
            </p>
            <input type="file" accept=".json,application/json"
              onChange={(e) => { restoreBackup(e.target.files && e.target.files[0]); e.target.value = ""; }}
              className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-white file:border file:border-slate-300 file:text-slate-700 hover:file:bg-slate-50 cursor-pointer mb-5" />

            <Label>Import prospects</Label>
            <p className="t11 text-slate-500 mt-1 mb-2">
              Load a prepared import file. Existing leads are kept — imported ones are added alongside them.
            </p>
            <input type="file" accept=".json,application/json"
              onChange={(e) => { runImport(e.target.files && e.target.files[0]); e.target.value = ""; }}
              className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer" />
            {importing && importing.status === "reading" && <p className="t11 text-slate-500 mt-2">Reading the file…</p>}
            {importing && importing.status === "error" && (
              <p className="t11 mt-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{importing.message}</p>
            )}
            {importing && importing.status === "done" && (
              <p className="t11 mt-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
                Imported {importing.counts.leads} prospects, {importing.counts.activities} history entries,{" "}
                {importing.counts.followups} follow-ups and {importing.counts.notes} notes.
              </p>
            )}
          </div>

          <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
            <p className="t11 text-amber-900">
              {CLOUD
                ? "Cloud mode is on. Your data lives on the server and is shared by everyone on the team — the same leads on your Mac, your phone and your salespeople's devices. Changes appear on other devices within a few seconds."
                : "Browser mode. Your data is saved against this exact web address, in this browser. Open the app from a different link or device and you will see a separate, empty copy. Bookmark one address and stick to it."}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[["Leads", db.leads.length], ["Activities", db.activities.length], ["Follow-ups", db.followups.length],
              ["Trials", db.appointments.length], ["Campaigns", db.campaigns.length], ["Notes", db.notes.length]].map(([k, v]) => (
              <div key={k}><div className="font-mono text-lg font-semibold">{v}</div><Label>{k}</Label></div>
            ))}
          </div>
        </Card>
      </div>

      {tpl && <TemplateForm ctx={ctx} initial={tpl} onClose={() => setTpl(null)} />}
      {pkg && <PackageForm ctx={ctx} initial={pkg} onClose={() => setPkg(null)} />}
      {user && <UserForm ctx={ctx} initial={user} onClose={() => setUser(null)} />}
    </div>
  );
}

function TemplateForm({ ctx, initial, onClose }) {
  const { db, setDb, flash } = ctx;
  const [v, setV] = useState({ label: "", stage: "new", channel: "WhatsApp", body: "", ...initial });
  const set = (k, val) => setV((st) => ({ ...st, [k]: val }));
  const save = () => {
    if (!v.label.trim() || !v.body.trim()) { flash("Give it a name and some wording"); return; }
    const item = { id: v.id || uid("tpl"), label: v.label.trim(), stage: v.stage, channel: v.channel, body: v.body };
    setDb((st) => {
      const list = st.settings.templates || DEFAULT_TEMPLATES;
      return { ...st, settings: { ...st.settings,
        templates: v.id ? list.map((x) => (x.id === v.id ? item : x)) : [...list, item] } };
    });
    flash("Template saved"); onClose();
  };
  return (
    <Modal open onClose={onClose} wide title={v.id ? "Edit template" : "New template"}
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="accent" onClick={save}>Save template</Btn></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Name"><Input value={v.label} onChange={(e) => set("label", e.target.value)} placeholder="e.g. Offer the trial" /></Field>
          <Field label="Stage"><Select value={v.stage} onChange={(e) => set("stage", e.target.value)}>{STAGES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select></Field>
          <Field label="Channel"><Select value={v.channel} onChange={(e) => set("channel", e.target.value)}>{FOLLOWUP_TYPES.map((x) => <option key={x}>{x}</option>)}</Select></Field>
        </div>
        <Field label="Message"><Textarea rows={10} value={v.body} onChange={(e) => set("body", e.target.value)} /></Field>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_VARS.map((x) => (
            <button key={x} onClick={() => set("body", v.body + "{" + x + "}")}
              className="t10 font-mono bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{"{" + x + "}"}</button>
          ))}
        </div>
        <p className="t11 text-slate-500">Tap a tag to drop it in. It's replaced with the prospect's real details.</p>
      </div>
    </Modal>
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
        <div className="grid grid-cols-3 gap-3">
          <Field label="Sessions"><Input type="number" min="0" value={v.sessions} onChange={(e) => set("sessions", e.target.value)} /></Field>
          <Field label="Price (RM)"><Input type="number" min="0" value={v.price} onChange={(e) => set("price", e.target.value)} /></Field>
          <Field label="Per session">
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-600">
              {Number(v.sessions) > 0 ? RM(Number(v.price) / Number(v.sessions)) : "—"}
            </div>
          </Field>
        </div>
        <p className="t11 text-slate-500">A starting point, not a rule — sessions and price can be changed on any individual deal without touching this.</p>
      </div>
    </Modal>
  );
}

function UserForm({ ctx, initial, onClose }) {
  const { setDb, flash } = ctx;
  const [v, setV] = useState({ name: "", email: "", role: "sales", active: true, passcode: FALLBACK_PASSCODE, ...initial });
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
  const save = () => {
    if (!v.name.trim()) { flash("Name is required"); return; }
    if (!String(v.passcode || "").trim()) { flash("Give this person a passcode"); return; }
    const item = { ...v, id: v.id || uid("u"), name: v.name.trim(), passcode: String(v.passcode).trim() };
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
        <Field label="Login passcode">
          <Input value={v.passcode} onChange={(e) => set("passcode", e.target.value)} placeholder="e.g. aspire2026" />
        </Field>
        <p className="t11 text-slate-500">This is what they type on the sign-in screen. Change it here any time — nothing in the code needs editing.</p>
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <input type="checkbox" checked={v.active} onChange={(e) => set("active", e.target.checked)} className="rounded border-slate-300 text-amber-500 focus:ring-amber-400" />
          <span className="text-slate-700">Active — can be assigned new leads</span>
        </label>
      </div>
    </Modal>
  );
}
