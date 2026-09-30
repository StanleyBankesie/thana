let loader = null;
export function loadChartJs() {
  if (typeof window !== "undefined" && window.Chart) {
    return Promise.resolve(window.Chart);
  }
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src =
      "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js";
    s.async = true;
    s.onload = () => resolve(window.Chart);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return loader;
}
