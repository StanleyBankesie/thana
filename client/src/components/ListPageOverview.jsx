import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const STATUS_HEADER = /status|state|approval|condition/i;
const PAYMENT_HEADER = /payment|paid|settlement/i;
const NUMBER_HEADER =
  /stock|quantity|\bqty\b|capacity|odometer|mileage|progress|completion|hours|count|score|level|reserved|received|issued|used|balance/i;
const MONEY_HEADER =
  /amount|total|balance|value|cost|price|debit|credit|budget|fee|rate|salary|wage/i;
const ENTITY_HEADER =
  /item|batch|serial|customer|supplier|vehicle|driver|assignee|department|category|project|type|priority|warehouse|employee|client|branch|uom|unit|location|group/i;
const EXPIRY_HEADER =
  /expiry|expires|expiration|due date|deadline|valid until/i;
const ACTION_HEADER = /action/i;
const OVERVIEW_EXCLUDED_PATHS = [
  "/pos/sales-entry",
  "/pos/sales",
  "/pos/entry",
  "/pos/post-to-finance",
  "/pos/returns",
  "/pos/holds",
  "/pos/setup",
  "/finance/setup/finance",
  "/project-management/projects",
  "/project-management/quotations",
  "/project-management/reports",
  "/project-management/boqs",
  "/project-management/cost-control",
  "/project-management/variations",
  "/project-management/client-valuations",
  "/project-management/subcontracts",
  "/project-management/daily-reports",
  "/project-management/equipment-logs",
  "/project-management/schedule",
  "/project-management/quality-control",
  "/project-management/safety",
  "/project-management/documents",
  "/project-management/rfis",
  "/inventory/item-groups",
  "/inventory/item-group",
];

function isOverviewExcludedPath(pathname = "") {
  if (
    OVERVIEW_EXCLUDED_PATHS.some(
      (basePath) =>
        pathname === basePath || pathname.startsWith(`${basePath}/`),
    )
  ) {
    return true;
  }
  // Exclude project orders form page (/project-orders/new, /project-orders/:id)
  if (/\/project-orders\/.+/.test(pathname)) {
    return true;
  }
  if (/\/project-management\/quotations(\/.*)?/.test(pathname)) {
    return true;
  }
  // Exclude direct purchase form page (/purchase/direct-purchase/new, /purchase/direct-purchase/:id)
  if (/\/purchase\/direct-purchase\/.+/.test(pathname)) {
    return true;
  }
  return false;
}

function isFormPage(root, pathname = "") {
  if (/(?:^|\/)(?:new|create|edit|form)(?:\/|$)/i.test(pathname)) return true;

  return [...root.querySelectorAll("form")].some((form) => {
    if (form.closest("[role='dialog'], dialog, .ant-modal, .modal"))
      return false;
    const rect = form.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const fields = form.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea',
    );
    return fields.length >= 3;
  });
}

function readTableSnapshot(root) {
  const tables = [...root.querySelectorAll("table")].filter((table) => {
    const rect = table.getBoundingClientRect();
    const isInDialog = table.closest(
      "[role='dialog'], dialog, .ant-modal, .modal",
    );
    const isInFormOrExcluded = table.closest(
      "form, [data-no-overview], .no-overview",
    );
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      !isInDialog &&
      !isInFormOrExcluded &&
      table.querySelector("thead")
    );
  });

  const candidates = tables.map((table) => {
    const headerRows = [...table.querySelectorAll("thead tr")];
    const headerRow = headerRows.sort(
      (a, b) =>
        b.querySelectorAll("th").length - a.querySelectorAll("th").length,
    )[0];
    const headers = [...(headerRow?.querySelectorAll("th") || [])].map((cell) =>
      cell.innerText.trim(),
    );
    const rows = [...table.querySelectorAll("tbody tr")]
      .map((row) =>
        [...row.querySelectorAll("td")].map((cell) => cell.innerText.trim()),
      )
      .filter(
        (cells) =>
          cells.length > 0 &&
          cells.some(Boolean) &&
          !/^(loading|error|no (matching )?(records|data)|no .* found)/i.test(
            cells.join(" ").trim(),
          ),
      );
    return { headers, rows };
  });

  return candidates.sort((a, b) => b.rows.length - a.rows.length)[0] || null;
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
    value,
  );
}

function parseNumericValue(value) {
  const normalized = String(value)
    .replace(/[(),]/g, (character) => (character === "(" ? "-" : ""))
    .replace(/[^\d.-]/g, "");
  if (!normalized || normalized === "-" || normalized === ".") return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function summarizeProjectOrders(snapshot) {
  const columns = snapshot.headers.map((label, index) => ({
    label: label.trim(),
    index,
  }));
  const priorityColumn = columns.find(({ label }) => /^priority$/i.test(label));
  const projectColumn = columns.find(({ label }) => /^project$/i.test(label));
  const amountColumn = columns.find(({ label }) => /total amount/i.test(label));
  if (!priorityColumn || !projectColumn || !amountColumn) return null;

  const rows = snapshot.rows;
  const groupBy = (column) => {
    const counts = new Map();
    rows.forEach((row) => {
      const raw = row[column.index]?.trim();
      if (!raw || raw === "-" || raw === "—") return;
      const normalized = raw.toUpperCase().replace(/[_-]+/g, " ").trim();
      const label = normalized
        .toLowerCase()
        .replace(/\b\w/g, (character) => character.toUpperCase());
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([label, count]) => ({
        label,
        count,
        share: rows.length ? (count / rows.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  };

  const amounts = rows
    .map((row) => parseNumericValue(row[amountColumn.index]))
    .filter((value) => value !== null);
  const totalValue = amounts.reduce((sum, amount) => sum + amount, 0);
  const currency = rows
    .map((row) => row[amountColumn.index]?.match(/[A-Z]{3}|[$€£]/)?.[0])
    .find(Boolean);
  const formatMoney = (value) =>
    `${currency ? `${currency} ` : ""}${formatNumber(value)}`;
  const projects = rows
    .map((row) => row[projectColumn.index]?.trim())
    .filter((project) => project && project !== "-" && project !== "—");
  const uniqueProjects = new Set(
    projects.map((project) => project.toLowerCase()),
  );
  const topProject = projects.reduce((counts, project) => {
    counts.set(project, (counts.get(project) || 0) + 1);
    return counts;
  }, new Map());
  const leadingProject = [...topProject.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];

  return [
    {
      label: "Priority mix",
      value: `${formatNumber(rows.length)} orders`,
      detail: "Workload distribution across priority levels",
      breakdown: groupBy(priorityColumn),
    },
    {
      label: "Order value",
      value: formatMoney(totalValue),
      detail: `${formatMoney(amounts.length ? totalValue / amounts.length : 0)} average per order`,
    },
    {
      label: "Project workload",
      value: `${formatNumber(uniqueProjects.size)} projects`,
      detail: `${formatNumber(projects.length && uniqueProjects.size ? projects.length / uniqueProjects.size : 0)} orders per project on average${leadingProject ? ` · busiest: ${leadingProject[0]} (${leadingProject[1]})` : ""}`,
    },
  ];
}

function summarize(snapshot) {
  const projectOrderCards = summarizeProjectOrders(snapshot);
  if (projectOrderCards) return projectOrderCards;

  const rows = snapshot.rows;
  const columns = snapshot.headers
    .map((label, index) => ({ label: label.trim(), index }))
    .filter(({ label }) => label && !ACTION_HEADER.test(label));
  const isHardServicesSystemsTable =
    columns.some(({ label }) => /^system name$/i.test(label)) &&
    columns.some(({ label }) => /^system code$/i.test(label)) &&
    columns.some(({ label }) => /^category$/i.test(label));
  const cards = [];
  if (!rows.length) return [];

  const addCard = (card) => {
    if (
      cards.length < 4 &&
      !cards.some(
        ({ label }) => label.toLowerCase() === card.label.toLowerCase(),
      )
    )
      cards.push(card);
  };
  const validText = (value) => {
    const text = String(value || "").trim();
    return text && text !== "-" && text !== "—" ? text : "";
  };
  const getDistribution = (column, getValue = (value) => value) => {
    const groups = new Map();
    rows.forEach((row) => {
      const raw = validText(getValue(row[column.index] || ""));
      if (!raw) return;
      const label = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
      const key = label.toLowerCase();
      const group = groups.get(key) || { label, count: 0 };
      group.count += 1;
      groups.set(key, group);
    });
    return [...groups.values()]
      .sort((a, b) => b.count - a.count)
      .map((group) => ({
        ...group,
        share: (group.count / rows.length) * 100,
      }));
  };

  const softServicesColumns = {
    status: columns.find(({ label }) => /^status$/i.test(label)),
    signOff: columns.find(({ label }) =>
      /^supervisor sign[- ]?off$/i.test(label),
    ),
    schedule: columns.find(({ label }) =>
      /^schedule\s*\/\s*shift$/i.test(label),
    ),
  };
  if (
    softServicesColumns.status &&
    softServicesColumns.signOff &&
    softServicesColumns.schedule
  ) {
    const shiftValue = (value) => {
      const text = String(value).trim();
      const shift = text.match(
        /\b(morning|afternoon|evening|night|day|weekend|am|pm)\b/i,
      );
      if (shift) return shift[0];
      return (
        text
          .split(/\r?\n/)
          .map((part) => part.trim())
          .filter(Boolean)
          .at(-1) || text
      );
    };
    return [
      ["Status", getDistribution(softServicesColumns.status)],
      ["Supervisor Sign-off", getDistribution(softServicesColumns.signOff)],
      [
        "Schedule / Shift",
        getDistribution(softServicesColumns.schedule, shiftValue),
      ],
    ].flatMap(([label, distribution]) => {
      if (!distribution.length) return [];
      const top = distribution[0];
      return [
        {
          label,
          value: `${top.label} · ${formatNumber(top.share)}%`,
          detail: `${formatNumber(top.count)} of ${rows.length} tasks · ${distribution.length} categories`,
          breakdown: distribution.slice(0, 2),
        },
      ];
    });
  }

  // Payment mixes show both volume and share of the displayed rows.
  columns
    .filter(({ label }) => PAYMENT_HEADER.test(label))
    .forEach((column) => {
      const distribution = getDistribution(column);
      if (!distribution.length) return;
      const top = distribution[0];
      addCard({
        label: "Payment mix",
        value: `${top.label} · ${formatNumber(top.share)}%`,
        detail: `${formatNumber(top.count)} of ${rows.length} rows · ${distribution.length} observed categories`,
        breakdown: distribution.slice(0, 4),
      });
    });

  // Financial summaries are calculated from the monetary values visible in this table.
  columns
    .filter(
      ({ label }) => MONEY_HEADER.test(label) && !PAYMENT_HEADER.test(label),
    )
    .forEach((column) => {
      const values = rows
        .map((row) => parseNumericValue(row[column.index]))
        .filter((value) => value !== null);
      if (!values.length) return;
      const total = values.reduce((sum, value) => sum + value, 0);
      const average = total / values.length;
      const currency = rows
        .map((row) => row[column.index]?.match(/[A-Z]{3}|[$€£]/)?.[0])
        .find(Boolean);
      const money = (value) =>
        `${currency ? `${currency} ` : ""}${formatNumber(value)}`;
      addCard({
        label: `${column.label} analysis`,
        value: money(total),
        detail: `Total · ${money(average)} average across ${values.length} displayed values`,
      });
    });

  // Due/expiry fields produce a risk metric using only dates present in this view.
  columns
    .filter(({ label }) => EXPIRY_HEADER.test(label))
    .forEach((column) => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const soon = new Date(now);
      soon.setDate(soon.getDate() + 30);
      const dates = rows
        .map((row) => new Date(row[column.index]))
        .filter((date) => !Number.isNaN(date.getTime()));
      if (!dates.length) return;
      const overdue = dates.filter((date) => date < now).length;
      const upcoming = dates.filter(
        (date) => date >= now && date <= soon,
      ).length;
      addCard({
        label: /expiry|expiration/i.test(column.label)
          ? "Expiry risk"
          : "Due-date risk",
        value: `${formatNumber((overdue / dates.length) * 100)}% overdue`,
        detail: `${overdue} overdue · ${upcoming} due within 30 days · ${dates.length} dates analyzed`,
      });
    });

  // Numeric operational columns provide an average and range, not a bare total.
  columns
    .filter(
      ({ label }) => NUMBER_HEADER.test(label) && !MONEY_HEADER.test(label),
    )
    .forEach((column) => {
      const values = rows
        .map((row) => parseNumericValue(row[column.index]))
        .filter((value) => value !== null);
      if (!values.length) return;
      const average =
        values.reduce((sum, value) => sum + value, 0) / values.length;
      const unit = /progress|completion/i.test(column.label) ? "%" : "";
      addCard({
        label: `${column.label} profile`,
        value: `${formatNumber(average)}${unit} avg`,
        detail: `Range ${formatNumber(Math.min(...values))}–${formatNumber(Math.max(...values))}${unit} · ${values.length} displayed values`,
      });
    });

  // Business dimensions show the leading segment and its share of the list.
  columns
    .filter(
      ({ label }) =>
        ENTITY_HEADER.test(label) &&
        !(isHardServicesSystemsTable && /^category$/i.test(label)) &&
        !STATUS_HEADER.test(label) &&
        !PAYMENT_HEADER.test(label) &&
        !MONEY_HEADER.test(label),
    )
    .forEach((column) => {
      const distribution = getDistribution(column);
      if (!distribution.length) return;
      const top = distribution[0];
      addCard({
        label: `${column.label} mix`,
        value: `${top.label} · ${formatNumber(top.share)}%`,
        detail: `${distribution.length} segments · leading segment ${top.count} of ${rows.length} rows`,
        breakdown: distribution.slice(0, 4),
      });
    });

  return cards;
}

function findHeadingInsertionPoint(root) {
  const heading = [...root.querySelectorAll("h1")].find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  if (!heading) return null;

  const headingCard = heading.closest(".card");
  if (headingCard && !headingCard.querySelector("table")) return headingCard;

  let current = heading.parentElement;
  let headerRow = null;
  while (current && current !== root) {
    const containsActions = current.querySelector(
      "button, a[href], [role='button']",
    );
    const containsTable = current.querySelector("table");
    const styles = window.getComputedStyle(current);
    if (containsTable) break;
    if (
      containsActions &&
      styles.display.includes("flex") &&
      styles.flexDirection === "row"
    ) {
      headerRow = current;
    }
    current = current.parentElement;
  }
  if (headerRow) return headerRow;

  return heading.parentElement;
}

export default function ListPageOverview({ contentRef, pathname }) {
  const [cards, setCards] = useState([]);
  const [mountNode, setMountNode] = useState(null);

  useEffect(() => {
    const root = contentRef?.current;
    if (!root) return undefined;
    if (isOverviewExcludedPath(pathname) || isFormPage(root, pathname)) {
      setCards([]);
      setMountNode((current) => {
        current?.remove();
        return null;
      });
      return undefined;
    }

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const snapshot = readTableSnapshot(root);
        const nextCards = snapshot ? summarize(snapshot) : [];
        setCards((current) =>
          JSON.stringify(current) === JSON.stringify(nextCards)
            ? current
            : nextCards,
        );

        if (!snapshot) {
          setMountNode((current) => {
            current?.remove();
            return null;
          });
          return;
        }

        const insertionPoint = findHeadingInsertionPoint(root);
        if (insertionPoint?.parentElement) {
          setMountNode((current) => {
            if (current?.previousElementSibling === insertionPoint)
              return current;
            current?.remove();
            const node = document.createElement("div");
            node.className = "list-page-overview-mount";
            insertionPoint.insertAdjacentElement("afterend", node);
            return node;
          });
        }
      });
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      cancelAnimationFrame(frame);
      setMountNode((current) => {
        current?.remove();
        return null;
      });
    };
  }, [contentRef, pathname]);

  if (!cards.length || !mountNode) return null;

  return createPortal(
    <section
      className="mb-4 grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="List overview"
    >
      {cards.map((card, index) => (
        <article
          key={`${card.label}-${index}`}
          className="flex h-44 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/95"
        >
          <p
            className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            title={card.label}
          >
            {card.label}
          </p>
          <p
            className="mt-2 truncate text-xl font-bold text-slate-900 dark:text-white"
            title={card.value}
          >
            {card.value}
          </p>
          <p
            className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400"
            title={card.detail}
          >
            {card.detail}
          </p>
          {card.breakdown?.length > 0 && (
            <div className="mt-auto space-y-2 pt-3">
              {card.breakdown.slice(0, 2).map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="truncate">{item.label}</span>
                    <span className="shrink-0 tabular-nums">
                      {formatNumber(item.count)} · {formatNumber(item.share)}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.min(item.share, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      ))}
    </section>,
    mountNode,
  );
}
