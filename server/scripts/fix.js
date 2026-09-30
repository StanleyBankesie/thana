const fs = require('fs');
let content = fs.readFileSync('./client/src/layout/AppShell.jsx', 'utf8');

content = content.replace(/const \{ loading: permsLoading \} = usePermission\(\);[\s\S]*?\}, \[isLicenseExpired, location\.pathname, canViewModule, permsLoading, navigate\]\);/g, '');

content = content.replace('const [queueOpen, setQueueOpen] = useState(false);', 'const [queueOpen, setQueueOpen] = useState(false);\n  const { loading: permsLoading } = usePermission();\n  const isLicenseExpired = user?.licenseExpired;\n\n  useEffect(() => {\n    if (permsLoading || !isLicenseExpired) return;\n    const hasAdminPerm = canViewModule("administration");\n    const isAllowed = \n      location.pathname === "/administration/licenses" || \n      (hasAdminPerm && location.pathname.startsWith("/administration"));\n      \n    if (!isAllowed) {\n      navigate("/administration/licenses", { replace: true });\n    }\n  }, [isLicenseExpired, location.pathname, canViewModule, permsLoading, navigate]);');

fs.writeFileSync('./client/src/layout/AppShell.jsx', content);
