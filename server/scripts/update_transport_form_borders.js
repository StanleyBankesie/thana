import fs from 'fs';

const filePath = 'client/src/pages/modules/transport/requests/TransportRequestForm.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove border-2 border-slate-300 everywhere in the file
content = content.replace(/ border-2 border-slate-300/g, '');

// 2. Wrap Purpose of Journey and Notes in a col-span-3 2-col grid to put them perfectly on the same row.
content = content.replace(
  /<div className="form-control md:col-span-2">\s*<label className="label">\s*<span className="label-text font-semibold">Purpose of Journey<\/span>[\s\S]*?<textarea\s*name="notes"[\s\S]*?<\/div>/,
  `<div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Purpose of Journey</span>
              </label>
              <textarea
                name="purpose_of_journey"
                className="textarea textarea-bordered w-full"
                rows={3}
                value={formData.purpose_of_journey}
                onChange={handleChange}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Notes</span>
              </label>
              <textarea
                name="notes"
                className="textarea textarea-bordered w-full"
                rows={3}
                value={formData.notes}
                onChange={handleChange}
                placeholder="Any special handling instructions..."
              />
            </div>
          </div>`
);

fs.writeFileSync(filePath, content);
console.log("Updated borders and grid for Purpose of Journey and Notes");
