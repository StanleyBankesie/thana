import('./db/pool.js').then(m => m.query('SELECT doc_type, html_content FROM adm_document_templates').then(r => { console.log(r); process.exit(0); }).catch(console.error));
