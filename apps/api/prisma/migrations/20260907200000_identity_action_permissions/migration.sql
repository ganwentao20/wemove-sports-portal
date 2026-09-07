INSERT INTO "Permission" ("id","code","name","group") VALUES
('identity_action_0','catalog:product:create','Product create','catalog'),
('identity_action_1','catalog:product:edit','Product edit','catalog'),
('identity_action_2','catalog:product:publish','Product publish','catalog'),
('identity_action_3','catalog:product:archive','Product archive','catalog'),
('identity_action_4','catalog:product:export','Product export','catalog'),
('identity_action_5','catalog:product:import','Product import','catalog') ON CONFLICT ("code") DO NOTHING;
INSERT INTO "Role" ("id","code","name") VALUES ('identity_role_CUSTOMER_SUPPORT','CUSTOMER_SUPPORT','Customer support') ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."code"='CUSTOMER_SUPPORT' AND p."code" IN ('order:read','order:write','contact:read','contact:write','user:read','user:write','b2b:read','reports:read') ON CONFLICT DO NOTHING;
INSERT INTO "Role" ("id","code","name") VALUES ('identity_role_CONTENT_OPERATOR','CONTENT_OPERATOR','Content operations') ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."code"='CONTENT_OPERATOR' AND p."code" IN ('cms:read','cms:write','media:read','media:write','reports:read') ON CONFLICT DO NOTHING;
INSERT INTO "Role" ("id","code","name") VALUES ('identity_role_DEALER_OPERATOR','DEALER_OPERATOR','Dealer operations') ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."code"='DEALER_OPERATOR' AND p."code" IN ('b2b:read','b2b:write','media:read','reports:read') ON CONFLICT DO NOTHING;
INSERT INTO "Role" ("id","code","name") VALUES ('identity_role_ADMIN','ADMIN','Administrator') ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."code"='ADMIN' AND p."code" IN ('catalog:product:read','catalog:product:write','catalog:price:write','order:read','order:write','b2b:read','b2b:write','cms:read','cms:write','media:read','media:write','contact:read','contact:write','user:read','user:write','reports:read','reports:financial:read') ON CONFLICT DO NOTHING;
