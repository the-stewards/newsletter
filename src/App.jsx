import { useState, useEffect, useCallback, useRef } from "react";

// ── BRAND ────────────────────────────────────────────────────────────────────
const B = {
  charcoal: "#403d3d", orange: "#f76732", cream: "#fffae8",
  gray: "#dddddd", body: "#555", muted: "#888",
};

const PILLARS = ["Keep", "Create", "Multiply"];
const WORTH_TYPES = ["Podcast", "Book", "Article", "Video", "Scripture", "Kid Moment", "Other"];
const FROM_PROMPTS = [
  "What's one thing you're seeing in the market this month?",
  "What's a win you closed that surprised you?",
  "What did a client teach you recently?",
  "What's on your mind heading into this month?",
];
const PILLAR_BG = { Keep: "#403d3d", Create: "#f76732", Multiply: "#555" };

const STORAGE_KEY = "steward_newsletter_v6";

// ── CLAUDE API ───────────────────────────────────────────────────────────────
const VOICE = `You write for The Stewards — Ryan Miracle and Chris Beal, Senior Loan Officers at Ruoff Mortgage in Columbus, Ohio. Voice: warm, direct, trustworthy, never salesy. Plain English. No jargon. No hype. Brief and human. These are two people who genuinely care about their clients' lives, not just their loans.`;

async function claude(prompt, maxTokens = 800) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Missing VITE_ANTHROPIC_API_KEY environment variable");
    return "";
  }
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-allow-browser": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const d = await r.json();
  return d.content?.[0]?.text?.trim() || "";
}

// ── OG IMAGE FETCHER (via Claude API) ───────────────────────────────────────
async function fetchOG(url) {
  if (!url || !url.startsWith("http")) return null;
  try {
    const result = await claude(
      `Fetch the URL "${url}" and return ONLY a JSON object with these fields extracted from the page's meta tags:
{ "ogImage": "<og:image content value>", "ogTitle": "<og:title content value>", "ogDescription": "<og:description content value>" }
Return ONLY the JSON. No explanation. No markdown. If a field is missing use null.`,
      300
    );
    const clean = result.replace(/\`\`\`json|\`\`\`/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

// ── PERSIST ──────────────────────────────────────────────────────────────────
function usePersistedState(key, init) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : init;
    } catch { return init; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
  }, [state, key]);
  return [state, setState];
}

// ── SHARED UI ────────────────────────────────────────────────────────────────
const font = (size, weight = 300, spacing = 0, upper = false, color = B.body) => ({
  fontFamily: "'Frank Ruhl Libre', serif", fontWeight: weight,
  fontSize: size, letterSpacing: spacing, color,
  textTransform: upper ? "uppercase" : "none",
});
const bfont = (size, weight = 700, spacing = "0.2em", color = B.charcoal) => ({
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: weight,
  fontSize: size, letterSpacing: spacing, textTransform: "uppercase", color,
});

function Lbl({ children, color = B.orange }) {
  return <p style={{ ...bfont(12, 700, "0.35em", color), margin: "0 0 5px 0" }}>{children}</p>;
}

function Inp({ value, onChange, placeholder, type = "text", disabled }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled}
      style={{ width: "100%", boxSizing: "border-box", padding: "8px 11px", border: `1px solid ${B.gray}`, borderRadius: 3, ...font(15, 300, 0, false, B.charcoal), background: disabled ? "#f9f9f9" : "#fff", outline: "none" }} />
  );
}

function Txta({ value, onChange, placeholder, rows = 3, disabled }) {
  const len = (value || "").split(/\s+/).filter(Boolean).length;
  return (
    <div style={{ position: "relative" }}>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        rows={rows} disabled={disabled}
        style={{ width: "100%", boxSizing: "border-box", padding: "8px 11px", border: `1px solid ${B.gray}`, borderRadius: 3, ...font(15, 300, 0, false, B.charcoal), background: disabled ? "#f9f9f9" : "#fff", outline: "none", resize: "vertical" }} />
      <span style={{ position: "absolute", bottom: 6, right: 8, ...font(11, 300, 0, false, "#bbb") }}>{len}w</span>
    </div>
  );
}

function Sel({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "8px 11px", border: `1px solid ${B.gray}`, borderRadius: 3, ...font(15, 300, 0, false, B.charcoal), background: "#fff" }}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function OBtn({ onClick, children, small, disabled, ghost }) {
  const base = { border: "none", borderRadius: 3, cursor: disabled ? "not-allowed" : "pointer", ...bfont(small ? 12 : 14, 700, "0.12em"), padding: small ? "5px 12px" : "10px 22px", opacity: disabled ? 0.5 : 1, transition: "opacity 0.2s" };
  if (ghost) return <button onClick={onClick} disabled={disabled} style={{ ...base, background: "transparent", color: B.charcoal, border: `1px solid ${B.gray}` }}>{children}</button>;
  return <button onClick={onClick} disabled={disabled} style={{ ...base, background: B.orange, color: B.cream }}>{children}</button>;
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Lbl>{label}</Lbl>
      {children}
      {hint && <p style={{ ...font(12, 300, 0, false, "#aaa"), margin: "3px 0 0 0" }}>{hint}</p>}
    </div>
  );
}

function AIBtn({ onClick, loading, label = "✍️ Write for me", small = true }) {
  return <OBtn onClick={onClick} disabled={loading} small={small}>{loading ? "Writing…" : label}</OBtn>;
}

// ── SECTION WRAPPER WITH COLLAPSE ────────────────────────────────────────────
function Section({ id, icon, label, complete, children, openId, setOpenId }) {
  const isOpen = openId === id;
  const toggle = () => setOpenId(isOpen ? null : id);
  return (
    <div style={{ marginBottom: 12, border: `1px solid ${complete ? B.orange : B.gray}`, borderRadius: 4, overflow: "hidden", transition: "border-color 0.3s" }}>
      <button onClick={toggle} style={{ width: "100%", background: complete ? "rgba(247,103,50,0.06)" : "#fff", border: "none", padding: "13px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ ...bfont(14, 700, "0.2em", B.charcoal), flex: 1 }}>{label}</span>
        {complete && <span style={{ ...bfont(11, 700, "0.1em", B.orange) }}>✓ Ready</span>}
        <span style={{ ...font(14, 300, 0, false, B.muted), transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
      </button>
      {isOpen && <div style={{ padding: "16px", borderTop: `1px solid ${B.gray}`, background: B.cream }}>{children}</div>}
    </div>
  );
}

// ── PROGRESS BAR ─────────────────────────────────────────────────────────────
function Progress({ sections }) {
  const done = sections.filter(Boolean).length;
  const pct = Math.round((done / sections.length) * 100);
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ ...bfont(12, 700, "0.2em", B.muted) }}>Progress</span>
        <span style={{ ...bfont(12, 700, "0.2em", pct === 100 ? B.orange : B.muted) }}>{done}/{sections.length} sections ready</span>
      </div>
      <div style={{ background: B.gray, borderRadius: 99, height: 5, overflow: "hidden" }}>
        <div style={{ background: B.orange, height: "100%", width: `${pct}%`, borderRadius: 99, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

// ── SUBJECT / PREVIEW BLOCK ───────────────────────────────────────────────────
function SubjectBlock({ data, setData, contentSummary, openId, setOpenId }) {
  const [loading, setLoading] = useState(false);
  const u = (k, v) => setData(d => ({ ...d, [k]: v }));
  const complete = !!(data.subject && data.preview);

  const generate = async () => {
    setLoading(true);
    const prompt = `${VOICE}

You are writing email subject lines and preview text for The Stewards newsletter. Your ONLY goal is maximum open rate through genuine curiosity — never clickbait, always deliverable.

RULES:
- Subject lines must create an open loop the reader CANNOT ignore
- The content of the email MUST resolve the curiosity — no bait and switch
- Trust is the brand foundation — every subject line must be honest
- Preview text confirms the click without resolving the curiosity — 50 chars max, no period
- The subject line should feel like something a smart friend texted you, not a marketing email

This send contains: ${contentSummary}

Return ONLY valid JSON in this exact format, nothing else:
{
  "options": [
    { "subject": "...", "preview": "..." },
    { "subject": "...", "preview": "..." },
    { "subject": "...", "preview": "..." }
  ]
}`;
    try {
      const raw = await claude(prompt, 400);
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      u("subjectOptions", parsed.options);
      u("subject", parsed.options[0].subject);
      u("preview", parsed.options[0].preview);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <Section id="subject" icon="📬" label="Subject Line & Preview Text" complete={complete} openId={openId} setOpenId={setOpenId}>
      <div style={{ marginBottom: 12 }}>
        <AIBtn onClick={generate} loading={loading} label="⚡ Generate Subject Lines" small={false} />
        <p style={{ ...font(12, 300, 0, false, "#aaa"), margin: "5px 0 0 0" }}>Fill content sections first for best results</p>
      </div>

      {data.subjectOptions && (
        <div style={{ marginBottom: 14 }}>
          <Lbl>Choose an option</Lbl>
          {data.subjectOptions.map((opt, i) => (
            <div key={i} onClick={() => { u("subject", opt.subject); u("preview", opt.preview); }}
              style={{ padding: "10px 12px", marginBottom: 6, borderRadius: 3, border: `2px solid ${data.subject === opt.subject ? B.orange : B.gray}`, background: data.subject === opt.subject ? "rgba(247,103,50,0.06)" : "#fff", cursor: "pointer", transition: "all 0.15s" }}>
              <p style={{ ...bfont(13, 700, "0.15em", B.charcoal), margin: "0 0 3px 0" }}>{opt.subject}</p>
              <p style={{ ...font(12, 300, 0, false, B.muted), margin: 0 }}>{opt.preview}</p>
            </div>
          ))}
        </div>
      )}

      <Field label="Subject Line — edit freely">
        <Inp value={data.subject || ""} onChange={v => u("subject", v)} placeholder="Your subject line here..." />
      </Field>
      <Field label="Preview Text — 50 chars max" hint="Confirms the click. Doesn't resolve the curiosity.">
        <div style={{ position: "relative" }}>
          <Inp value={data.preview || ""} onChange={v => u("preview", v)} placeholder="Preview text here..." />
          <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", ...font(11, 300, 0, false, (data.preview || "").length > 50 ? "red" : "#bbb") }}>
            {(data.preview || "").length}/50
          </span>
        </div>
      </Field>
    </Section>
  );
}

// ── SEND 1 SECTIONS ───────────────────────────────────────────────────────────

function EventGroup({ events, setEvents, label }) {
  const update = (i, field, val) => setEvents(ev => { const a = [...ev]; a[i] = { ...a[i], [field]: val }; return a; });
  const add = () => setEvents(ev => [...ev, { name: "", date: "", desc: "", url: "" }]);
  const remove = (i) => setEvents(ev => ev.filter((_, idx) => idx !== i));

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ ...bfont(12, 700, "0.2em", B.charcoal), margin: "0 0 8px 0", borderBottom: `1px solid ${B.gray}`, paddingBottom: 6 }}>{label}</p>
      {events.map((ev, i) => (
        <div key={i} style={{ background: "#fff", border: `1px solid ${B.gray}`, borderRadius: 3, padding: 10, marginBottom: 8 }}>
          {i === 0 && <p style={{ ...font(11, 300, 0, false, B.orange), margin: "0 0 6px 0" }}>★ Hero image pulled from this event's URL</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
            <div><Lbl>Name</Lbl><Inp value={ev.name} onChange={v => update(i, "name", v)} placeholder="Event name" /></div>
            <div><Lbl>Date</Lbl><Inp value={ev.date} onChange={v => update(i, "date", v)} placeholder="May 15" /></div>
          </div>
          <div style={{ marginBottom: 6 }}><Lbl>Description</Lbl><Inp value={ev.desc} onChange={v => update(i, "desc", v)} placeholder="One line" /></div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}><Lbl>URL</Lbl><Inp value={ev.url} onChange={v => update(i, "url", v)} placeholder="https://" /></div>
            {i > 0 && <button onClick={() => remove(i)} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 20, paddingBottom: 6 }}>×</button>}
          </div>
        </div>
      ))}
      {events.length < 3 && <OBtn onClick={add} small ghost>+ Add Event</OBtn>}
    </div>
  );
}

const NYT = [
  { title: "Sheet-Pan Lemon Chicken with Potatoes", source: "NYT Cooking", url: "https://cooking.nytimes.com", img: "https://images.unsplash.com/photo-1598103442097-8b74394b95c4?w=600&q=80" },
  { title: "One-Pot Pasta with Burst Tomatoes", source: "NYT Cooking", url: "https://cooking.nytimes.com", img: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80" },
  { title: "Classic Beef Chili", source: "NYT Cooking", url: "https://cooking.nytimes.com", img: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80" },
  { title: "Weeknight Roast Salmon", source: "NYT Cooking", url: "https://cooking.nytimes.com", img: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&q=80" },
  { title: "Homemade Pizza with Any Toppings", source: "NYT Cooking", url: "https://cooking.nytimes.com", img: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80" },
  { title: "Summer Corn Chowder", source: "NYT Cooking", url: "https://cooking.nytimes.com", img: "https://images.unsplash.com/photo-1543362906-acfc16c67564?w=600&q=80" },
];

function Send1Form({ data, setData, openId, setOpenId }) {
  const u = (k, v) => setData(d => ({ ...d, [k]: v }));
  const [worthLoading, setWorthLoading] = useState(false);
  const [fromLoading, setFromLoading] = useState(false);
  const [remixIdx, setRemixIdx] = useState(0);

  const remix = () => {
    const next = (remixIdx + 1) % NYT.length;
    setRemixIdx(next);
    u("recipe", NYT[next]);
  };

  const writeWorth = async () => {
    setWorthLoading(true);
    const text = await claude(`${VOICE}\n\nWrite 2-3 sentences introducing this recommendation to our newsletter readers. Type: ${data.worthType}. Title: "${data.worthTitle}". Why it caught our eye: "${data.worthWhy}". URL: ${data.worthUrl || "not provided"}. Personal, warm, like a friend recommending something. No CTA, no sales language.`);
    u("worthCopy", text);
    setWorthLoading(false);
  };

  const writeFrom = async () => {
    setFromLoading(true);
    const text = await claude(`${VOICE}\n\nWrite a warm personal closing paragraph (3-4 sentences) for "From Ryan & Chris." Raw thought: "${data.fromUs}". Human, not corporate. Do not include a sign-off line.`);
    u("fromFormatted", text);
    setFromLoading(false);
  };

  const uEvents = (k) => (fn) => setData(d => ({ ...d, [k]: fn(d[k] || [{ name: "", date: "", desc: "", url: "" }]) }));
  const columbusReady = (data.uniqueEvents?.[0]?.name && data.annualEvents?.[0]?.name) || false;
  const recipeReady = !!(data.recipe?.title);
  const worthReady = !!(data.worthTitle && (data.worthCopy || data.worthWhy));
  const fromReady = !!(data.fromUs || data.fromFormatted);

  return (
    <>
      {/* 1 — Columbus Pick */}
      <Section id="columbus" icon="📍" label="1 · Columbus Pick" complete={columbusReady} openId={openId} setOpenId={setOpenId}>
        <EventGroup events={data.uniqueEvents || [{ name: "", date: "", desc: "", url: "" }]} setEvents={uEvents("uniqueEvents")} label="Unique This Month" />
        <EventGroup events={data.annualEvents || [{ name: "", date: "", desc: "", url: "" }]} setEvents={uEvents("annualEvents")} label="Annual Favorites" />
        <p style={{ ...font(12, 300, 0, false, B.muted), margin: "4px 0 0 0" }}>Sources: Columbus Underground · Experience Columbus</p>
      </Section>

      {/* 2 — Worth Your Time */}
      <Section id="worth" icon="👀" label="2 · Worth Your Time" complete={worthReady} openId={openId} setOpenId={setOpenId}>
        <Field label="Type"><Sel value={data.worthType || "Podcast"} onChange={v => u("worthType", v)} options={WORTH_TYPES} /></Field>
        <Field label="Title / Name"><Inp value={data.worthTitle || ""} onChange={v => u("worthTitle", v)} placeholder="Title or name" /></Field>
        <Field label="Why it caught your eye"><Inp value={data.worthWhy || ""} onChange={v => u("worthWhy", v)} placeholder="One line" /></Field>
        <Field label="URL (if applicable)"><Inp value={data.worthUrl || ""} onChange={v => u("worthUrl", v)} placeholder="https://" /></Field>
        <div style={{ marginBottom: 10 }}><AIBtn onClick={writeWorth} loading={worthLoading} /></div>
        {data.worthCopy && <Field label="Edit copy"><Txta value={data.worthCopy} onChange={v => u("worthCopy", v)} rows={4} /></Field>}
      </Section>

      {/* 3 — Recipe */}
      <Section id="recipe" icon="🍽" label="3 · From the Table — Recipe" complete={recipeReady} openId={openId} setOpenId={setOpenId}>
        <Field label="Recipe Title"><Inp value={data.recipe?.title || ""} onChange={v => u("recipe", { ...data.recipe, title: v })} placeholder="Recipe name" /></Field>
        <Field label="Source"><Inp value={data.recipe?.source || ""} onChange={v => u("recipe", { ...data.recipe, source: v })} placeholder="NYT Cooking" /></Field>
        <Field label="URL">
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1 }}>
              <Inp value={data.recipe?.url || ""} onChange={v => u("recipe", { ...data.recipe, url: v })} placeholder="https://" />
            </div>
            <OBtn small onClick={async () => {
              if (!data.recipe?.url) return;
              u("recipe", { ...data.recipe, _loading: true });
              const og = await fetchOG(data.recipe.url);
              if (og) u("recipe", { ...data.recipe, img: og.ogImage || data.recipe.img, title: og.ogTitle || data.recipe.title, _loading: false });
              else u("recipe", { ...data.recipe, _loading: false });
            }}>{data.recipe?._loading ? "…" : "⚡ Fetch"}</OBtn>
          </div>
        </Field>
        {data.recipe?.img && <img src={data.recipe.img} alt={data.recipe.title || "Recipe"} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 3, marginBottom: 8 }} />}
        <OBtn onClick={remix} small>🔀 Remix from NYT</OBtn>
      </Section>

      {/* 4 — Video Diary or Written Closer */}
      <Section id="video1" icon="🎥" label="4 · Video Diary or Written Closer" complete={!!(data.dubbUrl && data.dubbImg) || !!(data.fromUs || data.fromFormatted)} openId={openId} setOpenId={setOpenId}>
        <div style={{ background: "#fff", border: `1px solid ${B.gray}`, borderRadius: 3, padding: 10, marginBottom: 14 }}>
          <p style={{ ...font(13, 300, 0, false, B.muted), margin: 0, fontStyle: "italic" }}>Record a video this month? Paste the Dubb link. No video? Write the closer instead. Never both.</p>
        </div>
        <Field label="Dubb Video URL — paste to activate video diary">
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1 }}>
              <Inp value={data.dubbUrl || ""} onChange={v => u("dubbUrl", v)} placeholder="https://ryan-miracle.dubb.com/v/..." />
            </div>
            <OBtn small onClick={async () => {
              if (!data.dubbUrl) return;
              u("dubbLoading", true);
              const og = await fetchOG(data.dubbUrl);
              if (og) { u("dubbImg", og.ogImage); u("dubbTitle", og.ogTitle); }
              u("dubbLoading", false);
            }}>{data.dubbLoading ? "…" : "⚡ Fetch GIF"}</OBtn>
          </div>
          {data.dubbImg && <img src={data.dubbImg} alt={data.dubbTitle || "Video from Ryan and Chris"} style={{ width: "100%", borderRadius: 3, marginTop: 8 }} />}
        </Field>
        {data.dubbImg && <Field label="Caption (optional)"><Inp value={data.dubbCaption || ""} onChange={v => u("dubbCaption", v)} placeholder="One line — what this video is about" /></Field>}
        {!data.dubbUrl && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 12px 0" }}>
              <div style={{ flex: 1, height: 1, background: B.gray }} />
              <span style={{ ...font(12, 300, 0, false, B.muted) }}>or write the closer</span>
              <div style={{ flex: 1, height: 1, background: B.gray }} />
            </div>
            <div style={{ background: "#fff", border: `1px solid ${B.gray}`, borderRadius: 3, padding: 10, marginBottom: 10 }}>
              <p style={{ ...font(12, 300, 0, false, B.muted), margin: "0 0 5px 0", fontStyle: "italic" }}>Pick a direction:</p>
              {FROM_PROMPTS.map((p, i) => <p key={i} style={{ ...font(13, 300, 0, false, B.body), margin: "0 0 3px 0" }}>— {p}</p>)}
            </div>
            <Field label="Your 3–4 sentences"><Txta value={data.fromUs || ""} onChange={v => u("fromUs", v)} placeholder="Raw is fine…" rows={4} /></Field>
            <div style={{ marginBottom: 10 }}><AIBtn onClick={writeFrom} loading={fromLoading} label="✍️ Format in Stewards voice" /></div>
            {data.fromFormatted && <Field label="Edit formatted copy"><Txta value={data.fromFormatted} onChange={v => u("fromFormatted", v)} rows={4} /></Field>}
          </>
        )}
      </Section>

      {/* Subject line */}
    </>
  );
}

// ── SEND 2 SECTIONS ───────────────────────────────────────────────────────────
function Send2Form({ data, setData, openId, setOpenId }) {
  const u = (k, v) => setData(d => ({ ...d, [k]: v }));
  const [ckmLoading, setCkmLoading] = useState(false);
  const [fromLoading, setFromLoading] = useState(false);

  const writeCKM = async () => {
    setCkmLoading(true);
    const text = await claude(`${VOICE}\n\nWrite a clear, practical explanation of this financial topic for elder millennials (30s-40s) with families. Three flowing paragraphs — no bullets:\n1. What it is (plain English, 2-3 sentences)\n2. Why it matters at their life stage (2-3 sentences)\n3. Practical ways to use it — specific and actionable (3-4 sentences)\n\nPillar: ${data.pillar}. Topic: "${data.ckmTopic}". Context: "${data.ckmBrief}".\n\nUnder 200 words total.`);
    u("ckmCopy", text);
    setCkmLoading(false);
  };

  const writeFrom = async () => {
    setFromLoading(true);
    const text = await claude(`${VOICE}\n\nWrite a warm personal closing paragraph (3-4 sentences) for "From Ryan & Chris." Raw thought: "${data.fromUs}". Human, not corporate. No sign-off line.`);
    u("fromFormatted", text);
    setFromLoading(false);
  };

  const ckmReady = !!(data.ckmTopic && data.ckmCopy);
  const storyReady = !!(data.storyUrl && data.storyQuote);
  const watchReady = !!(data.watchUrl && data.watchQuote);
  const fromReady = !!(data.fromUs || data.fromFormatted);

  return (
    <>
      {/* 1 — CKM */}
      <Section id="ckm" icon="📊" label="1 · Create · Keep · Multiply" complete={ckmReady} openId={openId} setOpenId={setOpenId}>
        <Field label="Pillar"><Sel value={data.pillar || "Keep"} onChange={v => u("pillar", v)} options={PILLARS} /></Field>
        <Field label="Topic / Financial Tool"><Inp value={data.ckmTopic || ""} onChange={v => u("ckmTopic", v)} placeholder="e.g. HSA for Retirement" /></Field>
        <Field label="One-line brief for AI"><Inp value={data.ckmBrief || ""} onChange={v => u("ckmBrief", v)} placeholder="Any context…" /></Field>
        <div style={{ marginBottom: 10 }}><AIBtn onClick={writeCKM} loading={ckmLoading} label="✍️ Write this section" small={false} /></div>
        {data.ckmCopy && <Field label="Edit copy"><Txta value={data.ckmCopy} onChange={v => u("ckmCopy", v)} rows={6} /></Field>}
        <p style={{ ...font(12, 300, 0, false, "#aaa"), margin: "4px 0 0 0" }}>Legal disclaimer added automatically.</p>
      </Section>

      {/* 2 — Client Story */}
      <Section id="story" icon="📁" label="2 · Client Story" complete={storyReady} openId={openId} setOpenId={setOpenId}>
        <Field label="Blog Post URL">
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1 }}>
              <Inp value={data.storyUrl || ""} onChange={v => u("storyUrl", v)} placeholder="https://stewards.loan/blog/..." />
            </div>
            <OBtn small onClick={async () => {
              if (!data.storyUrl) return;
              u("storyLoading", true);
              const og = await fetchOG(data.storyUrl);
              if (og) { u("storyImg", og.ogImage); u("storyTitle", og.ogTitle); u("storyDesc", og.ogDescription); }
              u("storyLoading", false);
            }}>{data.storyLoading ? "…" : "⚡ Fetch"}</OBtn>
          </div>
          {data.storyImg && <img src={data.storyImg} alt={data.storyTitle || "Case study"} style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 3, marginTop: 6 }} />}
          {data.storyTitle && <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, color: B.charcoal, margin: "4px 0 0 0" }}>{data.storyTitle}</p>}
        </Field>
        <Field label="Pillar"><Sel value={data.storyPillar || "Keep"} onChange={v => u("storyPillar", v)} options={PILLARS} /></Field>
        <Field label="Read Time"><Inp value={data.storyReadTime || ""} onChange={v => u("storyReadTime", v)} placeholder="5 minute read" /></Field>
        <Field label="Pull Quote" hint="One sentence that creates curiosity"><Txta value={data.storyQuote || ""} onChange={v => u("storyQuote", v)} rows={2} /></Field>
      </Section>

      {/* 3 — Watch This */}
      <Section id="watch" icon="▶️" label="3 · Watch This" complete={watchReady} openId={openId} setOpenId={setOpenId}>
        <Field label="Video URL">
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1 }}>
              <Inp value={data.watchUrl || ""} onChange={v => u("watchUrl", v)} placeholder="https://youtube.com/watch?v=..." />
            </div>
            <OBtn small onClick={async () => {
              if (!data.watchUrl) return;
              u("watchLoading", true);
              const og = await fetchOG(data.watchUrl);
              if (og) { u("watchImg", og.ogImage); u("watchTitle", og.ogTitle); }
              u("watchLoading", false);
            }}>{data.watchLoading ? "…" : "⚡ Fetch"}</OBtn>
          </div>
          {data.watchImg && <img src={data.watchImg} alt={data.watchTitle || "Video"} style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 3, marginTop: 6 }} />}
          {data.watchTitle && <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, color: B.charcoal, margin: "4px 0 0 0" }}>{data.watchTitle}</p>}
        </Field>
        <Field label="Pillar"><Sel value={data.watchPillar || "Create"} onChange={v => u("watchPillar", v)} options={PILLARS} /></Field>
        <Field label="Watch Time"><Inp value={data.watchTime || ""} onChange={v => u("watchTime", v)} placeholder="12 minute watch" /></Field>
        <Field label="Hook / Pull Quote"><Txta value={data.watchQuote || ""} onChange={v => u("watchQuote", v)} rows={2} /></Field>
      </Section>

      {/* 4 — Video Diary or Written Closer */}
      <Section id="video2" icon="🎥" label="4 · Video Diary or Written Closer" complete={!!(data.dubbUrl && data.dubbImg) || !!(data.fromUs || data.fromFormatted)} openId={openId} setOpenId={setOpenId}>
        <div style={{ background: "#fff", border: `1px solid ${B.gray}`, borderRadius: 3, padding: 10, marginBottom: 14 }}>
          <p style={{ ...font(13, 300, 0, false, B.muted), margin: 0, fontStyle: "italic" }}>Record a video this month? Paste the Dubb link. No video? Write the closer instead. Never both.</p>
        </div>
        <Field label="Dubb Video URL — paste to activate video diary">
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1 }}>
              <Inp value={data.dubbUrl || ""} onChange={v => u("dubbUrl", v)} placeholder="https://ryan-miracle.dubb.com/v/..." />
            </div>
            <OBtn small onClick={async () => {
              if (!data.dubbUrl) return;
              u("dubbLoading", true);
              const og = await fetchOG(data.dubbUrl);
              if (og) { u("dubbImg", og.ogImage); u("dubbTitle", og.ogTitle); }
              u("dubbLoading", false);
            }}>{data.dubbLoading ? "…" : "⚡ Fetch GIF"}</OBtn>
          </div>
          {data.dubbImg && <img src={data.dubbImg} alt={data.dubbTitle || "Video from Ryan and Chris"} style={{ width: "100%", borderRadius: 3, marginTop: 8 }} />}
        </Field>
        {data.dubbImg && <Field label="Caption (optional)"><Inp value={data.dubbCaption || ""} onChange={v => u("dubbCaption", v)} placeholder="One line — what this video is about" /></Field>}
        {!data.dubbUrl && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 12px 0" }}>
              <div style={{ flex: 1, height: 1, background: B.gray }} />
              <span style={{ ...font(12, 300, 0, false, B.muted) }}>or write the closer</span>
              <div style={{ flex: 1, height: 1, background: B.gray }} />
            </div>
            <div style={{ background: "#fff", border: `1px solid ${B.gray}`, borderRadius: 3, padding: 10, marginBottom: 10 }}>
              <p style={{ ...font(12, 300, 0, false, B.muted), margin: "0 0 5px 0", fontStyle: "italic" }}>Pick a direction:</p>
              {FROM_PROMPTS.map((p, i) => <p key={i} style={{ ...font(13, 300, 0, false, B.body), margin: "0 0 3px 0" }}>— {p}</p>)}
            </div>
            <Field label="Your 3–4 sentences"><Txta value={data.fromUs || ""} onChange={v => u("fromUs", v)} rows={4} /></Field>
            <div style={{ marginBottom: 10 }}><AIBtn onClick={writeFrom} loading={fromLoading} label="✍️ Format in Stewards voice" /></div>
            {data.fromFormatted && <Field label="Edit formatted copy"><Txta value={data.fromFormatted} onChange={v => u("fromFormatted", v)} rows={4} /></Field>}
          </>
        )}
      </Section>
    </>
  );
}

// ── HTML GENERATORS ───────────────────────────────────────────────────────────
function evtRows(events) {
  return (events || []).map((ev, i) => {
    if (i === 0) return `
      <tr><td style="padding-bottom:16px;">
        <a href="${ev.url || '#'}" style="display:block;text-decoration:none;margin-bottom:10px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#403d3d" style="background:#403d3d;padding:40px 20px;">
            <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:20px;color:#fffae8;letter-spacing:0.1em;text-transform:uppercase;margin:0;text-align:center;">${ev.name || 'Event'}</p>
          </td></tr></table>
        </a>
        <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;letter-spacing:0.25em;text-transform:uppercase;color:#f76732;margin:0 0 3px 0;">${ev.date || ''}</p>
        <a href="${ev.url || '#'}" style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:20px;color:#403d3d;text-decoration:none;display:block;margin-bottom:4px;">${ev.name || ''}</a>
        <p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:16px;color:#555;line-height:1.7;margin:0;">${ev.desc || ''}</p>
      </td></tr>`;
    return `
      <tr><td style="padding:10px 0;border-top:1px solid #dddddd;">
        <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.25em;text-transform:uppercase;color:#f76732;margin:0 0 2px 0;">${ev.date || ''}</p>
        <a href="${ev.url || '#'}" style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:18px;color:#403d3d;text-decoration:none;display:block;margin-bottom:2px;">${ev.name || ''}</a>
        <p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:15px;color:#555;line-height:1.7;margin:0;">${ev.desc || ''}</p>
      </td></tr>`;
  }).join("");
}

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700&family=Frank+Ruhl+Libre:wght@300;400;500&display=swap" rel="stylesheet">`;
const EYEBROW = `<tr><td style="padding:14px 40px;background:#403d3d;text-align:center;"><p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(255,250,232,0.4);margin:0;">The Stewards &middot; Ryan Miracle NMLS #497698 &middot; Chris Beal NMLS #514071 &middot; Ruoff Mortgage &middot; Columbus, Ohio</p></td></tr>`;

// Delivery-safe CTA — no flex, table-based, dual stacked buttons, correct phone + email
const CTA = `<tr><td style="padding:36px 40px;text-align:center;background:#fffae8;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 8px 0;">Questions? Life Changes? Just Want to Talk?</p>
  <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:28px;line-height:1.05;text-transform:uppercase;color:#403d3d;margin:0 0 20px 0;">We're One <span style="color:#f76732;">Message</span> Away</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding-bottom:12px;">
      <a href="mailto:Stewards@ruoff.com?subject=I%27d%20like%20to%20talk&body=Hi%20Ryan%20and%20Chris%2C%20I%27d%20like%20to%20talk%20about%20"
        style="display:inline-block;background:#403d3d;color:#fffae8;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;letter-spacing:0.15em;text-transform:uppercase;padding:14px 40px;text-decoration:none;min-width:220px;">
        &#9993; Email Ryan &amp; Chris
      </a>
    </td></tr>
    <tr><td align="center">
      <a href="sms:+16147675273&amp;body=Hi%20Chris%20and%20Ryan%2C%20we%20need%20to%20talk%20about%20"
        style="display:inline-block;background:#f76732;color:#fffae8;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;letter-spacing:0.15em;text-transform:uppercase;padding:14px 40px;text-decoration:none;min-width:220px;">
        &#128172; Text Ryan &amp; Chris
      </a>
    </td></tr>
  </table>
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:14px 0 0 0;">No pitch. No pressure. Just people.</p>
</td></tr>`;

const LEGAL = (extra = "") => `<tr><td style="padding:20px 40px;border-top:1px solid #dddddd;"><p style="font-family:'Frank Ruhl Libre',serif;font-weight:400;font-size:16px;color:#555;line-height:1.75;margin:0 0 10px 0;"><span style="font-weight:500;color:#403d3d;">Ryan Miracle</span>, Senior Loan Officer, NMLS #497698<br><span style="font-weight:500;color:#403d3d;">Chris Beal</span>, Loan Officer, NMLS #514071<br>Ruoff Mortgage, 8101 N High St Suite 300, Columbus OH 43235, NMLS #141868</p><p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:15px;color:#999;line-height:1.75;margin:0;">This newsletter is for informational purposes only and does not constitute financial, legal, or mortgage advice.${extra} Equal Housing Lender. To unsubscribe, reply STOP.</p></td></tr>`;

function buildS1(d, date, subj) {
  const mo = date ? new Date(date).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "This Month";
  const recipe = d.recipe || {};
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${FONTS}</head><body style="margin:0;padding:0;background:#f5f5f0;">
<!-- Subject: ${subj?.subject || ''} | Preview: ${subj?.preview || ''} -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;"><tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fffae8;max-width:600px;">
${EYEBROW}
<tr><td style="background:#403d3d;border-left:4px solid #f76732;padding:40px 40px 32px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 8px 0;">Monthly · ${mo}</p>
  <h1 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:52px;line-height:1.05;letter-spacing:-0.01em;text-transform:uppercase;color:#fffae8;margin:0 0 10px 0;">The Stewards' <span style="color:#f76732;">Provision</span></h1>
  <hr style="border:none;border-top:2px solid #f76732;width:60px;margin:0 0 14px 0;">
  <p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:17px;color:rgba(255,250,232,0.7);line-height:1.75;margin:0;">Community. Nourishment. Provision for the life you're building.</p>
</td></tr>
<tr><td style="height:1px;background:#dddddd;"></td></tr>

<!-- COLUMBUS PICK -->
<tr><td style="padding:32px 40px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 6px 0;">Columbus Pick</p>
  <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:30px;line-height:1.05;text-transform:uppercase;color:#403d3d;margin:0 0 20px 0;">What's <span style="color:#f76732;">Happening</span> This Month</h2>
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.25em;text-transform:uppercase;color:#403d3d;border-bottom:1px solid #dddddd;padding-bottom:6px;margin:0 0 10px 0;">Unique This Month</p>
  <table width="100%" cellpadding="0" cellspacing="0">${evtRows(d.uniqueEvents)}</table>
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.25em;text-transform:uppercase;color:#403d3d;border-bottom:1px solid #dddddd;padding-bottom:6px;margin:20px 0 10px 0;">Annual Favorites</p>
  <table width="100%" cellpadding="0" cellspacing="0">${evtRows(d.annualEvents)}</table>
</td></tr>
<tr><td style="height:1px;background:#dddddd;"></td></tr>

<!-- RECIPE -->
<tr><td style="padding:32px 40px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 6px 0;">From the Table</p>
  <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:30px;line-height:1.05;text-transform:uppercase;color:#403d3d;margin:0 0 16px 0;">This Month's <span style="color:#f76732;">Recipe</span></h2>
  ${recipe.img ? `<a href="${recipe.url || '#'}" style="display:block;margin-bottom:12px;"><img src="${recipe.img}" alt="${recipe.title || 'Recipe this month'}" width="520" style="width:100%;display:block;"></a>` : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;"><tr><td align="center" bgcolor="#403d3d" style="padding:40px 20px;"><p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px;color:#fffae8;text-transform:uppercase;letter-spacing:0.1em;margin:0;">Recipe Image</p></td></tr></table>`}
  <a href="${recipe.url || '#'}" style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:20px;color:#403d3d;text-decoration:none;display:block;margin-bottom:3px;">${recipe.title || ''}</a>
  <p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:15px;color:#888;margin:0;">Via ${recipe.source || 'NYT Cooking'}</p>
</td></tr>
<tr><td style="height:1px;background:#dddddd;"></td></tr>

<!-- WORTH YOUR TIME -->
<tr><td style="padding:32px 40px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 6px 0;">Worth Your Time</p>
  <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:30px;line-height:1.05;text-transform:uppercase;color:#403d3d;margin:0 0 14px 0;">${d.worthType || 'Something'} Worth <span style="color:#f76732;">Sharing</span></h2>
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#888;margin:0 0 8px 0;">${d.worthType || ''} · ${d.worthTitle || ''}</p>
  <p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:17px;color:#555;line-height:1.75;margin:0 0 12px 0;">${d.worthCopy || d.worthWhy || ''}</p>
  ${d.worthUrl ? `<a href="${d.worthUrl}" style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;letter-spacing:0.15em;text-transform:uppercase;color:#f76732;text-decoration:none;">Check It Out →</a>` : ''}
</td></tr>
<tr><td style="height:1px;background:#dddddd;"></td></tr>

<!-- PERSONAL CLOSER: video diary OR written — never both -->
<tr><td style="height:1px;background:#dddddd;"></td></tr>
${d.dubbImg ? `
<tr><td style="padding:32px 40px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 6px 0;">From Ryan &amp; Chris</p>
  <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:30px;line-height:1.05;text-transform:uppercase;color:#403d3d;margin:0 0 16px 0;">A Message <span style="color:#f76732;">For You</span></h2>
  <a href="${d.dubbUrl || '#'}" style="display:block;margin-bottom:10px;">
    <img src="${d.dubbImg}" alt="${d.dubbTitle || 'Video message from Ryan and Chris'}" width="520" style="width:100%;display:block;">
  </a>
  ${d.dubbCaption ? `<p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:16px;color:#555;line-height:1.7;margin:0;">${d.dubbCaption}</p>` : ''}
</td></tr>
` : `
<tr><td style="padding:32px 40px;background:#403d3d;border-left:4px solid #f76732;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 8px 0;">From Ryan &amp; Chris</p>
  <p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:18px;color:rgba(255,250,232,0.85);line-height:1.75;margin:0 0 14px 0;">${d.fromFormatted || d.fromUs || ''}</p>
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,250,232,0.45);margin:0;">— Ryan &amp; Chris</p>
</td></tr>
`}
${CTA}
${LEGAL()}
</table></td></tr></table></body></html>`;
}

function buildS2(d, date, subj) {
  const mo = date ? new Date(date).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "This Month";
  const pbg = PILLAR_BG[d.pillar] || B.charcoal;
  const sbg = PILLAR_BG[d.storyPillar] || B.charcoal;
  const wbg = PILLAR_BG[d.watchPillar] || B.charcoal;
  const ckmBody = (d.ckmCopy || "").replace(/\n\n/g, '</p><p style="font-family:\'Frank Ruhl Libre\',serif;font-weight:300;font-size:17px;color:#555;line-height:1.75;margin:0 0 14px 0;">').replace(/\n/g, ' ');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${FONTS}</head><body style="margin:0;padding:0;background:#f5f5f0;">
<!-- Subject: ${subj?.subject || ''} | Preview: ${subj?.preview || ''} -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;"><tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fffae8;max-width:600px;">
${EYEBROW}
<tr><td style="background:#403d3d;border-left:4px solid #f76732;padding:40px 40px 32px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 8px 0;">Monthly · ${mo}</p>
  <h1 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:52px;line-height:1.05;letter-spacing:-0.01em;text-transform:uppercase;color:#fffae8;margin:0 0 10px 0;">The Stewards' <span style="color:#f76732;">Counsel</span></h1>
  <hr style="border:none;border-top:2px solid #f76732;width:60px;margin:0 0 14px 0;">
  <p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:17px;color:rgba(255,250,232,0.7);line-height:1.75;margin:0;">Wisdom. Clarity. Counsel for the decisions that matter most.</p>
</td></tr>
<tr><td style="height:1px;background:#dddddd;"></td></tr>

<!-- CKM -->
<tr><td style="padding:32px 40px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 6px 0;">Create · Keep · Multiply</p>
  <span style="display:inline-block;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#fffae8;background:${pbg};padding:3px 10px;border-radius:2px;margin-bottom:10px;">${d.pillar || 'Keep'}</span>
  <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:30px;line-height:1.05;text-transform:uppercase;color:#403d3d;margin:0 0 14px 0;"><span style="color:#f76732;">${(d.ckmTopic || 'This Month').split(' ')[0]}</span> ${(d.ckmTopic || '').split(' ').slice(1).join(' ')}</h2>
  <p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:17px;color:#555;line-height:1.75;margin:0 0 14px 0;">${ckmBody}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="#403d3d" style="background:#403d3d;border-left:4px solid #f76732;padding:12px 16px;"><p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:14px;color:rgba(255,250,232,0.55);line-height:1.7;margin:0;">We're not attorneys or financial advisors &mdash; always consult a qualified professional before making financial decisions.</p></td></tr></table>
</td></tr>
<tr><td style="height:1px;background:#dddddd;"></td></tr>

<!-- CLIENT STORY -->
<tr><td style="padding:32px 40px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 6px 0;">Client Story</p>
  <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:30px;line-height:1.05;text-transform:uppercase;color:#403d3d;margin:0 0 14px 0;">Real People. Real <span style="color:#f76732;">Outcomes.</span></h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;"><tr><td align="center" bgcolor="#403d3d" style="padding:40px 20px;"><p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;color:#fffae8;text-transform:uppercase;letter-spacing:0.1em;margin:0;text-align:center;">Case Study Image</p><p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;color:rgba(255,250,232,0.4);text-transform:uppercase;letter-spacing:0.1em;margin:6px 0 0 0;">Pulled from blog URL</p></td></tr></table>
  <span style="display:inline-block;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#fffae8;background:${sbg};padding:3px 10px;border-radius:2px;margin-bottom:8px;">${d.storyPillar || 'Keep'}</span>
  ${d.storyReadTime ? `<p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#888;margin:0 0 8px 0;">${d.storyReadTime}</p>` : ''}
  ${d.storyQuote ? `<div style="border-left:3px solid #f76732;padding:8px 14px;margin-bottom:12px;"><p style="font-family:'Frank Ruhl Libre',serif;font-weight:400;font-size:17px;color:#403d3d;line-height:1.7;margin:0;font-style:italic;">"${d.storyQuote}"</p></div>` : ''}
  <a href="${d.storyUrl || '#'}" style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:18px;color:#403d3d;text-decoration:none;display:block;margin-bottom:10px;">Read the Full Story →</a>
  <p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:15px;color:#888;line-height:1.7;margin:0;">Know someone in this situation? <a href="sms:+16147675273&amp;body=Hi%20Chris%20and%20Ryan%2C%20we%20need%20to%20talk%20about%20" style="color:#f76732;text-decoration:none;font-weight:500;">Have them text us.</a></p>
</td></tr>
<tr><td style="height:1px;background:#dddddd;"></td></tr>

<!-- WATCH THIS -->
<tr><td style="padding:32px 40px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 6px 0;">Watch This</p>
  <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:30px;line-height:1.05;text-transform:uppercase;color:#403d3d;margin:0 0 14px 0;">Worth Your <span style="color:#f76732;">Time</span></h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;"><tr><td align="center" bgcolor="#403d3d" style="padding:40px 20px;"><p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;color:#fffae8;text-transform:uppercase;letter-spacing:0.1em;margin:0;text-align:center;">Video Thumbnail</p><p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;color:rgba(255,250,232,0.4);text-transform:uppercase;letter-spacing:0.1em;margin:6px 0 0 0;">Pulled from YouTube URL</p></td></tr></table>
  <span style="display:inline-block;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#fffae8;background:${wbg};padding:3px 10px;border-radius:2px;margin-bottom:8px;">${d.watchPillar || 'Create'}</span>
  ${d.watchTime ? `<p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#888;margin:0 0 8px 0;">${d.watchTime}</p>` : ''}
  ${d.watchQuote ? `<div style="border-left:3px solid #f76732;padding:8px 14px;margin-bottom:12px;"><p style="font-family:'Frank Ruhl Libre',serif;font-weight:400;font-size:17px;color:#403d3d;line-height:1.7;margin:0;font-style:italic;">"${d.watchQuote}"</p></div>` : ''}
  <a href="${d.watchUrl || '#'}" style="display:inline-block;background:#f76732;color:#fffae8;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;letter-spacing:0.15em;text-transform:uppercase;padding:10px 24px;border-radius:2px;text-decoration:none;">▶ Watch Now</a>
</td></tr>
<tr><td style="height:1px;background:#dddddd;"></td></tr>

<!-- PERSONAL CLOSER: video diary OR written — never both -->
<tr><td style="height:1px;background:#dddddd;"></td></tr>
${d.dubbImg ? `
<tr><td style="padding:32px 40px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 6px 0;">From Ryan &amp; Chris</p>
  <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:30px;line-height:1.05;text-transform:uppercase;color:#403d3d;margin:0 0 16px 0;">A Message <span style="color:#f76732;">For You</span></h2>
  <a href="${d.dubbUrl || '#'}" style="display:block;margin-bottom:10px;">
    <img src="${d.dubbImg}" alt="${d.dubbTitle || 'Video message from Ryan and Chris'}" width="520" style="width:100%;display:block;">
  </a>
  ${d.dubbCaption ? `<p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:16px;color:#555;line-height:1.7;margin:0;">${d.dubbCaption}</p>` : ''}
</td></tr>
` : `
<tr><td style="padding:32px 40px;background:#403d3d;border-left:4px solid #f76732;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 8px 0;">From Ryan &amp; Chris</p>
  <p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:18px;color:rgba(255,250,232,0.85);line-height:1.75;margin:0 0 14px 0;">${d.fromFormatted || d.fromUs || ''}</p>
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,250,232,0.45);margin:0;">— Ryan &amp; Chris</p>
</td></tr>
`}
${CTA}
${LEGAL(" Always consult a qualified professional before making financial decisions.")}
</table></td></tr></table></body></html>`;
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────

// ── SHARED STORAGE HELPERS ───────────────────────────────────────────────────
// Shared state via a simple shared key in localStorage
// Both Ryan and Chris use the same Netlify URL so localStorage is per-browser
// For true shared state, swap these for a Supabase/Neon call later
async function sharedGet(key) {
  try {
    const val = localStorage.getItem("shared_" + key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}
async function sharedSet(key, value) {
  try {
    localStorage.setItem("shared_" + key, JSON.stringify(value));
  } catch {}
}

// ── PILLAR ROTATION TRACKER ──────────────────────────────────────────────────
function PillarTracker({ history }) {
  const last = history?.[0]?.pillar || null;
  const next = last === "Keep" ? "Create" : last === "Create" ? "Multiply" : "Keep";
  return (
    <div style={{ background: "#fff", border: `1px solid ${B.gray}`, borderRadius: 4, padding: "12px 16px", marginBottom: 14 }}>
      <p style={{ ...bfont(11, 700, "0.3em", B.orange), margin: "0 0 8px 0" }}>CKM Rotation</p>
      <div style={{ display: "flex", gap: 8 }}>
        {["Keep", "Create", "Multiply"].map(p => {
          const isLast = p === last;
          const isNext = p === next && last !== null;
          return (
            <div key={p} style={{ flex: 1, textAlign: "center", padding: "8px 4px", borderRadius: 3, background: isNext ? B.orange : isLast ? B.charcoal : B.gray, border: isNext ? `2px solid ${B.orange}` : "2px solid transparent" }}>
              <p style={{ ...bfont(11, 700, "0.15em", isNext || isLast ? B.cream : B.muted), margin: "0 0 2px 0" }}>{p}</p>
              <p style={{ ...font(10, 300, 0, false, isNext || isLast ? "rgba(255,250,232,0.7)" : B.muted), margin: 0 }}>{isLast ? "Last used" : isNext ? "Up next ↑" : ""}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SEND HISTORY ─────────────────────────────────────────────────────────────
function HistoryPanel({ history, onClose }) {
  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 340, background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)", zIndex: 100, display: "flex", flexDirection: "column" }}>
      <div style={{ background: B.charcoal, borderLeft: `4px solid ${B.orange}`, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ ...bfont(11, 700, "0.3em", B.orange), margin: "0 0 2px 0" }}>The Stewards</p>
          <p style={{ ...bfont(16, 700, "0.1em", B.cream), margin: 0 }}>Send History</p>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: B.cream, fontSize: 22, cursor: "pointer", opacity: 0.6 }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {(!history || history.length === 0) && (
          <p style={{ ...font(14, 300, 0, false, B.muted), textAlign: "center", marginTop: 40 }}>No sends recorded yet.<br />Generate your first newsletter to start the log.</p>
        )}
        {(history || []).map((h, i) => (
          <div key={i} style={{ marginBottom: 10, padding: "12px 14px", border: `1px solid ${B.gray}`, borderRadius: 4, borderLeft: `3px solid ${h.send === 1 ? B.orange : B.charcoal}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <p style={{ ...bfont(12, 700, "0.15em", h.send === 1 ? B.orange : B.charcoal), margin: 0 }}>{h.send === 1 ? "The Provision" : "The Counsel"}</p>
              <p style={{ ...font(11, 300, 0, false, B.muted), margin: 0 }}>{h.date}</p>
            </div>
            {h.name && <p style={{ ...font(14, 500, 0, false, B.charcoal), margin: "0 0 3px 0" }}>{h.name}</p>}
            {h.subject && <p style={{ ...font(13, 300, 0, false, B.body), margin: "0 0 3px 0", fontStyle: "italic" }}>"{h.subject}"</p>}
            {h.topic && <p style={{ ...font(12, 300, 0, false, B.muted), margin: 0 }}>CKM: {h.pillar} — {h.topic}</p>}
            {h.columbus && <p style={{ ...font(12, 300, 0, false, B.muted), margin: 0 }}>Columbus: {h.columbus}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── REVIEW CHECKLIST MODAL ────────────────────────────────────────────────────
function ReviewModal({ send, data, subj, onConfirm, onClose }) {
  const s1 = send === 1;
  const checks = s1 ? [
    { label: "Subject line written", pass: !!(subj?.subject), critical: true },
    { label: "Preview text under 50 chars", pass: (subj?.preview || "").length > 0 && (subj?.preview || "").length <= 50, critical: true },
    { label: "Columbus Pick — at least one unique event", pass: !!(data?.uniqueEvents?.[0]?.name), critical: true },
    { label: "Columbus Pick — at least one annual event", pass: !!(data?.annualEvents?.[0]?.name), critical: false },
    { label: "Recipe selected", pass: !!(data?.recipe?.title), critical: false },
    { label: "Worth Your Time filled", pass: !!(data?.worthTitle), critical: false },
    { label: "Personal closer — video or written", pass: !!(data?.dubbImg || data?.fromUs || data?.fromFormatted), critical: true },
    { label: "Send date set", pass: !!(data?.sendDate), critical: false },
  ] : [
    { label: "Subject line written", pass: !!(subj?.subject), critical: true },
    { label: "Preview text under 50 chars", pass: (subj?.preview || "").length > 0 && (subj?.preview || "").length <= 50, critical: true },
    { label: "CKM topic written and copy generated", pass: !!(data?.ckmTopic && data?.ckmCopy), critical: true },
    { label: "Client story URL entered", pass: !!(data?.storyUrl), critical: true },
    { label: "Client story pull quote written", pass: !!(data?.storyQuote), critical: false },
    { label: "Watch This URL entered", pass: !!(data?.watchUrl), critical: false },
    { label: "Personal closer — video or written", pass: !!(data?.dubbImg || data?.fromUs || data?.fromFormatted), critical: true },
    { label: "Pillar consistency — CKM, story, watch all tagged", pass: !!(data?.pillar && data?.storyPillar && data?.watchPillar), critical: false },
  ];

  const criticalFails = checks.filter(c => c.critical && !c.pass);
  const warnings = checks.filter(c => !c.critical && !c.pass);
  const allClear = criticalFails.length === 0;

  // Pillar consistency check for Send 2
  const pillarMismatch = !s1 && data?.pillar && data?.storyPillar && data?.watchPillar &&
    !(data.pillar === data.storyPillar && data.storyPillar === data.watchPillar);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(64,61,61,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 6, maxWidth: 480, width: "100%", overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ background: B.charcoal, borderLeft: `4px solid ${allClear ? B.orange : "#e53"}`, padding: "20px 24px" }}>
          <p style={{ ...bfont(11, 700, "0.3em", allClear ? B.orange : "#ff7a6e"), margin: "0 0 4px 0" }}>Review Before Send</p>
          <p style={{ ...bfont(20, 700, "0.05em", B.cream), margin: 0 }}>{allClear ? "Looking good." : `${criticalFails.length} issue${criticalFails.length > 1 ? "s" : ""} to fix"}`}</p>
        </div>
        <div style={{ padding: "20px 24px", maxHeight: 400, overflowY: "auto" }}>
          {checks.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < checks.length - 1 ? `1px solid ${B.gray}` : "none" }}>
              <span style={{ fontSize: 16, minWidth: 20 }}>{c.pass ? "✅" : c.critical ? "🔴" : "🟡"}</span>
              <span style={{ ...font(14, c.pass ? 300 : 500, 0, false, c.pass ? B.muted : c.critical ? "#c0392b" : "#e67e22") }}>{c.label}</span>
              {c.critical && !c.pass && <span style={{ ...bfont(10, 700, "0.1em", "#c0392b"), marginLeft: "auto" }}>Required</span>}
            </div>
          ))}
          {pillarMismatch && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(247,103,50,0.08)", borderLeft: `3px solid ${B.orange}`, borderRadius: "0 3px 3px 0" }}>
              <p style={{ ...font(13, 400, 0, false, B.charcoal), margin: 0 }}>
                <strong>Pillar mismatch:</strong> CKM is <strong>{data?.pillar}</strong>, Client Story is <strong>{data?.storyPillar}</strong>, Watch This is <strong>{data?.watchPillar}</strong>. Consider aligning these for a thematically consistent send — or leave as-is if intentional.
              </p>
            </div>
          )}
        </div>
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${B.gray}`, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <OBtn onClick={onClose} ghost small>Go Back & Fix</OBtn>
          <OBtn onClick={onConfirm} disabled={!allClear}>
            {allClear ? "✓ Copy HTML" : "Fix Issues First"}
          </OBtn>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [send, setSend] = usePersistedState(`${STORAGE_KEY}_send`, 1);
  const [sendDate, setSendDate] = usePersistedState(`${STORAGE_KEY}_date`, "");
  const [sendName, setSendName] = usePersistedState(`${STORAGE_KEY}_name`, "");
  const [s1, setS1] = usePersistedState(`${STORAGE_KEY}_s1`, { uniqueEvents: [{ name: "", date: "", desc: "", url: "" }], annualEvents: [{ name: "", date: "", desc: "", url: "" }] });
  const [s2, setS2] = usePersistedState(`${STORAGE_KEY}_s2`, { pillar: "Keep", storyPillar: "Keep", watchPillar: "Create" });
  const [subj, setSubj] = usePersistedState(`${STORAGE_KEY}_subj`, {});
  const [openId, setOpenId] = useState("subject");
  const [view, setView] = useState("build");
  const [html, setHtml] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [history, setHistory] = useState([]);
  const [readerMode, setReaderMode] = useState(false);
  const saveTimer = useRef(null);

  // Load shared history on mount
  useEffect(() => {
    sharedGet("steward_send_history").then(h => { if (h) setHistory(h); });
  }, []);

  // Auto-save indicator
  useEffect(() => {
    setSaving(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaving(false), 800);
  }, [s1, s2, subj, sendDate, send, sendName]);

  const contentSummary = send === 1
    ? `The Stewards' Provision (feel-good monthly). Events: ${(s1.uniqueEvents || []).map(e => e.name).filter(Boolean).join(", ")}. Recipe: ${s1.recipe?.title || "TBD"}. Worth Your Time: ${s1.worthType || ''} — ${s1.worthTitle || ''}.`
    : `The Stewards' Counsel (money/finance monthly). CKM Pillar: ${s2.pillar} — Topic: ${s2.ckmTopic || "TBD"}. Client story at: ${s2.storyUrl || "TBD"}. Watch: ${s2.watchUrl || "TBD"}.`;

  const s1Sections = [
    !!(s1.uniqueEvents?.[0]?.name && s1.annualEvents?.[0]?.name),
    !!(s1.recipe?.title),
    !!(s1.worthTitle && (s1.worthCopy || s1.worthWhy)),
    !!(s1.dubbUrl && s1.dubbImg),
    !!(s1.fromUs || s1.fromFormatted),
    !!(subj.subject && subj.preview),
  ];
  const s2Sections = [
    !!(s2.ckmTopic && s2.ckmCopy),
    !!(s2.storyUrl && s2.storyQuote),
    !!(s2.watchUrl && s2.watchQuote),
    !!(s2.dubbUrl && s2.dubbImg),
    !!(s2.fromUs || s2.fromFormatted),
    !!(subj.subject && subj.preview),
  ];
  const sections = send === 1 ? s1Sections : s2Sections;
  const allReady = sections.every(Boolean);

  const generate = useCallback(() => {
    const output = send === 1 ? buildS1(s1, sendDate, subj) : buildS2(s2, sendDate, subj);
    setHtml(output);
    return output;
  }, [send, s1, s2, sendDate, subj]);

  const saveToHistory = useCallback(async () => {
    const entry = {
      id: Date.now(),
      send,
      date: sendDate || new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      name: sendName,
      subject: subj.subject,
      pillar: s2.pillar,
      topic: s2.ckmTopic,
      columbus: (s1.uniqueEvents?.[0]?.name || "") + (s1.annualEvents?.[0]?.name ? ` · ${s1.annualEvents[0].name}` : ""),
    };
    const updated = [entry, ...(history || [])].slice(0, 24);
    setHistory(updated);
    await sharedSet("steward_send_history", updated);
  }, [send, sendDate, sendName, subj, s2, s1, history]);

  const handleConfirmCopy = useCallback(async () => {
    const output = generate();
    navigator.clipboard.writeText(output).then(async () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      await saveToHistory();
      setShowReview(false);
      setView("preview");
    });
  }, [generate, saveToHistory]);

  const copy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const counselHistory = history.filter(h => h.send === 2);

  return (
    <div style={{ fontFamily: "'Frank Ruhl Libre', serif", background: "#f0ede8", minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700&family=Frank+Ruhl+Libre:wght@300;400;500&display=swap" rel="stylesheet" />

      {showReview && (
        <ReviewModal
          send={send}
          data={send === 1 ? s1 : s2}
          subj={subj}
          onConfirm={handleConfirmCopy}
          onClose={() => setShowReview(false)}
        />
      )}

      {showHistory && <HistoryPanel history={history} onClose={() => setShowHistory(false)} />}

      {/* TOP BAR */}
      <div style={{ background: B.charcoal, borderLeft: `4px solid ${B.orange}`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <p style={{ ...bfont(11, 700, "0.4em", B.orange), margin: "0 0 2px 0" }}>The Stewards</p>
          <h1 style={{ ...bfont(24, 700, "0.05em", B.cream), margin: 0, lineHeight: 1.05 }}>Newsletter <span style={{ color: B.orange }}>Builder</span></h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {saving && <span style={{ ...font(12, 300, 0, false, "rgba(255,250,232,0.4)") }}>Saving…</span>}
          {!saving && <span style={{ ...font(12, 300, 0, false, "rgba(255,250,232,0.3)") }}>Auto-saved</span>}
          <button onClick={() => setShowHistory(true)} style={{ background: "rgba(255,250,232,0.08)", border: "1px solid rgba(255,250,232,0.15)", color: B.cream, borderRadius: 3, padding: "6px 12px", ...bfont(12, 700, "0.1em", B.cream), cursor: "pointer" }}>
            📋 History {history.length > 0 && `(${history.length})`}
          </button>
          <input type="date" value={sendDate} onChange={e => setSendDate(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 3, border: "1px solid rgba(255,250,232,0.15)", background: "rgba(255,250,232,0.08)", color: B.cream, ...bfont(13, 700, "0.05em", B.cream) }} />
        </div>
      </div>

      {/* SEND TABS */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${B.gray}`, display: "flex", padding: "0 20px", gap: 0, overflowX: "auto" }}>
        {[{ n: 1, label: "Send 1 · The Provision" }, { n: 2, label: "Send 2 · The Counsel" }].map(({ n, label }) => (
          <button key={n} onClick={() => { setSend(n); setView("build"); setOpenId("subject"); }}
            style={{ background: "none", border: "none", borderBottom: send === n ? `3px solid ${B.orange}` : "3px solid transparent", padding: "13px 18px", ...bfont(13, 700, "0.15em", send === n ? B.charcoal : B.muted), cursor: "pointer", whiteSpace: "nowrap" }}>
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {["build", "preview", "html"].map(v => (
          <button key={v} onClick={() => { if (v !== "build") { generate(); } setView(v); setReaderMode(false); }}
            style={{ background: "none", border: "none", borderBottom: view === v ? `3px solid ${B.orange}` : "3px solid transparent", padding: "13px 16px", ...bfont(12, 700, "0.15em", view === v ? B.charcoal : B.muted), cursor: "pointer" }}>
            {v === "build" ? "✏️ Build" : v === "preview" ? "👁 Preview" : "</ > HTML"}
          </button>
        ))}
      </div>

      {/* BODY */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 60px" }}>

        {view === "build" && (
          <>
            <Progress sections={sections} />

            {/* Send name */}
            <div style={{ marginBottom: 14 }}>
              <Lbl>Name This Send</Lbl>
              <Inp value={sendName} onChange={setSendName} placeholder={`e.g. "May Provision" or "June Counsel — HSA"`} />
            </div>

            {/* CKM tracker for Send 2 */}
            {send === 2 && <PillarTracker history={counselHistory} />}

            <SubjectBlock data={subj} setData={setSubj} contentSummary={contentSummary} openId={openId} setOpenId={setOpenId} />

            {send === 1
              ? <Send1Form data={s1} setData={setS1} openId={openId} setOpenId={setOpenId} />
              : <Send2Form data={s2} setData={setS2} openId={openId} setOpenId={setOpenId} />
            }

            <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <OBtn onClick={() => { generate(); setView("preview"); }}>
                👁 Preview
              </OBtn>
              <OBtn onClick={() => setShowReview(true)}>
                ✓ Review Before Send
              </OBtn>
              {!allReady && <span style={{ ...font(13, 300, 0, false, B.muted) }}>Some sections incomplete — preview is still available.</span>}
            </div>
          </>
        )}

        {view === "preview" && html && (
          <div>
            {/* Reader mode toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <OBtn onClick={() => setReaderMode(r => !r)} ghost small>
                {readerMode ? "← Show Tool" : "👤 Reader View"}
              </OBtn>
              {!readerMode && (
                <>
                  <OBtn onClick={() => setShowReview(true)}>✓ Review Before Send</OBtn>
                  <OBtn onClick={() => copy(`Subject: ${subj.subject || ''}
Preview: ${subj.preview || ''}`)} ghost small>Copy Subject + Preview</OBtn>
                  <OBtn onClick={() => setView("build")} ghost small>← Back</OBtn>
                </>
              )}
              {readerMode && <span style={{ ...font(13, 300, 0, false, B.muted) }}>Reading as your audience sees it</span>}
            </div>

            {!readerMode && (subj.subject || subj.preview) && (
              <div style={{ background: "#fff", border: `1px solid ${B.gray}`, borderRadius: 4, padding: "12px 16px", marginBottom: 14 }}>
                <p style={{ ...bfont(11, 700, "0.3em", B.orange), margin: "0 0 4px 0" }}>Subject Line</p>
                <p style={{ ...font(16, 500, 0, false, B.charcoal), margin: "0 0 6px 0" }}>{subj.subject}</p>
                <p style={{ ...bfont(11, 700, "0.3em", B.muted), margin: "0 0 3px 0" }}>Preview Text</p>
                <p style={{ ...font(14, 300, 0, false, B.muted), margin: 0 }}>{subj.preview}</p>
              </div>
            )}

            <div style={{ border: readerMode ? "none" : `1px solid ${B.gray}`, borderRadius: readerMode ? 0 : 4, overflow: "hidden", boxShadow: readerMode ? "none" : "0 2px 12px rgba(0,0,0,0.06)" }}>
              {!readerMode && (
                <div style={{ background: "#e8e8e8", padding: "8px 14px", display: "flex", gap: 6, alignItems: "center" }}>
                  {["#f76732", "#dddddd", "#fffae8"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
                  <span style={{ ...font(11, 300, 0, false, B.muted), marginLeft: 6 }}>Email Preview — 600px</span>
                </div>
              )}
              <iframe srcDoc={html} style={{ width: "100%", height: readerMode ? "calc(100vh - 120px)" : 680, border: "none" }} title="Preview" />
            </div>
          </div>
        )}

        {view === "html" && html && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <OBtn onClick={() => copy(html)}>{copied ? "✓ Copied!" : "Copy All HTML"}</OBtn>
              <OBtn onClick={() => setView("build")} ghost small>← Back</OBtn>
            </div>
            <textarea readOnly value={html} rows={30}
              style={{ width: "100%", boxSizing: "border-box", padding: "12px", border: `1px solid ${B.gray}`, borderRadius: 4, fontFamily: "monospace", fontSize: 12, color: B.muted, background: "#fff", resize: "vertical" }} />
          </div>
        )}
      </div>
    </div>
  );
}
