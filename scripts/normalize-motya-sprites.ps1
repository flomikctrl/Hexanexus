# Deterministic raster normalization from the supplied archive; no redrawing.
param([string]$Archive = 'motya_9_skins(1).zip')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;using System.Drawing;using System.Collections.Generic;
public class MotyaRaster {
 public static Bitmap Clean(Bitmap b) {
  int w=b.Width,h=b.Height;bool[] seen=new bool[w*h];Bitmap clean=new Bitmap(w,h,System.Drawing.Imaging.PixelFormat.Format32bppArgb);
  for(int y=0;y<h;y++)for(int x=0;x<w;x++){int start=y*w+x;if(seen[start]||b.GetPixel(x,y).A==0)continue;
   var queue=new Queue<int>();var component=new List<int>();queue.Enqueue(start);seen[start]=true;
   while(queue.Count>0){int p=queue.Dequeue(),px=p%w,py=p/w;component.Add(p);
    for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++){int nx=px+dx,ny=py+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;int n=ny*w+nx;if(!seen[n]&&b.GetPixel(nx,ny).A>0){seen[n]=true;queue.Enqueue(n);}}
   }
   // Source-sheet fragments have at most 149 pixels. Shock accents have >590.
   if(component.Count>=200)foreach(int p in component)clean.SetPixel(p%w,p/w,b.GetPixel(p%w,p/w));
  }return clean;
 }
 public static Rectangle Bounds(Bitmap b){int l=b.Width,t=b.Height,r=-1,d=-1;for(int y=0;y<b.Height;y++)for(int x=0;x<b.Width;x++)if(b.GetPixel(x,y).A>0){l=Math.Min(l,x);t=Math.Min(t,y);r=Math.Max(r,x);d=Math.Max(d,y);}return Rectangle.FromLTRB(l,t,r+1,d+1);}
}
'@
$zip=[IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Archive))
try {
 foreach($pair in @(@('confectioner','baker'),@('winter','winter'),@('cosmic','cosmic'))) {
  $sprites=@(); $bounds=@()
  try {
   foreach($emotion in @('idle','sad','shock')) {
    $stream=$zip.GetEntry($pair[0]+'_'+$emotion+'.png').Open()
    try { $source=[Drawing.Bitmap]::FromStream($stream); $sprites+=,[MotyaRaster]::Clean($source); $source.Dispose() } finally { $stream.Dispose() }
    $bounds+=,[MotyaRaster]::Bounds($sprites[-1])
   }
   # Match classic/sleepy: 944px visible width on a 1024px transparent canvas,
   # centered at x=512, paws at y=999. One uniform scale for all three emotions.
   $scale=944.0/(($bounds | ForEach-Object Width | Measure-Object -Maximum).Maximum)
   for($i=0;$i -lt 3;$i++) {
    $b=$bounds[$i]; $canvas=New-Object Drawing.Bitmap 1024,1024; $g=[Drawing.Graphics]::FromImage($canvas)
    try {
     $g.Clear([Drawing.Color]::Transparent)
     $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
     $g.PixelOffsetMode=[Drawing.Drawing2D.PixelOffsetMode]::HighQuality
     $g.CompositingQuality=[Drawing.Drawing2D.CompositingQuality]::HighQuality
     $w=$b.Width*$scale; $h=$b.Height*$scale
     $dest=New-Object Drawing.RectangleF ([single]((1024-$w)/2)),([single](1000-$h)),([single]$w),([single]$h)
     $src=New-Object Drawing.RectangleF ([single]$b.X),([single]$b.Y),([single]$b.Width),([single]$b.Height)
     $g.DrawImage($sprites[$i],$dest,$src,[Drawing.GraphicsUnit]::Pixel)
     $emotion=@('idle','sad','shock')[$i]
     $canvas.Save("$PWD/public/assets/motya/$($pair[1])/$emotion.png",[Drawing.Imaging.ImageFormat]::Png)
    } finally { $g.Dispose();$canvas.Dispose() }
   }
  } finally { foreach($sprite in $sprites){$sprite.Dispose()} }
 }
} finally { $zip.Dispose() }
# Same-sized cells show the actual shared PNG coordinate system, including margins.
$sheet=New-Object Drawing.Bitmap 1100,810; $g=[Drawing.Graphics]::FromImage($sheet)
$font=New-Object Drawing.Font 'Segoe UI',11
try {
 $g.Clear([Drawing.ColorTranslator]::FromHtml('#142e33'))
 $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 $names=@('Classic','Sleepy','Confectioner','Winter','Cosmic'); $skins=@('classic','sleepy','baker','winter','cosmic')
 for($row=0;$row -lt 3;$row++){for($col=0;$col -lt 5;$col++){
  $emotion=@('idle','sad','shock')[$row];$x=$col*220;$y=$row*270
  $g.DrawString(($names[$col]+' / '+$emotion),$font,[Drawing.Brushes]::Beige,$x+10,$y+6)
  $g.DrawRectangle([Drawing.Pens]::DarkSlateGray,$x+10,$y+34,200,200)
  $g.DrawLine([Drawing.Pens]::DarkGoldenrod,$x+10,$y+229,$x+210,$y+229)
  $b=[Drawing.Bitmap]::FromFile("$PWD/public/assets/motya/$($skins[$col])/$emotion.png")
  try{$g.DrawImage($b,$x+10,$y+34,200,200)}finally{$b.Dispose()}
 }}
 New-Item -ItemType Directory -Force artifacts | Out-Null
 $sheet.Save("$PWD/artifacts/motya-scale-comparison.png",[Drawing.Imaging.ImageFormat]::Png)
} finally {$g.Dispose();$font.Dispose();$sheet.Dispose()}
