-- CreateTable
CREATE TABLE "UsedNonce" (
    "id" SERIAL NOT NULL,
    "nonce" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsedNonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsedNonce_nonce_key" ON "UsedNonce"("nonce");
