# PowerShell script to update version, zip extension, and create GitHub release

# Get current version from manifest.json
$manifestPath = "ninja-test-calculator/manifest.json"
$manifest = Get-Content $manifestPath | ConvertFrom-Json

# Increment patch version
$versionParts = $manifest.version -split '\.'
$versionParts[2] = [int]$versionParts[2] + 1
$newVersion = $versionParts -join '.'

# Update manifest.json
$manifest.version = $newVersion
$manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath

# Commit the version change
git add .
git commit -m "Bump version to $newVersion"
git push

# Zip the extension

# Zip the extension
$zipName = "ninja-test-calculator-v$newVersion.zip"
Compress-Archive -Path "ninja-test-calculator" -DestinationPath $zipName -Force

# Tag the new version in git
git tag v$newVersion
git push origin v$newVersion

# Create GitHub release and upload the zip using gh CLI
gh release create v$newVersion $zipName --title "Release v$newVersion" --notes "Automated release for version $newVersion"