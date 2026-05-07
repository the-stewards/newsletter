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
const STORAGE_KEY = "steward_newsletter_v7";

// ── CLAUDE API — proxied via Netlify function to avoid CORS ──────────────────
async function claude(prompt, maxTokens = 800) {
  try {
    const r = await fetch("/.netlify/functions/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error("Claude API error:", r.status, err);
      return "";
    }
    const d = await r.json();
    return d.content?.[0]?.text?.trim() || "";
  } catch (e) {
    console.error("Claude fetch error:", e);
    return "";
  }
}

// ── OG IMAGE FETCHER via Claude web_search ───────────────────────────────────
// Claude can browse URLs — we ask it to return the OG meta tags as JSON
async function fetchOG(url) {
  if (!url || !url.startsWith("http")) return null;
  try {
    const result = await claude(
      `Use your web browsing capability to visit this URL: ${url}

Then return ONLY a raw JSON object (no markdown, no explanation, no code fences) with exactly these fields from the page's HTML meta tags:
{"ogImage":"<og:image content>","ogTitle":"<og:title content>","ogDescription":"<og:description content>"}

If a field is not found, use null. Return nothing except the JSON object.`,
      400
    );
    const clean = result.replace(/```json|```/g, "").trim();
    // Find the JSON object even if there's extra text
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (e) {
    console.error("fetchOG error:", e);
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

// ── SHARED HISTORY (localStorage — same origin = shared on Netlify) ───────────
async function sharedGet(key) {
  try { const v = localStorage.getItem("shared_" + key); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function sharedSet(key, value) {
  try { localStorage.setItem("shared_" + key, JSON.stringify(value)); } catch {}
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
function Txta({ value, onChange, placeholder, rows = 3 }) {
  const len = (value || "").split(/\s+/).filter(Boolean).length;
  return (
    <div style={{ position: "relative" }}>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        style={{ width: "100%", boxSizing: "border-box", padding: "8px 11px", border: `1px solid ${B.gray}`, borderRadius: 3, ...font(15, 300, 0, false, B.charcoal), background: "#fff", outline: "none", resize: "vertical" }} />
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

// Fetch button with loading state — used for all OG pulls
function FetchBtn({ url, onResult, label = "⚡ Fetch" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const go = async () => {
    if (!url) return;
    setLoading(true); setError(false);
    const og = await fetchOG(url);
    if (og) { onResult(og); }
    else { setError(true); }
    setLoading(false);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <OBtn onClick={go} disabled={loading || !url} small>{loading ? "Fetching…" : label}</OBtn>
      {error && <span style={{ ...font(11, 300, 0, false, "#c0392b") }}>Couldn't fetch — check URL</span>}
    </div>
  );
}

// ── SECTION WRAPPER ───────────────────────────────────────────────────────────
function Section({ id, icon, label, complete, children, openId, setOpenId }) {
  const isOpen = openId === id;
  return (
    <div style={{ marginBottom: 12, border: `1px solid ${complete ? B.orange : B.gray}`, borderRadius: 4, overflow: "hidden" }}>
      <button onClick={() => setOpenId(isOpen ? null : id)}
        style={{ width: "100%", background: complete ? "rgba(247,103,50,0.06)" : "#fff", border: "none", padding: "13px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}>
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
        <span style={{ ...bfont(12, 700, "0.2em", pct === 100 ? B.orange : B.muted) }}>{done}/{sections.length} ready</span>
      </div>
      <div style={{ background: B.gray, borderRadius: 99, height: 5, overflow: "hidden" }}>
        <div style={{ background: B.orange, height: "100%", width: `${pct}%`, borderRadius: 99, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

// ── PILLAR TRACKER ────────────────────────────────────────────────────────────
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
            <div key={p} style={{ flex: 1, textAlign: "center", padding: "8px 4px", borderRadius: 3, background: isNext ? B.orange : isLast ? B.charcoal : B.gray }}>
              <p style={{ ...bfont(11, 700, "0.15em", isNext || isLast ? B.cream : B.muted), margin: "0 0 2px 0" }}>{p}</p>
              <p style={{ ...font(10, 300, 0, false, isNext || isLast ? "rgba(255,250,232,0.7)" : B.muted), margin: 0 }}>{isLast ? "Last" : isNext ? "Up next ↑" : ""}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── HISTORY PANEL ─────────────────────────────────────────────────────────────
function HistoryPanel({ history, onClose }) {
  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 340, background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)", zIndex: 100, display: "flex", flexDirection: "column" }}>
      <div style={{ background: B.charcoal, borderLeft: `4px solid ${B.orange}`, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ ...bfont(16, 700, "0.1em", B.cream), margin: 0 }}>Send History</p>
        <button onClick={onClose} style={{ background: "none", border: "none", color: B.cream, fontSize: 22, cursor: "pointer", opacity: 0.6 }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {(!history || history.length === 0) && (
          <p style={{ ...font(14, 300, 0, false, B.muted), textAlign: "center", marginTop: 40 }}>No sends yet. Complete your first send to start the log.</p>
        )}
        {(history || []).map((h, i) => (
          <div key={i} style={{ marginBottom: 10, padding: "12px 14px", border: `1px solid ${B.gray}`, borderRadius: 4, borderLeft: `3px solid ${h.send === 1 ? B.orange : B.charcoal}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
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

// ── REVIEW MODAL ──────────────────────────────────────────────────────────────
function ReviewModal({ send, data, subj, onConfirm, onClose }) {
  const s1 = send === 1;
  const checks = s1 ? [
    { label: "Subject line written", pass: !!(subj?.subject), critical: true },
    { label: "Preview text set (under 50 chars)", pass: (subj?.preview || "").length > 0 && (subj?.preview || "").length <= 50, critical: true },
    { label: "Columbus Pick — unique event", pass: !!(data?.uniqueEvents?.[0]?.name), critical: true },
    { label: "Columbus Pick — annual event", pass: !!(data?.annualEvents?.[0]?.name), critical: false },
    { label: "Recipe selected", pass: !!(data?.recipe?.title), critical: false },
    { label: "Worth Your Time filled", pass: !!(data?.worthTitle), critical: false },
    { label: "Personal closer present", pass: !!(data?.dubbImg || data?.fromUs || data?.fromFormatted), critical: true },
  ] : [
    { label: "Subject line written", pass: !!(subj?.subject), critical: true },
    { label: "Preview text set (under 50 chars)", pass: (subj?.preview || "").length > 0 && (subj?.preview || "").length <= 50, critical: true },
    { label: "CKM topic + copy generated", pass: !!(data?.ckmTopic && data?.ckmCopy), critical: true },
    { label: "Client story URL entered", pass: !!(data?.storyUrl), critical: true },
    { label: "Client story pull quote written", pass: !!(data?.storyQuote), critical: false },
    { label: "Watch This URL entered", pass: !!(data?.watchUrl), critical: false },
    { label: "Personal closer present", pass: !!(data?.dubbImg || data?.fromUs || data?.fromFormatted), critical: true },
  ];
  const criticalFails = checks.filter(c => c.critical && !c.pass);
  const allClear = criticalFails.length === 0;
  const pillarMismatch = !s1 && data?.pillar && data?.storyPillar && data?.watchPillar &&
    !(data.pillar === data.storyPillar && data.storyPillar === data.watchPillar);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(64,61,61,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 6, maxWidth: 480, width: "100%", overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ background: B.charcoal, borderLeft: `4px solid ${allClear ? B.orange : "#e53"}`, padding: "20px 24px" }}>
          <p style={{ ...bfont(11, 700, "0.3em", allClear ? B.orange : "#ff7a6e"), margin: "0 0 4px 0" }}>Review Before Send</p>
          <p style={{ ...bfont(20, 700, "0.05em", B.cream), margin: 0 }}>{allClear ? "Looking good." : `${criticalFails.length} issue${criticalFails.length > 1 ? "s" : ""} to fix`}</p>
        </div>
        <div style={{ padding: "20px 24px", maxHeight: 380, overflowY: "auto" }}>
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
                <strong>Pillar mismatch:</strong> CKM is <strong>{data?.pillar}</strong>, Story is <strong>{data?.storyPillar}</strong>, Watch is <strong>{data?.watchPillar}</strong>. Intentional?
              </p>
            </div>
          )}
        </div>
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${B.gray}`, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <OBtn onClick={onClose} ghost small>Go Back</OBtn>
          <OBtn onClick={onConfirm} disabled={!allClear}>{allClear ? "✓ Copy HTML" : "Fix Issues First"}</OBtn>
        </div>
      </div>
    </div>
  );
}

// ── SUBJECT BLOCK ─────────────────────────────────────────────────────────────
function SubjectBlock({ data, setData, contentSummary, openId, setOpenId }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const u = (k, v) => setData(d => ({ ...d, [k]: v }));
  const complete = !!(data.subject && data.preview);

  const generate = async () => {
    setLoading(true); setErr("");
    const prompt = `${VOICE}

Write three email subject lines and preview texts for The Stewards newsletter.
Goal: maximum open rate through genuine curiosity — never clickbait, always honest and deliverable.

Rules:
- Subject lines must create an unresolved open loop the reader cannot ignore
- The email content MUST resolve the curiosity — no bait and switch  
- Preview text confirms the click without resolving curiosity — 50 chars max, no period
- Feel like a text from a smart friend, not a marketing email

This send contains: ${contentSummary}

Return ONLY this exact JSON structure, nothing else, no markdown fences:
{"options":[{"subject":"...","preview":"..."},{"subject":"...","preview":"..."},{"subject":"...","preview":"..."}]}`;

    const raw = await claude(prompt, 500);
    if (!raw) { setErr("API call failed — check your Netlify environment variable VITE_ANTHROPIC_API_KEY"); setLoading(false); return; }
    try {
      const match = raw.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON found");
      const parsed = JSON.parse(match[0]);
      u("subjectOptions", parsed.options);
      u("subject", parsed.options[0].subject);
      u("preview", parsed.options[0].preview);
    } catch (e) {
      setErr("Couldn't parse response — try again");
      console.error("Subject parse error:", raw, e);
    }
    setLoading(false);
  };

  return (
    <Section id="subject" icon="📬" label="Subject Line & Preview Text" complete={complete} openId={openId} setOpenId={setOpenId}>
      <div style={{ marginBottom: 12 }}>
        <AIBtn onClick={generate} loading={loading} label="⚡ Generate Subject Lines" small={false} />
        <p style={{ ...font(12, 300, 0, false, "#aaa"), margin: "5px 0 0 0" }}>Fill content sections first for best results</p>
        {err && <p style={{ ...font(12, 300, 0, false, "#c0392b"), margin: "5px 0 0 0" }}>{err}</p>}
      </div>
      {data.subjectOptions && (
        <div style={{ marginBottom: 14 }}>
          <Lbl>Pick one</Lbl>
          {data.subjectOptions.map((opt, i) => (
            <div key={i} onClick={() => { u("subject", opt.subject); u("preview", opt.preview); }}
              style={{ padding: "10px 12px", marginBottom: 6, borderRadius: 3, border: `2px solid ${data.subject === opt.subject ? B.orange : B.gray}`, background: data.subject === opt.subject ? "rgba(247,103,50,0.06)" : "#fff", cursor: "pointer" }}>
              <p style={{ ...bfont(13, 700, "0.15em", B.charcoal), margin: "0 0 3px 0" }}>{opt.subject}</p>
              <p style={{ ...font(12, 300, 0, false, B.muted), margin: 0 }}>{opt.preview}</p>
            </div>
          ))}
        </div>
      )}
      <Field label="Subject Line">
        <Inp value={data.subject || ""} onChange={v => u("subject", v)} placeholder="Your subject line..." />
      </Field>
      <Field label="Preview Text — 50 chars max">
        <div style={{ position: "relative" }}>
          <Inp value={data.preview || ""} onChange={v => u("preview", v)} placeholder="Preview text..." />
          <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", ...font(11, 300, 0, false, (data.preview || "").length > 50 ? "red" : "#bbb") }}>
            {(data.preview || "").length}/50
          </span>
        </div>
      </Field>
    </Section>
  );
}

// ── EVENT GROUP with OG fetch per event ───────────────────────────────────────
function EventGroup({ events, setEvents, label }) {
  const [fetching, setFetching] = useState({});
  const update = (i, field, val) => setEvents(ev => { const a = [...ev]; a[i] = { ...a[i], [field]: val }; return a; });
  const add = () => setEvents(ev => [...ev, { name: "", date: "", desc: "", url: "", img: "" }]);
  const remove = (i) => setEvents(ev => ev.filter((_, idx) => idx !== i));

  const fetchEvent = async (i, url) => {
    if (!url) return;
    setFetching(f => ({ ...f, [i]: true }));
    const og = await fetchOG(url);
    if (og) {
      update(i, "img", og.ogImage || "");
      if (og.ogTitle && !events[i].name) update(i, "name", og.ogTitle);
      if (og.ogDescription && !events[i].desc) update(i, "desc", og.ogDescription);
    }
    setFetching(f => ({ ...f, [i]: false }));
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ ...bfont(12, 700, "0.2em", B.charcoal), margin: "0 0 8px 0", borderBottom: `1px solid ${B.gray}`, paddingBottom: 6 }}>{label}</p>
      {events.map((ev, i) => (
        <div key={i} style={{ background: "#fff", border: `1px solid ${B.gray}`, borderRadius: 3, padding: 10, marginBottom: 8 }}>
          {i === 0 && <p style={{ ...font(11, 300, 0, false, B.orange), margin: "0 0 6px 0" }}>★ Hero image — fetched from URL below</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
            <div><Lbl>Name</Lbl><Inp value={ev.name} onChange={v => update(i, "name", v)} placeholder="Event name" /></div>
            <div><Lbl>Date</Lbl><Inp value={ev.date} onChange={v => update(i, "date", v)} placeholder="May 15" /></div>
          </div>
          <div style={{ marginBottom: 6 }}><Lbl>Description</Lbl><Inp value={ev.desc} onChange={v => update(i, "desc", v)} placeholder="One line" /></div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 6 }}>
            <div style={{ flex: 1 }}><Lbl>URL</Lbl><Inp value={ev.url} onChange={v => update(i, "url", v)} placeholder="https://" /></div>
            <OBtn small onClick={() => fetchEvent(i, ev.url)} disabled={fetching[i] || !ev.url}>{fetching[i] ? "…" : "⚡ Fetch"}</OBtn>
            {i > 0 && <button onClick={() => remove(i)} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 20, paddingBottom: 6 }}>×</button>}
          </div>
          {ev.img && <img src={ev.img} alt={ev.name} style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 3 }} />}
        </div>
      ))}
      {events.length < 3 && <OBtn onClick={add} small ghost>+ Add Event</OBtn>}
    </div>
  );
}

// ── NYT REMIX ─────────────────────────────────────────────────────────────────
const NYT = [
  { title: "Sheet-Pan Lemon Chicken with Potatoes", source: "NYT Cooking", url: "https://cooking.nytimes.com", img: "https://images.unsplash.com/photo-1598103442097-8b74394b95c4?w=600&q=80" },
  { title: "One-Pot Pasta with Burst Tomatoes", source: "NYT Cooking", url: "https://cooking.nytimes.com", img: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80" },
  { title: "Classic Beef Chili", source: "NYT Cooking", url: "https://cooking.nytimes.com", img: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80" },
  { title: "Weeknight Roast Salmon", source: "NYT Cooking", url: "https://cooking.nytimes.com", img: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&q=80" },
  { title: "Homemade Pizza with Any Toppings", source: "NYT Cooking", url: "https://cooking.nytimes.com", img: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80" },
  { title: "Summer Corn Chowder", source: "NYT Cooking", url: "https://cooking.nytimes.com", img: "https://images.unsplash.com/photo-1543362906-acfc16c67564?w=600&q=80" },
];

// ── SEND 1 FORM ───────────────────────────────────────────────────────────────
function Send1Form({ data, setData, openId, setOpenId }) {
  const u = (k, v) => setData(d => ({ ...d, [k]: v }));
  const [worthLoading, setWorthLoading] = useState(false);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [fromLoading, setFromLoading] = useState(false);
  const [remixIdx, setRemixIdx] = useState(0);

  const remix = () => {
    const next = (remixIdx + 1) % NYT.length;
    setRemixIdx(next);
    u("recipe", NYT[next]);
  };

  const fetchRecipe = async () => {
    if (!data.recipe?.url) return;
    setRecipeLoading(true);
    const og = await fetchOG(data.recipe.url);
    if (og) u("recipe", { ...data.recipe, img: og.ogImage || data.recipe.img, title: og.ogTitle || data.recipe.title, desc: og.ogDescription || "" });
    setRecipeLoading(false);
  };

  const writeWorth = async () => {
    setWorthLoading(true);
    const text = await claude(`${VOICE}

Write 2-3 warm sentences introducing this to our newsletter readers.
Type: ${data.worthType}. Title: "${data.worthTitle}". Why it caught our eye: "${data.worthWhy}". URL: ${data.worthUrl || "not provided"}.
Personal and warm like a friend recommending something. No CTA, no sales language. Return only the copy — no labels, no intro.`);
    if (text) u("worthCopy", text);
    setWorthLoading(false);
  };

  const writeFrom = async () => {
    setFromLoading(true);
    const text = await claude(`${VOICE}

Write a warm personal closing paragraph (3-4 sentences) for "From Ryan & Chris."
Raw thought from Ryan or Chris: "${data.fromUs}"
Make it human and personal, not corporate. Do not include a sign-off line — that is added separately.
Return only the paragraph — no labels, no intro.`);
    if (text) u("fromFormatted", text);
    setFromLoading(false);
  };

  const uEvents = (k) => (fn) => setData(d => ({ ...d, [k]: fn(d[k] || [{ name: "", date: "", desc: "", url: "", img: "" }]) }));

  const columbusReady = !!(data.uniqueEvents?.[0]?.name && data.annualEvents?.[0]?.name);
  const recipeReady = !!(data.recipe?.title);
  const worthReady = !!(data.worthTitle && (data.worthCopy || data.worthWhy));
  const closerReady = !!(data.dubbImg || data.fromUs || data.fromFormatted);

  return (
    <>
      <Section id="columbus" icon="📍" label="1 · Columbus Pick" complete={columbusReady} openId={openId} setOpenId={setOpenId}>
        <EventGroup events={data.uniqueEvents || [{ name: "", date: "", desc: "", url: "", img: "" }]} setEvents={uEvents("uniqueEvents")} label="Unique This Month" />
        <EventGroup events={data.annualEvents || [{ name: "", date: "", desc: "", url: "", img: "" }]} setEvents={uEvents("annualEvents")} label="Annual Favorites" />
        <p style={{ ...font(12, 300, 0, false, B.muted), margin: "4px 0 0 0" }}>Sources: Columbus Underground · Experience Columbus</p>
      </Section>

      <Section id="worth" icon="👀" label="2 · Worth Your Time" complete={worthReady} openId={openId} setOpenId={setOpenId}>
        <Field label="Type"><Sel value={data.worthType || "Podcast"} onChange={v => u("worthType", v)} options={WORTH_TYPES} /></Field>
        <Field label="Title / Name"><Inp value={data.worthTitle || ""} onChange={v => u("worthTitle", v)} placeholder="Title or name" /></Field>
        <Field label="Why it caught your eye"><Inp value={data.worthWhy || ""} onChange={v => u("worthWhy", v)} placeholder="One line — be specific" /></Field>
        <Field label="URL (if applicable)"><Inp value={data.worthUrl || ""} onChange={v => u("worthUrl", v)} placeholder="https://" /></Field>
        <div style={{ marginBottom: 10 }}>
          <AIBtn onClick={writeWorth} loading={worthLoading} label="✍️ Write the copy for me" />
        </div>
        {data.worthCopy && (
          <Field label="Edit copy before sending">
            <Txta value={data.worthCopy} onChange={v => u("worthCopy", v)} rows={4} />
          </Field>
        )}
      </Section>

      <Section id="recipe" icon="🍽" label="3 · From the Table — Recipe" complete={recipeReady} openId={openId} setOpenId={setOpenId}>
        <Field label="Recipe URL — paste first, then fetch">
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1 }}>
              <Inp value={data.recipe?.url || ""} onChange={v => u("recipe", { ...data.recipe, url: v })} placeholder="https://cooking.nytimes.com/recipes/..." />
            </div>
            <OBtn small onClick={fetchRecipe} disabled={recipeLoading || !data.recipe?.url}>{recipeLoading ? "…" : "⚡ Fetch"}</OBtn>
          </div>
        </Field>
        {data.recipe?.img && <img src={data.recipe.img} alt={data.recipe.title || "Recipe"} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 3, marginBottom: 8 }} />}
        <Field label="Recipe Title"><Inp value={data.recipe?.title || ""} onChange={v => u("recipe", { ...data.recipe, title: v })} placeholder="Auto-filled from fetch, or type manually" /></Field>
        <Field label="Source"><Inp value={data.recipe?.source || "NYT Cooking"} onChange={v => u("recipe", { ...data.recipe, source: v })} placeholder="NYT Cooking" /></Field>
        {data.recipe?.desc && <Field label="Description"><Txta value={data.recipe.desc} onChange={v => u("recipe", { ...data.recipe, desc: v })} rows={2} /></Field>}
        <div style={{ marginTop: 4 }}>
          <OBtn onClick={remix} small ghost>🔀 Remix from NYT instead</OBtn>
        </div>
      </Section>

      <Section id="closer1" icon="🎥" label="4 · Video Diary or Written Closer" complete={closerReady} openId={openId} setOpenId={setOpenId}>
        <div style={{ background: "#fff", border: `1px solid ${B.gray}`, borderRadius: 3, padding: 10, marginBottom: 14 }}>
          <p style={{ ...font(13, 300, 0, false, B.muted), margin: 0, fontStyle: "italic" }}>Record a Dubb video this month? Paste the link and fetch. No video? Write the closer instead. Never both.</p>
        </div>
        <Field label="Dubb Video URL">
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1 }}>
              <Inp value={data.dubbUrl || ""} onChange={v => u("dubbUrl", v)} placeholder="https://ryan-miracle.dubb.com/v/..." />
            </div>
            <FetchBtn url={data.dubbUrl} label="⚡ Fetch GIF" onResult={og => { if (og.ogImage) u("dubbImg", og.ogImage); if (og.ogTitle) u("dubbTitle", og.ogTitle); }} />
          </div>
        </Field>
        {data.dubbImg && (
          <>
            <img src={data.dubbImg} alt={data.dubbTitle || "Video from Ryan and Chris"} style={{ width: "100%", borderRadius: 3, marginBottom: 8 }} />
            <Field label="Caption (optional)"><Inp value={data.dubbCaption || ""} onChange={v => u("dubbCaption", v)} placeholder="One line — what this video is about" /></Field>
          </>
        )}
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
            <Field label="Your 3–4 sentences — raw is fine">
              <Txta value={data.fromUs || ""} onChange={v => u("fromUs", v)} placeholder="Write here then let AI format it…" rows={4} />
            </Field>
            <div style={{ marginBottom: 10 }}>
              <AIBtn onClick={writeFrom} loading={fromLoading} label="✍️ Format in Stewards voice" />
            </div>
            {data.fromFormatted && (
              <Field label="Edit formatted copy">
                <Txta value={data.fromFormatted} onChange={v => u("fromFormatted", v)} rows={4} />
              </Field>
            )}
          </>
        )}
      </Section>
    </>
  );
}

// ── SEND 2 FORM ───────────────────────────────────────────────────────────────
function Send2Form({ data, setData, openId, setOpenId }) {
  const u = (k, v) => setData(d => ({ ...d, [k]: v }));
  const [ckmLoading, setCkmLoading] = useState(false);
  const [fromLoading, setFromLoading] = useState(false);

  const writeCKM = async () => {
    setCkmLoading(true);
    const text = await claude(`${VOICE}

Write a clear practical explanation of this financial topic for elder millennials (30s-40s) with families.
Write three flowing paragraphs — no bullet points, no headers:
1. What it is — plain English, 2-3 sentences
2. Why it matters at their life stage — 2-3 sentences  
3. Practical ways to use it — specific and actionable, 3-4 sentences

Pillar: ${data.pillar}. Topic: "${data.ckmTopic}". Context: "${data.ckmBrief || "none provided"}".
Under 200 words total. Return only the three paragraphs — no labels, no intro.`);
    if (text) u("ckmCopy", text);
    setCkmLoading(false);
  };

  const writeFrom = async () => {
    setFromLoading(true);
    const text = await claude(`${VOICE}

Write a warm personal closing paragraph (3-4 sentences) for "From Ryan & Chris."
Raw thought: "${data.fromUs}"
Human, not corporate. No sign-off line. Return only the paragraph.`);
    if (text) u("fromFormatted", text);
    setFromLoading(false);
  };

  const ckmReady = !!(data.ckmTopic && data.ckmCopy);
  const storyReady = !!(data.storyUrl && data.storyQuote);
  const watchReady = !!(data.watchUrl && data.watchQuote);
  const closerReady = !!(data.dubbImg || data.fromUs || data.fromFormatted);

  return (
    <>
      <Section id="ckm" icon="📊" label="1 · Create · Keep · Multiply" complete={ckmReady} openId={openId} setOpenId={setOpenId}>
        <Field label="Pillar"><Sel value={data.pillar || "Keep"} onChange={v => u("pillar", v)} options={PILLARS} /></Field>
        <Field label="Topic / Financial Tool"><Inp value={data.ckmTopic || ""} onChange={v => u("ckmTopic", v)} placeholder="e.g. HSA for Retirement" /></Field>
        <Field label="One-line brief for AI" hint="Any context, angle, or specific point you want covered"><Inp value={data.ckmBrief || ""} onChange={v => u("ckmBrief", v)} placeholder="e.g. Focus on the contribution limits and triple tax benefit" /></Field>
        <div style={{ marginBottom: 10 }}>
          <AIBtn onClick={writeCKM} loading={ckmLoading} label="✍️ Write this section" small={false} />
        </div>
        {data.ckmCopy && (
          <Field label="Edit copy">
            <Txta value={data.ckmCopy} onChange={v => u("ckmCopy", v)} rows={7} />
          </Field>
        )}
        <p style={{ ...font(12, 300, 0, false, "#aaa"), margin: "4px 0 0 0" }}>Legal disclaimer added automatically in the email.</p>
      </Section>

      <Section id="story" icon="📁" label="2 · Client Story" complete={storyReady} openId={openId} setOpenId={setOpenId}>
        <Field label="Blog Post URL — paste then fetch">
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1 }}>
              <Inp value={data.storyUrl || ""} onChange={v => u("storyUrl", v)} placeholder="https://stewards.loan/blog/..." />
            </div>
            <FetchBtn url={data.storyUrl} onResult={og => { if (og.ogImage) u("storyImg", og.ogImage); if (og.ogTitle) u("storyTitle", og.ogTitle); if (og.ogDescription) u("storyDesc", og.ogDescription); }} />
          </div>
        </Field>
        {data.storyImg && <img src={data.storyImg} alt={data.storyTitle || "Case study"} style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 3, marginBottom: 8 }} />}
        {data.storyTitle && <p style={{ ...bfont(13, 700, "0.1em", B.charcoal), margin: "0 0 10px 0" }}>{data.storyTitle}</p>}
        <Field label="Pillar"><Sel value={data.storyPillar || "Keep"} onChange={v => u("storyPillar", v)} options={PILLARS} /></Field>
        <Field label="Read Time"><Inp value={data.storyReadTime || ""} onChange={v => u("storyReadTime", v)} placeholder="5 minute read" /></Field>
        <Field label="Pull Quote" hint="One sentence that creates curiosity — the hook that makes them click">
          <Txta value={data.storyQuote || ""} onChange={v => u("storyQuote", v)} rows={2} />
        </Field>
      </Section>

      <Section id="watch" icon="▶️" label="3 · Watch This" complete={watchReady} openId={openId} setOpenId={setOpenId}>
        <Field label="Video URL — paste then fetch">
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1 }}>
              <Inp value={data.watchUrl || ""} onChange={v => u("watchUrl", v)} placeholder="https://youtube.com/watch?v=..." />
            </div>
            <FetchBtn url={data.watchUrl} onResult={og => { if (og.ogImage) u("watchImg", og.ogImage); if (og.ogTitle) u("watchTitle", og.ogTitle); }} />
          </div>
        </Field>
        {data.watchImg && <img src={data.watchImg} alt={data.watchTitle || "Video"} style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 3, marginBottom: 8 }} />}
        {data.watchTitle && <p style={{ ...bfont(13, 700, "0.1em", B.charcoal), margin: "0 0 10px 0" }}>{data.watchTitle}</p>}
        <Field label="Pillar"><Sel value={data.watchPillar || "Create"} onChange={v => u("watchPillar", v)} options={PILLARS} /></Field>
        <Field label="Watch Time"><Inp value={data.watchTime || ""} onChange={v => u("watchTime", v)} placeholder="12 minute watch" /></Field>
        <Field label="Hook / Pull Quote" hint="One line that makes them want to watch">
          <Txta value={data.watchQuote || ""} onChange={v => u("watchQuote", v)} rows={2} />
        </Field>
      </Section>

      <Section id="closer2" icon="🎥" label="4 · Video Diary or Written Closer" complete={closerReady} openId={openId} setOpenId={setOpenId}>
        <div style={{ background: "#fff", border: `1px solid ${B.gray}`, borderRadius: 3, padding: 10, marginBottom: 14 }}>
          <p style={{ ...font(13, 300, 0, false, B.muted), margin: 0, fontStyle: "italic" }}>Record a Dubb video? Paste the link and fetch. No video? Write the closer instead. Never both.</p>
        </div>
        <Field label="Dubb Video URL">
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1 }}>
              <Inp value={data.dubbUrl || ""} onChange={v => u("dubbUrl", v)} placeholder="https://ryan-miracle.dubb.com/v/..." />
            </div>
            <FetchBtn url={data.dubbUrl} label="⚡ Fetch GIF" onResult={og => { if (og.ogImage) u("dubbImg", og.ogImage); if (og.ogTitle) u("dubbTitle", og.ogTitle); }} />
          </div>
        </Field>
        {data.dubbImg && (
          <>
            <img src={data.dubbImg} alt={data.dubbTitle || "Video"} style={{ width: "100%", borderRadius: 3, marginBottom: 8 }} />
            <Field label="Caption (optional)"><Inp value={data.dubbCaption || ""} onChange={v => u("dubbCaption", v)} placeholder="One line — what this video is about" /></Field>
          </>
        )}
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
            <Field label="Your 3–4 sentences">
              <Txta value={data.fromUs || ""} onChange={v => u("fromUs", v)} rows={4} />
            </Field>
            <div style={{ marginBottom: 10 }}>
              <AIBtn onClick={writeFrom} loading={fromLoading} label="✍️ Format in Stewards voice" />
            </div>
            {data.fromFormatted && (
              <Field label="Edit formatted copy">
                <Txta value={data.fromFormatted} onChange={v => u("fromFormatted", v)} rows={4} />
              </Field>
            )}
          </>
        )}
      </Section>
    </>
  );
}

// ── HTML GENERATORS ───────────────────────────────────────────────────────────
const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700&family=Frank+Ruhl+Libre:wght@300;400;500&display=swap" rel="stylesheet">`;
const EYEBROW = `<tr><td style="padding:14px 40px;background:#403d3d;text-align:center;"><p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(255,250,232,0.4);margin:0;">The Stewards &middot; Ryan Miracle NMLS #497698 &middot; Chris Beal NMLS #514071 &middot; Ruoff Mortgage &middot; Columbus, Ohio</p></td></tr>`;

const CTA = `<tr><td style="padding:36px 40px;text-align:center;background:#fffae8;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 8px 0;">Questions? Life Changes? Just Want to Talk?</p>
  <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:28px;line-height:1.05;text-transform:uppercase;color:#403d3d;margin:0 0 20px 0;">We're One <span style="color:#f76732;">Message</span> Away</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding-bottom:12px;">
      <a href="mailto:Stewards@ruoff.com?subject=I%27d%20like%20to%20talk&body=Hi%20Ryan%20and%20Chris%2C%20I%27d%20like%20to%20talk%20about%20"
        style="display:inline-block;background:#403d3d;color:#fffae8;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;letter-spacing:0.15em;text-transform:uppercase;padding:14px 40px;text-decoration:none;min-width:220px;">
        &#9993;&nbsp; Email Ryan &amp; Chris
      </a>
    </td></tr>
    <tr><td align="center">
      <a href="sms:+16147675273&amp;body=Hi%20Chris%20and%20Ryan%2C%20we%20need%20to%20talk%20about%20"
        style="display:inline-block;background:#f76732;color:#fffae8;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;letter-spacing:0.15em;text-transform:uppercase;padding:14px 40px;text-decoration:none;min-width:220px;">
        &#128172;&nbsp; Text Ryan &amp; Chris
      </a>
    </td></tr>
  </table>
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin:14px 0 0 0;">No pitch. No pressure. Just people.</p>
</td></tr>`;

const LEGAL = (extra = "") => `<tr><td style="padding:20px 40px;border-top:1px solid #dddddd;"><p style="font-family:'Frank Ruhl Libre',serif;font-weight:400;font-size:16px;color:#555;line-height:1.75;margin:0 0 10px 0;"><span style="font-weight:500;color:#403d3d;">Ryan Miracle</span>, Senior Loan Officer, NMLS #497698<br><span style="font-weight:500;color:#403d3d;">Chris Beal</span>, Loan Officer, NMLS #514071<br>Ruoff Mortgage, 8101 N High St Suite 300, Columbus OH 43235, NMLS #141868</p><p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:15px;color:#999;line-height:1.75;margin:0;">This newsletter is for informational purposes only and does not constitute financial, legal, or mortgage advice.${extra} Equal Housing Lender.</p></td></tr>`;

function evtRows(events) {
  return (events || []).map((ev, i) => {
    if (i === 0) return `
      <tr><td style="padding-bottom:16px;">
        <a href="${ev.url || '#'}" style="display:block;text-decoration:none;margin-bottom:10px;">
          ${ev.img
            ? `<img src="${ev.img}" alt="${ev.name || 'Event'}" width="520" style="width:100%;display:block;">`
            : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#403d3d" style="padding:40px 20px;"><p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:20px;color:#fffae8;letter-spacing:0.1em;text-transform:uppercase;margin:0;">${ev.name || 'Event'}</p></td></tr></table>`
          }
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

function closerHTML(d) {
  if (d.dubbImg) return `
<tr><td style="padding:32px 40px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 6px 0;">From Ryan &amp; Chris</p>
  <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:30px;line-height:1.05;text-transform:uppercase;color:#403d3d;margin:0 0 16px 0;">A Message <span style="color:#f76732;">For You</span></h2>
  <a href="${d.dubbUrl || '#'}" style="display:block;margin-bottom:10px;">
    <img src="${d.dubbImg}" alt="${d.dubbTitle || 'Video message from Ryan and Chris'}" width="520" style="width:100%;display:block;">
  </a>
  ${d.dubbCaption ? `<p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:16px;color:#555;line-height:1.7;margin:0;">${d.dubbCaption}</p>` : ''}
</td></tr>`;
  return `
<tr><td style="padding:32px 40px;background:#403d3d;border-left:4px solid #f76732;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 8px 0;">From Ryan &amp; Chris</p>
  <p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:18px;color:rgba(255,250,232,0.85);line-height:1.75;margin:0 0 14px 0;">${d.fromFormatted || d.fromUs || ''}</p>
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,250,232,0.45);margin:0;">&mdash; Ryan &amp; Chris</p>
</td></tr>`;
}

function buildS1(d, date, subj) {
  const mo = date ? new Date(date).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "This Month";
  const recipe = d.recipe || {};
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${FONTS}</head><body style="margin:0;padding:0;background:#f5f5f0;">
<!-- Subject: ${subj?.subject || ''} | Preview: ${subj?.preview || ''} -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;"><tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fffae8;max-width:600px;">
${EYEBROW}
<tr><td style="background:#403d3d;border-left:4px solid #f76732;padding:40px 40px 32px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 8px 0;">Monthly &middot; ${mo}</p>
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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${evtRows(d.uniqueEvents)}</table>
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.25em;text-transform:uppercase;color:#403d3d;border-bottom:1px solid #dddddd;padding-bottom:6px;margin:20px 0 10px 0;">Annual Favorites</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${evtRows(d.annualEvents)}</table>
</td></tr>
<tr><td style="height:1px;background:#dddddd;"></td></tr>

<!-- WORTH YOUR TIME -->
<tr><td style="padding:32px 40px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 6px 0;">Worth Your Time</p>
  <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:30px;line-height:1.05;text-transform:uppercase;color:#403d3d;margin:0 0 14px 0;">${d.worthType || 'Something'} Worth <span style="color:#f76732;">Sharing</span></h2>
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#888;margin:0 0 8px 0;">${d.worthType || ''} &middot; ${d.worthTitle || ''}</p>
  <p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:17px;color:#555;line-height:1.75;margin:0 0 12px 0;">${d.worthCopy || d.worthWhy || ''}</p>
  ${d.worthUrl ? `<a href="${d.worthUrl}" style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;letter-spacing:0.15em;text-transform:uppercase;color:#f76732;text-decoration:none;">Check It Out &rarr;</a>` : ''}
</td></tr>
<tr><td style="height:1px;background:#dddddd;"></td></tr>

<!-- RECIPE -->
<tr><td style="padding:32px 40px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 6px 0;">From the Table</p>
  <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:30px;line-height:1.05;text-transform:uppercase;color:#403d3d;margin:0 0 16px 0;">This Month's <span style="color:#f76732;">Recipe</span></h2>
  ${recipe.img
    ? `<a href="${recipe.url || '#'}" style="display:block;margin-bottom:12px;"><img src="${recipe.img}" alt="${recipe.title || 'Recipe'}" width="520" style="width:100%;display:block;"></a>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;"><tr><td align="center" bgcolor="#403d3d" style="padding:40px 20px;"><p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px;color:#fffae8;text-transform:uppercase;letter-spacing:0.1em;margin:0;">Recipe Image</p></td></tr></table>`
  }
  <a href="${recipe.url || '#'}" style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:20px;color:#403d3d;text-decoration:none;display:block;margin-bottom:3px;">${recipe.title || ''}</a>
  <p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:15px;color:#888;margin:0 0 8px 0;">Via ${recipe.source || 'NYT Cooking'}</p>
  ${recipe.desc ? `<p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:16px;color:#555;line-height:1.7;margin:0;">${recipe.desc}</p>` : ''}
</td></tr>
<tr><td style="height:1px;background:#dddddd;"></td></tr>

${closerHTML(d)}
${CTA}
${LEGAL()}
</table></td></tr></table></body></html>`;
}

function buildS2(d, date, subj) {
  const mo = date ? new Date(date).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "This Month";
  const pbg = PILLAR_BG[d.pillar] || B.charcoal;
  const sbg = PILLAR_BG[d.storyPillar] || B.charcoal;
  const wbg = PILLAR_BG[d.watchPillar] || B.charcoal;
  const ckmBody = (d.ckmCopy || "").split(/\n\n+/).map(p => `<p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:17px;color:#555;line-height:1.75;margin:0 0 14px 0;">${p.replace(/\n/g, ' ')}</p>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${FONTS}</head><body style="margin:0;padding:0;background:#f5f5f0;">
<!-- Subject: ${subj?.subject || ''} | Preview: ${subj?.preview || ''} -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;"><tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fffae8;max-width:600px;">
${EYEBROW}
<tr><td style="background:#403d3d;border-left:4px solid #f76732;padding:40px 40px 32px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 8px 0;">Monthly &middot; ${mo}</p>
  <h1 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:52px;line-height:1.05;letter-spacing:-0.01em;text-transform:uppercase;color:#fffae8;margin:0 0 10px 0;">The Stewards' <span style="color:#f76732;">Counsel</span></h1>
  <hr style="border:none;border-top:2px solid #f76732;width:60px;margin:0 0 14px 0;">
  <p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:17px;color:rgba(255,250,232,0.7);line-height:1.75;margin:0;">Wisdom. Clarity. Counsel for the decisions that matter most.</p>
</td></tr>
<tr><td style="height:1px;background:#dddddd;"></td></tr>

<!-- CKM -->
<tr><td style="padding:32px 40px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 6px 0;">Create &middot; Keep &middot; Multiply</p>
  <span style="display:inline-block;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#fffae8;background:${pbg};padding:3px 10px;border-radius:2px;margin-bottom:10px;">${d.pillar || 'Keep'}</span>
  <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:30px;line-height:1.05;text-transform:uppercase;color:#403d3d;margin:0 0 14px 0;"><span style="color:#f76732;">${(d.ckmTopic || 'This Month').split(' ')[0]}</span> ${(d.ckmTopic || '').split(' ').slice(1).join(' ')}</h2>
  ${ckmBody}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="#403d3d" style="background:#403d3d;border-left:4px solid #f76732;padding:12px 16px;"><p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:14px;color:rgba(255,250,232,0.55);line-height:1.7;margin:0;">We&rsquo;re not attorneys or financial advisors &mdash; always consult a qualified professional before making financial decisions.</p></td></tr></table>
</td></tr>
<tr><td style="height:1px;background:#dddddd;"></td></tr>

<!-- CLIENT STORY -->
<tr><td style="padding:32px 40px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 6px 0;">Client Story</p>
  <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:30px;line-height:1.05;text-transform:uppercase;color:#403d3d;margin:0 0 14px 0;">Real People. Real <span style="color:#f76732;">Outcomes.</span></h2>
  ${d.storyImg
    ? `<a href="${d.storyUrl || '#'}" style="display:block;margin-bottom:14px;"><img src="${d.storyImg}" alt="${d.storyTitle || 'Case study'}" width="520" style="width:100%;display:block;"></a>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;"><tr><td align="center" bgcolor="#403d3d" style="padding:40px 20px;"><p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;color:#fffae8;text-transform:uppercase;letter-spacing:0.1em;margin:0;">Case Study Image</p></td></tr></table>`
  }
  <span style="display:inline-block;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#fffae8;background:${sbg};padding:3px 10px;border-radius:2px;margin-bottom:8px;">${d.storyPillar || 'Keep'}</span>
  ${d.storyReadTime ? `<p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#888;margin:0 0 8px 0;">${d.storyReadTime}</p>` : ''}
  ${d.storyQuote ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;"><tr><td style="border-left:3px solid #f76732;padding:8px 14px;"><p style="font-family:'Frank Ruhl Libre',serif;font-weight:400;font-size:17px;color:#403d3d;line-height:1.7;margin:0;font-style:italic;">&ldquo;${d.storyQuote}&rdquo;</p></td></tr></table>` : ''}
  <a href="${d.storyUrl || '#'}" style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:18px;color:#403d3d;text-decoration:none;display:block;margin-bottom:10px;">Read the Full Story &rarr;</a>
  <p style="font-family:'Frank Ruhl Libre',serif;font-weight:300;font-size:15px;color:#888;line-height:1.7;margin:0;">Know someone in this situation? <a href="sms:+16147675273&amp;body=Hi%20Chris%20and%20Ryan%2C%20we%20need%20to%20talk%20about%20" style="color:#f76732;text-decoration:none;font-weight:500;">Have them text us.</a></p>
</td></tr>
<tr><td style="height:1px;background:#dddddd;"></td></tr>

<!-- WATCH THIS -->
<tr><td style="padding:32px 40px;">
  <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#f76732;margin:0 0 6px 0;">Watch This</p>
  <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:30px;line-height:1.05;text-transform:uppercase;color:#403d3d;margin:0 0 14px 0;">Worth Your <span style="color:#f76732;">Time</span></h2>
  ${d.watchImg
    ? `<a href="${d.watchUrl || '#'}" style="display:block;margin-bottom:14px;"><img src="${d.watchImg}" alt="${d.watchTitle || 'Video'}" width="520" style="width:100%;display:block;"></a>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;"><tr><td align="center" bgcolor="#403d3d" style="padding:40px 20px;"><p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;color:#fffae8;text-transform:uppercase;letter-spacing:0.1em;margin:0;">Video Thumbnail</p></td></tr></table>`
  }
  <span style="display:inline-block;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#fffae8;background:${wbg};padding:3px 10px;border-radius:2px;margin-bottom:8px;">${d.watchPillar || 'Create'}</span>
  ${d.watchTime ? `<p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#888;margin:0 0 8px 0;">${d.watchTime}</p>` : ''}
  ${d.watchQuote ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;"><tr><td style="border-left:3px solid #f76732;padding:8px 14px;"><p style="font-family:'Frank Ruhl Libre',serif;font-weight:400;font-size:17px;color:#403d3d;line-height:1.7;margin:0;font-style:italic;">&ldquo;${d.watchQuote}&rdquo;</p></td></tr></table>` : ''}
  <a href="${d.watchUrl || '#'}" style="display:inline-block;background:#f76732;color:#fffae8;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;letter-spacing:0.15em;text-transform:uppercase;padding:10px 24px;border-radius:2px;text-decoration:none;">&#9654; Watch Now</a>
</td></tr>
<tr><td style="height:1px;background:#dddddd;"></td></tr>

${closerHTML(d)}
${CTA}
${LEGAL(" Always consult a qualified professional before making financial decisions.")}
</table></td></tr></table></body></html>`;
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [send, setSend] = usePersistedState(`${STORAGE_KEY}_send`, 1);
  const [sendDate, setSendDate] = usePersistedState(`${STORAGE_KEY}_date`, "");
  const [sendName, setSendName] = usePersistedState(`${STORAGE_KEY}_name`, "");
  const [s1, setS1] = usePersistedState(`${STORAGE_KEY}_s1`, {
    uniqueEvents: [{ name: "", date: "", desc: "", url: "", img: "" }],
    annualEvents: [{ name: "", date: "", desc: "", url: "", img: "" }]
  });
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

  useEffect(() => { sharedGet("steward_send_history").then(h => { if (h) setHistory(h); }); }, []);

  useEffect(() => {
    setSaving(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaving(false), 800);
  }, [s1, s2, subj, sendDate, send, sendName]);

  const contentSummary = send === 1
    ? `The Stewards' Provision. Events: ${(s1.uniqueEvents || []).map(e => e.name).filter(Boolean).join(", ")}. Recipe: ${s1.recipe?.title || "TBD"}. Worth Your Time: ${s1.worthType || ''} — ${s1.worthTitle || ''}.`
    : `The Stewards' Counsel. CKM: ${s2.pillar} — ${s2.ckmTopic || "TBD"}. Client story: ${s2.storyUrl || "TBD"}. Watch: ${s2.watchUrl || "TBD"}.`;

  const s1Sections = [
    !!(s1.uniqueEvents?.[0]?.name && s1.annualEvents?.[0]?.name),
    !!(s1.worthTitle && (s1.worthCopy || s1.worthWhy)),
    !!(s1.recipe?.title),
    !!(s1.dubbImg || s1.fromUs || s1.fromFormatted),
    !!(subj.subject && subj.preview),
  ];
  const s2Sections = [
    !!(s2.ckmTopic && s2.ckmCopy),
    !!(s2.storyUrl && s2.storyQuote),
    !!(s2.watchUrl && s2.watchQuote),
    !!(s2.dubbImg || s2.fromUs || s2.fromFormatted),
    !!(subj.subject && subj.preview),
  ];
  const sections = send === 1 ? s1Sections : s2Sections;

  const generate = useCallback(() => {
    const output = send === 1 ? buildS1(s1, sendDate, subj) : buildS2(s2, sendDate, subj);
    setHtml(output);
    return output;
  }, [send, s1, s2, sendDate, subj]);

  const saveToHistory = useCallback(async () => {
    const entry = {
      id: Date.now(), send,
      date: sendDate || new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      name: sendName, subject: subj.subject,
      pillar: s2.pillar, topic: s2.ckmTopic,
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
      setTimeout(() => setCopied(false), 2500);
      await saveToHistory();
      setShowReview(false);
      setView("preview");
    });
  }, [generate, saveToHistory]);

  const copy = (text) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  };

  const counselHistory = history.filter(h => h.send === 2);

  return (
    <div style={{ fontFamily: "'Frank Ruhl Libre', serif", background: "#f0ede8", minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700&family=Frank+Ruhl+Libre:wght@300;400;500&display=swap" rel="stylesheet" />

      {showReview && (
        <ReviewModal send={send} data={send === 1 ? s1 : s2} subj={subj}
          onConfirm={handleConfirmCopy} onClose={() => setShowReview(false)} />
      )}
      {showHistory && <HistoryPanel history={history} onClose={() => setShowHistory(false)} />}

      {/* TOP BAR */}
      <div style={{ background: B.charcoal, borderLeft: `4px solid ${B.orange}`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <p style={{ ...bfont(11, 700, "0.4em", B.orange), margin: "0 0 2px 0" }}>The Stewards</p>
          <h1 style={{ ...bfont(24, 700, "0.05em", B.cream), margin: 0, lineHeight: 1.05 }}>Newsletter <span style={{ color: B.orange }}>Builder</span></h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ ...font(12, 300, 0, false, saving ? "rgba(255,250,232,0.4)" : "rgba(255,250,232,0.25)") }}>{saving ? "Saving…" : "✓ Saved"}</span>
          <button onClick={() => setShowHistory(true)}
            style={{ background: "rgba(255,250,232,0.08)", border: "1px solid rgba(255,250,232,0.15)", color: B.cream, borderRadius: 3, padding: "6px 12px", ...bfont(12, 700, "0.1em", B.cream), cursor: "pointer" }}>
            📋 History {history.length > 0 && `(${history.length})`}
          </button>
          <input type="date" value={sendDate} onChange={e => setSendDate(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 3, border: "1px solid rgba(255,250,232,0.15)", background: "rgba(255,250,232,0.08)", color: B.cream, ...bfont(13, 700, "0.05em", B.cream) }} />
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${B.gray}`, display: "flex", padding: "0 20px", overflowX: "auto" }}>
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

            {send === 2 && <PillarTracker history={counselHistory} />}

            <SubjectBlock data={subj} setData={setSubj} contentSummary={contentSummary} openId={openId} setOpenId={setOpenId} />

            {send === 1
              ? <Send1Form data={s1} setData={setS1} openId={openId} setOpenId={setOpenId} />
              : <Send2Form data={s2} setData={setS2} openId={openId} setOpenId={setOpenId} />
            }

            <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <OBtn onClick={() => { generate(); setView("preview"); }}>👁 Preview</OBtn>
              <OBtn onClick={() => setShowReview(true)}>✓ Review Before Send</OBtn>
            </div>
          </>
        )}

        {view === "preview" && html && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <OBtn onClick={() => setReaderMode(r => !r)} ghost small>{readerMode ? "← Show Tool" : "👤 Reader View"}</OBtn>
              {!readerMode && (
                <>
                  <OBtn onClick={() => setShowReview(true)}>✓ Review Before Send</OBtn>
                  <OBtn onClick={() => copy(`Subject: ${subj.subject || ''}\nPreview: ${subj.preview || ''}`)} ghost small>Copy Subject + Preview</OBtn>
                  <OBtn onClick={() => setView("build")} ghost small>← Back</OBtn>
                </>
              )}
            </div>
            {!readerMode && (subj.subject || subj.preview) && (
              <div style={{ background: "#fff", border: `1px solid ${B.gray}`, borderRadius: 4, padding: "12px 16px", marginBottom: 14 }}>
                <p style={{ ...bfont(11, 700, "0.3em", B.orange), margin: "0 0 4px 0" }}>Subject Line</p>
                <p style={{ ...font(16, 500, 0, false, B.charcoal), margin: "0 0 6px 0" }}>{subj.subject}</p>
                <p style={{ ...bfont(11, 700, "0.3em", B.muted), margin: "0 0 3px 0" }}>Preview Text</p>
                <p style={{ ...font(14, 300, 0, false, B.muted), margin: 0 }}>{subj.preview}</p>
              </div>
            )}
            <div style={{ border: readerMode ? "none" : `1px solid ${B.gray}`, borderRadius: readerMode ? 0 : 4, overflow: "hidden" }}>
              {!readerMode && (
                <div style={{ background: "#e8e8e8", padding: "8px 14px", display: "flex", gap: 6, alignItems: "center" }}>
                  {["#f76732", "#dddddd", "#fffae8"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
                  <span style={{ ...font(11, 300, 0, false, B.muted), marginLeft: 6 }}>Email Preview — 600px</span>
                </div>
              )}
              <iframe srcDoc={html} style={{ width: "100%", height: readerMode ? "calc(100vh - 120px)" : 700, border: "none" }} title="Preview" />
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
