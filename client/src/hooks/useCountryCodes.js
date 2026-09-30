import { useState, useEffect } from "react";

const CACHE_KEY = "country_codes_cache";

export function useCountryCodes() {
  const [countryCodes, setCountryCodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCodes() {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          setCountryCodes(JSON.parse(cached));
          setLoading(false);
          // Return early if cached data is valid
          if (JSON.parse(cached).length > 0) return;
        }

        const res = await fetch("https://raw.githubusercontent.com/mledoze/countries/master/countries.json");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        
        let codes = [];
        if (Array.isArray(data)) {
          data.forEach((country) => {
            if (country.idd && country.idd.root) {
              const root = country.idd.root;
              const suffixes = country.idd.suffixes || [""];
              suffixes.forEach((suffix) => {
                codes.push({
                  name: country.name?.common || country.name?.official || "",
                  code: country.cca2,
                  dialCode: `${root}${suffix}`
                });
              });
            }
          });
        }
        
        // Remove duplicates and sort
        const uniqueCodes = [];
        const seen = new Set();
        codes.forEach(c => {
          const key = `${c.code}-${c.dialCode}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueCodes.push(c);
          }
        });

        uniqueCodes.sort((a, b) => a.name.localeCompare(b.name));
        
        localStorage.setItem(CACHE_KEY, JSON.stringify(uniqueCodes));
        setCountryCodes(uniqueCodes);
      } catch (error) {
        console.error("Failed to fetch country codes", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCodes();
  }, []);

  // Helper to parse existing full phone number into code and local number
  const parsePhoneNumber = (fullNumber) => {
    if (!fullNumber) return { dialCode: "", localNumber: "" };
    
    // Sort by dial code length descending so we match the longest prefix first
    // e.g. +1242 before +1
    const sortedCodes = [...countryCodes].sort((a, b) => b.dialCode.length - a.dialCode.length);
    
    // Clean spaces and dashes for checking
    const cleanNumber = fullNumber.replace(/[\s-]/g, "");
    
    // Ensure we start checking with a + if it doesn't have one for robust matching
    const normalizedNumber = cleanNumber.startsWith("+") ? cleanNumber : `+${cleanNumber}`;
    
    for (const c of sortedCodes) {
      if (normalizedNumber.startsWith(c.dialCode)) {
        return {
          dialCode: c.dialCode,
          // Strip the dial code from the original or cleaned number
          localNumber: normalizedNumber.slice(c.dialCode.length)
        };
      }
    }
    
    // If no match found, fallback to original behaviour
    return { dialCode: "", localNumber: fullNumber };
  };

  return { countryCodes, loading, parsePhoneNumber };
}
