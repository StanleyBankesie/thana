import React, { useEffect, useState } from "react";
import { useCountryCodes } from "@/hooks/useCountryCodes.js";

export default function PhoneInput({ value, onChange, className, required, placeholder = "Phone Number", disabled = false }) {
  const { countryCodes, loading, parsePhoneNumber } = useCountryCodes();
  const [dialCode, setDialCode] = useState("");
  const [localNumber, setLocalNumber] = useState("");

  // When value changes from outside (e.g., initial fetch)
  useEffect(() => {
    // Only parse if we have codes and a value
    if (countryCodes.length > 0) {
      if (value) {
        const { dialCode: parsedCode, localNumber: parsedLocal } = parsePhoneNumber(value);
        if (parsedCode) setDialCode(parsedCode);
        setLocalNumber(parsedLocal);
      } else {
        setDialCode("");
        setLocalNumber("");
      }
    }
  }, [value, countryCodes]);

  const handleDialCodeChange = (e) => {
    const newCode = e.target.value;
    setDialCode(newCode);
    if (onChange) {
      onChange(newCode && localNumber ? `${newCode}${localNumber}` : localNumber);
    }
  };

  const handleNumberChange = (e) => {
    // Basic clean up: remove non-numeric or non-space characters from local number
    const newNum = e.target.value;
    setLocalNumber(newNum);
    if (onChange) {
      onChange(dialCode && newNum ? `${dialCode}${newNum}` : newNum);
    }
  };

  return (
    <div className={`flex ${className && className.includes('w-') ? '' : 'w-full'} ${className || ""}`.trim()}>
      <select 
        className="input rounded-r-none border-r-0 bg-slate-50 text-slate-700 w-[30%] disabled:opacity-50" 
        value={dialCode}
        onChange={handleDialCodeChange}
        disabled={loading || disabled}
      >
        <option value="">Code</option>
        {countryCodes.map((c, i) => (
          <option key={`${c.code}-${i}`} value={c.dialCode}>
            {c.name} ({c.dialCode})
          </option>
        ))}
      </select>
      <input
        type="tel"
        className="input rounded-l-none w-[70%] disabled:opacity-50"
        value={localNumber}
        onChange={handleNumberChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
    </div>
  );
}
