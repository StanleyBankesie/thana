import fs from 'fs';

const filePath = 'client/src/pages/modules/transport/TransportLayout.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const badRoutes = `      <Route
        path="income"
        element={
          <RoleProtectedRoute
            featureKey="TRANSPORT.INCOME"
            action="VIEW"
          >
            <TransportIncomeList />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="expenses"
        element={
          <RoleProtectedRoute
            featureKey="TRANSPORT.EXPENSES"
            action="VIEW"
          >
            <TransportExpenseList />
          </RoleProtectedRoute>
        }
      />`;

const goodRoutes = `      <Route path="income" element={<TransportIncomeList />} />
      <Route path="expenses" element={<TransportExpenseList />} />`;

content = content.replace(badRoutes, goodRoutes);

// If there's an import for RoleProtectedRoute, remove it
content = content.replace('import { RoleProtectedRoute } from "../../../auth/RoleProtectedRoute.jsx";\n', '');

fs.writeFileSync(filePath, content);
console.log("Repaired TransportLayout.jsx");
