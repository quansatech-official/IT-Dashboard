$ErrorActionPreference = "Stop"

function Get-OsCaption {
    try {
        return (Get-CimInstance Win32_OperatingSystem).Caption
    } catch {
        return "Unknown"
    }
}

function Get-FirmwareType {
    try {
        $computerInfo = Get-ComputerInfo -Property "BiosFirmwareType" -ErrorAction Stop
        $biosFirmwareType = [string]$computerInfo.BiosFirmwareType
        if ($biosFirmwareType -match "UEFI") { return "UEFI" }
        if ($biosFirmwareType -match "Legacy|BIOS") { return "BIOS" }
    } catch {
    }

    try {
        $firmwareType = $env:firmware_type
        if ($firmwareType -match "UEFI") { return "UEFI" }
        if ($firmwareType -match "Legacy|BIOS") { return "BIOS" }
    } catch {
    }

    try {
        $val = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control" -Name "PEFirmwareType" -ErrorAction Stop).PEFirmwareType
        switch ([int]$val) {
            1 { return "BIOS" }
            2 { return "UEFI" }
        }
    } catch {
    }

    return "Unknown"
}

function Get-SecureBootEnabled {
    try {
        $sb = Confirm-SecureBootUEFI
        return [bool]$sb
    } catch {
        $msg = $_.Exception.Message
        if ($msg -match "Cmdlet not supported on this platform") { return $null }
        if ($msg -match "Unable to set proper privileges") { return $null }
        if ($msg -match "The system does not support Secure Boot") { return $null }
        return $null
    }
}

function Get-RegValueSafe {
    param(
        [string]$Path,
        [string]$Name
    )
    try {
        return (Get-ItemProperty -Path $Path -Name $Name -ErrorAction Stop).$Name
    } catch {
        return $null
    }
}

function Get-LatestEvent {
    param(
        [int[]]$Ids
    )
    try {
        return Get-WinEvent -FilterHashtable @{
            LogName = "System"
            ProviderName = "TPM-WMI"
            Id = $Ids
        } -MaxEvents 20 | Sort-Object TimeCreated -Descending | Select-Object -First 1
    } catch {
        return $null
    }
}

function Convert-ClassificationToAuditStatus {
    param(
        [string]$Classification
    )
    switch ($Classification) {
        "Updated" { return "pass" }
        "ActionNeeded" { return "fail" }
        "Error" { return "error" }
        "Pending" { return "warn" }
        "NeedsReview" { return "warn" }
        "NotApplicable" { return "info" }
        default { return "unknown" }
    }
}

function Get-IsoUtcNow {
    return (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

function Format-CertificateDateUtc {
    param(
        $Value
    )
    if ($null -eq $Value) {
        return $null
    }
    try {
        return ([datetime]$Value).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    } catch {
        return $null
    }
}

function Get-EmbeddedX509Certificates {
    param(
        [byte[]]$Bytes,
        [string]$VariableName
    )

    if ($null -eq $Bytes -or $Bytes.Length -lt 4) {
        return @()
    }

    $results = @()
    $seenThumbprints = @{}

    for ($index = 0; $index -le ($Bytes.Length - 4); $index++) {
        if ($Bytes[$index] -ne 0x30 -or $Bytes[$index + 1] -ne 0x82) {
            continue
        }

        $contentLength = ([int]$Bytes[$index + 2] -shl 8) + [int]$Bytes[$index + 3]
        $certificateLength = $contentLength + 4

        if ($certificateLength -le 4 -or ($index + $certificateLength) -gt $Bytes.Length) {
            continue
        }

        $candidate = New-Object byte[] $certificateLength
        [Array]::Copy($Bytes, $index, $candidate, 0, $certificateLength)

        try {
            $certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList @(, $candidate)
        } catch {
            continue
        }

        if (-not $certificate -or [string]::IsNullOrWhiteSpace($certificate.Thumbprint)) {
            continue
        }

        if ($seenThumbprints.ContainsKey($certificate.Thumbprint)) {
            continue
        }

        $seenThumbprints[$certificate.Thumbprint] = $true

        try {
            $simpleName = $certificate.GetNameInfo(
                [System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName,
                $false
            )
        } catch {
            $simpleName = ""
        }

        $results += [pscustomobject]@{
            variable = $VariableName
            simpleName = $simpleName
            subject = $certificate.Subject
            issuer = $certificate.Issuer
            thumbprint = $certificate.Thumbprint
            notBefore = Format-CertificateDateUtc -Value $certificate.NotBefore
            notAfter = Format-CertificateDateUtc -Value $certificate.NotAfter
        }
    }

    return $results
}

function Get-SecureBootCertificateInventory {
    $inventory = @()

    foreach ($variableName in @("KEK", "db")) {
        try {
            $uefiVariable = Get-SecureBootUEFI -Name $variableName -ErrorAction Stop
            $variableBytes = @($uefiVariable.Bytes)
            if ($variableBytes.Length -gt 0) {
                $inventory += Get-EmbeddedX509Certificates -Bytes $variableBytes -VariableName $variableName
            }
        } catch {
        }
    }

    return $inventory
}

function Find-SecureBootCertificate {
    param(
        [object[]]$Certificates,
        [string]$VariableName,
        [string[]]$Patterns
    )

    if (-not $Certificates -or -not $Patterns) {
        return $null
    }

    foreach ($certificate in $Certificates) {
        if ($VariableName -and $certificate.variable -ne $VariableName) {
            continue
        }

        $candidateText = @(
            [string]$certificate.simpleName,
            [string]$certificate.subject,
            [string]$certificate.issuer
        ) -join " | "

        foreach ($pattern in $Patterns) {
            if ($candidateText -match $pattern) {
                return $certificate
            }
        }
    }

    return $null
}

function Get-RelevantSecureBootCertificates {
    param(
        [object[]]$Certificates
    )

    $definitions = @(
        [ordered]@{
            key = "kek2011"
            label = "KEK 2011"
            variable = "KEK"
            patterns = @("KEK( 2K)? CA 2011")
        },
        [ordered]@{
            key = "kek2023"
            label = "KEK 2023"
            variable = "KEK"
            patterns = @("KEK 2K CA 2023")
        },
        [ordered]@{
            key = "uefiCa2011"
            label = "UEFI CA 2011"
            variable = "db"
            patterns = @("UEFI CA 2011")
        },
        [ordered]@{
            key = "uefiCa2023"
            label = "UEFI CA 2023"
            variable = "db"
            patterns = @("UEFI CA 2023")
        }
    )

    $relevant = @()

    foreach ($definition in $definitions) {
        $match = Find-SecureBootCertificate -Certificates $Certificates -VariableName $definition.variable -Patterns $definition.patterns
        if (-not $match) {
            continue
        }

        $relevant += [ordered]@{
            key = $definition.key
            label = $definition.label
            variable = $match.variable
            simpleName = $match.simpleName
            subject = $match.subject
            issuer = $match.issuer
            thumbprint = $match.thumbprint
            notBefore = $match.notBefore
            notAfter = $match.notAfter
        }
    }

    return $relevant
}

$osCaption = Get-OsCaption
$firmwareType = Get-FirmwareType
$secureBootEnabled = Get-SecureBootEnabled
$hostname = $env:COMPUTERNAME

if ($firmwareType -eq "Unknown" -and $null -ne $secureBootEnabled) {
    $firmwareType = "UEFI"
}

$regBase = "HKLM:\SYSTEM\CurrentControlSet\Control\SecureBoot"
$regServicing = "HKLM:\SYSTEM\CurrentControlSet\Control\SecureBoot\Servicing"

$availableUpdates = Get-RegValueSafe -Path $regBase -Name "AvailableUpdates"
$uefiCaStatus = Get-RegValueSafe -Path $regServicing -Name "UEFICA2023Status"
$uefiCaError = Get-RegValueSafe -Path $regServicing -Name "UEFICA2023Error"
$uefiCaErrorEvent = Get-RegValueSafe -Path $regServicing -Name "UEFICA2023ErrorEvent"

$latestEvent = Get-LatestEvent -Ids @(1801, 1808)
$latestEventId = $null
$latestEventTime = $null
if ($latestEvent) {
    $latestEventId = $latestEvent.Id
    $latestEventTime = $latestEvent.TimeCreated.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

$secureBootUpdateTaskExists = $false
try {
    $task = Get-ScheduledTask -TaskPath "\Microsoft\Windows\PI\" -TaskName "Secure-Boot-Update" -ErrorAction Stop
    if ($task) { $secureBootUpdateTaskExists = $true }
} catch {
    $secureBootUpdateTaskExists = $false
}

$secureBootCertificates = Get-SecureBootCertificateInventory
$relevantSecureBootCertificates = Get-RelevantSecureBootCertificates -Certificates $secureBootCertificates
$earliestRelevantCertificateExpiry = $null
if ($relevantSecureBootCertificates) {
    $notAfterValues = @(
        $relevantSecureBootCertificates |
            Where-Object { $_.notAfter } |
            ForEach-Object {
                try {
                    [datetime]$_.notAfter
                } catch {
                    $null
                }
            } |
            Where-Object { $null -ne $_ }
    )
    if ($notAfterValues.Count -gt 0) {
        $earliestRelevantCertificateExpiry = Format-CertificateDateUtc -Value ($notAfterValues | Sort-Object | Select-Object -First 1)
    }
}

$classification = "Unknown"
$relevant = $true
$reason = ""
$certificateUpdateNeeded = $null
$certificateUpdateState = "unknown"

if ($firmwareType -eq "BIOS") {
    $classification = "NotApplicable"
    $relevant = $false
    $reason = "System is not booting in UEFI mode."
    $certificateUpdateNeeded = $false
    $certificateUpdateState = "not-applicable"
}
elseif ($firmwareType -ne "UEFI") {
    $classification = "Unknown"
    $relevant = $true
    $reason = "Could not determine firmware boot mode reliably."
    $certificateUpdateNeeded = $null
    $certificateUpdateState = "unknown"
}
elseif ($null -eq $secureBootEnabled) {
    $classification = "Unknown"
    $relevant = $true
    $reason = "Could not determine Secure Boot state reliably."
    $certificateUpdateNeeded = $null
    $certificateUpdateState = "unknown"
}
elseif (-not $secureBootEnabled) {
    $classification = "ActionNeeded"
    $relevant = $true
    $reason = "UEFI device with Secure Boot disabled. Microsoft states disabled devices do not receive new Secure Boot certificates in firmware."
    $certificateUpdateNeeded = $true
    $certificateUpdateState = "blocked"
}
elseif ($latestEventId -eq 1808 -or $uefiCaStatus -eq "Updated") {
    $classification = "Updated"
    $relevant = $false
    $reason = "Required Secure Boot 2023 certificates appear to be deployed successfully."
    $certificateUpdateNeeded = $false
    $certificateUpdateState = "completed"
}
elseif ($uefiCaError -or $uefiCaErrorEvent) {
    $classification = "Error"
    $relevant = $true
    $reason = "Secure Boot certificate deployment shows an error state."
    $certificateUpdateNeeded = $true
    $certificateUpdateState = "error"
}
elseif ($uefiCaStatus) {
    $classification = "Pending"
    $relevant = $true
    $reason = "Secure Boot certificate deployment is not yet completed."
    $certificateUpdateNeeded = $true
    $certificateUpdateState = "in-progress"
}
else {
    $classification = "NeedsReview"
    $relevant = $true
    $reason = "UEFI plus Secure Boot enabled, but no completed 2023 certificate status detected yet."
    $certificateUpdateNeeded = $true
    $certificateUpdateState = "required"
}

$auditStatus = Convert-ClassificationToAuditStatus -Classification $classification
$checkedAtUtc = Get-IsoUtcNow

Write-Output "OS: $osCaption"
Write-Output "Hostname: $hostname"
Write-Output "FirmwareType: $firmwareType"
Write-Output "SecureBootEnabled: $secureBootEnabled"
Write-Output "UEFICA2023Status: $uefiCaStatus"
Write-Output "UEFICA2023Error: $uefiCaError"
Write-Output "UEFICA2023ErrorEvent: $uefiCaErrorEvent"
Write-Output "AvailableUpdates: $availableUpdates"
Write-Output "Secure-Boot-Update Task Exists: $secureBootUpdateTaskExists"
Write-Output "Latest TPM-WMI Event ID: $latestEventId"
Write-Output "Latest TPM-WMI Event Time: $latestEventTime"
Write-Output "Classification: $classification"
Write-Output "AuditStatus: $auditStatus"
Write-Output "Relevant: $relevant"
Write-Output "CertificateUpdateNeeded: $certificateUpdateNeeded"
Write-Output "CertificateUpdateState: $certificateUpdateState"
Write-Output "Relevant Secure Boot Certificates: $($relevantSecureBootCertificates.Count)"
Write-Output "Earliest Relevant Certificate Expiry: $earliestRelevantCertificateExpiry"
Write-Output "Reason: $reason"
Write-Output ""

$auditPayload = [ordered]@{
    schema = "qt-audit/v1"
    topic = "secure-boot"
    status = $auditStatus
    collectedAt = $checkedAtUtc
    summary = $reason
    customer = [ordered]@{
        number = ""
        name = ""
    }
    device = [ordered]@{
        hostname = $hostname
        serialNumber = ""
        os = $osCaption
    }
    source = [ordered]@{
        scriptName = "Workbench_Audit_SecureBoot2026"
        scriptVersion = "1.0.3"
    }
    checks = @(
        [ordered]@{
            key = "secure_boot_enabled"
            label = "Secure Boot Enabled"
            status = if ($null -eq $secureBootEnabled) { "unknown" } elseif ($secureBootEnabled) { "pass" } else { "fail" }
            expected = "enabled"
            actual = if ($null -eq $secureBootEnabled) { "unknown" } elseif ($secureBootEnabled) { "enabled" } else { "disabled" }
            message = if ($null -eq $secureBootEnabled) { "Secure Boot state could not be determined." } elseif ($secureBootEnabled) { "Secure Boot is enabled." } else { "Secure Boot is disabled." }
        },
        [ordered]@{
            key = "uefi_firmware"
            label = "Boot Firmware Type"
            status = if ($firmwareType -eq "UEFI") { "pass" } elseif ($firmwareType -eq "BIOS") { "info" } else { "unknown" }
            expected = "UEFI"
            actual = $firmwareType
            message = "Detected firmware boot mode."
        },
        [ordered]@{
            key = "secure_boot_ca_2023"
            label = "Secure Boot CA 2023 Deployment"
            status = if ($classification -eq "Updated") { "pass" } elseif ($classification -eq "Error") { "error" } elseif ($classification -in @("Pending", "NeedsReview")) { "warn" } elseif ($classification -eq "NotApplicable") { "info" } else { "unknown" }
            expected = "updated"
            actual = if ($uefiCaStatus) { [string]$uefiCaStatus } elseif ($latestEventId) { "event:$latestEventId" } else { "not-detected" }
            message = $reason
        }
    )
    facts = [ordered]@{
        os = $osCaption
        firmware = $firmwareType
        secureBootEnabled = $secureBootEnabled
        relevant = $relevant
        certificateUpdateNeeded = $certificateUpdateNeeded
        certificateUpdateState = $certificateUpdateState
        uefiCa2023Status = $uefiCaStatus
        uefiCa2023Error = $uefiCaError
        uefiCa2023ErrorEvent = $uefiCaErrorEvent
        availableUpdates = $availableUpdates
        secureBootUpdateTaskExists = $secureBootUpdateTaskExists
        latestTpmWmiEventId = $latestEventId
        latestTpmWmiEventTime = $latestEventTime
        secureBootCertificates = $secureBootCertificates
        relevantSecureBootCertificates = $relevantSecureBootCertificates
        earliestRelevantCertificateExpiry = $earliestRelevantCertificateExpiry
    }
    metadata = [ordered]@{
        classification = $classification
        campaign = "secure-boot-2026-relevance-check"
        checkedAtLocal = (Get-Date).ToString("s")
    }
}

$auditJson = $auditPayload | ConvertTo-Json -Compress -Depth 8

Write-Output "[QT-AUDIT]"
Write-Output $auditJson
