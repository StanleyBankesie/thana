export function calculateEmployeeSalaryComponents(components, baseSalary) {
  const componentsById = new Map(
    components.map((component) => [Number(component.id), component]),
  );
  const amounts = new Map();
  const visiting = new Set();

  const calculate = (component) => {
    if (!component)
      throw new Error("Salary component percentage basis was not found");
    const id = Number(component.id);
    if (amounts.has(id)) return amounts.get(id);
    if (visiting.has(id))
      throw new Error(
        "Salary component bases cannot contain a circular reference",
      );

    visiting.add(id);
    const value = Number(component.value || 0);
    let amount = value;
    if (String(component.calculation_type).toUpperCase() === "PERCENT") {
      const basisId = Number(component.basis_component_id || 0);
      const basis = basisId
        ? calculate(componentsById.get(basisId))
        : Number(baseSalary || 0);
      amount = (basis * value) / 100;
    }
    amount = Math.round((amount + Number.EPSILON) * 100) / 100;
    visiting.delete(id);
    amounts.set(id, amount);
    return amount;
  };

  components.forEach(calculate);
  return amounts;
}
