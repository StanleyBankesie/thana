/**
 * @file useExchangeRate.js
 * @description Hook to fetch currency exchange rates (server-cached via Redis).
 */

import { useState, useCallback } from 'react';
import api from '../services/apiClient';

/**
 * Hook for retrieving currency exchange rates and available currencies.
 * @returns {Object} An object containing the fetching methods and state.
 * @returns {Function} returns.getExchangeRate - Fetches the exchange rate between two currencies.
 * @returns {Function} returns.getAvailableCurrencies - Fetches a list of available currencies.
 * @returns {boolean} returns.loading - Indicates if a fetch operation is in progress.
 * @returns {string|null} returns.error - Error message if a fetch operation fails.
 */
export function useExchangeRate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetches the exchange rate from one currency to another.
   * @param {string} from - The base currency code.
   * @param {string} to - The target currency code.
   * @returns {Promise<number|null>} The exchange rate, or null if it fails.
   */
  const getExchangeRate = useCallback(async (from, to) => {
    if (!from || !to) return null;
    if (from === to) return 1;

    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/finance/exchange-rates/${from}`);
      if (data && data.rates && data.rates[to]) {
        return data.rates[to];
      }
      throw new Error('Failed to fetch exchange rate');
    } catch (err) {
      console.error('Error fetching exchange rate:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetches the list of available currencies.
   * @returns {Promise<Array<{code: string, name: string}>>} Array of available currencies.
   */
  const getAvailableCurrencies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/finance/exchange-rates/USD');
      if (data && data.rates) {
        return Object.keys(data.rates).map(code => ({
          code,
          name: code
        }));
      }
      throw new Error('Failed to fetch currencies');
    } catch (err) {
      console.error('Error fetching available currencies:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { getExchangeRate, getAvailableCurrencies, loading, error };
}
