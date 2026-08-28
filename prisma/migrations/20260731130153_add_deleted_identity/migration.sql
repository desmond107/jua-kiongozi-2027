-- CreateTable
CREATE TABLE "deleted_identities" (
    "id" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "idNumberHash" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deleted_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deleted_identities_phoneHash_key" ON "deleted_identities"("phoneHash");

-- CreateIndex
CREATE UNIQUE INDEX "deleted_identities_idNumberHash_key" ON "deleted_identities"("idNumberHash");
