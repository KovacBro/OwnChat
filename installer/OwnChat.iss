; OwnChat installer (Inno Setup 6)
; Build from the repository root:
;   powershell -File installer\build-release.ps1 -Version 0.2.0
;
; Design notes
; - Per-user install: everything lives under %LOCALAPPDATA%, no admin needed.
; - data\ is never touched by install, upgrade or uninstall.
; - A running instance is stopped before files are copied; otherwise Windows
;   refuses to replace node.exe and Setup reports "Error 5: Access denied".
; - Before the install starts we prove the target directory is writable and
;   stop with a readable message instead of a raw Win32 error.

#ifndef MyAppVersion
  #define MyAppVersion "0.2.0"
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
DisableDirPage=no
PrivilegesRequired=lowest
UsePreviousAppDir=yes
CloseApplications=yes
RestartApplications=no
SetupLogging=yes
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

[Code]

{ Kill the process recorded in data\server.pid, plus any stray launcher.
  Uses taskkill.exe directly: no PowerShell, no execution-policy dependency. }
procedure StopRunningApp();
var
  ResultCode: Integer;
  PidFile: String;
  Lines: TArrayOfString;
  Pid: String;
begin
  PidFile := ExpandConstant('{app}\data\server.pid');
  if FileExists(PidFile) and LoadStringsFromFile(PidFile, Lines) and (GetArrayLength(Lines) > 0) then
  begin
    Pid := Trim(Lines[0]);
    if Pid <> '' then
      Exec(ExpandConstant('{sys}\taskkill.exe'), '/PID ' + Pid + ' /F /T',
        '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/IM {#MyAppExeName} /F',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(400);
end;

{ Create the directory if needed, then prove we can write a file into it. }
function DirIsWritable(const Dir: String): Boolean;
var
  Probe: String;
  Stream: TFileStream;
begin
  Result := False;
  if not ForceDirectories(Dir) then Exit;
  Probe := AddBackslash(Dir) + '.ownchat-write-probe';
  try
    Stream := TFileStream.Create(Probe, fmCreate);
    try
      Result := True;
    finally
      Stream.Free;
    end;
  except
    Result := False;
  end;
  if Result then
    DeleteFile(Probe);
end;

{ Fail early, on the directory page, with a message a user can act on. }
function NextButtonClick(CurPageID: Integer): Boolean;
var
  Dir: String;
begin
  Result := True;
  if CurPageID = wpSelectDir then
  begin
    Dir := WizardForm.DirEdit.Text;
    if not DirIsWritable(Dir) then
    begin
      MsgBox('无法写入这个目录：' + #13#10 + Dir + #13#10 + #13#10 +
             '常见原因：' + #13#10 +
             '1. OwnChat 仍在运行（请在任务管理器里结束 node.exe）' + #13#10 +
             '2. 该目录是上一个安装用管理员权限创建的，当前账户没有写权限' + #13#10 +
             '3. 杀毒软件 / 安全策略锁定了这个目录' + #13#10 + #13#10 +
             '请退出 OwnChat 后重试，或点「浏览」换一个目录（例如文档下的文件夹），' + #13#10 +
             '也可以直接使用便携版 ZIP，解压即用。',
             mbError, MB_OK);
      Result := False;
    end;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  StopRunningApp();
  if DirIsWritable(ExpandConstant('{app}')) then
    Result := ''
  else
    Result := '安装目录不可写：' + ExpandConstant('{app}') + #13#10 +
      '请退出 OwnChat、检查杀毒软件，或改用便携版 ZIP。';
end;
