/**
 * @file useGhanaCities.js
 * @description Hook to fetch a list of cities in Ghana.
 */

import { useState, useEffect } from 'react';

/**
 * Hook for retrieving a list of cities in Ghana.
 * @returns {Object} An object containing the cities and fetching state.
 * @returns {string[]} returns.cities - An array of city names.
 * @returns {boolean} returns.loading - Indicates if the fetch operation is in progress.
 * @returns {string|null} returns.error - Error message if the fetch operation fails.
 */
export function useGhanaCities() {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCities() {
      setLoading(true);
      try {
        const response = await fetch('https://countriesnow.space/api/v0.1/countries/cities', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ country: 'ghana' }),
        });
        const data = await response.json();
        if (!data.error) {
          setCities(data.data.sort());
        } else {
          throw new Error(data.msg || 'Failed to fetch cities');
        }
      } catch (err) {
        console.error('Error fetching Ghana cities:', err);
        setError(err.message);
        // Fallback to major cities if API fails
        setCities([
          "Accra", "Kumasi", "Tamale", "Takoradi", "Atsiaman", "Tema", "Teshie", 
          "Cape Coast", "Sekondi", "Obuasi", "Medina Estates", "Koforidua", 
          "Japekrom", "Wa", "Ejura", "Sunyani", "Ho", "Bawku", "Aflao", "Agona Swedru"
        ].sort());
      } finally {
        setLoading(false);
      }
    }

    fetchCities();
  }, []);

  return { cities, loading, error };
}
