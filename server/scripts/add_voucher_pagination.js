const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../client/src/pages/modules/finance/vouchers');
const files = fs.readdirSync(dir).filter(f => f.endsWith('List.jsx') || f === 'VoucherListPage.jsx');

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Skip if already processed
  if (content.includes('const [page, setPage] = useState(1);')) {
    console.log(`Skipping ${file}, already processed.`);
    continue;
  }

  // 1. Add pagination state
  content = content.replace(
    'const [items, setItems] = useState([]);',
    `const [items, setItems] = useState([]);\n  const [page, setPage] = useState(1);\n  const [totalPages, setTotalPages] = useState(1);\n  const [totalCount, setTotalCount] = useState(0);`
  );

  // 2. Update load() signature
  content = content.replace(
    'async function load() {',
    'async function load(currentPage = page) {'
  );

  // 3. Update API params
  content = content.replace(
    /to: to \|\| undefined,?\s*}/,
    `to: to || undefined,\n          page: currentPage,\n          limit: 50,\n        }`
  );

  // 4. Update state from response
  content = content.replace(
    'setItems(res.data?.items || []);',
    `setItems(res.data?.items || []);\n      if (res.data?.pagination) {\n        setTotalPages(res.data.pagination.totalPages || 1);\n        setTotalCount(res.data.pagination.total || 0);\n        setPage(currentPage);\n      }`
  );

  // 5. Add pagination UI
  // We can just find </table>\s*</div>\s*</div>
  const paginationUI = `
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 p-4 bg-base-100 rounded-lg shadow-sm border border-base-200">
              <span className="text-sm text-base-content/70">
                Showing page {page} of {totalPages}
                {totalCount > 0 && \` (\${totalCount} total vouchers)\`}
              </span>
              <div className="join">
                <button
                  className="join-item btn btn-sm"
                  disabled={page === 1}
                  onClick={() => load(Math.max(1, page - 1))}
                >
                  «
                </button>
                <button className="join-item btn btn-sm">Page {page}</button>
                <button
                  className="join-item btn btn-sm"
                  disabled={page === totalPages}
                  onClick={() => load(Math.min(totalPages, page + 1))}
                >
                  »
                </button>
              </div>
            </div>
          )}`;
  
  content = content.replace(
    /<\/table>\s*<\/div>\s*<\/div>/,
    `</table>\n          </div>${paginationUI}\n        </div>`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${file}`);
}
