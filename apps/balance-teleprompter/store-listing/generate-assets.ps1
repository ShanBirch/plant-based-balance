Add-Type -AssemblyName System.Drawing

$assetDir = Join-Path $PSScriptRoot 'google-play-assets'
New-Item -ItemType Directory -Path $assetDir -Force | Out-Null

$cream = [System.Drawing.Color]::FromArgb(248, 245, 238)
$paper = [System.Drawing.Color]::FromArgb(242, 237, 226)
$ink = [System.Drawing.Color]::FromArgb(21, 21, 21)
$muted = [System.Drawing.Color]::FromArgb(111, 106, 97)
$gold = [System.Drawing.Color]::FromArgb(216, 178, 94)
$line = [System.Drawing.Color]::FromArgb(222, 215, 201)
$white = [System.Drawing.Color]::White

function New-Canvas([int]$width, [int]$height) {
  $bitmap = [System.Drawing.Bitmap]::new($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $graphics.Clear($cream)
  return @($bitmap, $graphics)
}

function Draw-RoundRect($graphics, $brush, [float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  $graphics.FillPath($brush, $path)
  $path.Dispose()
}

function Draw-CenteredText($graphics, $text, $font, $brush, [float]$x, [float]$y, [float]$width, [float]$height) {
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $graphics.DrawString($text, $font, $brush, [System.Drawing.RectangleF]::new($x, $y, $width, $height), $format)
  $format.Dispose()
}

function Draw-Phone($graphics, [string]$mode) {
  $blackBrush = [System.Drawing.SolidBrush]::new($ink)
  $goldBrush = [System.Drawing.SolidBrush]::new($gold)
  $whiteBrush = [System.Drawing.SolidBrush]::new($white)
  $paperBrush = [System.Drawing.SolidBrush]::new($paper)
  $mutedBrush = [System.Drawing.SolidBrush]::new($muted)
  $darkCamera = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(31, 35, 32))
  $softCamera = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(73, 88, 78))
  $small = [System.Drawing.Font]::new('Segoe UI Semibold', 21)
  $body = [System.Drawing.Font]::new('Segoe UI Semibold', 31)
  $scriptFont = [System.Drawing.Font]::new('Segoe UI Semibold', 42)

  Draw-RoundRect $graphics $blackBrush 120 430 840 1370 62
  Draw-RoundRect $graphics $paperBrush 138 448 804 1334 48
  Draw-RoundRect $graphics $darkCamera 156 530 768 720 34
  Draw-RoundRect $graphics $softCamera 156 530 768 720 34
  Draw-RoundRect $graphics $blackBrush 448 468 184 38 19

  Draw-CenteredText $graphics 'BALANCE' $small $blackBrush 165 570 160 46
  Draw-CenteredText $graphics '4K' $small $whiteBrush 780 568 82 46

  if ($mode -ne 'frame') {
    $overlay = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(178, 10, 12, 11))
    Draw-RoundRect $graphics $overlay 218 660 644 380 28
    if ($mode -eq 'slow') {
      Draw-CenteredText $graphics "Slow it down.`nStay relaxed.`nKeep eye contact." $scriptFont $whiteBrush 252 690 576 300
    } else {
      Draw-CenteredText $graphics "Your script stays`nright beside the lens,`nso you stay connected." $scriptFont $whiteBrush 252 690 576 300
    }
    $graphics.FillRectangle($goldBrush, 238, 838, 8, 88)
  } else {
    Draw-CenteredText $graphics 'Frame your shot first' $body $whiteBrush 245 760 590 70
  }

  Draw-RoundRect $graphics $whiteBrush 178 1284 724 390 30
  $graphics.DrawString('Scroll speed', $small, $mutedBrush, 220, 1324)
  $graphics.FillRectangle($paperBrush, 220, 1390, 620, 14)
  $graphics.FillRectangle($goldBrush, 220, 1390, $(if ($mode -eq 'slow') { 120 } else { 310 }), 14)
  $graphics.FillEllipse($blackBrush, $(if ($mode -eq 'slow') { 326 } else { 516 }), 1377, 40, 40)
  $graphics.DrawString($(if ($mode -eq 'slow') { '5' } else { '42' }), $body, $blackBrush, 790, 1324)
  Draw-RoundRect $graphics $blackBrush 220 1480 275 116 24
  Draw-CenteredText $graphics $(if ($mode -eq 'frame') { 'Show script' } else { 'Start prompt' }) $small $whiteBrush 220 1480 275 116
  $graphics.FillEllipse($goldBrush, 720, 1472, 124, 124)
  $graphics.FillEllipse($blackBrush, 752, 1504, 60, 60)

  foreach ($item in @($blackBrush,$goldBrush,$whiteBrush,$paperBrush,$mutedBrush,$darkCamera,$softCamera,$small,$body,$scriptFont)) { $item.Dispose() }
}

function New-Screenshot([string]$fileName, [string]$headline, [string]$subhead, [string]$mode) {
  $canvas = New-Canvas 1080 1920
  $bitmap = $canvas[0]
  $graphics = $canvas[1]
  $blackBrush = [System.Drawing.SolidBrush]::new($ink)
  $mutedBrush = [System.Drawing.SolidBrush]::new($muted)
  $goldBrush = [System.Drawing.SolidBrush]::new($gold)
  $headlineFont = [System.Drawing.Font]::new('Segoe UI Semibold', 62)
  $subheadFont = [System.Drawing.Font]::new('Segoe UI', 27)
  $labelFont = [System.Drawing.Font]::new('Segoe UI Semibold', 20)

  Draw-RoundRect $graphics $goldBrush 70 64 168 54 16
  Draw-CenteredText $graphics 'BALANCE' $labelFont $blackBrush 70 64 168 54
  Draw-CenteredText $graphics $headline $headlineFont $blackBrush 68 136 944 150
  Draw-CenteredText $graphics $subhead $subheadFont $mutedBrush 118 287 844 82
  Draw-Phone $graphics $mode

  $bitmap.Save((Join-Path $assetDir $fileName), [System.Drawing.Imaging.ImageFormat]::Png)
  foreach ($item in @($blackBrush,$mutedBrush,$goldBrush,$headlineFont,$subheadFont,$labelFont,$graphics,$bitmap)) { $item.Dispose() }
}

New-Screenshot '01-read-by-the-lens.png' 'Read by the lens' 'Sound prepared without looking scripted.' 'prompt'
New-Screenshot '02-frame-first.png' 'Frame it first' 'Hide the words until your shot looks right.' 'frame'
New-Screenshot '03-speed-control.png' 'Your pace, your way' 'Fine control from genuinely slow to super fast.' 'slow'
New-Screenshot '04-high-resolution.png' 'Record in high resolution' 'Choose 720p, Full HD or 4K when your phone supports it.' 'prompt'

$iconSource = [System.Drawing.Image]::FromFile((Join-Path $PSScriptRoot '..\public\icon.png'))
$icon = [System.Drawing.Bitmap]::new(512, 512)
$iconGraphics = [System.Drawing.Graphics]::FromImage($icon)
$iconGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$iconGraphics.DrawImage($iconSource, 0, 0, 512, 512)
$icon.Save((Join-Path $assetDir 'app-icon-512.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$iconGraphics.Dispose(); $icon.Dispose(); $iconSource.Dispose()

$feature = New-Canvas 1024 500
$featureBitmap = $feature[0]
$featureGraphics = $feature[1]
$blackBrush = [System.Drawing.SolidBrush]::new($ink)
$goldBrush = [System.Drawing.SolidBrush]::new($gold)
$mutedBrush = [System.Drawing.SolidBrush]::new($muted)
$whiteBrush = [System.Drawing.SolidBrush]::new($white)
$logo = [System.Drawing.Image]::FromFile((Join-Path $PSScriptRoot '..\public\balance-logo.png'))
$headlineFont = [System.Drawing.Font]::new('Segoe UI Semibold', 48)
$subheadFont = [System.Drawing.Font]::new('Segoe UI', 23)
$labelFont = [System.Drawing.Font]::new('Segoe UI Semibold', 17)

$featureGraphics.DrawImage($logo, 62, 66, 140, 140)
Draw-RoundRect $featureGraphics $goldBrush 246 64 148 48 14
Draw-CenteredText $featureGraphics 'BALANCE' $labelFont $blackBrush 246 64 148 48
$featureGraphics.DrawString("Speak naturally.`nStay connected.", $headlineFont, $blackBrush, 242, 126)
$featureGraphics.DrawString("A teleprompter and high-resolution camera`nmade for confident videos.", $subheadFont, $mutedBrush, 248, 288)
Draw-RoundRect $featureGraphics $blackBrush 770 44 190 412 34
Draw-RoundRect $featureGraphics $whiteBrush 780 54 170 392 28
Draw-RoundRect $featureGraphics $blackBrush 792 98 146 204 18
Draw-CenteredText $featureGraphics "Your script`nby the lens" $labelFont $whiteBrush 802 136 126 104
$featureGraphics.FillEllipse($goldBrush, 832, 332, 70, 70)

$featureBitmap.Save((Join-Path $assetDir 'feature-graphic-1024x500.png'), [System.Drawing.Imaging.ImageFormat]::Png)
foreach ($item in @($blackBrush,$goldBrush,$mutedBrush,$whiteBrush,$logo,$headlineFont,$subheadFont,$labelFont,$featureGraphics,$featureBitmap)) { $item.Dispose() }
