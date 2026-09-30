import React from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  Lock,
  FileText,
  ArrowLeft,
  Database,
  Globe,
  HardDrive,
  Users,
} from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        {/* Header Section */}
        <div className="bg-brand-900 px-8 py-14 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-900 to-brand-900 opacity-90"></div>

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="bg-brand-600/10 p-4 rounded-full mb-6">
              <Shield className="w-12 h-12 text-amber-400" />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-slate-300 text-lg max-w-2xl font-medium">
              How we collect, use, and protect your enterprise data across the
              OmniSuite ERP platform.
            </p>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-8 md:p-12 max-w-none">
          <div className="mb-10">
            <Link
              to="/login"
              className="inline-flex items-center text-amber-600 hover:text-amber-700 font-semibold transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Link>
          </div>

          <div className="space-y-12">
            {/* Section 1 */}
            <section>
              <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-3 mb-5 flex items-center gap-3">
                <FileText className="text-amber-500 w-6 h-6" />
                1. Introduction
              </h2>
              <p className="text-slate-600 leading-relaxed text-base mb-4">
                At Stanness Technologies, we respect your privacy and are
                committed to protecting the personal and business information
                processed through the OmniSuite ERP platform.
              </p>
              <p className="text-slate-600 leading-relaxed text-base mb-4">
                This Privacy Policy explains how information is handled when you
                access or use OmniSuite ERP and describes your privacy rights
                and how applicable data protection laws protect you.
              </p>
              <p className="text-slate-600 leading-relaxed text-base mb-4">
                Where your organisation uses OmniSuite ERP to store and manage
                information about its employees, customers, suppliers or other
                individuals, your organisation generally determines how that
                information is collected and used. In such circumstances, your
                organisation acts as the Data Controller and Stanness
                Technologies acts primarily as the Data Processor and technology
                service provider.
              </p>
              <p className="text-slate-600 leading-relaxed text-base font-medium text-slate-700">
                Stanness Technologies does not use your organisation's ERP data
                for its own independent commercial purposes.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-3 mb-5 flex items-center gap-3">
                <Database className="text-amber-500 w-6 h-6" />
                2. Data We Process
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4 text-base">
                Depending on how your organisation uses OmniSuite ERP, the
                platform may contain different categories of personal and
                business information, including:
              </p>
              <ul className="list-none space-y-4 text-slate-600">
                <li className="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 shrink-0"></div>
                  <div>
                    <strong className="text-slate-800 block mb-1">
                      Identity Data:
                    </strong>
                    Includes first name, last name, username or similar
                    identifier, employee or staff identification, title,
                    department and organisation role.
                  </div>
                </li>
                <li className="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 shrink-0"></div>
                  <div>
                    <strong className="text-slate-800 block mb-1">
                      Contact Data:
                    </strong>
                    Includes email address, telephone number, business address
                    and other contact information entered into the ERP by your
                    organisation.
                  </div>
                </li>
                <li className="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 shrink-0"></div>
                  <div>
                    <strong className="text-slate-800 block mb-1">
                      Financial and Business Data:
                    </strong>
                    May include accounting records, invoices, payments, payroll
                    information, bank account information, sales, purchases,
                    inventory, expenses and other financial or operational
                    information entered or maintained by your organisation.
                  </div>
                </li>
                <li className="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 shrink-0"></div>
                  <div>
                    <strong className="text-slate-800 block mb-1">
                      Technical Data:
                    </strong>
                    Includes IP address, login information, browser type and
                    version, operating system, device information, login date
                    and time, session information, security logs and application
                    performance or error information.
                  </div>
                </li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-3 mb-5 flex items-center gap-3">
                <Globe className="text-amber-500 w-6 h-6" />
                3. How We Use Your Data
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4 text-base">
                Stanness Technologies processes information only to the extent
                reasonably necessary to provide, maintain, secure and support
                the OmniSuite ERP service.
              </p>
              <p className="text-slate-600 leading-relaxed mb-4 text-base">
                This may include:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 marker:text-slate-400 mb-6">
                <li>
                  Hosting and maintaining your organisation's ERP database.
                </li>
                <li>Providing database and application infrastructure.</li>
                <li>Performing backups and data restoration.</li>
                <li>Maintaining system availability and security.</li>
                <li>Diagnosing and resolving technical problems.</li>
                <li>Providing authorised technical support.</li>
                <li>Monitoring system performance and security.</li>
                <li>Investigating suspected security incidents.</li>
                <li>Maintaining technical and security logs.</li>
                <li>
                  Complying with applicable legal or regulatory requirements.
                </li>
              </ul>

              <p className="text-slate-600 leading-relaxed mb-4 text-base">
                Stanness Technologies does <strong>not</strong>:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 marker:text-slate-400 mb-8">
                <li>Sell or rent your organisation's ERP data.</li>
                <li>Use the data for advertising purposes.</li>
                <li>Use the data for unrelated commercial purposes.</li>
                <li>Create personal profiles for commercial purposes.</li>
                <li>
                  Use identifiable ERP data to train artificial intelligence or
                  machine-learning models without the organisation's express
                  authorisation.
                </li>
                <li>
                  Disclose the data to third parties except where necessary to
                  provide the service, authorised by the organisation, or
                  required or permitted by law.
                </li>
              </ul>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-6">
                <h3 className="font-bold text-slate-800 text-lg mb-2">
                  Access to Data
                </h3>
                <p className="text-slate-600 leading-relaxed text-base">
                  Stanness Technologies does not routinely access the contents
                  of your organisation's ERP data. Authorised personnel may
                  access data only where reasonably necessary to provide
                  technical support, maintain or restore the database,
                  investigate a security incident, perform an authorised
                  technical task, or comply with a lawful requirement. Such
                  access is subject to appropriate confidentiality and security
                  requirements.
                </p>
              </div>

              {/* Security Callout */}
              <div className="bg-gradient-to-r from-slate-50 to-white border border-slate-200 rounded-2xl p-8 flex items-start gap-6 shadow-sm">
                <div className="bg-amber-100 p-3 rounded-full shrink-0">
                  <Lock className="w-8 h-8 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-xl mb-3">
                    Data Security Commitment
                  </h3>
                  <p className="text-slate-600 leading-relaxed text-base mb-4">
                    We maintain appropriate technical and organisational
                    measures designed to protect information against
                    unauthorised access, accidental loss, alteration, disclosure
                    or destruction. These measures may include access controls,
                    authentication mechanisms, security monitoring, audit
                    logging, secure database management, backup and recovery
                    procedures and other appropriate security measures.
                  </p>
                  <p className="text-slate-600 leading-relaxed text-base italic">
                    However, no electronic system or method of transmission over
                    the internet can be guaranteed to be completely secure.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-3 mb-5 flex items-center gap-3">
                <HardDrive className="text-amber-500 w-6 h-6" />
                4. Data Retention and Backup
              </h2>
              <p className="text-slate-600 leading-relaxed text-base mb-4">
                We retain information for as long as reasonably necessary to
                provide the OmniSuite service, maintain security, perform
                backups, comply with applicable legal or regulatory
                requirements, or fulfil our contractual obligations.
              </p>
              <p className="text-slate-600 leading-relaxed text-base mb-4">
                Stanness Technologies maintains backups of client databases
                solely for purposes such as:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 marker:text-slate-400 mb-6">
                <li>Disaster recovery.</li>
                <li>Business continuity.</li>
                <li>Protection against accidental data loss.</li>
                <li>System recovery and restoration.</li>
                <li>
                  Maintaining the availability and integrity of the service.
                </li>
              </ul>
              <p className="text-slate-600 leading-relaxed text-base mb-4">
                Backup copies may remain in secure backup systems for a limited
                period after information is removed from the active database, in
                accordance with the applicable backup-retention procedures.
              </p>
              <p className="text-slate-600 leading-relaxed text-base">
                Following termination of an organisation's use of OmniSuite,
                client data will be handled in accordance with the applicable
                service agreement and applicable legal requirements.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-3 mb-5">
                5. Your Legal Rights
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4 text-base">
                Depending on applicable data protection laws and the
                circumstances of the processing, you may have rights in relation
                to your personal data, including the right to:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                {[
                  "Request access to your personal data",
                  "Request correction of inaccurate or incomplete personal data",
                  "Request deletion or erasure of your personal data where legally applicable",
                  "Object to certain processing of your personal data",
                  "Request restriction of processing where legally applicable",
                  "Request transfer or portability of your personal data where such a right is provided by applicable law",
                  "Withdraw consent where processing is based on consent",
                  "Lodge a complaint with the appropriate data protection authority where you believe your privacy rights have been violated",
                ].map((right, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-slate-700 font-medium text-sm"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0"></div>
                    {right}
                  </div>
                ))}
              </div>
              <p className="text-slate-600 leading-relaxed text-base">
                Where Stanness Technologies is acting solely as a Data Processor
                on behalf of your organisation, requests concerning personal
                data held within your organisation's OmniSuite environment may
                need to be directed to your organisation, which remains
                responsible for determining the purposes and means of processing
                that information.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-3 mb-5 flex items-center gap-3">
                <Users className="text-amber-500 w-6 h-6" />
                6. Contact Us
              </h2>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <p className="text-slate-600 leading-relaxed text-base mb-4">
                  For privacy or data protection enquiries, please contact:
                </p>
                <div className="space-y-2 mb-6">
                  <p className="text-slate-800 font-semibold">
                    Stanness Technologies
                  </p>
                  <p className="text-slate-600">
                    <strong className="text-slate-800">Email:</strong>{" "}
                    admin@omnisuite-erp.com
                  </p>
                  <p className="text-slate-600">
                    <strong className="text-slate-800">Telephone:</strong>{" "}
                    +233248877123
                  </p>
                </div>
                <p className="text-slate-600 leading-relaxed text-base">
                  Where your enquiry relates to personal information processed
                  by your organisation through OmniSuite ERP, you may also
                  contact your organisation's designated Data Protection
                  Supervisor or privacy representative.
                </p>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-slate-200 flex flex-col items-center text-sm text-slate-500">
            <div className="font-semibold text-slate-700 mb-2">
              Powered by{" "}
              <a
                href="https://www.stannesstechnologies.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-amber-600 transition-colors"
              >
                Stanness Technologies
              </a>
            </div>
            <p>Last Updated: 7 August 2026</p>
            <p className="mt-1">
              © 2026 Stanness Technologies. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
