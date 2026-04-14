$ErrorActionPreference = "Continue"

function Get-IsoUtcNow {
    return (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

function Get-OsCaption {
    try {
        return (Get-CimInstance Win32_OperatingSystem -ErrorAction Stop).Caption
    } catch {
        return "Unknown"
    }
}

function Get-SerialNumber {
    try {
        return (Get-CimInstance Win32_BIOS -ErrorAction Stop).SerialNumber
    } catch {
        return ""
    }
}

function Test-RunningAsAdmin {
    try {
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
        $principal = New-Object Security.Principal.WindowsPrincipal($identity)
        return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch {
        return $false
    }
}

function Get-ProtectionStatusText {
    param(
        $Value
    )

    if ($null -eq $Value) {
        return "Unknown"
    }

    if ($Value -is [int]) {
        switch ([int]$Value) {
            0 { return "Off" }
            1 { return "On" }
            default { return "Unknown" }
        }
    }

    $text = [string]$Value
    if ([string]::IsNullOrWhiteSpace($text)) {
        return "Unknown"
    }

    if ($text -match "^\s*On\s*$") { return "On" }
    if ($text -match "^\s*Off\s*$") { return "Off" }
    if ($text -match "Protection\s+On|Schutz\s+aktiviert|Aktiviert") { return "On" }
    if ($text -match "Protection\s+Off|Schutz\s+deaktiviert|Deaktiviert") { return "Off" }

    return $text
}

function Get-RecoveryKeysFromKeyProtectors {
    param(
        [object[]]$KeyProtectors
    )

    $keys = @()
    $seen = @{}

    if (-not $KeyProtectors) {
        return $keys
    }

    foreach ($kp in $KeyProtectors) {
        $kpType = [string]$kp.KeyProtectorType
        $recoveryPassword = [string]$kp.RecoveryPassword

        if ($kpType -ne "RecoveryPassword") {
            continue
        }

        if ([string]::IsNullOrWhiteSpace($recoveryPassword)) {
            continue
        }

        if ($seen.ContainsKey($recoveryPassword)) {
            continue
        }

        $seen[$recoveryPassword] = $true
        $keys += [ordered]@{
            keyProtectorId = [string]$kp.KeyProtectorId
            recoveryPassword = $recoveryPassword
            source = "Get-BitLockerVolume"
        }
    }

    return $keys
}

function Resolve-ManageBdeCommand {
    $command = Get-Command -Name "manage-bde.exe" -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $command = Get-Command -Name "manage-bde" -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $windowsDir = if ($env:windir) { $env:windir } elseif ($env:SystemRoot) { $env:SystemRoot } else { "" }
    $candidates = @()
    if ($windowsDir) {
        $candidates += (Join-Path $windowsDir "Sysnative\manage-bde.exe")
        $candidates += (Join-Path $windowsDir "System32\manage-bde.exe")
    }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    }

    return $null
}

function Invoke-ManageBde {
    param(
        [string[]]$Arguments
    )

    $commandPath = Resolve-ManageBdeCommand
    if (-not $commandPath) {
        return [ordered]@{
            available = $false
            exitCode = $null
            output = @()
            error = "manage-bde.exe was not found."
        }
    }

    try {
        $output = & $commandPath @Arguments 2>&1 | ForEach-Object { [string]$_ }
        return [ordered]@{
            available = $true
            exitCode = $LASTEXITCODE
            output = @($output)
            error = ""
        }
    } catch {
        return [ordered]@{
            available = $true
            exitCode = $LASTEXITCODE
            output = @()
            error = $_.Exception.Message
        }
    }
}

function Get-ManageBdeStatus {
    param(
        [string]$MountPoint
    )

    $result = Invoke-ManageBde -Arguments @("-status", $MountPoint)
    $text = ($result.output -join "`n")
    $protectionStatus = "Unknown"

    if ($text -match "(?im)Protection\s+Status\s*:\s*Protection\s+On|Schutzstatus\s*:\s*Schutz\s+aktiviert|Schutzstatus\s*:\s*Aktiviert") {
        $protectionStatus = "On"
    } elseif ($text -match "(?im)Protection\s+Status\s*:\s*Protection\s+Off|Schutzstatus\s*:\s*Schutz\s+deaktiviert|Schutzstatus\s*:\s*Deaktiviert") {
        $protectionStatus = "Off"
    }

    return [ordered]@{
        commandAvailable = $result.available
        exitCode = $result.exitCode
        error = $result.error
        protectionStatus = $protectionStatus
        rawOutput = $result.output
    }
}

function Get-ManageBdeRecoveryKeys {
    param(
        [string]$MountPoint
    )

    $result = Invoke-ManageBde -Arguments @("-protectors", "-get", $MountPoint)
    $keys = @()
    $seen = @{}
    $lastProtectorId = ""

    foreach ($line in @($result.output)) {
        if ($line -match "\{[0-9A-Fa-f-]{36}\}") {
            $lastProtectorId = $Matches[0]
        }

        $matches = [regex]::Matches($line, "\b\d{6}(?:-\d{6}){7}\b")
        foreach ($match in $matches) {
            $password = [string]$match.Value
            if ($seen.ContainsKey($password)) {
                continue
            }

            $seen[$password] = $true
            $keys += [ordered]@{
                keyProtectorId = $lastProtectorId
                recoveryPassword = $password
                source = "manage-bde"
            }
        }
    }

    return [ordered]@{
        commandAvailable = $result.available
        exitCode = $result.exitCode
        error = $result.error
        recoveryKeys = $keys
        rawOutput = $result.output
    }
}

function Get-WmiBitLockerVolume {
    param(
        [string]$MountPoint
    )

    try {
        $volumes = @(Get-CimInstance -Namespace "root\CIMV2\Security\MicrosoftVolumeEncryption" -ClassName "Win32_EncryptableVolume" -ErrorAction Stop)
        foreach ($volume in $volumes) {
            if ([string]$volume.DriveLetter -ieq $MountPoint) {
                return [ordered]@{
                    available = $true
                    volume = $volume
                    error = ""
                }
            }
        }

        return [ordered]@{
            available = $true
            volume = $null
            error = "No Win32_EncryptableVolume entry found for $MountPoint."
        }
    } catch {
        return [ordered]@{
            available = $false
            volume = $null
            error = $_.Exception.Message
        }
    }
}

function Get-WmiBitLockerStatus {
    param(
        $Volume
    )

    try {
        $result = Invoke-CimMethod -InputObject $Volume -MethodName "GetProtectionStatus" -ErrorAction Stop
        $status = switch ([int]$result.ProtectionStatus) {
            0 { "Off" }
            1 { "On" }
            2 { "Unknown" }
            default { "Unknown" }
        }

        return [ordered]@{
            succeeded = $true
            protectionStatus = $status
            returnValue = $result.ReturnValue
            error = ""
        }
    } catch {
        return [ordered]@{
            succeeded = $false
            protectionStatus = "Unknown"
            returnValue = $null
            error = $_.Exception.Message
        }
    }
}

function Get-WmiBitLockerRecoveryKeys {
    param(
        $Volume
    )

    $keys = @()

    try {
        $protectorResult = Invoke-CimMethod -InputObject $Volume -MethodName "GetKeyProtectors" -Arguments @{ KeyProtectorType = 3 } -ErrorAction Stop
        foreach ($protectorId in @($protectorResult.VolumeKeyProtectorID)) {
            if ([string]::IsNullOrWhiteSpace([string]$protectorId)) {
                continue
            }

            try {
                $passwordResult = Invoke-CimMethod -InputObject $Volume -MethodName "GetKeyProtectorNumericalPassword" -Arguments @{ VolumeKeyProtectorID = [string]$protectorId } -ErrorAction Stop
                $password = [string]$passwordResult.NumericalPassword
                if ([string]::IsNullOrWhiteSpace($password)) {
                    continue
                }

                $keys += [ordered]@{
                    keyProtectorId = [string]$protectorId
                    recoveryPassword = $password
                    source = "Win32_EncryptableVolume"
                }
            } catch {
            }
        }

        return [ordered]@{
            succeeded = $true
            returnValue = $protectorResult.ReturnValue
            recoveryKeys = $keys
            error = ""
        }
    } catch {
        return [ordered]@{
            succeeded = $false
            returnValue = $null
            recoveryKeys = $keys
            error = $_.Exception.Message
        }
    }
}

function New-AuditPayload {
    param(
        [string]$Status,
        [string]$Summary,
        [object[]]$Checks,
        [object]$Facts,
        [string]$Classification
    )

    return [ordered]@{
        schema = "qt-audit/v1"
        topic = "bitlocker-recovery"
        status = $Status
        collectedAt = $script:checkedAtUtc
        summary = $Summary
        customer = [ordered]@{
            number = ""
            name = ""
        }
        device = [ordered]@{
            hostname = $script:hostname
            serialNumber = $script:serialNumber
            os = $script:osCaption
        }
        source = [ordered]@{
            scriptName = "Workbench_Audit_BitLocker_Recovery"
            scriptVersion = "1.3.0"
        }
        checks = $Checks
        facts = $Facts
        metadata = [ordered]@{
            classification = $Classification
            checkedAtLocal = (Get-Date).ToString("s")
        }
    }
}

$hostname = if ($env:COMPUTERNAME) { $env:COMPUTERNAME } else { $env:HOSTNAME }
$systemDrive = if ($env:SystemDrive) { $env:SystemDrive } else { "C:" }
$checkedAtUtc = Get-IsoUtcNow
$osCaption = Get-OsCaption
$serialNumber = Get-SerialNumber
$isAdmin = Test-RunningAsAdmin
$errors = @()

$bitLockerCmd = Get-Command -Name "Get-BitLockerVolume" -ErrorAction SilentlyContinue
$bitLockerCmdletAvailable = $null -ne $bitLockerCmd
$manageBdePath = Resolve-ManageBdeCommand
$manageBdeAvailable = $null -ne $manageBdePath
$wmiBitLockerAvailable = $null
$wmiBitLockerError = ""

$volumes = @()
$systemVolume = $null
$protectionStatus = "Unknown"
$recoveryKeys = @()
$manageBdeStatus = $null
$manageBdeProtectors = $null
$wmiVolumeResult = $null
$wmiStatus = $null
$wmiProtectors = $null

if ($bitLockerCmdletAvailable) {
    try {
        $volumes = @(Get-BitLockerVolume -ErrorAction Stop)
        foreach ($volume in $volumes) {
            if ([string]$volume.MountPoint -ieq $systemDrive) {
                $systemVolume = $volume
                break
            }
        }
    } catch {
        $errors += "Get-BitLockerVolume failed: $($_.Exception.Message)"
        $volumes = @()
    }

    if (-not $systemVolume) {
        try {
            $systemVolume = Get-BitLockerVolume -MountPoint $systemDrive -ErrorAction Stop
        } catch {
            $errors += "Get-BitLockerVolume for $systemDrive failed: $($_.Exception.Message)"
        }
    }
}

if ($systemVolume) {
    $protectionStatus = Get-ProtectionStatusText -Value $systemVolume.ProtectionStatus
    $recoveryKeys = @(Get-RecoveryKeysFromKeyProtectors -KeyProtectors @($systemVolume.KeyProtector))
}

if ($protectionStatus -eq "Unknown" -or $recoveryKeys.Count -eq 0) {
    $wmiVolumeResult = Get-WmiBitLockerVolume -MountPoint $systemDrive
    $wmiBitLockerAvailable = $wmiVolumeResult.available
    $wmiBitLockerError = $wmiVolumeResult.error

    if ($wmiVolumeResult.volume) {
        $wmiStatus = Get-WmiBitLockerStatus -Volume $wmiVolumeResult.volume
        if ($protectionStatus -eq "Unknown" -and $wmiStatus.protectionStatus -ne "Unknown") {
            $protectionStatus = $wmiStatus.protectionStatus
        }

        $wmiProtectors = Get-WmiBitLockerRecoveryKeys -Volume $wmiVolumeResult.volume
        foreach ($key in @($wmiProtectors.recoveryKeys)) {
            $exists = $false
            foreach ($existingKey in @($recoveryKeys)) {
                if ($existingKey.recoveryPassword -eq $key.recoveryPassword) {
                    $exists = $true
                    break
                }
            }

            if (-not $exists) {
                $recoveryKeys += $key
            }
        }
    } elseif ($wmiBitLockerError) {
        $errors += "Win32_EncryptableVolume lookup failed: $wmiBitLockerError"
    }
}

if ($protectionStatus -eq "Unknown" -and $manageBdeAvailable) {
    $manageBdeStatus = Get-ManageBdeStatus -MountPoint $systemDrive
    if ($manageBdeStatus.protectionStatus -ne "Unknown") {
        $protectionStatus = $manageBdeStatus.protectionStatus
    }
}

if (($protectionStatus -eq "On" -or $recoveryKeys.Count -eq 0) -and $manageBdeAvailable) {
    $manageBdeProtectors = Get-ManageBdeRecoveryKeys -MountPoint $systemDrive
    foreach ($key in @($manageBdeProtectors.recoveryKeys)) {
        $exists = $false
        foreach ($existingKey in @($recoveryKeys)) {
            if ($existingKey.recoveryPassword -eq $key.recoveryPassword) {
                $exists = $true
                break
            }
        }

        if (-not $exists) {
            $recoveryKeys += $key
        }
    }
}

$bitLockerActive = if ($protectionStatus -eq "On") { $true } elseif ($protectionStatus -eq "Off") { $false } else { $null }
$bitLockerAvailable = $bitLockerCmdletAvailable -or $manageBdeAvailable -or ($wmiBitLockerAvailable -eq $true)

$bitLockerSetupStatus = if (-not $bitLockerAvailable) {
    "nicht verfuegbar"
} elseif ($bitLockerActive) {
    "eingerichtet"
} else {
    "verfuegbar nicht eingerichtet"
}

$classification = switch ($bitLockerSetupStatus) {
    "nicht verfuegbar" { "NotAvailable" }
    "verfuegbar nicht eingerichtet" { "AvailableNotConfigured" }
    "eingerichtet" {
        if ($recoveryKeys.Count -gt 0) { "Configured" } else { "ConfiguredNoRecoveryKey" }
    }
    default { "Unknown" }
}

$auditStatus = switch ($classification) {
    "NotAvailable" { "info" }
    "AvailableNotConfigured" { "fail" }
    "Configured" { "pass" }
    "ConfiguredNoRecoveryKey" { "warn" }
    default { "unknown" }
}

$reason = switch ($classification) {
    "NotAvailable" { "BitLocker is not available or not installed on this system." }
    "AvailableNotConfigured" { "BitLocker is available but not configured on the system drive." }
    "ConfiguredNoRecoveryKey" { "BitLocker is configured, but no Recovery Password protector was found." }
    "Configured" { "BitLocker is configured and Recovery Password protector(s) were collected." }
    default { "BitLocker status on the system drive could not be determined reliably." }
}

$allVolumeFacts = @()
foreach ($volume in @($volumes)) {
    $encryptionPercentage = $null
    try {
        if ($null -ne $volume.EncryptionPercentage) {
            $encryptionPercentage = [int]$volume.EncryptionPercentage
        }
    } catch {
        $encryptionPercentage = $null
    }

    $allVolumeFacts += [ordered]@{
        mountPoint = [string]$volume.MountPoint
        volumeType = [string]$volume.VolumeType
        protectionStatus = Get-ProtectionStatusText -Value $volume.ProtectionStatus
        encryptionPercentage = $encryptionPercentage
        volumeStatus = [string]$volume.VolumeStatus
    }
}

$checks = @(
    [ordered]@{
        key = "bitlocker_available"
        label = "BitLocker Available"
        status = if ($bitLockerAvailable) { "pass" } else { "info" }
        expected = "available"
        actual = if ($bitLockerAvailable) { "available" } else { "not-available" }
        message = if ($bitLockerAvailable) { "BitLocker management interface is available." } else { "BitLocker is not available or not installed on this system." }
    },
    [ordered]@{
        key = "bitlocker_system_drive_active"
        label = "BitLocker Active (System Drive)"
        status = if (-not $bitLockerAvailable) { "info" } elseif ($bitLockerActive) { "pass" } else { "fail" }
        expected = "active"
        actual = if (-not $bitLockerAvailable) { "not-available" } elseif ($bitLockerActive) { "active" } else { "inactive-or-not-detected" }
        message = if (-not $bitLockerAvailable) { "BitLocker is not available or not installed on this system." } elseif ($bitLockerActive) { "BitLocker is active on system drive." } else { "BitLocker is available but not configured on the system drive." }
    },
    [ordered]@{
        key = "bitlocker_recovery_password_present"
        label = "Recovery Password Available"
        status = if (-not $bitLockerActive) { "info" } elseif ($recoveryKeys.Count -gt 0) { "pass" } else { "warn" }
        expected = "present"
        actual = if (-not $bitLockerActive) { "not-applicable" } elseif ($recoveryKeys.Count -gt 0) { "present" } else { "missing" }
        message = if (-not $bitLockerActive) { "BitLocker is not configured; recovery password check is not applicable." } elseif ($recoveryKeys.Count -gt 0) { "Recovery password protector found." } else { "No recovery password protector found." }
    }
)

$facts = [ordered]@{
    systemDrive = $systemDrive
    runningAsAdmin = $isAdmin
    bitlockerCmdletAvailable = $bitLockerCmdletAvailable
    wmiBitLockerAvailable = $wmiBitLockerAvailable
    wmiBitLockerError = $wmiBitLockerError
    manageBdeAvailable = $manageBdeAvailable
    manageBdePath = $manageBdePath
    bitlockerAvailable = $bitLockerAvailable
    bitlockerSetupStatus = $bitLockerSetupStatus
    bitlockerActive = $bitLockerActive
    protectionStatus = $protectionStatus
    recoveryKeyCount = $recoveryKeys.Count
    recoveryKeys = $recoveryKeys
    volumes = $allVolumeFacts
    errors = $errors
    wmiProtectionStatusReturnValue = if ($wmiStatus) { $wmiStatus.returnValue } else { $null }
    wmiProtectorsReturnValue = if ($wmiProtectors) { $wmiProtectors.returnValue } else { $null }
    manageBdeStatusExitCode = if ($manageBdeStatus) { $manageBdeStatus.exitCode } else { $null }
    manageBdeProtectorsExitCode = if ($manageBdeProtectors) { $manageBdeProtectors.exitCode } else { $null }
}

$auditPayload = New-AuditPayload -Status $auditStatus -Summary $reason -Checks $checks -Facts $facts -Classification $classification
$auditJson = $auditPayload | ConvertTo-Json -Compress -Depth 8

Write-Output "Hostname: $hostname"
Write-Output "OS: $osCaption"
Write-Output "SystemDrive: $systemDrive"
Write-Output "RunningAsAdmin: $isAdmin"
Write-Output "BitLockerCmdletAvailable: $bitLockerCmdletAvailable"
Write-Output "WmiBitLockerAvailable: $wmiBitLockerAvailable"
Write-Output "ManageBdeAvailable: $manageBdeAvailable"
Write-Output "Status: $bitLockerSetupStatus"
Write-Output "ProtectionStatus: $protectionStatus"
Write-Output "BitLockerActive: $bitLockerActive"
Write-Output "RecoveryKeyCount: $($recoveryKeys.Count)"
if ($recoveryKeys.Count -gt 0) {
    for ($i = 0; $i -lt $recoveryKeys.Count; $i++) {
        Write-Output "RecoveryKey[$($i + 1)]: $($recoveryKeys[$i].recoveryPassword)"
        Write-Output "RecoveryKeySource[$($i + 1)]: $($recoveryKeys[$i].source)"
    }
}
if ($errors.Count -gt 0) {
    foreach ($errorMessage in $errors) {
        Write-Output "Error: $errorMessage"
    }
}
Write-Output "Classification: $classification"
Write-Output "AuditStatus: $auditStatus"
Write-Output "Reason: $reason"
Write-Output ""
Write-Output "[QT-AUDIT]"
Write-Output $auditJson
