USE omnisuite;

INSERT INTO adm_users (id, company_id, branch_id, username, email, password_hash, full_name, is_active)
VALUES (1, 1, 1, 'admin', 'admin@company.com', '$2a$10$x.59rYiGsPmrPPv8psJ8qeE47EmAQ5ZdB8AiRHk5d3XRISmXlt0A.', 'System Admin', 1)
ON DUPLICATE KEY UPDATE username = VALUES(username), email = VALUES(email), password_hash = VALUES(password_hash), full_name = VALUES(full_name), is_active = VALUES(is_active);

INSERT INTO adm_user_roles (user_id, role_id)
VALUES (1, 1)
ON DUPLICATE KEY UPDATE role_id = role_id;
