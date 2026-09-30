import fs from 'fs';

const filePath = 'client/src/pages/modules/transport/TransportLayout.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const regex = /\{\s*title:\s*"Billing",[\s\S]*?\},/;

const addition = `{ 
          title: "Billing", 
          path: "/transport/billing", 
          feature_key: "billing", 
          description: "Manage transport invoices and billing",
          icon: "🧾",
          actions: [
            <ActionButton key="view" label="View" path="/transport/billing" type="outline" featureKey="transport:billing" action="view" />
          ]
        },
        { 
          title: "Transportation Income", 
          path: "/transport/income", 
          feature_key: "income", 
          description: "Manage income records",
          icon: "💵",
          actions: [
            <ActionButton key="view" label="View" path="/transport/income" type="outline" featureKey="transport:income" action="view" />
          ]
        },
        { 
          title: "Transportation Expenses", 
          path: "/transport/expenses", 
          feature_key: "expenses", 
          description: "Manage expense records",
          icon: "💸",
          actions: [
            <ActionButton key="view" label="View" path="/transport/expenses" type="outline" featureKey="transport:expenses" action="view" />
          ]
        },`;

if (!content.includes('Transportation Income')) {
  if (regex.test(content)) {
    content = content.replace(regex, addition);
    fs.writeFileSync(filePath, content);
    console.log("Successfully added dashboard cards via Regex.");
  } else {
    console.error("Could not find the target regex string to replace.");
  }
} else {
  console.log("Cards already exist.");
}
