const fs = require('fs');
let content = fs.readFileSync('./client/src/layout/AppShell.jsx', 'utf8');

// remove my useEffect
content = content.replace(/const \{ loading: permsLoading \} = usePermission\(\);\n  const isLicenseExpired = user\?\.licenseExpired;\n\n  useEffect\(\(\) => \{[\s\S]*?\}, \[isLicenseExpired, location\.pathname, canViewModule, permsLoading, navigate\]\);\n/g, '');

// remove the modal component usage
content = content.replace(/<PaymentPackageModal[\s\S]*?\/>\n/g, '');

// remove the import
content = content.replace(/import PaymentPackageModal from "\.\.\/components\/PaymentPackageModal\.jsx";\n/g, '');

// remove the state
content = content.replace(/const \[showPaymentModal, setShowPaymentModal\] = useState\(false\);\n/g, '');

fs.writeFileSync('./client/src/layout/AppShell.jsx', content);
