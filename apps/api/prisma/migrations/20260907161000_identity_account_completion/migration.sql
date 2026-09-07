ALTER TABLE "User" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "phone" TEXT, ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN "marketingEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "marketingSms" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mfaSecret" TEXT, ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Staff" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "permissionOverrides" JSONB NOT NULL DEFAULT '{}';
CREATE TABLE "AuthenticationSession" (
 "id" TEXT PRIMARY KEY, "ownerId" TEXT NOT NULL, "ownerKind" TEXT NOT NULL,
 "authVersion" INTEGER NOT NULL, "mfaVerified" BOOLEAN NOT NULL DEFAULT false,
 "ip" TEXT, "userAgent" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3)
);
CREATE INDEX "AuthenticationSession_ownerKind_ownerId_revokedAt_idx" ON "AuthenticationSession"("ownerKind","ownerId","revokedAt");
CREATE TABLE "StaffLoginChallenge" (
 "id" TEXT PRIMARY KEY, "tokenHash" TEXT NOT NULL UNIQUE, "staffId" TEXT NOT NULL,
 "authVersion" INTEGER NOT NULL, "setupSecret" TEXT, "attempts" INTEGER NOT NULL DEFAULT 0,
 "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "StaffLoginChallenge_staffId_expiresAt_idx" ON "StaffLoginChallenge"("staffId","expiresAt");
CREATE TABLE "AccountAddress" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "label" TEXT NOT NULL, "recipient" TEXT NOT NULL, "phone" TEXT NOT NULL, "country" TEXT NOT NULL,
 "region" TEXT NOT NULL, "city" TEXT NOT NULL, "postalCode" TEXT NOT NULL, "line1" TEXT NOT NULL,
 "line2" TEXT NOT NULL DEFAULT '', "isDefaultBilling" BOOLEAN NOT NULL DEFAULT false,
 "isDefaultShipping" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AccountAddress_userId_idx" ON "AccountAddress"("userId");
CREATE UNIQUE INDEX "AccountAddress_default_billing" ON "AccountAddress"("userId") WHERE "isDefaultBilling" = true;
CREATE UNIQUE INDEX "AccountAddress_default_shipping" ON "AccountAddress"("userId") WHERE "isDefaultShipping" = true;
CREATE TABLE "AccountFavorite" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "productId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AccountFavorite_userId_productId_key" ON "AccountFavorite"("userId","productId");
CREATE TABLE "AccountPrivacyRequest" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "type" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN', "reason" TEXT NOT NULL, "resolution" TEXT,
 "handledBy" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" TIMESTAMP(3)
);
CREATE INDEX "AccountPrivacyRequest_status_createdAt_idx" ON "AccountPrivacyRequest"("status","createdAt");
INSERT INTO "Permission" ("id","code","name","group") VALUES
('identity_perm_rbac','system:rbac:write','Manage roles and permissions','system'),
('identity_perm_settings','system:settings:write','Manage system settings','system'),
('identity_perm_user_read','user:read','Read customer accounts','user'),
('identity_perm_user_write','user:write','Manage customer accounts and privacy','user'),
('identity_perm_financial','reports:financial:read','Read financial report amounts','reports'),
('identity_perm_reports','reports:read','Read reports','reports'),
('identity_perm_cms_read','cms:read','Read content','cms'),
('identity_perm_cms_write','cms:write','Manage content','cms'),
('identity_perm_media_read','media:read','Read media','media'),
('identity_perm_media_write','media:write','Manage media','media'),
('identity_perm_b2b_read','b2b:read','Read dealer operations','b2b'),
('identity_perm_b2b_write','b2b:write','Manage dealer operations','b2b'),
('identity_perm_contact_read','contact:read','Read customer support','contact'),
('identity_perm_contact_write','contact:write','Manage customer support','contact') ON CONFLICT ("code") DO NOTHING;
