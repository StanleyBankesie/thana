/**
 * @file cpmEngine.js
 * @description Advanced Critical Path Method (CPM) calculation service for ERP Project Management.
 * Supports:
 * - Forward Pass (Early Start ES, Early Finish EF)
 * - Backward Pass (Late Start LS, Late Finish LF)
 * - Total Float (TF) & Free Float (FF)
 * - Dependency Relationships: FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish)
 * - Lead / Lag days
 * - Working Calendar support (5-day, 6-day, 7-day)
 * - Cycle / circular dependency detection
 * - Critical Path identification and ordered sequence
 * - Forecast completion and schedule variance
 */

/**
 * Helper to add working days to a Date based on calendar type
 * @param {Date|string} startDate 
 * @param {number} workDays 
 * @param {string} calendar '5_DAY' | '6_DAY' | '7_DAY'
 * @returns {string} YYYY-MM-DD
 */
export function addWorkDays(startDate, workDays, calendar = "6_DAY") {
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];

  let added = 0;
  const target = Math.round(workDays);

  if (target <= 0) return d.toISOString().split("T")[0];

  while (added < target) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay(); // 0 is Sunday, 6 is Saturday
    if (calendar === "5_DAY") {
      if (day !== 0 && day !== 6) added++;
    } else if (calendar === "6_DAY") {
      if (day !== 0) added++; // Skip Sunday only
    } else {
      // 7_DAY continuous calendar
      added++;
    }
  }

  return d.toISOString().split("T")[0];
}

/**
 * Calculates Critical Path, Early/Late dates, Total & Free Float for a set of project activities.
 * @param {Array<Object>} tasks Array of tasks with id, duration_days, start_date, end_date, etc.
 * @param {string|Date} [projectStartDate] Base date for calendar conversion
 * @param {Array<Object>} [dependencies] Array of { task_id, predecessor_id, dependency_type, lag_days }
 * @param {Object} [options] { calendar: '5_DAY'|'6_DAY'|'7_DAY' }
 * @returns {Object} CPM calculation results
 */
export function calculateCPM(tasks = [], projectStartDate = new Date(), dependencies = [], options = {}) {
  if (!tasks || tasks.length === 0) {
    return {
      tasks: [],
      projectDurationDays: 0,
      criticalPathIds: [],
      criticalPathSequence: [],
      hasCycle: false,
      cycleTasks: [],
      forecastCompletionDate: new Date().toISOString().split("T")[0],
    };
  }

  const calendar = options.calendar || "6_DAY";
  const baseDate = new Date(projectStartDate);

  // 1. Build Task Map
  const taskMap = new Map();
  tasks.forEach((t) => {
    let duration = Number(t.duration_days);
    if (!duration || duration <= 0) {
      if (t.start_date && t.end_date) {
        const s = new Date(t.start_date);
        const e = new Date(t.end_date);
        const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
        duration = Math.max(1, diff);
      } else {
        duration = 1;
      }
    }

    taskMap.set(Number(t.id), {
      ...t,
      id: Number(t.id),
      duration: Math.max(1, Math.round(duration)),
      predecessorLinks: [], // Array of { id, type, lag }
      successorLinks: [],   // Array of { id, type, lag }
      es: 0,
      ef: 0,
      ls: 0,
      lf: 0,
      tf: 0,
      ff: 0,
      is_critical: 0,
    });
  });

  // 2. Attach Dependencies
  // A) From explicit dependencies array
  if (Array.isArray(dependencies)) {
    dependencies.forEach((dep) => {
      const succId = Number(dep.task_id);
      const predId = Number(dep.predecessor_id);
      const type = (dep.dependency_type || "FS").toUpperCase();
      const lag = Number(dep.lag_days || 0);

      if (taskMap.has(succId) && taskMap.has(predId) && succId !== predId) {
        taskMap.get(succId).predecessorLinks.push({ id: predId, type, lag });
        taskMap.get(predId).successorLinks.push({ id: succId, type, lag });
      }
    });
  }

  // B) From task.predecessor_ids or task.predecessors fallback
  tasks.forEach((t) => {
    const succId = Number(t.id);
    const node = taskMap.get(succId);
    if (!node) return;

    if (node.predecessorLinks.length === 0) {
      let rawPreds = t.predecessor_ids || t.predecessors;
      let predList = [];
      if (Array.isArray(rawPreds)) {
        predList = rawPreds;
      } else if (typeof rawPreds === "string") {
        predList = rawPreds.split(",").map((s) => s.trim()).filter(Boolean);
      }

      predList.forEach((item) => {
        let pId, type = "FS", lag = 0;
        if (typeof item === "object" && item !== null) {
          pId = Number(item.id || item.predecessor_id);
          type = (item.dependency_type || item.type || "FS").toUpperCase();
          lag = Number(item.lag_days || item.lag || 0);
        } else {
          const str = String(item).trim();
          const match = str.match(/^(\d+)(FS|SS|FF|SF)?([+-]\d+)?$/i);
          if (match) {
            pId = Number(match[1]);
            type = (match[2] || "FS").toUpperCase();
            lag = match[3] ? Number(match[3]) : 0;
          } else {
            pId = Number(str);
          }
        }

        if (pId && taskMap.has(pId) && pId !== succId) {
          node.predecessorLinks.push({ id: pId, type, lag });
          taskMap.get(pId).successorLinks.push({ id: succId, type, lag });
        }
      });
    }
  });

  // 3. Cycle Detection via Kahn's Algorithm
  const inDegree = new Map();
  for (const [id, node] of taskMap.entries()) {
    inDegree.set(id, node.predecessorLinks.length);
  }

  const queue = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const sortedOrder = [];
  while (queue.length > 0) {
    const currId = queue.shift();
    sortedOrder.push(currId);

    const currNode = taskMap.get(currId);
    for (const succ of currNode.successorLinks) {
      inDegree.set(succ.id, inDegree.get(succ.id) - 1);
      if (inDegree.get(succ.id) === 0) {
        queue.push(succ.id);
      }
    }
  }

  const hasCycle = sortedOrder.length < taskMap.size;
  const cycleTasks = hasCycle
    ? Array.from(taskMap.keys()).filter((id) => !sortedOrder.includes(id))
    : [];

  const processOrder = hasCycle ? Array.from(taskMap.keys()) : sortedOrder;

  // 4. FORWARD PASS (Early Start ES & Early Finish EF)
  for (const id of processOrder) {
    const node = taskMap.get(id);

    if (node.predecessorLinks.length === 0) {
      node.es = 0;
      node.ef = node.duration;
    } else {
      let maxES = 0;
      for (const link of node.predecessorLinks) {
        const pred = taskMap.get(link.id);
        if (!pred) continue;

        let reqES = 0;
        switch (link.type) {
          case "SS":
            reqES = pred.es + link.lag;
            break;
          case "FF":
            reqES = pred.ef + link.lag - node.duration;
            break;
          case "SF":
            reqES = pred.es + link.lag - node.duration;
            break;
          case "FS":
          default:
            reqES = pred.ef + link.lag;
            break;
        }
        if (reqES > maxES) maxES = reqES;
      }
      node.es = Math.max(0, maxES);
      node.ef = node.es + node.duration;
    }
  }

  // Project duration is max EF across all activities
  let projectDurationDays = 0;
  for (const node of taskMap.values()) {
    if (node.ef > projectDurationDays) {
      projectDurationDays = node.ef;
    }
  }

  // 5. BACKWARD PASS (Late Finish LF & Late Start LS)
  const reverseOrder = [...processOrder].reverse();
  for (const id of reverseOrder) {
    const node = taskMap.get(id);

    if (node.successorLinks.length === 0) {
      node.lf = projectDurationDays;
      node.ls = node.lf - node.duration;
    } else {
      let minLF = Infinity;
      for (const link of node.successorLinks) {
        const succ = taskMap.get(link.id);
        if (!succ) continue;

        let allowLF = Infinity;
        switch (link.type) {
          case "SS":
            allowLF = succ.ls - link.lag + node.duration;
            break;
          case "FF":
            allowLF = succ.lf - link.lag;
            break;
          case "SF":
            allowLF = succ.lf - link.lag + node.duration;
            break;
          case "FS":
          default:
            allowLF = succ.ls - link.lag;
            break;
        }
        if (allowLF < minLF) minLF = allowLF;
      }
      node.lf = Math.max(node.duration, minLF);
      node.ls = node.lf - node.duration;
    }

    // Total Float = Late Start - Early Start
    node.tf = Math.max(0, node.ls - node.es);

    // Free Float = min(succ.ES - lag) - node.EF
    if (node.successorLinks.length === 0) {
      node.ff = node.tf;
    } else {
      let minSuccES = Infinity;
      for (const link of node.successorLinks) {
        const succ = taskMap.get(link.id);
        if (!succ) continue;
        let effectiveES = succ.es - link.lag;
        if (effectiveES < minSuccES) minSuccES = effectiveES;
      }
      node.ff = Math.max(0, Math.min(node.tf, minSuccES - node.ef));
    }

    node.is_critical = node.tf === 0 ? 1 : 0;
  }

  // 6. Format Dates and Critical Path Sequence
  const criticalTasks = [];
  const calculatedTasks = [];

  for (const node of taskMap.values()) {
    const earlyStartDate = addWorkDays(baseDate, node.es, calendar);
    const earlyFinishDate = addWorkDays(baseDate, node.ef, calendar);
    const lateStartDate = addWorkDays(baseDate, node.ls, calendar);
    const lateFinishDate = addWorkDays(baseDate, node.lf, calendar);

    const taskObj = {
      ...node,
      duration_days: node.duration,
      early_start: earlyStartDate,
      early_finish: earlyFinishDate,
      late_start: lateStartDate,
      late_finish: lateFinishDate,
      total_float: node.tf,
      free_float: node.ff,
      is_critical: node.is_critical,
    };

    if (node.is_critical) {
      criticalTasks.push(taskObj);
    }
    calculatedTasks.push(taskObj);
  }

  // Sort critical path in execution sequence (by early start)
  criticalTasks.sort((a, b) => a.es - b.es);
  const criticalPathIds = criticalTasks.map((t) => t.id);

  const forecastCompletionDate = addWorkDays(baseDate, projectDurationDays, calendar);

  return {
    tasks: calculatedTasks,
    projectDurationDays,
    criticalPathIds,
    criticalPathSequence: criticalTasks,
    hasCycle,
    cycleTasks,
    forecastCompletionDate,
  };
}
