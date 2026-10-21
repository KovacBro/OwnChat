; OwnChat installer (Inno Setup 6)
; Build from the repository root:
;   installer\build-release.ps1 -Version 0.1.0

#ifndef MyAppVersion
  #define MyAppVersion "0.1.0"
#endif

#define MyAppName "OwnChat"
#define MyAppPublisher "KovacBro"
#define MyAppURL "https://github.com/KovacBro/OwnChat"
#define MyAppExeName "OwnChat.exe"

[Setup]
AppId={{FAC944F2-93E8-41E7-977E-E2B586291FBA}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={localappdata}\Programs\OwnChat
DefaultGroupName=OwnChat
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=OwnChat-{#MyAppVersion}-win64-setup
SetupIconFile=OwnChat.ico
UninstallDisplayIcon={app}\OwnChat.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} installer
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}
LicenseFile=..\LICENSE

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加任务:"; Flags: unchecked

[Files]
Source: "..\.build\staging\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "OwnChat.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\OwnChat"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\start.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\OwnChat.ico"
Name: "{autodesktop}\OwnChat"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\start.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\OwnChat.ico"; Tasks: desktopicon

[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\start.vbs"""; Description: "启动 OwnChat"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\stop.ps1"""; Flags: runhidden; RunOnceId: "StopOwnChat"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\data\edge-profile"
