BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

-- CreateTable
CREATE TABLE [dbo].[Sites] (
    [Code] NVARCHAR(20) NOT NULL,
    [Name] NVARCHAR(200) NOT NULL,
    [SortOrder] INT NOT NULL CONSTRAINT [Sites_SortOrder_df] DEFAULT 0,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Sites_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [CreatedBy] NVARCHAR(200) NOT NULL CONSTRAINT [Sites_CreatedBy_df] DEFAULT 'system',
    [UpdatedBy] NVARCHAR(200),
    CONSTRAINT [Sites_pkey] PRIMARY KEY CLUSTERED ([Code])
);

-- CreateTable
CREATE TABLE [dbo].[AssetTypes] (
    [TypeName] NVARCHAR(100) NOT NULL,
    [Abbr] NVARCHAR(20),
    [Color] NVARCHAR(20),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [AssetTypes_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [CreatedBy] NVARCHAR(200) NOT NULL CONSTRAINT [AssetTypes_CreatedBy_df] DEFAULT 'system',
    [UpdatedBy] NVARCHAR(200),
    CONSTRAINT [AssetTypes_pkey] PRIMARY KEY CLUSTERED ([TypeName])
);

-- CreateTable
CREATE TABLE [dbo].[Assets] (
    [Id] NVARCHAR(50) NOT NULL,
    [Name] NVARCHAR(300) NOT NULL,
    [AssetType] NVARCHAR(100) NOT NULL,
    [SiteCode] NVARCHAR(20) NOT NULL,
    [Health] INT NOT NULL CONSTRAINT [Assets_Health_df] DEFAULT 100,
    [Status] NVARCHAR(20) NOT NULL CONSTRAINT [Assets_Status_df] DEFAULT 'Healthy',
    [InstallDate] DATE,
    [MotorKw] FLOAT(53),
    [Rpm] FLOAT(53),
    [VgGrade] INT NOT NULL CONSTRAINT [Assets_VgGrade_df] DEFAULT 46,
    [OilBrand] NVARCHAR(200),
    [OilQtyL] FLOAT(53) NOT NULL CONSTRAINT [Assets_OilQtyL_df] DEFAULT 20,
    [OilChangeMonths] INT NOT NULL CONSTRAINT [Assets_OilChangeMonths_df] DEFAULT 6,
    [OilSampleMonths] INT NOT NULL CONSTRAINT [Assets_OilSampleMonths_df] DEFAULT 3,
    [LastUpdate] NVARCHAR(7),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Assets_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [CreatedBy] NVARCHAR(200) NOT NULL CONSTRAINT [Assets_CreatedBy_df] DEFAULT 'system',
    [UpdatedBy] NVARCHAR(200),
    CONSTRAINT [Assets_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[OilReadings] (
    [Id] NVARCHAR(36) NOT NULL,
    [AssetId] NVARCHAR(50) NOT NULL,
    [Period] NVARCHAR(7) NOT NULL,
    [Fe] FLOAT(53),
    [Cu] FLOAT(53),
    [Si] FLOAT(53),
    [Water] FLOAT(53),
    [Visc] FLOAT(53),
    [Tan] FLOAT(53),
    [IsoCode] NVARCHAR(20),
    [Particle4] INT,
    [Particle6] INT,
    [Particle14] INT,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [OilReadings_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [CreatedBy] NVARCHAR(200) NOT NULL CONSTRAINT [OilReadings_CreatedBy_df] DEFAULT 'system',
    [UpdatedBy] NVARCHAR(200),
    CONSTRAINT [OilReadings_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [OilReadings_AssetId_Period_key] UNIQUE NONCLUSTERED ([AssetId],[Period])
);

-- CreateTable
CREATE TABLE [dbo].[VibReadings] (
    [Id] NVARCHAR(36) NOT NULL,
    [AssetId] NVARCHAR(50) NOT NULL,
    [Period] NVARCHAR(7) NOT NULL,
    [Vel] FLOAT(53),
    [Acc] FLOAT(53),
    [Cf] FLOAT(53),
    [Temp] FLOAT(53),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [VibReadings_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [CreatedBy] NVARCHAR(200) NOT NULL CONSTRAINT [VibReadings_CreatedBy_df] DEFAULT 'system',
    [UpdatedBy] NVARCHAR(200),
    CONSTRAINT [VibReadings_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [VibReadings_AssetId_Period_key] UNIQUE NONCLUSTERED ([AssetId],[Period])
);

-- CreateTable
CREATE TABLE [dbo].[MaintenanceRecords] (
    [Id] NVARCHAR(36) NOT NULL,
    [AssetId] NVARCHAR(50) NOT NULL,
    [RecordType] NVARCHAR(10) NOT NULL,
    [WorkDate] DATE,
    [WoNo] NVARCHAR(50),
    [Description] NVARCHAR(max),
    [Parts] NVARCHAR(max),
    [Cost] FLOAT(53) NOT NULL CONSTRAINT [MaintenanceRecords_Cost_df] DEFAULT 0,
    [Technician] NVARCHAR(200),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [MaintenanceRecords_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [CreatedBy] NVARCHAR(200) NOT NULL CONSTRAINT [MaintenanceRecords_CreatedBy_df] DEFAULT 'system',
    [UpdatedBy] NVARCHAR(200),
    CONSTRAINT [MaintenanceRecords_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[AlarmParams] (
    [Id] NVARCHAR(36) NOT NULL,
    [Category] NVARCHAR(10) NOT NULL,
    [ParamKey] NVARCHAR(30) NOT NULL,
    [Name] NVARCHAR(200) NOT NULL,
    [Unit] NVARCHAR(50),
    [Description] NVARCHAR(max),
    [WarnLimit] FLOAT(53),
    [CritLimit] FLOAT(53),
    [WarnPenalty] FLOAT(53),
    [CritPenalty] FLOAT(53),
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [AlarmParams_UpdatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedBy] NVARCHAR(200),
    CONSTRAINT [AlarmParams_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [AlarmParams_Category_ParamKey_key] UNIQUE NONCLUSTERED ([Category],[ParamKey])
);

-- CreateTable
CREATE TABLE [dbo].[ScoreConfigs] (
    [Id] INT NOT NULL CONSTRAINT [ScoreConfigs_Id_df] DEFAULT 1,
    [OilWeight] FLOAT(53) NOT NULL CONSTRAINT [ScoreConfigs_OilWeight_df] DEFAULT 100,
    [VibWeight] FLOAT(53) NOT NULL CONSTRAINT [ScoreConfigs_VibWeight_df] DEFAULT 0,
    [WarnPenalty] FLOAT(53) NOT NULL CONSTRAINT [ScoreConfigs_WarnPenalty_df] DEFAULT 15,
    [CritPenalty] FLOAT(53) NOT NULL CONSTRAINT [ScoreConfigs_CritPenalty_df] DEFAULT 30,
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [ScoreConfigs_UpdatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedBy] NVARCHAR(200),
    CONSTRAINT [ScoreConfigs_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[AssetAlarmOverrides] (
    [Id] NVARCHAR(36) NOT NULL,
    [AssetId] NVARCHAR(50) NOT NULL,
    [Category] NVARCHAR(10) NOT NULL,
    [ParamKey] NVARCHAR(30) NOT NULL,
    [WarnLimit] FLOAT(53),
    [CritLimit] FLOAT(53),
    [WarnPenalty] FLOAT(53),
    [CritPenalty] FLOAT(53),
    CONSTRAINT [AssetAlarmOverrides_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [AssetAlarmOverrides_AssetId_Category_ParamKey_key] UNIQUE NONCLUSTERED ([AssetId],[Category],[ParamKey])
);

-- CreateTable
CREATE TABLE [dbo].[AssetScoreOverrides] (
    [AssetId] NVARCHAR(50) NOT NULL,
    [OilWeight] FLOAT(53),
    [VibWeight] FLOAT(53),
    [WarnPenalty] FLOAT(53),
    [CritPenalty] FLOAT(53),
    CONSTRAINT [AssetScoreOverrides_pkey] PRIMARY KEY CLUSTERED ([AssetId])
);

-- CreateTable
CREATE TABLE [dbo].[Standards] (
    [Id] NVARCHAR(36) NOT NULL,
    [Category] NVARCHAR(20) NOT NULL,
    [Title] NVARCHAR(300) NOT NULL,
    [Subtitle] NVARCHAR(500),
    [Description] NVARCHAR(max),
    [FullText] NVARCHAR(max),
    [Tags] NVARCHAR(max) NOT NULL CONSTRAINT [Standards_Tags_df] DEFAULT '[]',
    [Version] INT NOT NULL CONSTRAINT [Standards_Version_df] DEFAULT 1,
    [RelatedParams] NVARCHAR(max) NOT NULL CONSTRAINT [Standards_RelatedParams_df] DEFAULT '[]',
    [AssetTypes] NVARCHAR(max) NOT NULL CONSTRAINT [Standards_AssetTypes_df] DEFAULT '[]',
    [RelatedStandardIds] NVARCHAR(max) NOT NULL CONSTRAINT [Standards_RelatedStandardIds_df] DEFAULT '[]',
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Standards_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [Standards_UpdatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [CreatedBy] NVARCHAR(200) NOT NULL CONSTRAINT [Standards_CreatedBy_df] DEFAULT 'system',
    [UpdatedBy] NVARCHAR(200),
    CONSTRAINT [Standards_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[ReadingAttachments] (
    [Id] NVARCHAR(36) NOT NULL,
    [AssetId] NVARCHAR(50) NOT NULL,
    [Period] NVARCHAR(7),
    [Kind] NVARCHAR(10),
    [FileName] NVARCHAR(255) NOT NULL,
    [StorageKey] NVARCHAR(300) NOT NULL,
    [ContentType] NVARCHAR(150),
    [FileSize] INT,
    [Checksum] NVARCHAR(64),
    [CreatedBy] NVARCHAR(200),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [ReadingAttachments_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [ReadingAttachments_UpdatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedBy] NVARCHAR(200),
    [IsActive] BIT NOT NULL CONSTRAINT [ReadingAttachments_IsActive_df] DEFAULT 1,
    [IsDeleted] BIT NOT NULL CONSTRAINT [ReadingAttachments_IsDeleted_df] DEFAULT 0,
    CONSTRAINT [ReadingAttachments_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [ReadingAttachments_StorageKey_key] UNIQUE NONCLUSTERED ([StorageKey])
);

-- CreateTable
CREATE TABLE [dbo].[StandardAttachments] (
    [Id] NVARCHAR(36) NOT NULL,
    [StandardId] NVARCHAR(36) NOT NULL,
    [FileName] NVARCHAR(255) NOT NULL,
    [StorageKey] NVARCHAR(300) NOT NULL,
    [ContentType] NVARCHAR(150),
    [FileSize] INT,
    [Checksum] NVARCHAR(64),
    [CreatedBy] NVARCHAR(200),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [StandardAttachments_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [StandardAttachments_UpdatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedBy] NVARCHAR(200),
    [IsActive] BIT NOT NULL CONSTRAINT [StandardAttachments_IsActive_df] DEFAULT 1,
    [IsDeleted] BIT NOT NULL CONSTRAINT [StandardAttachments_IsDeleted_df] DEFAULT 0,
    CONSTRAINT [StandardAttachments_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [StandardAttachments_StorageKey_key] UNIQUE NONCLUSTERED ([StorageKey])
);

-- CreateTable
CREATE TABLE [dbo].[NotificationConfigs] (
    [Id] INT NOT NULL CONSTRAINT [NotificationConfigs_Id_df] DEFAULT 1,
    [FromEmail] NVARCHAR(255) NOT NULL CONSTRAINT [NotificationConfigs_FromEmail_df] DEFAULT 'alerts@ugt-reliability.com',
    [EmailRecipients] NVARCHAR(max) NOT NULL CONSTRAINT [NotificationConfigs_EmailRecipients_df] DEFAULT '[]',
    [EnableCriticalAlerts] BIT NOT NULL CONSTRAINT [NotificationConfigs_EnableCriticalAlerts_df] DEFAULT 1,
    [EnableWeeklySummary] BIT NOT NULL CONSTRAINT [NotificationConfigs_EnableWeeklySummary_df] DEFAULT 0,
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [NotificationConfigs_UpdatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedBy] NVARCHAR(200),
    CONSTRAINT [NotificationConfigs_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[AppSettings] (
    [Id] NVARCHAR(1000) NOT NULL,
    [SettingKey] NVARCHAR(200) NOT NULL,
    [SettingValue] NVARCHAR(max) NOT NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [AppSettings_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [UpdatedBy] NVARCHAR(200),
    CONSTRAINT [AppSettings_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [AppSettings_SettingKey_key] UNIQUE NONCLUSTERED ([SettingKey])
);

-- CreateTable
CREATE TABLE [dbo].[User] (
    [Id] NVARCHAR(1000) NOT NULL,
    [Name] NVARCHAR(1000) NOT NULL,
    [Email] NVARCHAR(1000) NOT NULL,
    [EmailVerified] BIT NOT NULL CONSTRAINT [User_EmailVerified_df] DEFAULT 0,
    [Image] NVARCHAR(max),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [User_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [AuthType] NVARCHAR(1000) NOT NULL CONSTRAINT [User_AuthType_df] DEFAULT 'local',
    [RoleId] NVARCHAR(1000),
    [LdapUsername] NVARCHAR(1000),
    [SiteAccess] NVARCHAR(max) NOT NULL CONSTRAINT [User_SiteAccess_df] DEFAULT '[]',
    [NoRoleNotifiedAt] DATETIME2,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [User_Email_key] UNIQUE NONCLUSTERED ([Email])
);

-- CreateTable
CREATE TABLE [dbo].[Session] (
    [Id] NVARCHAR(1000) NOT NULL,
    [ExpiresAt] DATETIME2 NOT NULL,
    [Token] NVARCHAR(1000) NOT NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Session_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [IpAddress] NVARCHAR(1000),
    [UserAgent] NVARCHAR(max),
    [UserId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [Session_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [Session_Token_key] UNIQUE NONCLUSTERED ([Token])
);

-- CreateTable
CREATE TABLE [dbo].[Account] (
    [Id] NVARCHAR(1000) NOT NULL,
    [AccountId] NVARCHAR(1000) NOT NULL,
    [ProviderId] NVARCHAR(1000) NOT NULL,
    [UserId] NVARCHAR(1000) NOT NULL,
    [AccessToken] NVARCHAR(max),
    [RefreshToken] NVARCHAR(max),
    [IdToken] NVARCHAR(max),
    [AccessTokenExpiresAt] DATETIME2,
    [RefreshTokenExpiresAt] DATETIME2,
    [Scope] NVARCHAR(1000),
    [Password] NVARCHAR(max),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Account_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Account_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [Account_ProviderId_AccountId_key] UNIQUE NONCLUSTERED ([ProviderId],[AccountId])
);

-- CreateTable
CREATE TABLE [dbo].[Verification] (
    [Id] NVARCHAR(1000) NOT NULL,
    [Identifier] NVARCHAR(1000) NOT NULL,
    [VerificationValue] NVARCHAR(max) NOT NULL,
    [ExpiresAt] DATETIME2 NOT NULL,
    [CreatedAt] DATETIME2 CONSTRAINT [Verification_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2,
    CONSTRAINT [Verification_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Role] (
    [Id] NVARCHAR(1000) NOT NULL,
    [Name] NVARCHAR(1000) NOT NULL,
    [Description] NVARCHAR(max),
    [IsSystem] BIT NOT NULL CONSTRAINT [Role_IsSystem_df] DEFAULT 0,
    [MenuMain] NVARCHAR(max),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Role_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Role_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [Role_Name_key] UNIQUE NONCLUSTERED ([Name])
);

-- CreateTable
CREATE TABLE [dbo].[Permission] (
    [Id] NVARCHAR(1000) NOT NULL,
    [PermKey] NVARCHAR(1000) NOT NULL,
    [Label] NVARCHAR(1000) NOT NULL,
    [GroupName] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [Permission_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [Permission_PermKey_key] UNIQUE NONCLUSTERED ([PermKey])
);

-- CreateTable
CREATE TABLE [dbo].[RolePermission] (
    [RoleId] NVARCHAR(1000) NOT NULL,
    [PermissionId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [RolePermission_pkey] PRIMARY KEY CLUSTERED ([RoleId],[PermissionId])
);

-- CreateTable
CREATE TABLE [dbo].[RateLimit] (
    [Id] NVARCHAR(1000) NOT NULL,
    [BucketKey] NVARCHAR(1000),
    [RequestCount] INT NOT NULL,
    [LastRequest] BIGINT NOT NULL,
    CONSTRAINT [RateLimit_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[ActivityLogs] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [UserId] NVARCHAR(1000) NOT NULL,
    [Action] NVARCHAR(1000) NOT NULL,
    [Detail] NVARCHAR(max),
    [TableName] NVARCHAR(100),
    [RecordId] NVARCHAR(200),
    [OldValue] NVARCHAR(max),
    [NewValue] NVARCHAR(max),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [ActivityLogs_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ActivityLogs_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Assets_SiteCode_idx] ON [dbo].[Assets]([SiteCode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Assets_Status_idx] ON [dbo].[Assets]([Status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceRecords_AssetId_idx] ON [dbo].[MaintenanceRecords]([AssetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ReadingAttachments_AssetId_Period_idx] ON [dbo].[ReadingAttachments]([AssetId], [Period]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StandardAttachments_StandardId_idx] ON [dbo].[StandardAttachments]([StandardId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_RoleId_idx] ON [dbo].[User]([RoleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ActivityLogs_CreatedAt_idx] ON [dbo].[ActivityLogs]([CreatedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ActivityLogs_Action_idx] ON [dbo].[ActivityLogs]([Action]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ActivityLogs_UserId_idx] ON [dbo].[ActivityLogs]([UserId]);

-- AddForeignKey
ALTER TABLE [dbo].[Assets] ADD CONSTRAINT [Assets_AssetType_fkey] FOREIGN KEY ([AssetType]) REFERENCES [dbo].[AssetTypes]([TypeName]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Assets] ADD CONSTRAINT [Assets_SiteCode_fkey] FOREIGN KEY ([SiteCode]) REFERENCES [dbo].[Sites]([Code]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OilReadings] ADD CONSTRAINT [OilReadings_AssetId_fkey] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[Assets]([Id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VibReadings] ADD CONSTRAINT [VibReadings_AssetId_fkey] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[Assets]([Id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceRecords] ADD CONSTRAINT [MaintenanceRecords_AssetId_fkey] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[Assets]([Id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetAlarmOverrides] ADD CONSTRAINT [AssetAlarmOverrides_AssetId_fkey] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[Assets]([Id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetScoreOverrides] ADD CONSTRAINT [AssetScoreOverrides_AssetId_fkey] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[Assets]([Id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ReadingAttachments] ADD CONSTRAINT [ReadingAttachments_AssetId_fkey] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[Assets]([Id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[StandardAttachments] ADD CONSTRAINT [StandardAttachments_StandardId_fkey] FOREIGN KEY ([StandardId]) REFERENCES [dbo].[Standards]([Id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_RoleId_fkey] FOREIGN KEY ([RoleId]) REFERENCES [dbo].[Role]([Id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Session] ADD CONSTRAINT [Session_UserId_fkey] FOREIGN KEY ([UserId]) REFERENCES [dbo].[User]([Id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Account] ADD CONSTRAINT [Account_UserId_fkey] FOREIGN KEY ([UserId]) REFERENCES [dbo].[User]([Id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RolePermission] ADD CONSTRAINT [RolePermission_RoleId_fkey] FOREIGN KEY ([RoleId]) REFERENCES [dbo].[Role]([Id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RolePermission] ADD CONSTRAINT [RolePermission_PermissionId_fkey] FOREIGN KEY ([PermissionId]) REFERENCES [dbo].[Permission]([Id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- One NULL per unique column on SQL Server: every SSO row starts with LdapUsername NULL,
-- so the unique is a filtered index (auth-setup references/schema-and-env.md). Prisma's own
-- name on purpose — the next migrate diff finds the unique it expects.
CREATE UNIQUE NONCLUSTERED INDEX [User_LdapUsername_key] ON [dbo].[User]([LdapUsername]) WHERE [LdapUsername] IS NOT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

