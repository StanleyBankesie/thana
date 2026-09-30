const fs = require('fs');
let content = fs.readFileSync('./client/src/layout/AppShell.jsx', 'utf8');

if (!content.includes('import PaymentPackageModal')) {
  content = content.replace(
    'import { api } from "../api/client.js";',
    'import { api } from "../api/client.js";\nimport PaymentPackageModal from "../components/PaymentPackageModal.jsx";'
  );
}

if (!content.includes('showPaymentModal')) {
  content = content.replace(
    'const [queueOpen, setQueueOpen] = useState(false);',
    'const [queueOpen, setQueueOpen] = useState(false);\n  const [showPaymentModal, setShowPaymentModal] = useState(false);'
  );
}

if (!content.includes('checkLicense()')) {
  const alertStr = \  useEffect(() => {
    let mounted = true;

    async function checkLicense() {
      const companyId = user?.company_id || user?.companyIds?.[0];
      if (!companyId) return;

      try {
        const res = await api.get(\\\/licenses/company/\\\\);
        if (mounted && res?.data) {
          const l = res.data;
          if (l.status === "ACTIVE" || l.status === "EXPIRED") {
            const exp = new Date(l.expiry_date);
            const graceDays = l.grace_days || 0;
            const finalExp = new Date(
              exp.getTime() + graceDays * 24 * 60 * 60 * 1000,
            );
            const now = new Date();
            const daysRemaining = Math.max(
              0,
              Math.ceil((finalExp - now) / (1000 * 60 * 60 * 24)),
            );

            const alertDays = l.alert_days !== undefined && l.alert_days !== null ? l.alert_days : 30;
            if (daysRemaining <= alertDays && daysRemaining >= 0) {
              const formattedDate = new Date(l.expiry_date).toLocaleDateString();
              let title =
                daysRemaining === 0
                  ? "License Expired"
                  : "License Expiring Soon";
              let text = \\\Your license expires on \ + \ days grace period.\\\;

              Swal.fire({
                toast: false,
                backdrop: true,
                position: "center",
                title,
                icon: daysRemaining === 0 ? "error" : "warning",
                text,
                showCancelButton: true,
                confirmButtonColor: "#2563eb",
                cancelButtonColor: "#64748b",
                confirmButtonText: "Renew License",
                cancelButtonText: "Dismiss",
                width: "24em",
                timerProgressBar: true,
                showCloseButton: true,
                background: "rgba(255, 255, 255, 1)",
              }).then((result) => {
                if (result.isConfirmed) {
                  setShowPaymentModal(true);
                } else if (result.isDismissed) {
                  sessionStorage.setItem("license_alert_dismissed", "true");
                }
              });
            }
          }
        }
      } catch (err) {}
    }

    checkLicense();
    return () => {
      mounted = false;
    };
  }, [user]);

\;

  content = content.replace(
    'const [online, setOnline] = useState(',
    alertStr + '  const [online, setOnline] = useState('
  );
}

if (!content.includes('<PaymentPackageModal')) {
  content = content.replace(
    '<FloatingInstallButton />',
    '<PaymentPackageModal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} companyId={user?.company_id || user?.companyIds?.[0]} />\n      <FloatingInstallButton />'
  );
}

fs.writeFileSync('./client/src/layout/AppShell.jsx', content);
