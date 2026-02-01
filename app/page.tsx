"use client";

import React, { useEffect, useMemo, useState } from "react";

type Reservation = {
  id: string;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  created_at: string;
};

const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre"
];

const MIN_YEAR = 2026;
const MAX_YEAR = 2030;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function weekdayIndexMonFirst(d: Date) {
  // 0 = Monday ... 6 = Sunday
  const js = d.getDay(); // 0=Sun..6=Sat
  return (js + 6) % 7;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return !(aEnd < bStart || aStart > bEnd);
}

export default function Page() {
  const h = React.createElement;

  // Data
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  // Create
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);

  // Calendar
  const [year, setYear] = useState<number>(MIN_YEAR);
  const [month, setMonth] = useState<number>(0); // 0..11

  // Edit
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [editName, setEditName] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  async function loadReservations() {
    const res = await fetch("/api/reservations", { cache: "no-store" });
    const data = await res.json();
    setReservations(data.reservations || []);
  }

  useEffect(() => {
    loadReservations();

    // Default to current month/year if in range; otherwise MIN_YEAR Jan
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (y < MIN_YEAR) {
      setYear(MIN_YEAR);
      setMonth(0);
    } else if (y > MAX_YEAR) {
      setYear(MAX_YEAR);
      setMonth(11);
    } else {
      setYear(y);
      setMonth(m);
    }
  }, []);

  const sorted = useMemo(() => {
    return [...reservations].sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [reservations]);

  const calendarGrid = useMemo(() => {
    const first = new Date(year, month, 1);
    const startOffset = weekdayIndexMonFirst(first); // 0..6
    const dim = daysInMonth(year, month);

    // 6 weeks x 7 days = 42 cells
    const cells: { iso: string | null; label: string }[] = [];
    for (let i = 0; i < 42; i++) {
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > dim) {
        cells.push({ iso: null, label: "" });
      } else {
        const d = new Date(year, month, dayNum);
        cells.push({ iso: toIsoDate(d), label: String(dayNum) });
      }
    }
    return cells;
  }, [year, month]);

  function monthLabel() {
    return `${MONTHS_FR[month]} ${year}`;
  }

  function goPrevMonth() {
    setMessage(null);
    setEditing(null);

    setMonth((m) => {
      if (m === 0) {
        setYear((y) => {
          const ny = y - 1;
          return ny < MIN_YEAR ? MIN_YEAR : ny;
        });
        // if we hit MIN_YEAR and already Jan, stay Jan
        if (year <= MIN_YEAR) return 0;
        return 11;
      }
      return m - 1;
    });
  }

  function goNextMonth() {
    setMessage(null);
    setEditing(null);

    setMonth((m) => {
      if (m === 11) {
        setYear((y) => {
          const ny = y + 1;
          return ny > MAX_YEAR ? MAX_YEAR : ny;
        });
        // if we hit MAX_YEAR and already Dec, stay Dec
        if (year >= MAX_YEAR) return 11;
        return 0;
      }
      return m + 1;
    });
  }

  function reservationForDay(dayIso: string) {
    return sorted.find((r) => r.start_date <= dayIso && dayIso <= r.end_date) || null;
  }

  async function createReservation() {
    setMessage(null);

    if (!name || !start || !end) {
      setMessage("Merci de remplir tous les champs.");
      return;
    }
    if (end < start) {
      setMessage("La date de fin doit être après la date de début.");
      return;
    }

    const conflict = sorted.find((r) => overlaps(start, end, r.start_date, r.end_date));
    if (conflict) {
      setMessage(`Conflit avec ${conflict.name} (${conflict.start_date} → ${conflict.end_date})`);
      return;
    }

    setLoading(true);

    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, start_date: start, end_date: end })
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Erreur lors de la réservation.");
    } else {
      setName("");
      setStart("");
      setEnd("");
      setMessage("Réservation enregistrée ✅");
      await loadReservations();
    }

    setLoading(false);
  }

  function openEdit(r: Reservation) {
    setEditing(r);
    setEditName(r.name);
    setEditStart(r.start_date);
    setEditEnd(r.end_date);
    setMessage(null);
  }

  async function saveEdit() {
    if (!editing) return;

    setMessage(null);

    if (!editName || !editStart || !editEnd) {
      setMessage("Merci de remplir tous les champs d’édition.");
      return;
    }
    if (editEnd < editStart) {
      setMessage("La date de fin doit être après la date de début.");
      return;
    }

    setEditLoading(true);

    const res = await fetch("/api/reservations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        name: editName,
        start_date: editStart,
        end_date: editEnd
      })
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Erreur lors de la modification.");
    } else {
      setEditing(null);
      setMessage("Modification enregistrée ✅");
      await loadReservations();
    }

    setEditLoading(false);
  }

  async function deleteReservation() {
    if (!editing) return;

    const ok = window.confirm(
      `Supprimer la réservation de "${editing.name}" (${editing.start_date} → ${editing.end_date}) ?`
    );
    if (!ok) return;

    setMessage(null);
    setEditLoading(true);

    const res = await fetch("/api/reservations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id })
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Erreur lors de la suppression.");
    } else {
      setEditing(null);
      setMessage("Réservation supprimée ✅");
      await loadReservations();
    }

    setEditLoading(false);
  }

  function yearOptions() {
    const opts: any[] = [];
    for (let y = MIN_YEAR; y <= MAX_YEAR; y++) {
      opts.push(h("option", { key: y, value: y }, String(y)));
    }
    return opts;
  }

  function weekdayHeader() {
    const names = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    return h(
      "div",
      { className: "weekdays" },
      ...names.map((n) => h("div", { key: n, style: { textAlign: "center" } }, n))
    );
  }

  function calendarBody() {
    return h(
      "div",
      { className: "grid" },
      ...calendarGrid.map((c, idx) => {
        if (!c.iso) {
          return h("div", { key: idx, className: "cell empty" });
        }
        const r = reservationForDay(c.iso);
        const isReserved = !!r;

        return h(
          "button",
          {
            key: idx,
            onClick: () => { if (r) openEdit(r); },
            disabled: !r,
            title: r ? `${r.name} (${r.start_date} → ${r.end_date})` : "",
            className: isReserved ? "cell reserved" : "cell free"
          },
          h("div", { className: "day" }, c.label),
          r ? h("div", { className: "who" }, r.name) : null
        );
      })
    );
  }

  function reservationsList() {
    return sorted.length === 0
      ? h("p", { className: "muted" }, "Aucune réservation.")
      : h(
          "ul",
          { className: "list" },
          ...sorted.map((r) =>
            h(
              "li",
              { key: r.id },
              h(
                "button",
                { className: "link", onClick: () => openEdit(r) },
                `${r.name} — ${r.start_date} → ${r.end_date}`
              )
            )
          )
        );
  }

  function editPanel() {
    if (!editing) return null;

    return h(
      "div",
      { className: "card" },
      h("div", { className: "cardTitle" }, "Modifier une réservation"),
      h("div", { className: "row" },
        h("input", {
          value: editName,
          onChange: (e: any) => setEditName(e.target.value),
          className: "input",
          placeholder: "Nom"
        }),
        h("input", {
          type: "date",
          value: editStart,
          onChange: (e: any) => setEditStart(e.target.value),
          className: "input"
        }),
        h("input", {
          type: "date",
          value: editEnd,
          onChange: (e: any) => setEditEnd(e.target.value),
          className: "input"
        })
      ),
      h("div", { className: "row" },
        h(
          "button",
          { onClick: saveEdit, disabled: editLoading, className: "btnPrimary" },
          editLoading ? "..." : "Enregistrer"
        ),
        h(
          "button",
          { onClick: deleteReservation, disabled: editLoading, className: "btnDanger" },
          "Supprimer"
        ),
        h(
          "button",
          { onClick: () => setEditing(null), className: "btnGhost" },
          "Fermer"
        )
      )
    );
  }

  const backgroundImageDirect =
    "https://images.unsplash.com/photo-1592986471102-83f98319fe2d?auto=format&fit=crop&fm=jpg&q=80&w=2400";

  return h(
    "div",
    {
      style: {
        minHeight: "100vh",
        backgroundImage: `url("${backgroundImageDirect}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed"
      }
    },

    // a small overlay for readability
    h("div", { className: "overlay" }),

    // styles (incl. mobile)
    h("style", {
      dangerouslySetInnerHTML: {
        __html: `
          .wrap { position: relative; z-index: 1; max-width: 1180px; margin: 0 auto; padding: 18px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; color: #0b0b0b; }
          .header { margin: 10px 0 18px; }
          .title { font-size: 30px; font-weight: 900; margin: 0; letter-spacing: -0.02em; }
          .subtitle { margin-top: 6px; font-size: 16px; opacity: 0.85; }
          .overlay { position: fixed; inset: 0; background: rgba(255,255,255,0.62); backdrop-filter: blur(2px); }

          .layout { display: grid; grid-template-columns: 1.25fr 0.95fr; gap: 16px; align-items: start; }
          .card { background: rgba(255,255,255,0.92); border: 1px solid rgba(0,0,0,0.08); border-radius: 16px; padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.07); }
          .cardTitle { font-weight: 900; font-size: 18px; margin-bottom: 10px; }

          .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
          .input, select { padding: 12px 12px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.18); background: white; font-size: 16px; }
          .btnPrimary { padding: 12px 14px; border-radius: 12px; border: 1px solid #111; background: #111; color: white; font-weight: 900; cursor: pointer; }
          .btnGhost { padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.18); background: white; font-weight: 800; cursor: pointer; }
          .btnDanger { padding: 12px 14px; border-radius: 12px; border: 1px solid #e11d48; background: rgba(255,255,255,0.9); color: #e11d48; font-weight: 900; cursor: pointer; }

          .muted { opacity: 0.75; margin: 10px 0 0; }

          .calHeader { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }
          .calTitle { font-weight: 900; font-size: 18px; }
          .navBtn { padding: 12px 16px; font-size: 18px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.18); background: rgba(255,255,255,0.9); cursor: pointer; }
          .navBtn:disabled { opacity: 0.5; cursor: not-allowed; }

          .weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; font-weight: 900; margin-top: 8px; opacity: 0.8; }
          .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-top: 8px; }
          .cell { height: 74px; border-radius: 14px; padding: 10px; text-align: left; }
          .cell.empty { background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.04); }
          .cell.free { background: rgba(255,255,255,0.95); border: 1px solid rgba(0,0,0,0.10); }
          .cell.reserved { background: rgba(17,17,17,0.98); border: 1px solid rgba(17,17,17,0.98); color: white; }
          .day { font-weight: 900; }
          .who { margin-top: 6px; font-size: 12px; opacity: 0.92; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

          .list { margin: 0; padding-left: 18px; }
          .link { border: none; background: transparent; text-decoration: underline; cursor: pointer; padding: 0; font-size: 14px; }

          @media (max-width: 900px) {
            .layout { grid-template-columns: 1fr; }
            .title { font-size: 26px; }
            .cell { height: 68px; }
            .input, select { width: 100%; }
            .btnPrimary, .btnGhost, .btnDanger { width: 100%; }
            .calTitle { text-align: center; flex: 1; }
          }
        `
      }
    }),

    h(
      "div",
      { className: "wrap" },

      h("div", { className: "header" },
        h("h1", { className: "title" }, "Planning Merlet"),
        h("div", { className: "subtitle" }, "Les Hameaux de Pietragione")
      ),

      h(
        "div",
        { className: "layout" },

        // LEFT: Calendar
        h(
          "div",
          { className: "card" },
          h("div", { className: "cardTitle" }, "Calendrier"),

          // mobile-first nav
          h(
            "div",
            { className: "calHeader" },
            h(
              "button",
              {
                className: "navBtn",
                onClick: goPrevMonth,
                disabled: year === MIN_YEAR && month === 0
              },
              "◀"
            ),
            h("div", { className: "calTitle" }, monthLabel()),
            h(
              "button",
              {
                className: "navBtn",
                onClick: goNextMonth,
                disabled: year === MAX_YEAR && month === 11
              },
              "▶"
            )
          ),

          // quick year jump (optional but useful)
          h("div", { className: "row", style: { marginBottom: 6 } },
            h("select", {
              value: year,
              onChange: (e: any) => { setYear(Number(e.target.value)); setEditing(null); setMessage(null); },
            }, ...yearOptions())
          ),

          weekdayHeader(),
          calendarBody(),

          h("p", { className: "muted" },
            "Astuce : clique sur un jour réservé pour modifier / supprimer."
          )
        ),

        // RIGHT: Create + Edit + List
        h(
          "div",
          null,

          h(
            "div",
            { className: "card" },
            h("div", { className: "cardTitle" }, "Nouvelle réservation"),

            h("div", { className: "row" },
              h("input", {
                className: "input",
                placeholder: "Nom",
                value: name,
                onChange: (e: any) => setName(e.target.value)
              }),
              h("input", {
                className: "input",
                type: "date",
                value: start,
                onChange: (e: any) => setStart(e.target.value)
              }),
              h("input", {
                className: "input",
                type: "date",
                value: end,
                onChange: (e: any) => setEnd(e.target.value)
              }),
              h(
                "button",
                { className: "btnPrimary", onClick: createReservation, disabled: loading },
                loading ? "..." : "Réserver"
              )
            ),

            message ? h("p", { style: { marginTop: 10 } }, message) : null
          ),

          editing ? h("div", { style: { marginTop: 16 } }, editPanel()) : null,

          h(
            "div",
            { className: "card", style: { marginTop: 16 } },
            h("div", { className: "cardTitle" }, "Réservations"),
            reservationsList()
          )
        )
      )
    )
  );
}
