import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../api/client.js";
import backgroundImage from "../assets/resources/BACKGROUND.jpg";
import { format } from "date-fns";

const CAROUSEL_MESSAGES = [
  "Streamline your operations.",
  "Empower your workforce.",
  "Insights at your fingertips.",
];

export default function ForgotPasswordRequest() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [loginBackgroundUrl, setLoginBackgroundUrl] = useState("");
  const [loginHeroImageUrl, setLoginHeroImageUrl] = useState("");
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function loadBackgrounds() {
      try {
        const bgRes = await api.get("/admin/settings/login-bg-info");
        if (mounted && bgRes.data?.hasBackground) {
          const version = bgRes.data.updatedAt || Date.now();
          const base = api.defaults?.baseURL || "/api";
          setLoginBackgroundUrl(`${base}/admin/settings/login-background?v=${encodeURIComponent(String(version))}`);
        }
      } catch {}

      try {
        const heroRes = await api.get("/admin/settings/login-hero-bg-info");
        if (mounted && heroRes.data?.hasBackground) {
          const version = heroRes.data.updatedAt || Date.now();
          const base = api.defaults?.baseURL || "/api";
          setLoginHeroImageUrl(`${base}/admin/settings/login-hero-background?v=${encodeURIComponent(String(version))}`);
        }
      } catch {}
    }
    loadBackgrounds();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % CAROUSEL_MESSAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/forgot-password/request-otp", {
        username,
        email,
      });
      toast.success("OTP sent to your registered email");
      navigate("/reset-password", { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to request OTP";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const currentDate = new Date();
  const dayName = format(currentDate, "EEEE");
  const monthName = format(currentDate, "MMMM");
  const dayNumber = format(currentDate, "d");
  const year = format(currentDate, "yyyy");

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
                <img src="/OMNISUITE_ICON_CLEAR.png" alt="Omnisuite ERP" className="h-7 w-auto" />
                <span className="font-bold text-slate-800 text-lg tracking-tight">Omnisuite ERP</span>
              </div>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">Password Reset</h1>
              <p className="text-slate-600">Enter your username and email to receive an OTP.</p>
            </div>
            
            {error ? (
              <div className="mb-4 rounded-lg border border-status-error/30 bg-red-50 px-4 py-3 text-status-error text-sm">
                {error}
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="relative w-full">
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="w-full">
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-amber-400 hover:bg-amber-500 text-amber-900 font-bold py-3 px-4 rounded-xl shadow-sm transition-colors mt-2"
                disabled={loading}
              >
                {loading ? "Sending OTP…" : "Send OTP"}
              </button>
              
              <div className="mt-4 text-center">
                <Link to="/login" className="text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors">
                  Back to login
                </Link>
              </div>
            </form>
            
            <div className="mt-8 pt-8 border-t border-amber-200/50 flex flex-col items-center gap-2 text-xs text-slate-500">
              <div>
                Powered by <a href="https://www.stannesstechnologies.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800 transition-colors font-medium">Stanness Technologies</a>
              </div>
              <div className="flex gap-4">
                <Link to="/privacy-policy" className="hover:text-slate-800 transition-colors">Privacy Policy</Link>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Side: Image and Glassmorphic Elements */}
        <div 
          className="hidden md:block w-full md:w-1/2 relative bg-slate-900 overflow-hidden"
          style={{
            backgroundImage: `url(${loginHeroImageUrl || backgroundImage})`,
            backgroundSize: "contain",
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
                    className="absolute inset-0 flex items-center text-sm font-medium whitespace-nowrap transition-all duration-500"
                    style={{
                      opacity: idx === carouselIndex ? 1 : 0,
                      transform: `translateY(${(idx - carouselIndex) * 100}%)`
                    }}
                  >
                    {msg}
                  </div>
                ))}
              </div>
              <div className="flex gap-1 ml-4">
                {CAROUSEL_MESSAGES.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === carouselIndex ? 'bg-amber-400 w-3' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Glassmorphic Calendar Widget */}
          <div className="absolute bottom-12 right-12 z-20">
            <div className="backdrop-blur-md bg-white/10 border border-white/20 p-6 rounded-3xl shadow-2xl flex flex-col items-center justify-center text-white min-w-[140px] transform hover:scale-105 transition-transform duration-300">
              <div className="text-amber-400 font-bold text-sm tracking-wider uppercase mb-1">{dayName}</div>
              <div className="text-5xl font-black mb-1 drop-shadow-md">{dayNumber}</div>
              <div className="text-white/90 font-medium">{monthName} {year}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
