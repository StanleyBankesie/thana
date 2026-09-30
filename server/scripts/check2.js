import('./db/pool.js').then(m => m.query('SELECT id, company_id, doc_type FROM adm_document_templates').then(r => { console.log(r); process.exit(0); }).catch(console.error));
