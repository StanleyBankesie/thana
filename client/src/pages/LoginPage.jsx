/**
 * @fileoverview LoginPage component for OmniSuite ERP.
 * Handles user authentication, remembering credentials, and redirecting based on assigned branches.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../auth/AuthContext.jsx";
import * as authStorage from "../auth/authStorage.js";
import api from "../api/client.js";
import logoClear from "../assets/resources/OMNISUITE_LOGO_CLEAR.png";
import backgroundImage from "../assets/resources/BACKGROUND.jpg";
import {
  Eye,
  EyeOff,
  Calendar as CalendarIcon,
  Clock,
  Video,
  Users,
  Megaphone,
  Gift,
  Award,
} from "lucide-react";
import Swal from "sweetalert2";
import PaymentPackageModal from "../components/PaymentPackageModal.jsx";

const CAROUSEL_MESSAGES = [
  "Empowering Your Business Operations",
  "Seamless Enterprise Resource Planning",
  "Streamline Your Workflow Today",
];

/**
 * LoginPage component
 * Renders the login form, handles API authentication, and manages remembered credentials.
 *
 * @returns {JSX.Element} The rendered login page.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, setScope, token, initialized, scope } = useAuth();

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginBackgroundUrl, setLoginBackgroundUrl] = useState(backgroundImage);
  const [loginHeroImageUrl, setLoginHeroImageUrl] = useState(backgroundImage);
  const [rememberMe, setRememberMe] = useState(() =>
    authStorage.readRememberMePreference(),
  );
  const handledStartupRedirect = useRef(false);
  const [upcomingEvents, setUpcomingEvents] = useState({
    announcements: [],
    birthdays: [],
    anniversaries: [],
  });

  // Date and carousel state for right panel
  const [currentDate, setCurrentDate] = useState(new Date());
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [announcementIndex, setAnnouncementIndex] = useState(0);

  useEffect(() => {
    async function fetchUpcomingEvents() {
      try {
        let baseURL = "";
        if (api.defaults && api.defaults.baseURL) {
          baseURL = api.defaults.baseURL;
        } else {
          baseURL = "/api";
        }
        const res = await fetch(baseURL + "/public/upcoming-events");
        const data = await res.json();
        setUpcomingEvents(data);
      } catch (err) {
        // ignore
      }
    }
    fetchUpcomingEvents();

    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    const carouselTimer = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % CAROUSEL_MESSAGES.length);
    }, 4000);
    return () => {
      clearInterval(timer);
      clearInterval(carouselTimer);
    };
  }, []);

  useEffect(() => {
    if (!upcomingEvents.announcements || upcomingEvents.announcements.length <= 1) return;
    const annTimer = setInterval(() => {
      setAnnouncementIndex((prev) => (prev + 1) % upcomingEvents.announcements.length);
    }, 5000);
    return () => clearInterval(annTimer);
  }, [upcomingEvents.announcements]);

  // ── Remembered credential suggestion state ──────────────────
  const [savedProfiles, setSavedProfiles] = useState([]);
  const [usernameQuery, setUsernameQuery] = useState("");
  const [showSuggestion, setShowSuggestion] = useState(false);
  const suggestionRef = useRef(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const renewingLicenseRef = useRef(false);

  const setInputValue = useCallback((input, value) => {
    if (!input) return;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set;
    nativeInputValueSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, []);

  const isAutoFillingRef = useRef(false);

  // Automatically clear all fields when login page is loaded or refreshed
  useEffect(() => {
    const profiles = authStorage.readRememberedCredentialProfiles?.() || [];
    if (profiles.length) {
      setSavedProfiles(profiles);
      setRememberMe(true);
    }
    setTimeout(() => {
      if (usernameRef.current) {
        setInputValue(usernameRef.current, "");
      }
      if (passwordRef.current) {
        setInputValue(passwordRef.current, "");
      }
      setShowSuggestion(false);
      setUsernameQuery("");
    }, 50);
  }, [setInputValue]);

  // Check global license status on mount
  useEffect(() => {
    async function checkGlobalLicense() {
      try {
        const res = await api.get("/licenses/system-state");
        if (
          res.data?.status === "EXPIRED" ||
          res.data?.status === "INACTIVE" ||
          res.data?.message?.toLowerCase().includes("expired")
        ) {
          // 1. Informational Alert First
          Swal.fire({
            title: "License Expired",
            text: "The license for your organization has expired. Access to certain features may be restricted until the license is renewed. Please contact your administrator.",
            icon: "warning",
            allowOutsideClick: false,
            allowEscapeKey: false,
            showCancelButton: false,
            confirmButtonText: "Close",
            buttonsStyling: false,
            customClass: {
              container: "backdrop-blur-sm bg-slate-900/40",
              popup: "rounded-2xl shadow-2xl border-0 p-6",
              title: "text-2xl font-bold text-slate-800 mt-2",
              htmlContainer: "text-slate-500 text-base mt-2",
              confirmButton:
                "bg-brand-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-brand-700 transition-all shadow-sm w-full mt-4",
              icon: "border-0 text-amber-500",
            },
          });
        }
      } catch (err) {
        // Silently fail if endpoint is not accessible or returns error
      }
    }
    checkGlobalLicense();
  }, [login, setScope]);

  useEffect(() => {
    let mounted = true;
    async function loadLoginBackground() {
      try {
        const resp = await api.get("/admin/settings/login-bg-info");
        const meta = resp?.data;
        if (!mounted || !meta?.hasBackground) return;
        const version = meta.updatedAt || Date.now();
        const base = api.defaults?.baseURL || "/api";
        setLoginBackgroundUrl(
          `${base}/admin/settings/login-background?v=${encodeURIComponent(
            String(version),
          )}`,
        );
      } catch {}
    }
    loadLoginBackground().catch(() => {});

    async function loadLoginHeroBackground() {
      try {
        const resp = await api.get("/admin/settings/login-hero-bg-info");
        const meta = resp?.data;
        if (!mounted || !meta?.hasBackground) return;
        const version = meta.updatedAt || Date.now();
        const base = api.defaults?.baseURL || "/api";
        setLoginHeroImageUrl(
          `${base}/admin/settings/login-hero-background?v=${encodeURIComponent(
            String(version),
          )}`,
        );
      } catch {}
    }
    loadLoginHeroBackground().catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  // Close suggestion dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(e.target) &&
        e.target !== usernameRef.current
      ) {
        setShowSuggestion(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // When user focuses or clicks the username field, show saved credential suggestion if typed >= 2 chars
  const handleUsernameFocus = useCallback(() => {
    if (
      savedProfiles.length &&
      usernameQuery.trim().length >= 2 &&
      !isAutoFillingRef.current
    ) {
      setShowSuggestion(true);
    }
  }, [savedProfiles, usernameQuery]);

  // When user selects the suggested username, fill username field and focus password
  const handleSelectSuggestion = useCallback(
    (profile) => {
      if (!profile) return;
      if (usernameRef.current) {
        usernameRef.current.value = profile.username || "";
        setInputValue(usernameRef.current, profile.username || "");
      }
      if (passwordRef.current && profile.password) {
        passwordRef.current.value = profile.password;
        setInputValue(passwordRef.current, profile.password);
      }
      setUsernameQuery(profile.username || "");
      setRememberMe(true);
      setShowSuggestion(false);
    },
    [setInputValue],
  );

  const filteredProfiles = savedProfiles.filter((profile) => {
    const query = usernameQuery.trim().toLowerCase();
    if (!query) return true;
    return profile.username.toLowerCase().includes(query);
  });

  const shouldShowSuggestion =
    showSuggestion &&
    usernameQuery.trim().length >= 2 &&
    filteredProfiles.length > 0;

  useEffect(() => {
    if (
      initialized &&
      token &&
      !handledStartupRedirect.current &&
      !renewingLicenseRef.current
    ) {
      handledStartupRedirect.current = true;
      navigate("/", { replace: true });
    }
  }, [initialized, token, navigate]);

  /**
   * Handles the login form submission.
   * Authenticates the user, saves credentials if rememberMe is true, and sets the active branch scope.
   * @param {React.FormEvent<HTMLFormElement>} e - The form submission event.
   */
  async function onSubmit(e) {
    e.preventDefault();

    // Read values directly from refs (fixes React/Browser autofill mismatch)
    const submittedUsername = usernameRef.current?.value?.trim() || "";
    const submittedPassword = passwordRef.current?.value || "";

    if (!submittedUsername || !submittedPassword) {
      setError("Please enter both username and password");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const data = await login({
        username: submittedUsername,
        password: submittedPassword,
        rememberMe,
      });

      // ── Save or clear remembered credentials ──────────────
      if (rememberMe) {
        authStorage.saveRememberedCredentials(
          submittedUsername,
          submittedPassword,
          { profilePictureUrl: data?.user?.profile_picture_url || "" },
        );
        authStorage.saveRememberMePreference(true);
      } else {
        authStorage.clearRememberedCredentials(submittedUsername);
        authStorage.saveRememberMePreference(false);
      }

      // ── Clear form fields on successful login ──────────────
      if (usernameRef.current) {
        setInputValue(usernameRef.current, "");
      }
      if (passwordRef.current) {
        setInputValue(passwordRef.current, "");
      }
      setUsernameQuery("");

      const branches = Array.isArray(data?.user?.branchIds)
        ? data.user.branchIds.map(Number).filter((n) => Number.isFinite(n))
        : [];
      const companies = Array.isArray(data?.user?.companyIds)
        ? data.user.companyIds.map(Number).filter((n) => Number.isFinite(n))
        : [];

      if (branches.length === 1) {
        const branchId = branches[0];
        let companyId = companies.length === 1 ? companies[0] : null;
        if (!companyId) {
          try {
            const res = await api.get("/admin/branches");
            const items = Array.isArray(res.data?.items) ? res.data.items : [];
            const b = items.find((x) => Number(x.id) === Number(branchId));
            if (b) companyId = Number(b.company_id);
          } catch {
            companyId = companies[0] || 1;
          }
        }
        setScope((prev) => ({
          ...prev,
          companyId: companyId || prev.companyId || 1,
          branchId: branchId,
        }));

        navigate("/", { replace: true });
      } else {
        navigate("/select-branch", { replace: true });
      }
    } catch (err) {
      if (err?.response?.data?.error === "PASSWORD_RESET_REQUIRED") {
        navigate("/reset-password", { replace: true });
        return;
      }

      if (err?.response?.data?.error === "LICENSE_EXPIRED") {
        setLoading(false);
        const canRenew = err.response.data.canRenew;

        if (canRenew) {
          Swal.fire({
            title: "License Expired",
            html: `
              <p class="text-slate-500 text-sm mb-5">Your company license has expired. Please log in to renew your license.</p>
              <div class="space-y-4">
                <input id="swal-login-username-retry" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-slate-700 placeholder-slate-400 bg-slate-50 focus:bg-white" placeholder="Username" value="${submittedUsername}">
                <input id="swal-login-password-retry" type="password" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-slate-700 placeholder-slate-400 bg-slate-50 focus:bg-white" placeholder="Password">
              </div>
            `,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Renew License",
            cancelButtonText: "Cancel",
            buttonsStyling: false,
            customClass: {
              container: "backdrop-blur-sm bg-slate-900/40",
              popup: "rounded-2xl shadow-2xl border-0 p-6",
              title: "text-xl font-bold text-slate-800 mt-2",
              actions: "w-full flex gap-3 mt-6",
              confirmButton:
                "flex-1 bg-brand-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-brand-700 transition-all shadow-sm",
              cancelButton:
                "flex-1 bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-semibold hover:bg-slate-200 transition-all",
              icon: "border-0 text-amber-500",
            },
            didOpen: () => {
              const u = document.getElementById("swal-login-username-retry");
              const p = document.getElementById("swal-login-password-retry");
              if (u && !u.value) u.focus();
              else if (p) p.focus();
            },
            preConfirm: () => {
              const u = document.getElementById(
                "swal-login-username-retry",
              ).value;
              const p = document.getElementById(
                "swal-login-password-retry",
              ).value;
              if (!u || !p) {
                Swal.showValidationMessage(
                  "Please enter both username and password",
                );
                return false;
              }
              return { username: u, password: p };
            },
          }).then(async (result) => {
            if (result.isConfirmed) {
              setLoading(true);
              renewingLicenseRef.current = true;
              try {
                const data = await login({
                  username: result.value.username,
                  password: result.value.password,
                  rememberMe: false,
                  intent: "renew",
                });

                const branches = Array.isArray(data?.user?.branchIds)
                  ? data.user.branchIds.map(Number).filter(Number.isFinite)
                  : [];
                const companies = Array.isArray(data?.user?.companyIds)
                  ? data.user.companyIds.map(Number).filter(Number.isFinite)
                  : [];

                if (branches.length === 1) {
                  const branchId = branches[0];
                  let companyId = companies.length === 1 ? companies[0] : null;
                  if (!companyId) companyId = companies[0] || 1;
                  setScope((prev) => ({
                    ...prev,
                    companyId: companyId || prev.companyId || 1,
                    branchId: branchId,
                  }));
                }

                setShowPaymentModal(true);
              } catch (retryErr) {
                toast.error(
                  retryErr?.response?.data?.message ||
                    retryErr?.message ||
                    "Renewal login failed",
                );
              } finally {
                setLoading(false);
              }
            }
          });
        } else {
          Swal.fire({
            title: "License Expired",
            text: "Your company license has expired. Please contact your administrator to renew.",
            icon: "error",
            allowOutsideClick: false,
            allowEscapeKey: false,
            showCancelButton: false,
            confirmButtonText: "Close",
            buttonsStyling: false,
            customClass: {
              container: "backdrop-blur-sm bg-slate-900/40",
              popup: "rounded-2xl shadow-2xl border-0 p-6",
              title: "text-2xl font-bold text-slate-800 mt-2",
              htmlContainer: "text-slate-500 text-base mt-2",
              confirmButton:
                "bg-brand-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-brand-700 transition-all shadow-sm w-full mt-4",
              icon: "border-0 text-red-500",
            },
          });
        }
        return;
      }

      const msg =
        err?.response?.data?.message || err?.message || "Login failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        {/* Left Side: Form */}
        <div
          className="w-full md:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-center relative bg-slate-900"
          style={{
            backgroundImage: `url(${loginBackgroundUrl || backgroundImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Overlay to ensure form text readability */}
          <div className="absolute inset-0 bg-white/90"></div>

          <div className="max-w-md w-full mx-auto relative z-10">
            {/* Logo on top for all devices */}
            <div className="flex justify-center mb-12">
              <div className="bg-white/80 backdrop-blur px-5 py-2.5 rounded-full shadow-md flex items-center gap-3 border border-slate-100">
                <img
                  src="/OMNISUITE_ICON_CLEAR.png"
                  alt="Omnisuite ERP"
                  className="h-7 w-auto"
                />
                <span className="font-bold text-slate-800 text-lg tracking-tight">
                  Omnisuite ERP
                </span>
              </div>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">
                {savedProfiles.length > 0 ? "Welcome Back" : "Welcome"}
              </h1>
              <p className="text-slate-600">
                Sign in to continue your enterprise journey.
              </p>
            </div>

            {error ? (
              <div className="mb-4 rounded-lg border border-status-error/30 bg-red-50 px-4 py-3 text-status-error text-sm">
                {error}
              </div>
            ) : null}

            <form
              onSubmit={onSubmit}
              className="space-y-5"
              autoComplete="on"
              method="post"
            >
              <div className="relative w-full">
                <label
                  className="block text-sm font-medium text-slate-700 mb-1"
                  htmlFor="username"
                >
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all"
                  ref={usernameRef}
                  autoComplete="username"
                  required
                  defaultValue=""
                  onFocus={handleUsernameFocus}
                  onClick={handleUsernameFocus}
                  onChange={(e) => {
                    const val = e.target.value;
                    setUsernameQuery(val);
                    if (savedProfiles.length && !isAutoFillingRef.current) {
                      if (val.trim().length >= 2) {
                        setShowSuggestion(true);
                      }
                      const matched = savedProfiles.find(
                        (p) =>
                          p.username.toLowerCase() === val.trim().toLowerCase(),
                      );
                      if (matched && matched.password && passwordRef.current) {
                        setInputValue(passwordRef.current, matched.password);
                      }
                    }
                  }}
                />

                {/* Credential suggestion dropdown */}
                {shouldShowSuggestion && (
                  <div
                    ref={suggestionRef}
                    className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-56 overflow-y-auto overflow-x-hidden"
                  >
                    {filteredProfiles.map((profile) => (
                      <button
                        key={profile.username}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelectSuggestion(profile);
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelectSuggestion(profile);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 text-left"
                      >
                        {profile.profilePictureUrl ? (
                          <img
                            src={profile.profilePictureUrl}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                            style={{
                              background:
                                profile.avatarColor ||
                                authStorage.getRememberedAvatarColor(
                                  profile.username,
                                ),
                            }}
                          >
                            {profile.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-slate-800 leading-tight truncate">
                            {profile.username}
                          </div>
                          <div className="text-xs text-slate-400 leading-tight">
                            ••••••••
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="w-full">
                <label
                  className="block text-sm font-medium text-slate-700 mb-1"
                  htmlFor="password"
                >
                  Password
                </label>
                <div className="relative w-full">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all pr-12"
                    ref={passwordRef}
                    autoComplete="current-password"
                    required
                    defaultValue=""
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 w-4 h-4"
                  checked={rememberMe}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRememberMe(checked);
                    authStorage.saveRememberMePreference(checked);
                  }}
                />
                Remember me
              </label>

              <button
                type="submit"
                className="w-full bg-amber-400 hover:bg-amber-500 text-brand-700 font-bold py-3 px-4 rounded-xl shadow-sm transition-colors mt-2"
                disabled={loading}
              >
                {loading ? "Signing in…" : "Submit"}
              </button>

              <div className="mt-4 text-center">
                <Link
                  to="/forgot-password"
                  className="text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            </form>

            <div className="mt-8 pt-8 border-t border-amber-200/50 flex flex-col items-center gap-2 text-xs text-slate-500">
              <div>
                Powered by{" "}
                <a
                  href="https://www.stannesstechnologies.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-slate-800 transition-colors font-medium"
                >
                  Stanness Technologies
                </a>
              </div>
              <div className="flex gap-4">
                <Link
                  to="/privacy-policy"
                  className="hover:text-slate-800 transition-colors"
                >
                  Privacy Policy
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Image and Glassmorphic Elements */}
        <div
          className="hidden md:block w-full md:w-1/2 relative bg-slate-900 overflow-hidden"
          style={{
            backgroundImage: `url(${loginHeroImageUrl || backgroundImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* Overlay to ensure text readability */}
          <div className="absolute inset-0 bg-black/20"></div>

          {/* Glassmorphic Carousel */}
          <div className="absolute top-12 left-1/2 -translate-x-1/2 w-4/5 max-w-md z-20">
            <div className="backdrop-blur-md bg-white/20 border border-white/30 p-4 rounded-2xl shadow-xl flex items-center justify-between text-white">
              <div className="flex-1 overflow-hidden relative h-6">
                {CAROUSEL_MESSAGES.map((msg, idx) => (
                  <div
                    key={idx}
                    className="absolute inset-0 w-full flex items-center font-medium transition-all duration-500 ease-in-out"
                    style={{
                      transform: `translateY(${(idx - carouselIndex) * 100}%)`,
                      opacity: idx === carouselIndex ? 1 : 0,
                    }}
                  >
                    {msg}
                  </div>
                ))}
              </div>
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse ml-4 shrink-0"></div>
            </div>
          </div>

          {/* Glassmorphic Calendar & Date */}
          <div className="absolute bottom-12 left-12 right-12 flex flex-col gap-6 z-20">
            {/* Calendar Strip */}
            <div className="backdrop-blur-md bg-black/20 border border-white/20 p-4 rounded-3xl text-white">
              <div className="flex justify-between items-center px-2">
                {[...Array(7)].map((_, i) => {
                  const d = new Date(currentDate);
                  d.setDate(d.getDate() - 3 + i);
                  const isToday = i === 3;
                  return (
                    <div
                      key={i}
                      className={`flex flex-col items-center p-2 rounded-xl transition-all ${isToday ? "bg-white/20 scale-110" : "opacity-70"}`}
                    >
                      <span className="text-xs mb-1">
                        {d.toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                      <span
                        className={`font-bold ${isToday ? "text-lg" : "text-sm"}`}
                      >
                        {d.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upcoming Events Widget */}
            <div className="backdrop-blur-md bg-white/90 border border-white p-4 rounded-2xl shadow-xl flex flex-col gap-3  w-full max-h-[500px] overflow-y-auto custom-scrollbar">
              <h3 className="font-bold text-slate-800 text-base border-b pb-2">
                Upcoming Events
              </h3>

              {upcomingEvents.announcements && upcomingEvents.announcements.length > 0 && (
                <div className="flex items-start gap-3 bg-blue-50/50 p-3 rounded-xl">
                  <div className="bg-blue-100 text-blue-600 p-2 rounded-lg shrink-0">
                    <Megaphone size={20} />
                  </div>
                  <div className="relative flex-1 overflow-hidden min-h-[44px]">
                    {upcomingEvents.announcements.map((ann, idx) => (
                      <div
                        key={idx}
                        className="absolute inset-0 transition-all duration-500 ease-in-out flex items-center"
                        style={{
                          transform: `translateX(${(idx - announcementIndex) * 100}%)`,
                          opacity: idx === announcementIndex ? 1 : 0,
                        }}
                      >
                        <p className="text-slate-700 text-sm font-medium leading-relaxed w-full">
                          {ann}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {upcomingEvents.birthdays?.map((bd, idx) => (
                <div key={`bd-${idx}`} className="flex items-center gap-3">
                  <div className="bg-pink-100 text-pink-600 p-2.5 rounded-lg shrink-0">
                    <Gift size={18} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-700 text-sm">
                      {bd.full_name}'s Birthday
                    </h4>
                    <p className="text-slate-500 text-xs">
                      {bd.celebration_date}
                    </p>
                  </div>
                </div>
              ))}

              {upcomingEvents.anniversaries?.map((an, idx) => (
                <div key={`an-${idx}`} className="flex items-center gap-3">
                  <div className="bg-amber-100 text-amber-600 p-2.5 rounded-lg shrink-0">
                    <Award size={18} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-700 text-sm">
                      {an.full_name}'s Work Anniversary
                    </h4>
                    <p className="text-slate-500 text-xs">
                      {an.celebration_date}
                    </p>
                  </div>
                </div>
              ))}

              {(!upcomingEvents.announcements || upcomingEvents.announcements.length === 0) &&
                upcomingEvents.birthdays?.length === 0 &&
                upcomingEvents.anniversaries?.length === 0 && (
                  <div className="text-center py-4 text-slate-400 text-xs">
                    No upcoming events
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
      <PaymentPackageModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        companyId={scope?.companyId || null}
      />
    </div>
  );
}
