-- Keep OAuth identities tenant-scoped. PostgreSQL allows multiple NULL values
-- here, so users without OAuth details are unaffected.
CREATE UNIQUE INDEX "User_tenantId_oauthProvider_oauthId_key"
ON "User"("tenantId", "oauthProvider", "oauthId");
