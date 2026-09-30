import fs from 'fs';

const filePath = 'client/src/pages/modules/transport/requests/TransportRequestForm.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Change grid to 3 columns
content = content.replace(
  /<div className="grid grid-cols-1 md:grid-cols-2 gap-6">/,
  '<div className="grid grid-cols-1 md:grid-cols-3 gap-6">'
);

// Add conditional to Duration
content = content.replace(
  /<div className="form-control">\s*<label className="label">\s*<span className="label-text">Duration<\/span>\s*<\/label>\s*<div className="flex gap-2">\s*<div className="w-1\/2 flex items-center gap-2">\s*<span className="text-sm font-semibold">Days:<\/span>\s*<input type="text" readOnly className="input input-bordered input-sm w-full bg-slate-50" value=\{formData\.no_of_days\} \/>\s*<\/div>\s*<div className="w-1\/2 flex items-center gap-2">\s*<span className="text-sm font-semibold">Hours:<\/span>\s*<input type="text" readOnly className="input input-bordered input-sm w-full bg-slate-50" value=\{formData\.no_of_hours\} \/>\s*<\/div>\s*<\/div>\s*<\/div>/,
  `{formData.required_date && formData.return_date && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Duration</span>
                </label>
                <div className="flex gap-2">
                  <div className="w-1/2 flex items-center gap-2">
                    <span className="text-sm font-semibold">Days:</span>
                    <input type="text" readOnly className="input input-bordered input-sm w-full bg-slate-50" value={formData.no_of_days} />
                  </div>
                  <div className="w-1/2 flex items-center gap-2">
                    <span className="text-sm font-semibold">Hours:</span>
                    <input type="text" readOnly className="input input-bordered input-sm w-full bg-slate-50" value={formData.no_of_hours} />
                  </div>
                </div>
              </div>
            )}`
);

fs.writeFileSync(filePath, content);
console.log("Updated TransportRequestForm.jsx");
