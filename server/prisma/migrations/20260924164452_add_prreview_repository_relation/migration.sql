-- CreateIndex
CREATE INDEX "PRReview_repositoryId_idx" ON "PRReview"("repositoryId");

-- AddForeignKey
ALTER TABLE "PRReview" ADD CONSTRAINT "PRReview_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
