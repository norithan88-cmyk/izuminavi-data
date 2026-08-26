$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$work = Split-Path -Parent $MyInvocation.MyCommand.Path
$ffmpeg = Join-Path (Split-Path -Parent $work) 'ffmpeg.exe'
$output = Join-Path $work 'みおんの朗読_都築弥厚と明治用水.mp4'

$azureRegion = if ($env:AZURE_SPEECH_REGION) { $env:AZURE_SPEECH_REGION } else { 'japaneast' }
$azureKey = $env:AZURE_SPEECH_KEY
if (-not $azureKey) { throw '環境変数 AZURE_SPEECH_KEY が設定されていません。' }
$azureToken = Invoke-RestMethod -Method Post -Uri "https://$azureRegion.api.cognitive.microsoft.com/sts/v1.0/issuetoken" -Headers @{ 'Ocp-Apim-Subscription-Key' = $azureKey }

function ConvertTo-AzureSpeech([string]$Text, [string]$OutFile) {
  $escaped = [System.Security.SecurityElement]::Escape($Text)
  $ssml = "<speak version='1.0' xml:lang='ja-JP' xmlns:mstts='http://www.w3.org/2001/mstts'><voice name='ja-JP-NanamiNeural'><mstts:express-as style='cheerful'>$escaped</mstts:express-as></voice></speak>"
  Invoke-WebRequest -Method Post -Uri "https://$azureRegion.tts.speech.microsoft.com/cognitiveservices/v1" -Headers @{ 'Authorization' = "Bearer $azureToken"; 'Content-Type' = 'application/ssml+xml'; 'X-Microsoft-OutputFormat' = 'riff-24khz-16bit-mono-pcm'; 'User-Agent' = 'izuminavi-video/1.0' } -Body ([System.Text.Encoding]::UTF8.GetBytes($ssml)) -OutFile $OutFile
}

$items = @(
  @{ image='01_みおんと明治用水.png'; title='みおんの朗読'; text='こんにちは。いずみなび初代AIアナウンサーの、みおんです。みおんの朗読を始めます。' },
  @{ image='01_みおんと明治用水.png'; title='都築弥厚と明治用水'; text='今回のお話は、つづきやこうと明治用水です。' },
  @{ image='02_弥厚の測量イメージ.png'; title='大きな夢'; text='江戸時代の終わりごろ、つづきやこうは、矢作川の水を台地へ引き、乾いた土地を豊かな田畑に変えるという大きな計画を描きました。' },
  @{ image='02_弥厚の測量イメージ.png'; title='困難を越えて'; text='測量を重ね、人々に計画を説き続けましたが、その道のりは平らではありませんでした。誤解や反対にも苦しみながら、やこうは夢の実現に力を尽くしました。' },
  @{ image='02_弥厚の測量イメージ.png'; title='完成を見ずに'; text='しかし、やこうは、用水の完成を見ることなく、この世を去ります。その志は後の人々へ受け継がれ、明治十三年、明治用水は通水しました。' },
  @{ image='03_明治用水の恵み.png'; title='今も流れる夢'; text='やこうが夢見た水は大地を潤し、西三河の農業と暮らしを支え続けています。ひとりの夢が、時代を越えて地域の力になったのです。' },
  @{ image='01_みおんと明治用水.png'; title='次回予告'; text='武士を捨て、詩人として生きた、いしかわじょうざん。しかし、その隠居生活には、幕府の密命が隠されていたという説もあります。次回、石川丈山、本当はスパイ？　乞うご期待。' }
)

function Wrap-Japanese([string]$text, [int]$length = 32) {
  $lines = New-Object System.Collections.Generic.List[string]
  for ($i = 0; $i -lt $text.Length; $i += $length) {
    $lines.Add($text.Substring($i, [Math]::Min($length, $text.Length - $i)))
  }
  return ($lines -join "`n")
}

$concatLines = New-Object System.Collections.Generic.List[string]
for ($i = 0; $i -lt $items.Count; $i++) {
  $n = '{0:D2}' -f ($i + 1)
  $wav = Join-Path $work "$n.wav"
  $slide = Join-Path $work "$n.png"
  $segment = Join-Path $work "$n.mp4"
  $source = Join-Path $work $items[$i].image

  ConvertTo-AzureSpeech -Text $items[$i].text -OutFile $wav

  $src = [System.Drawing.Image]::FromFile($source)
  $canvas = New-Object System.Drawing.Bitmap 1920,1080
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $scale = [Math]::Max(1920 / $src.Width, 1080 / $src.Height)
  $dw = [int]($src.Width * $scale); $dh = [int]($src.Height * $scale)
  $g.DrawImage($src, [int]((1920-$dw)/2), [int]((1080-$dh)/2), $dw, $dh)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(155,10,31,48))), 0, 0, 1920, 135)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(190,10,31,48))), 0, 760, 1920, 320)
  $titleFont = [System.Drawing.Font]::new('Yu Gothic UI',[single]42,[System.Drawing.FontStyle]::Bold)
  $bodyFont = [System.Drawing.Font]::new('Yu Gothic UI',[single]32,[System.Drawing.FontStyle]::Regular)
  $white = [System.Drawing.Brushes]::White
  $accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,247,200,89))
  $g.DrawString($items[$i].title,$titleFont,$accent,70,38)
  $caption = Wrap-Japanese $items[$i].text 31
  $captionRect = [System.Drawing.RectangleF]::new(70,800,1780,240)
  $g.DrawString($caption,$bodyFont,$white,$captionRect)
  $smallFont = [System.Drawing.Font]::new('Yu Gothic UI',[single]19,[System.Drawing.FontStyle]::Regular)
  $g.DrawString('歴史場面はイメージ映像です',$smallFont,$white,1540,45)
  $canvas.Save($slide,[System.Drawing.Imaging.ImageFormat]::Png)
  $smallFont.Dispose(); $titleFont.Dispose(); $bodyFont.Dispose(); $accent.Dispose(); $g.Dispose(); $canvas.Dispose(); $src.Dispose()

  & $ffmpeg -y -loglevel error -loop 1 -framerate 30 -i $slide -i $wav -vf "scale=1920:1080,format=yuv420p,fade=t=in:st=0:d=0.5,fade=t=out:st=9999:d=0.1" -c:v libx264 -preset medium -tune stillimage -c:a aac -b:a 192k -shortest -movflags +faststart $segment
  if ($LASTEXITCODE -ne 0) { throw "動画区間 $n の作成に失敗しました" }
  $concatLines.Add("file '$($segment.Replace("'","''"))'")
}

$concatFile = Join-Path $work 'concat.txt'
[System.IO.File]::WriteAllLines($concatFile,$concatLines,[System.Text.UTF8Encoding]::new($false))
& $ffmpeg -y -loglevel error -f concat -safe 0 -i $concatFile -c copy -movflags +faststart $output
if ($LASTEXITCODE -ne 0) { throw '最終動画の結合に失敗しました' }
Write-Output $output
