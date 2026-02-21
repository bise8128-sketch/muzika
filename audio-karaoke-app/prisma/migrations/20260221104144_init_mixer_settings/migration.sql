-- CreateEnum
CREATE TYPE "SongType" AS ENUM ('AI_SEPARATED', 'DIRECT_KARAOKE');

-- CreateEnum
CREATE TYPE "StemType" AS ENUM ('VOCALS', 'DRUMS', 'BASS', 'OTHER', 'PIANO', 'GUITAR');

-- CreateTable
CREATE TABLE "SongEntry" (
    "id" TEXT NOT NULL,
    "type" "SongType" NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "duration" DOUBLE PRECISION NOT NULL,
    "album" TEXT,
    "genre" TEXT[],
    "year" INTEGER,
    "bpm" DOUBLE PRECISION,
    "key" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" TIMESTAMP(3),
    "originalFileHash" TEXT,
    "originalFileName" TEXT,

    CONSTRAINT "SongEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongVersion" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "versionName" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "pitchAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tempoMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "instrumentalUrl" TEXT,
    "vocalUrl" TEXT,
    "lyricsUrl" TEXT,
    "reverbEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reverbMix" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "echoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "echoFeedback" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "autoStartKaraoke" BOOLEAN NOT NULL DEFAULT false,
    "defaultPitchShift" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "theme" TEXT NOT NULL DEFAULT 'dark',

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardRecord" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "maxCombo" INTEGER NOT NULL DEFAULT 0,
    "perfectionRate" DOUBLE PRECISION,
    "harmonyBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pitchAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tempoMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StemSetting" (
    "id" TEXT NOT NULL,
    "songVersionId" TEXT,
    "presetId" TEXT,
    "type" "StemType" NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "panning" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "solo" BOOLEAN NOT NULL DEFAULT false,
    "reverbSend" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "echoSend" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MixerPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isUserDefault" BOOLEAN NOT NULL DEFAULT false,
    "songVersionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MixerPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SongEntryToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SongEntryToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "SongEntry_originalFileHash_key" ON "SongEntry"("originalFileHash");

-- CreateIndex
CREATE INDEX "SongEntry_title_idx" ON "SongEntry"("title");

-- CreateIndex
CREATE INDEX "SongEntry_artist_idx" ON "SongEntry"("artist");

-- CreateIndex
CREATE INDEX "SongEntry_type_idx" ON "SongEntry"("type");

-- CreateIndex
CREATE UNIQUE INDEX "SongVersion_songId_versionName_key" ON "SongVersion"("songId", "versionName");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "LeaderboardRecord_songId_idx" ON "LeaderboardRecord"("songId");

-- CreateIndex
CREATE INDEX "LeaderboardRecord_score_idx" ON "LeaderboardRecord"("score" DESC);

-- CreateIndex
CREATE INDEX "LeaderboardRecord_createdAt_idx" ON "LeaderboardRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MixerPreset_songVersionId_name_key" ON "MixerPreset"("songVersionId", "name");

-- CreateIndex
CREATE INDEX "_SongEntryToTag_B_index" ON "_SongEntryToTag"("B");

-- AddForeignKey
ALTER TABLE "SongVersion" ADD CONSTRAINT "SongVersion_songId_fkey" FOREIGN KEY ("songId") REFERENCES "SongEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardRecord" ADD CONSTRAINT "LeaderboardRecord_songId_fkey" FOREIGN KEY ("songId") REFERENCES "SongEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StemSetting" ADD CONSTRAINT "StemSetting_songVersionId_fkey" FOREIGN KEY ("songVersionId") REFERENCES "SongVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StemSetting" ADD CONSTRAINT "StemSetting_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "MixerPreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MixerPreset" ADD CONSTRAINT "MixerPreset_songVersionId_fkey" FOREIGN KEY ("songVersionId") REFERENCES "SongVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SongEntryToTag" ADD CONSTRAINT "_SongEntryToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "SongEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SongEntryToTag" ADD CONSTRAINT "_SongEntryToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
