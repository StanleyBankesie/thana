import test from "node:test";
import assert from "node:assert/strict";
import { calculateEmployeeSalaryComponents } from "../utils/payrollSalaryComponents.js";

test("calculates fixed employee allowance and deduction amounts", () => {
  const amounts = calculateEmployeeSalaryComponents(
    [
      { id: 1, calculation_type: "AMOUNT", value: 500 },
      { id: 2, calculation_type: "AMOUNT", value: 75 },
    ],
    4000,
  );
  assert.equal(amounts.get(1), 500);
  assert.equal(amounts.get(2), 75);
});

test("calculates percentages of base salary and another component", () => {
  const amounts = calculateEmployeeSalaryComponents(
    [
      { id: 10, calculation_type: "AMOUNT", value: 1000 },
      {
        id: 11,
        calculation_type: "PERCENT",
        value: 10,
        basis_component_id: null,
      },
      { id: 12, calculation_type: "PERCENT", value: 5, basis_component_id: 10 },
      {
        id: 13,
        calculation_type: "PERCENT",
        value: 10,
        basis_component_id: 12,
      },
    ],
    4000,
  );
  assert.equal(amounts.get(11), 400);
  assert.equal(amounts.get(12), 50);
  assert.equal(amounts.get(13), 5);
});

test("rounds percentage results to cents", () => {
  const amounts = calculateEmployeeSalaryComponents(
    [
      {
        id: 1,
        calculation_type: "PERCENT",
        value: 10,
        basis_component_id: null,
      },
    ],
    123.456,
  );
  assert.equal(amounts.get(1), 12.35);
});

test("rejects missing and circular percentage bases", () => {
  assert.throws(
    () =>
      calculateEmployeeSalaryComponents(
        [
          {
            id: 1,
            calculation_type: "PERCENT",
            value: 10,
            basis_component_id: 99,
          },
        ],
        1000,
      ),
    /basis was not found/,
  );
  assert.throws(
    () =>
      calculateEmployeeSalaryComponents(
        [
          {
            id: 1,
            calculation_type: "PERCENT",
            value: 10,
            basis_component_id: 2,
          },
          {
            id: 2,
            calculation_type: "PERCENT",
            value: 10,
            basis_component_id: 1,
          },
        ],
        1000,
      ),
    /circular reference/,
  );
});
