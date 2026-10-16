/**
 * @file cpmEngine.js
 * @description Critical Path Method (CPM) calculation service for project scheduling.
 * Performs forward pass, backward pass, total float, and critical path determination.
 */

/**
 * Calculates Critical Path, Early/Late dates, and Float for a set of project tasks.
 * @param {Array<Object>} tasks Array of tasks with id, duration_days (or calculated from dates), and predecessor_ids
 * @param {string|Date} [projectStartDate] Base date for calendar conversion
 * @returns {Object} { tasks: Array, projectDurationDays: number, criticalPathIds: Array<number> }
 */
export function calculateCPM(tasks = [], projectStartDate = new Date()) {
  if (!tasks || tasks.length === 0) {
    return { tasks: [], projectDurationDays: 0, criticalPathIds: [] };
  }

  const baseDate = new Date(projectStartDate);

  // Normalize tasks and build graph
  const taskMap = new Map();
  tasks.forEach((t) => {
    let duration = Number(t.duration_days);
    if (!duration || duration <= 0) {
      if (t.start_date && t.end_date) {
        const s = new Date(t.start_date);
        const e = new Date(t.end_date);
        duration = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
      } else {
        duration = 1;
      }
    }

    let preds = [];
    if (Array.isArray(t.predecessor_ids)) {
      preds = t.predecessor_ids.map(Number).filter((id) => id > 0);
    } else if (typeof t.predecessor_ids === "string") {
      preds = t.predecessor_ids
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((id) => id > 0);
    }

    taskMap.set(Number(t.id), {
      ...t,
      id: Number(t.id),
      duration,
      predecessors: preds,
      successors: [],
      es: 0,
      ef: 0,
      ls: 0,
      lf: 0,
      tf: 0,
      is_critical: 0,
    });
  });

  // Build successor links
  for (const [id, node] of taskMap.entries()) {
    node.predecessors.forEach((predId) => {
      const pred = taskMap.get(predId);
      if (pred) {
        pred.successors.push(id);
      }
    });
  }

  // Topological sorting via Kahn's algorithm
  const inDegree = new Map();
  for (const [id, node] of taskMap.entries()) {
    // Only count predecessors that actually exist in taskMap
    const validPreds = node.predecessors.filter((p) => taskMap.has(p));
    inDegree.set(id, validPreds.length);
  }

  const queue = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  const sortedOrder = [];
  while (queue.length > 0) {
    const currId = queue.shift();
    sortedOrder.push(currId);

    const currNode = taskMap.get(currId);
    for (const succId of currNode.successors) {
      inDegree.set(succId, inDegree.get(succId) - 1);
      if (inDegree.get(succId) === 0) {
        queue.push(succId);
      }
    }
  }

  // If cycle detected, fallback to original order
  const processOrder = sortedOrder.length === taskMap.size ? sortedOrder : Array.from(taskMap.keys());

  // --- FORWARD PASS (Early Start & Early Finish) ---
  for (const id of processOrder) {
    const node = taskMap.get(id);
    const validPreds = node.predecessors.filter((p) => taskMap.has(p));
    if (validPreds.length === 0) {
      node.es = 0;
    } else {
      node.es = Math.max(...validPreds.map((pid) => taskMap.get(pid).ef));
    }
    node.ef = node.es + node.duration;
  }

  // Total Project Duration is max of all early finishes
  let projectDurationDays = 0;
  for (const node of taskMap.values()) {
    if (node.ef > projectDurationDays) {
      projectDurationDays = node.ef;
    }
  }

  // --- BACKWARD PASS (Late Start & Late Finish) ---
  const reverseOrder = [...processOrder].reverse();
  for (const id of reverseOrder) {
    const node = taskMap.get(id);
    const validSuccs = node.successors.filter((s) => taskMap.has(s));
    if (validSuccs.length === 0) {
      node.lf = projectDurationDays;
    } else {
      node.lf = Math.min(...validSuccs.map((sid) => taskMap.get(sid).ls));
    }
    node.ls = node.lf - node.duration;
    node.tf = Math.max(0, node.ls - node.es);
    node.is_critical = node.tf === 0 ? 1 : 0;
  }

  // Helper to add days to Date
  const addDays = (dt, days) => {
    const res = new Date(dt);
    res.setDate(res.getDate() + days);
    return res.toISOString().split("T")[0];
  };

  const criticalPathIds = [];
  const calculatedTasks = [];

  for (const node of taskMap.values()) {
    const earlyStartDate = addDays(baseDate, node.es);
    const earlyFinishDate = addDays(baseDate, node.ef);
    const lateStartDate = addDays(baseDate, node.ls);
    const lateFinishDate = addDays(baseDate, node.lf);

    if (node.is_critical) {
      criticalPathIds.push(node.id);
    }

    calculatedTasks.push({
      ...node,
      duration_days: node.duration,
      early_start: earlyStartDate,
      early_finish: earlyFinishDate,
      late_start: lateStartDate,
      late_finish: lateFinishDate,
      total_float: node.tf,
      is_critical: node.is_critical,
    });
  }

  return {
    tasks: calculatedTasks,
    projectDurationDays,
    criticalPathIds,
  };
}
