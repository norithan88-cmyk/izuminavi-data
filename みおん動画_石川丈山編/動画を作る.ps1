$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$work = Split-Path -Parent $MyInvocation.MyCommand.Path
$ffmpeg = Join-Path (Split-Path -Parent $work) 'ffmpeg.exe'
$output = Join-Path $work 'みおんの朗読_石川丈山_武から文へ_読み方修正版.mp4'

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
  @{ image='01_みおんと丈山苑.png'; title='みおんの朗読'; text='こんにちは。いずみなび初代AIアナウンサーの、みおんです。みおんの朗読を始めます。' },
  @{ image='01_みおんと丈山苑.png'; title='石川丈山 ― 武から文へ'; text='今回のお話は、いしかわ。じょうざん。武士の道を離れ、学問と風雅に生きた、和泉町ゆかりの人物です。' },
  @{ image='01_みおんと丈山苑.png'; title='三河・泉郷に生まれる'; text='石川丈山は、天正十一年、西暦一五八三年、三河国泉郷、今の安城市和泉町に生まれました。石川家は、代々徳川家に仕えた武士の家柄。丈山も若くして徳川家康に仕え、関ヶ原の戦いなどに従軍しました。' },
  @{ image='02_大坂夏の陣.png'; title='人生を変えた大坂夏の陣'; text='丈山の人生を大きく変えたのは、慶長二十年、西暦一六一五年の大坂夏の陣でした。武勇に優れた丈山は、先陣を禁じる軍令に背いて敵陣へ進み、功名を挙げます。しかし、軍令違反の責任は重く、論功行賞を受けることはできませんでした。' },
  @{ image='03_詩仙堂の丈山.png'; title='武から文へ'; text='丈山は武士の身分を離れ、京都の妙心寺に身を寄せます。そこで学問の道へ進み、儒学者の藤原惺窩に学びました。戦場で示した一途な力は、漢詩や書、庭づくりへと向けられていきます。' },
  @{ image='03_詩仙堂の丈山.png'; title='母を支えた十三年'; text='その後、年老いた母を支えるため浅野家に仕え、広島で十三年を過ごしました。母を見送ったのち、丈山は再び京都へ戻り、自らが本当に望む暮らしを選びます。' },
  @{ image='03_詩仙堂の丈山.png'; title='詩仙堂の誕生'; text='五十九歳のころ、京都、一乗寺に山荘、おうとつかを完成させました。後に詩仙堂と呼ばれる場所です。丈山は中国の詩人三十六人を選び、狩野探幽の肖像に、自ら隷書で漢詩を書きました。' },
  @{ image='03_詩仙堂の丈山.png'; title='風雅に生きる'; text='詩仙堂では、漢詩、書、庭づくり、煎茶を楽しみながら、およそ三十年を過ごしました。武功を追った若者は、静かな庭で学問と芸術を深める文人へと生まれ変わったのです。' },
  @{ image='01_みおんと丈山苑.png'; title='和泉町に残る丈山の世界'; text='寛文十二年、西暦一六七二年、丈山は九十年の生涯を閉じました。生誕地の安城市和泉町には、詩仙堂の趣を再現した丈山苑があり、その世界を今に伝えています。' },
  @{ image='01_みおんと丈山苑.png'; title='人生をつくり直す力'; text='一度選んだ道を離れることは、敗北ではありません。自分の力を新しい道へ生かし、人生をつくり直した石川丈山。その歩みは、四百年を越えた今も、私たちに静かな勇気を与えてくれます。以上、石川丈山、武から文へ、のお話でした。みおんの朗読、次回もどうぞお楽しみに。' }
)

function Wrap-Japanese([string]$text, [int]$length = 31) {
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

  # 表示字幕は漢字を保ち、読み上げ時だけ人名の誤読を防ぐ。
  $speechText = $items[$i].text.Replace('丈山苑', 'じょうざんえん').Replace('石川丈山', 'いしかわじょうざん').Replace('丈山', 'じょうざん')
  ConvertTo-AzureSpeech -Text $speechText -OutFile $wav

  $src = [System.Drawing.Image]::FromFile($source)
  $canvas = New-Object System.Drawing.Bitmap 1920,1080
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $scale = [Math]::Max(1920 / $src.Width, 1080 / $src.Height)
  $dw = [int]($src.Width * $scale); $dh = [int]($src.Height * $scale)
  $g.DrawImage($src, [int]((1920-$dw)/2), [int]((1080-$dh)/2), $dw, $dh)
  $topBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(165,10,31,48))
  $bottomBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(205,10,31,48))
  $g.FillRectangle($topBrush, 0, 0, 1920, 135)
  $g.FillRectangle($bottomBrush, 0, 745, 1920, 335)
  $titleFont = [System.Drawing.Font]::new('Yu Gothic UI',[single]42,[System.Drawing.FontStyle]::Bold)
  $bodyFont = [System.Drawing.Font]::new('Yu Gothic UI',[single]31,[System.Drawing.FontStyle]::Regular)
  $smallFont = [System.Drawing.Font]::new('Yu Gothic UI',[single]19,[System.Drawing.FontStyle]::Regular)
  $accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,247,200,89))
  $g.DrawString($items[$i].title,$titleFont,$accent,70,38)
  $caption = Wrap-Japanese $items[$i].text 31
  $captionRect = [System.Drawing.RectangleF]::new(70,785,1780,270)
  $g.DrawString($caption,$bodyFont,[System.Drawing.Brushes]::White,$captionRect)
  $g.DrawString('歴史場面はイメージ映像です',$smallFont,[System.Drawing.Brushes]::White,1540,45)
  $canvas.Save($slide,[System.Drawing.Imaging.ImageFormat]::Png)
  $smallFont.Dispose(); $titleFont.Dispose(); $bodyFont.Dispose(); $accent.Dispose(); $topBrush.Dispose(); $bottomBrush.Dispose(); $g.Dispose(); $canvas.Dispose(); $src.Dispose()

  & $ffmpeg -y -loglevel error -loop 1 -framerate 30 -i $slide -i $wav -vf "scale=1920:1080,format=yuv420p,fade=t=in:st=0:d=0.5" -c:v libx264 -preset medium -tune stillimage -c:a aac -b:a 192k -shortest -movflags +faststart $segment
  if ($LASTEXITCODE -ne 0) { throw "動画区間 $n の作成に失敗しました" }
  $concatLines.Add("file '$($segment.Replace("'","''"))'")
}

$concatFile = Join-Path $work 'concat.txt'
[System.IO.File]::WriteAllLines($concatFile,$concatLines,[System.Text.UTF8Encoding]::new($false))
& $ffmpeg -y -loglevel error -f concat -safe 0 -i $concatFile -c copy -movflags +faststart $output
if ($LASTEXITCODE -ne 0) { throw '最終動画の結合に失敗しました' }
Write-Output $output
